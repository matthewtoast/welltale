import Speech

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
