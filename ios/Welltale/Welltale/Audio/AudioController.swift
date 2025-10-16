import AVFoundation
import SwiftUI
import Foundation
import Speech

enum SpeechCaptureStopReason: Hashable {
    case user
    case maxDuration
    case autoStop
    case error
    case external
}

enum SpeechCaptureEvent: Hashable {
    case started
    case stopped
    case segmentRestarted
    case transcriptUpdated
    case stopRequest
}

struct SpeechCaptureConfig {
    let lineGapMs: Int
    let maxDurationMs: Int
    let segmentDurationMs: Int
    let segmentCharacterLimit: Int
    let autoStopAfterMs: Int
    static let `default` = SpeechCaptureConfig(
        lineGapMs: 3000,
        maxDurationMs: 600000,
        segmentDurationMs: 120000,
        segmentCharacterLimit: 4000,
        autoStopAfterMs: 0
    )
}

struct SpeechCaptureLine: Identifiable, Equatable {
    let id: UUID
    var text: String
    var updatedAt: Date
}

final class SpeechCaptureEmitter: EventEmitter<SpeechCaptureEvent> {}

@MainActor
final class SpeechCaptureController: ObservableObject {
    @Published private(set) var lines: [SpeechCaptureLine] = []
    @Published private(set) var isRecording = false
    let emitter = SpeechCaptureEmitter()
    var accumulatedText: String {
        lines.map { $0.text }.joined(separator: "\n")
    }
    var stopReason: SpeechCaptureStopReason? {
        lastStopReason
    }
    var stopWord: String? {
        lastStopWord
    }

    private let locale: LangLocale
    private let config: SpeechCaptureConfig
    private let recognizer: SpeechRecognizer
    private let audioSession = AVAudioSession.sharedInstance()
    private var recognitionId: UUID?
    private var sessionStart: Date?
    private var segmentStart: Date?
    private var lastResultDate: Date?
    private var currentLineId: UUID?
    private var lastStopReason: SpeechCaptureStopReason?
    private var lastStopWord: String?
    private var maxDurationTask: Task<Void, Never>?
    private var autoStopTask: Task<Void, Never>?
    private var segmentTimerTask: Task<Void, Never>?
    private var segmentBaselineLength = 0
    private lazy var handler: SpeechRecognizer.SpeechRecognitionCallback = { [weak self] transcripts, isFinal, _ in
        Task { @MainActor in
            self?.handle(transcripts: transcripts, isFinal: isFinal)
        }
    }

    init(locale: LangLocale, config: SpeechCaptureConfig, recognizer: SpeechRecognizer = SpeechRecognizer()) {
        self.locale = locale
        self.config = config
        self.recognizer = recognizer
        emitter.on(.stopRequest) { [weak self] in
            Task { @MainActor [weak self] in
                self?.stop(reason: .external)
            }
        }
    }

    deinit {
        cancelTasks()
    }

    func start() async {
        if isRecording {
            return
        }
        cancelTasks()
        guard await ensurePermissions() else {
            recordFailure()
            return
        }
        clearState(keepLines: false)
        do {
            try configureSession()
            try recognizer.startStream()
            try startSegment()
            isRecording = true
            emitter.emit(.started)
            scheduleMaxDuration()
            scheduleAutoStop()
        } catch {
            cleanupAfterFailure()
            recordFailure()
        }
    }

    func stop(reason: SpeechCaptureStopReason = .user, sourceWord: String? = nil) {
        if !isRecording {
            lastStopReason = reason
            lastStopWord = sourceWord
            return
        }
        cancelTasks()
        if let id = recognitionId {
            recognizer.stopContinuous(id)
        }
        recognizer.stopStream()
        isRecording = false
        lastStopReason = reason
        lastStopWord = sourceWord
        try? audioSession.setActive(false, options: .notifyOthersOnDeactivation)
        clearState(keepLines: true)
        emitTranscript()
        emitter.emit(.stopped)
    }

    func toggle() {
        if isRecording {
            stop(reason: .user)
        } else {
            Task {
                await start()
            }
        }
    }

