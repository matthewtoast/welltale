import AVFoundation
import SwiftUI

class AudioController: ObservableObject {
    private let player = AudioPlayer()
    private var recognizer: SpeechRecognizer? = nil
    public var emitter = AudioControllerEmitter()
    private var stopped: Bool = false
    private var finished: Bool = false
    public var listening: Bool = false
    public var playing: Bool {
        get {
            return !stopped && !finished
        }
    }

    private func getRecognizer() -> SpeechRecognizer {
        if recognizer == nil {
            recognizer = SpeechRecognizer()
        }
        return recognizer!
    }

    func prepare(mode: ChallengeMode) async throws {
        let audioSession = AVAudioSession.sharedInstance()
        try audioSession.setCategory(
            .playAndRecord,
            mode: .default,
            options: [.allowBluetooth, .allowAirPlay, .mixWithOthers, .defaultToSpeaker]
        )
        try audioSession.setActive(true)
        try getRecognizer().startStream()
    }

    func interrupt() {
        getRecognizer().detach()
        player.pausePlayback()
    }

    func teardown(mode: ChallengeMode) {
        getRecognizer().stopStream()
        recognizer = nil
        player.pausePlayback()
    }

    func stop(mode: ChallengeMode) {
        if stopped {
            return
        }
        stopped = true
        getRecognizer().detach()
    }

    func emit(_ event: GameSignal) {
        emitter.emit(event)
    }

    typealias SpeechRecognizedHook = (LangLocale, [String]) -> Void
    typealias SpeechBeforeAttachHook = (LangLocale) -> Void

    @MainActor
    func start(
        ll: LangLocale,
        onSpeechRecognized: @escaping SpeechRecognizedHook,
        onBeforeAttacah: @escaping SpeechBeforeAttachHook
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

            onBeforeAttacah(ll)

            do {
                try getRecognizer().attach(ll) { transcripts, isFinal, locale in
                    print("[recog]", locale, isFinal, self.stopped)
                    if self.stopped {
                        self.getRecognizer().detach()
                        return
                    }
                    onSpeechRecognized(locale, transcripts)
                }
            } catch {
                print("[error]", error)
                continuation.resume(returning: (0, "error"))
            }
        }
    }
}

class AudioControllerEmitter: EventEmitter<GameSignal> {}
