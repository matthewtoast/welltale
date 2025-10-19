import AVFoundation
import AVFAudio
import Combine
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

    var lineGapMs: Int {
        config.lineGapMs
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
    private var transcriptBuffer = ""

    private lazy var handler: SpeechRecognizer.SpeechRecognitionCallback = { [weak self] transcripts, isFinal, _ in
        Task { @MainActor in
            self?.handle(transcripts: transcripts, isFinal: isFinal)
        }
    }

    init(locale: LangLocale, config: SpeechCaptureConfig, recognizer: SpeechRecognizer? = nil) {
        self.locale = locale
        self.config = config
        self.recognizer = recognizer ?? SpeechRecognizer()
        emitter.on(.stopRequest) { [weak self] in
            Task { @MainActor [weak self] in
                self?.stop(reason: .external)
            }
        }
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

    func preparePermissions() async {
        _ = await ensurePermissions()
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
            transcriptBuffer = ""
        } else {
            transcriptBuffer = accumulatedText
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
            if #available(iOS 17, *) {
                AVAudioApplication.requestRecordPermission { granted in
                    continuation.resume(returning: granted)
                }
            } else {
                audioSession.requestRecordPermission { granted in
                    continuation.resume(returning: granted)
                }
            }
        }
        return speechGranted && audioGranted
    }

    private func configureSession() throws {
        let options: AVAudioSession.CategoryOptions = [
            .allowBluetoothA2DP,
            .allowAirPlay,
            .duckOthers,
            .mixWithOthers,
            .defaultToSpeaker,
        ]
        try audioSession.setCategory(
            .playAndRecord,
            mode: .voiceChat,
            options: options
        )
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
        guard isRecording, let best = transcripts.first else {
            return
        }
        let now = Date()
        if shouldStartNewLine(at: now) {
            startNewLine(at: now)
        }
        applyTranscriptDiff(best, at: now)
        lastResultDate = now
        emitTranscript()
        if exceededSegmentLimit(now: now) {
            restartSegment()
        }
        if isFinal && config.autoStopAfterMs > 0 {
            stop(reason: .autoStop)
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

    private func applyTranscriptDiff(_ text: String, at date: Date) {
        let previous = transcriptBuffer
        if text == previous {
            return
        }
        let prefix = previous.commonPrefix(with: text)
        let removed = previous.count - prefix.count
        if removed > 0 {
            removeCharactersFromLines(removed, at: date)
        }
        let appended = String(text.dropFirst(prefix.count))
        if !appended.isEmpty {
            appendToCurrentLine(appended, at: date)
        }
        transcriptBuffer = text
    }

    private func removeCharactersFromLines(_ count: Int, at date: Date) {
        var remaining = count
        while remaining > 0 && !lines.isEmpty {
            let lastIndex = lines.count - 1
            var line = lines[lastIndex]
            if line.text.isEmpty {
                if lines.count > 1 {
                    lines.removeLast()
                } else {
                    break
                }
                continue
            }
            let toRemove = min(remaining, line.text.count)
            let endIndex = line.text.index(line.text.endIndex, offsetBy: -toRemove)
            line.text = String(line.text[..<endIndex])
            line.updatedAt = date
            lines[lastIndex] = line
            remaining -= toRemove
            if line.text.isEmpty && lines.count > 1 {
                lines.removeLast()
            }
        }
        if lines.isEmpty {
            startNewLine(at: date)
        }
        currentLineId = lines.last?.id
    }

    private func appendToCurrentLine(_ text: String, at date: Date) {
        if currentLineId == nil || !lines.contains(where: { $0.id == currentLineId }) {
            startNewLine(at: date)
        }
        guard let id = currentLineId,
              let index = lines.firstIndex(where: { $0.id == id }) else {
            return
        }
        var line = lines[index]
        line.text += text
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

    private func schedule(
        task: inout Task<Void, Never>?,
        delayMs: Int,
        action: @escaping (SpeechCaptureController) -> Void
    ) {
        task?.cancel()
        guard delayMs > 0 else {
            task = nil
            return
        }
        task = Task { [weak self] in
            try? await Task.sleep(nanoseconds: UInt64(delayMs) * 1_000_000)
            guard !Task.isCancelled else {
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

    private func cancelTasks() {
        maxDurationTask?.cancel()
        autoStopTask?.cancel()
        segmentTimerTask?.cancel()
        maxDurationTask = nil
        autoStopTask = nil
        segmentTimerTask = nil
    }

    private func totalCharacterCount() -> Int {
        lines.reduce(into: 0) { result, line in
            result += line.text.count
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

    private func recordFailure() {
        lastStopReason = .error
        emitter.emit(.stopped)
    }

    private func cleanupAfterFailure() {
        recognizer.stopStream()
        try? audioSession.setActive(false, options: .notifyOthersOnDeactivation)
    }

    private func emitTranscript() {
        emitter.emit(.transcriptUpdated)
    }
}

final class SpeechRecognizer: NSObject, SFSpeechRecognizerDelegate {
    private var bus = 0
    private var size: UInt32 = 1024
    private var engine = AVAudioEngine()
    private var requests: [UUID: SFSpeechAudioBufferRecognitionRequest] = [:]
    private var tasks: [UUID: SFSpeechRecognitionTask] = [:]
    private var streaming = false

    typealias SpeechRecognitionCallback = (
        _ transcripts: [String],
        _ isFinal: Bool,
        _ locale: LangLocale
    ) -> Void

    static func requestAuthorization(
        completion: @escaping (SFSpeechRecognizerAuthorizationStatus) -> Void
    ) {
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

    func attach(
        _ ll: LangLocale,
        callback: @escaping SpeechRecognitionCallback
    ) throws {
        let id = UUID()
        try attachInternal(id: id, ll: ll, stopEngine: true, callback: callback)
    }

    func startContinuous(
        _ ll: LangLocale,
        callback: @escaping SpeechRecognitionCallback
    ) throws -> UUID {
        let id = UUID()
        try attachInternal(id: id, ll: ll, stopEngine: false, callback: callback)
        return id
    }

    func stopContinuous(_ id: UUID) {
        finish(id: id, stopEngine: false)
    }

    private func attachInternal(
        id: UUID,
        ll: LangLocale,
        stopEngine: Bool,
        callback: @escaping SpeechRecognitionCallback
    ) throws {
        let identifier = langLocaleToString(ll)
        let locale = Locale(identifier: identifier)
        guard let recognizer = SFSpeechRecognizer(locale: locale) else {
            throw NSError(domain: "SpeechRecognizer", code: -1, userInfo: nil)
        }
        recognizer.defaultTaskHint = .dictation
        let request = SFSpeechAudioBufferRecognitionRequest()
        request.shouldReportPartialResults = true
        requests[id] = request
        let task = recognizer.recognitionTask(with: request) { result, error in
            if self.requests[id] == nil {
                return
            }
            if let result {
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

    func pauseAll() {
        let ids = Array(players.keys)
        for id in ids {
            players[id]?.pause()
        }
    }

    func resumeAll() {
        let ids = Array(players.keys)
        for id in ids {
            players[id]?.play()
        }
    }

    func stopAll() {
        let ids = Array(players.keys)
        for id in ids {
            players[id]?.pause()
            complete(id: id, result: .success(()))
        }
    }

    func playAudioFromURL(_ urlString: String, volume: Float) async throws {
        guard let url = URL(string: urlString) else {
            throw NSError(
                domain: "AudioPlayer",
                code: 0,
                userInfo: [NSLocalizedDescriptionKey: "Failed to load audio URL"]
            )
        }

        let id = UUID()
        let player = AVPlayer(url: url)
        player.volume = volume
        configurePlayer(player)
        players[id] = player
        observe(player: player, id: id)
        player.play()

        try await withCheckedThrowingContinuation { continuation in
            completions[id] = { result in
                continuation.resume(with: result)
            }
        }
    }

    private func configurePlayer(_ player: AVPlayer) {
        player.automaticallyWaitsToMinimizeStalling = true
        player.allowsExternalPlayback = true
    }

    private func observe(player: AVPlayer, id: UUID) {
        var tokens: [NSObjectProtocol] = []
        if let item = player.currentItem {
            let endToken = NotificationCenter.default.addObserver(
                forName: .AVPlayerItemDidPlayToEndTime,
                object: item,
                queue: .main
            ) { [weak self] _ in
                self?.complete(id: id, result: .success(()))
            }
            tokens.append(endToken)

            let failToken = NotificationCenter.default.addObserver(
                forName: .AVPlayerItemFailedToPlayToEndTime,
                object: item,
                queue: .main
            ) { [weak self] notification in
                let error = notification.userInfo?[AVPlayerItemFailedToPlayToEndTimeErrorKey] as? Error
                let fallback = NSError(
                    domain: "AudioPlayer",
                    code: 1,
                    userInfo: [NSLocalizedDescriptionKey: "Playback failed"]
                )
                self?.complete(id: id, result: .failure(error ?? fallback))
            }
            tokens.append(failToken)

            let stallToken = NotificationCenter.default.addObserver(
                forName: .AVPlayerItemPlaybackStalled,
                object: item,
                queue: .main
            ) { _ in
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

class EventEmitter<Event: Hashable> {
    private var listeners: [Event: [(once: Bool, callback: () -> Void)]] = [:]

    func on(_ event: Event, _ callback: @escaping () -> Void) {
        listeners[event, default: []].append((once: false, callback: callback))
    }

    func once(_ event: Event, _ callback: @escaping () -> Void) {
        listeners[event, default: []].append((once: true, callback: callback))
    }

    func emit(_ event: Event) {
        guard let callbacks = listeners[event] else {
            return
        }
        for entry in callbacks {
            entry.callback()
        }
        listeners[event] = callbacks.filter { !$0.once }
    }

    func removeAllListeners(_ event: Event) {
        listeners[event] = []
    }

    func removeAllListeners() {
        listeners = [:]
    }
}