    func restartSegment() {
        guard isRecording else {
            return
        }
        if let id = recognitionId {
            recognizer.stopContinuous(id)
        }
        do {
            try startSegment()
            emitter.emit(.segmentRestarted)
        } catch {
            stop(reason: .error)
        }
    }

    private func clearState(keepLines: Bool) {
        if !keepLines {
            lines = []
            lastStopReason = nil
            lastStopWord = nil
        }
        recognitionId = nil
        sessionStart = nil
        segmentStart = nil
        lastResultDate = nil
        currentLineId = nil
        segmentBaselineLength = 0
    }

    private func ensurePermissions() async -> Bool {
        let speechGranted = await withCheckedContinuation { continuation in
            SpeechRecognizer.requestAuthorization { status in
                continuation.resume(returning: status == .authorized)
            }
        }
        let audioGranted = await withCheckedContinuation { continuation in
            audioSession.requestRecordPermission { granted in
                continuation.resume(returning: granted)
            }
        }
        return speechGranted && audioGranted
    }

    private func configureSession() throws {
        let options: AVAudioSession.CategoryOptions = [.allowBluetooth, .allowBluetoothA2DP, .allowAirPlay, .mixWithOthers, .defaultToSpeaker]
        if #available(iOS 11.0, *) {
            try audioSession.setCategory(.playAndRecord, mode: .voiceChat, policy: .longFormAudio, options: options)
        } else {
            try audioSession.setCategory(.playAndRecord, mode: .voiceChat, options: options)
        }
        try audioSession.setActive(true)
    }

    private func startSegment() throws {
        if recognitionId == nil {
            sessionStart = Date()
        }
        segmentStart = Date()
        segmentBaselineLength = totalCharacterCount()
        if lines.isEmpty {
            startNewLine(at: Date())
        }
        recognitionId = try recognizer.startContinuous(locale, callback: handler)
        scheduleSegmentTimer()
    }

    private func handle(transcripts: [String], isFinal: Bool) {
        guard isRecording else {
            return
        }
        guard let best = transcripts.first else {
            return
        }
        let now = Date()
        if shouldStartNewLine(at: now) {
            startNewLine(at: now)
        }
        lastResultDate = now
        updateCurrentLine(with: best, at: now)
        emitTranscript()
        if exceededSegmentLimit(now: now) {
            restartSegment()
            return
        }
    }

    private func shouldStartNewLine(at date: Date) -> Bool {
        guard let last = lastResultDate else {
            return lines.isEmpty
        }
        let delta = date.timeIntervalSince(last) * 1000
        return delta >= Double(config.lineGapMs)
    }

    private func startNewLine(at date: Date) {
        let line = SpeechCaptureLine(id: UUID(), text: "", updatedAt: date)
        lines.append(line)
        currentLineId = line.id
    }

    private func updateCurrentLine(with text: String, at date: Date) {
        if currentLineId == nil || !lines.contains(where: { $0.id == currentLineId }) {
            startNewLine(at: date)
        }
        guard let id = currentLineId, let index = lines.firstIndex(where: { $0.id == id }) else {
            return
        }
        var line = lines[index]
        line.text = text
        line.updatedAt = date
        lines[index] = line
    }

    private func scheduleMaxDuration() {
        schedule(task: &maxDurationTask, delayMs: config.maxDurationMs) { controller in
            controller.stop(reason: .maxDuration)
        }
    }

    private func scheduleAutoStop() {
        schedule(task: &autoStopTask, delayMs: config.autoStopAfterMs) { controller in
            controller.stop(reason: .autoStop)
        }
    }

    private func scheduleSegmentTimer() {
        schedule(task: &segmentTimerTask, delayMs: config.segmentDurationMs) { controller in
            controller.restartSegment()
        }
    }

    private func cancelTasks() {
        maxDurationTask?.cancel()
        autoStopTask?.cancel()
        segmentTimerTask?.cancel()
        maxDurationTask = nil
        autoStopTask = nil
        segmentTimerTask = nil
    }

    private func totalCharacterCount() -> Int {
        lines.reduce(0) { result, line in
            result + line.text.count
        }
    }

    private func recordFailure() {
        lastStopReason = .error
        emitter.emit(.stopped)
    }

    private func cleanupAfterFailure() {
        recognizer.stopStream()
        try? audioSession.setActive(false, options: .notifyOthersOnDeactivation)
    }

    private func schedule(task: inout Task<Void, Never>?, delayMs: Int, action: @escaping (SpeechCaptureController) -> Void) {
        task?.cancel()
        guard delayMs > 0 else {
            task = nil
            return
        }
        task = Task { [weak self] in
            try? await Task.sleep(nanoseconds: UInt64(delayMs) * 1_000_000)
            if Task.isCancelled {
                return
            }
            await MainActor.run {
                guard let self, self.isRecording else {
                    return
                }
                action(self)
            }
        }
    }

    private func exceededSegmentLimit(now: Date) -> Bool {
        if config.segmentCharacterLimit > 0 {
            let current = totalCharacterCount() - segmentBaselineLength
            if current >= config.segmentCharacterLimit {
                return true
            }
        }
        if let start = segmentStart, config.segmentDurationMs > 0 {
            let elapsed = now.timeIntervalSince(start) * 1000
            if elapsed >= Double(config.segmentDurationMs) {
                return true
            }
        }
        return false
    }

    private func emitTranscript() {
        emitter.emit(.transcriptUpdated)
    }
}

