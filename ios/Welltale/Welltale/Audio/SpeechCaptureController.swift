import AVFoundation
import SwiftUI

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
