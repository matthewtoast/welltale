import Speech

class SpeechRecognizer: NSObject, SFSpeechRecognizerDelegate {
    private var bus: Int = 0
    private var size: UInt32 = 1024
    private var engine = AVAudioEngine()
    private var requests: [SFSpeechAudioBufferRecognitionRequest] = []

    typealias SpeechRecognitionCallback = (_ transcripts: [String], _ isFinal: Bool, _ locale: LangLocale) -> Void

    static func requestAuthorization(completion: @escaping (SFSpeechRecognizerAuthorizationStatus) -> Void) {
        SFSpeechRecognizer.requestAuthorization { status in
            completion(status)
        }
    }

    func stopStream() {
        engine.stop()
        engine.inputNode.removeTap(onBus: bus)
    }

    func startStream() throws {
        engine.inputNode.installTap(
            onBus: bus,
            bufferSize: size,
            format: engine.inputNode.outputFormat(forBus: bus)
        ) { buffer, _ in
            // Buffer will be passed to whatever requests happen to be present
            self.requests.forEach { request in
                request.append(buffer)
            }
        }
        engine.prepare()
        // This throws if the app is in the background
        try engine.start()
    }

    func detach() {
        let removals = requests
        requests.removeAll() // Clear array before removing
        removals.forEach { request in
            request.endAudio()
        }
    }

    func attach(_ ll: LangLocale, callback: @escaping SpeechRecognitionCallback) throws {
        var done = false
        let identifier = langLocaleToString(ll)
        let locale = Locale(identifier: identifier)
        print("[recog] attach", identifier, locale)
        guard let recognizer = SFSpeechRecognizer(locale: locale) else {
            return
        }
        recognizer.supportsOnDeviceRecognition = true
        recognizer.defaultTaskHint = .dictation
        let request = SFSpeechAudioBufferRecognitionRequest()
        request.shouldReportPartialResults = true
        requests.append(request)
        var task: SFSpeechRecognitionTask?
        task = recognizer.recognitionTask(with: request) { result, error in
            if done || self.requests.count < 1 {
                task?.cancel()
                return
            }
            if let result = result {
                let bestString = result.bestTranscription.formattedString
                let alternatives = result.transcriptions.map { $0.formattedString }
                callback(Array(Set([bestString] + alternatives)), result.isFinal, ll)
            }
            if error != nil || (result?.isFinal ?? false) {
                done = true
                self.engine.stop()
                self.engine.inputNode.removeTap(onBus: self.bus)
                task?.cancel()
            }
        }
    }
}