class SpeechRecognizer: NSObject, SFSpeechRecognizerDelegate {
    private var bus = 0
    private var size: UInt32 = 1024
    private var engine = AVAudioEngine()
    private var requests: [UUID: SFSpeechAudioBufferRecognitionRequest] = [:]
    private var tasks: [UUID: SFSpeechRecognitionTask] = [:]
    private var streaming = false

    typealias SpeechRecognitionCallback = (_ transcripts: [String], _ isFinal: Bool, _ locale: LangLocale) -> Void

    static func requestAuthorization(completion: @escaping (SFSpeechRecognizerAuthorizationStatus) -> Void) {
        SFSpeechRecognizer.requestAuthorization { status in
            completion(status)
        }
    }

    func stopStream() {
        engine.stop()
        engine.inputNode.removeTap(onBus: bus)
        detach()
        streaming = false
    }

    func startStream() throws {
        if streaming {
            return
        }
        engine.inputNode.removeTap(onBus: bus)
        engine.inputNode.installTap(
            onBus: bus,
            bufferSize: size,
            format: engine.inputNode.outputFormat(forBus: bus)
        ) { buffer, _ in
            self.requests.forEach { _, request in
                request.append(buffer)
            }
        }
        engine.prepare()
        try engine.start()
        streaming = true
    }

    func detach() {
        let ids = Array(requests.keys)
        ids.forEach { id in
            finish(id: id, stopEngine: false)
        }
    }

    func attach(_ ll: LangLocale, callback: @escaping SpeechRecognitionCallback) throws {
        let id = UUID()
        try attachInternal(id: id, ll: ll, stopEngine: true, callback: callback)
    }

    func startContinuous(_ ll: LangLocale, callback: @escaping SpeechRecognitionCallback) throws -> UUID {
        let id = UUID()
        try attachInternal(id: id, ll: ll, stopEngine: false, callback: callback)
        return id
    }

    func stopContinuous(_ id: UUID) {
        finish(id: id, stopEngine: false)
    }

    private func attachInternal(id: UUID, ll: LangLocale, stopEngine: Bool, callback: @escaping SpeechRecognitionCallback) throws {
        let identifier = langLocaleToString(ll)
        let locale = Locale(identifier: identifier)
        guard let recognizer = SFSpeechRecognizer(locale: locale) else {
            return
        }
        recognizer.defaultTaskHint = .dictation
        let request = SFSpeechAudioBufferRecognitionRequest()
        request.shouldReportPartialResults = true
        requests[id] = request
        let task = recognizer.recognitionTask(with: request) { result, error in
            if self.requests[id] == nil {
                return
            }
            if let result = result {
                let bestString = result.bestTranscription.formattedString
                let alternatives = result.transcriptions.map { $0.formattedString }
                callback(Array(Set([bestString] + alternatives)), result.isFinal, ll)
            }
            if error != nil || (result?.isFinal ?? false) {
                DispatchQueue.main.async {
                    self.finish(id: id, stopEngine: stopEngine)
                }
            }
        }
        tasks[id] = task
    }

