import AVFoundation
import SwiftUI

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