    private func finish(id: UUID, stopEngine: Bool) {
        guard requests[id] != nil else {
            return
        }
        requests[id]?.endAudio()
        requests[id] = nil
        tasks[id]?.cancel()
        tasks[id] = nil
        if stopEngine {
            engine.stop()
            engine.inputNode.removeTap(onBus: bus)
            streaming = false
        }
    }
}

@MainActor
final class AudioPlayer {
    private var players: [UUID: AVPlayer] = [:]
    private var completions: [UUID: (Result<Void, Error>) -> Void] = [:]
    private var observers: [UUID: [NSObjectProtocol]] = [:]

    func pausePlayback() {
        let ids = Array(players.keys)
        for id in ids {
            if let player = players[id] {
                player.pause()
            }
            complete(id: id, result: .success(()))
        }
    }

    func playAudioFromURL(_ urlString: String, volume: Float) async throws {
        guard let url = URL(string: urlString) else {
            throw NSError(domain: "AudioPlayer", code: 0, userInfo: [NSLocalizedDescriptionKey: "Failed to load audio URL"])
        }

        let id = UUID()
        let player = AVPlayer(url: url)
        player.volume = volume
        configurePlayer(player)
        players[id] = player
        observe(player: player, id: id)
        player.play()

        return try await withCheckedThrowingContinuation { continuation in
            completions[id] = continuation.resume
        }
    }

    func playAudioFromResource(_ name: String, _ ext: String, volume: Float) async throws {
        guard let url = Bundle.main.url(
            forResource: name,
            withExtension: ext
        ) else {
            print("Failed to load audio resource")
            return
        }

        let id = UUID()
        let player = AVPlayer(url: url)
        player.volume = volume
        configurePlayer(player)
        players[id] = player
        observe(player: player, id: id)
        player.play()

        return try await withCheckedThrowingContinuation { continuation in
            completions[id] = continuation.resume
        }
    }

    func play(_ uri: String, volume: Float = 1.0) async {
        var parts = uri.split(separator: ".").map(String.init)
        guard let format = parts.popLast() else {
            return
        }
        print("[play]", uri)
        if isWebUrl(uri) {
            try? await playAudioFromURL(uri, volume: volume)
        } else {
            try? await playAudioFromResource(parts.joined(separator: "."), format, volume: volume)
        }
    }

    private func configurePlayer(_ player: AVPlayer) {
        player.automaticallyWaitsToMinimizeStalling = true
        player.allowsExternalPlayback = true
    }

    private func observe(player: AVPlayer, id: UUID) {
        var tokens: [NSObjectProtocol] = []
        if let item = player.currentItem {
            let endToken = NotificationCenter.default.addObserver(forName: .AVPlayerItemDidPlayToEndTime, object: item, queue: .main) { [weak self] _ in
                self?.complete(id: id, result: .success(()))
            }
            tokens.append(endToken)

            let failToken = NotificationCenter.default.addObserver(forName: .AVPlayerItemFailedToPlayToEndTime, object: item, queue: .main) { [weak self] notification in
                let error = notification.userInfo?[AVPlayerItemFailedToPlayToEndTimeErrorKey] as? Error
                let fallback = NSError(domain: "AudioPlayer", code: 1, userInfo: [NSLocalizedDescriptionKey: "Playback failed"])
                self?.complete(id: id, result: .failure(error ?? fallback))
            }
            tokens.append(failToken)

            let stallToken = NotificationCenter.default.addObserver(forName: .AVPlayerItemPlaybackStalled, object: item, queue: .main) { _ in
                player.play()
            }
            tokens.append(stallToken)
        }
        observers[id] = tokens
    }

    private func complete(id: UUID, result: Result<Void, Error>) {
        guard let completion = completions[id] else {
            cleanupPlayer(id: id)
            return
        }
        completions[id] = nil
        cleanupPlayer(id: id)
        completion(result)
    }

    private func cleanupPlayer(id: UUID) {
        observers[id]?.forEach { NotificationCenter.default.removeObserver($0) }
        observers[id] = nil
        players[id] = nil
    }
}

@MainActor
final class AudioController: ObservableObject {
    private let player = AudioPlayer()
    private let audioSession = AVAudioSession.sharedInstance()
    private var recognizer: SpeechRecognizer? = nil
    public var emitter = AudioControllerEmitter()
    private var stopped = false
    private var finished = false
    public var listening = false
    public var playing: Bool {
        !stopped && !finished
    }

    private func getRecognizer() -> SpeechRecognizer {
        if recognizer == nil {
            recognizer = SpeechRecognizer()
        }
        return recognizer!
    }

    func prepare(mode: ChallengeMode) async throws {
        let options: AVAudioSession.CategoryOptions = [.allowBluetooth, .allowBluetoothA2DP, .allowAirPlay, .mixWithOthers, .defaultToSpeaker]
        if #available(iOS 11.0, *) {
            try audioSession.setCategory(.playAndRecord, mode: .voiceChat, policy: .longFormAudio, options: options)
        } else {
            try audioSession.setCategory(.playAndRecord, mode: .voiceChat, options: options)
        }
        try audioSession.setActive(true)
        stopped = false
        finished = false
        listening = false
        try getRecognizer().startStream()
    }

    func interrupt() {
        listening = false
        recognizer?.detach()
        player.pausePlayback()
    }

    func teardown(mode: ChallengeMode) {
        recognizer?.stopStream()
        recognizer = nil
        listening = false
        stopped = false
        finished = false
        player.pausePlayback()
        do {
            try audioSession.setActive(false, options: .notifyOthersOnDeactivation)
        } catch {
            print("Audio session deactivation failed", error)
        }
    }

    func stop(mode: ChallengeMode) {
        if stopped {
            return
        }
        stopped = true
        listening = false
        recognizer?.detach()
    }

    func emit(_ event: GameSignal) {
        emitter.emit(event)
    }

    typealias SpeechRecognizedHook = (LangLocale, [String]) -> Void
    typealias SpeechBeforeAttachHook = (LangLocale) -> Void

    func start(
        ll: LangLocale,
        onSpeechRecognized: @escaping SpeechRecognizedHook,
        onBeforeAttach: @escaping SpeechBeforeAttachHook
     ) async -> (Float, String) {
        let started: Int = unixNow()
        if stopped {
            return (0, "stopped")
        }

        print("[start]", started)

        return await withCheckedContinuation { continuation in
            finished = false
            @Sendable func finish(_ score: Float, _ result: String) {
                print("[finish]", finished, score, result)
                if finished {
                    return
                }
                finished = true
                listening = false
                interrupt()
                continuation.resume(returning: (score, result))
            }

            onBeforeAttach(ll)
            listening = true

            do {
                try getRecognizer().attach(ll) { transcripts, isFinal, locale in
                    print("[recog]", locale, isFinal, self.stopped)
                    if self.stopped {
                        self.recognizer?.detach()
                        return
                    }
                    onSpeechRecognized(locale, transcripts)
                }
            } catch {
                print("[error]", error)
                listening = false
                continuation.resume(returning: (0, "error"))
            }
        }
    }
}

class AudioControllerEmitter: EventEmitter<GameSignal> {}

class EventEmitter<Event: Hashable> {
    private var listeners: [Event: [(once: Bool, callback: () -> Void)]] = [:]
    
    func on(_ event: Event, _ callback: @escaping () -> Void) {
        if listeners[event] == nil {
            listeners[event] = []
        }
        listeners[event]?.append((once: false, callback: callback))
    }
    
    func once(_ event: Event, _ callback: @escaping () -> Void) {
        if listeners[event] == nil {
            listeners[event] = []
        }
        listeners[event]?.append((once: true, callback: callback))
    }
    
    func emit(_ event: Event) {
        listeners[event]?.forEach { _, callback in
            callback()
        }
        listeners[event] = listeners[event]?.filter { !$0.once }
    }
    
    func removeAllListeners(_ event: Event) {
        listeners[event] = []
    }
    
    func removeAllListeners() {
        listeners = [:]
    }
}
