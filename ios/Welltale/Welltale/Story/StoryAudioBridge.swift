import AVFoundation

struct StoryAudioBridge {
    func prepare() async {
        await StoryAudioStore.prepare()
    }

    func playForeground(_ url: String, volume: Float) async {
        await StoryAudioStore.playForeground(url: url, volume: volume)
    }

    func playBackground(_ url: String, volume: Float) {
        StoryAudioStore.playBackground(url: url, volume: volume)
    }

    func pauseAll() async {
        await StoryAudioStore.pauseAll()
    }

    func resumeAll() async {
        await StoryAudioStore.resumeAll()
    }

    func stop() async {
        await StoryAudioStore.stopAll()
    }
}

@MainActor
private enum StoryAudioStore {
    static let session = AVAudioSession.sharedInstance()
    static let player = AudioPlayer()

    static func prepare() {
        try? session.setCategory(
            .playback,
            mode: .default,
            policy: .longFormAudio,
            options: [.mixWithOthers, .duckOthers]
        )
        try? session.setActive(true)
    }

    static func playForeground(url: String, volume: Float) async {
        try? await player.playAudioFromURL(url, volume: volume)
    }

    static func playBackground(url: String, volume: Float) {
        Task { @MainActor in
            try? await player.playAudioFromURL(url, volume: volume)
        }
    }

    static func pauseAll() {
        player.pauseAll()
    }

    static func resumeAll() {
        player.resumeAll()
    }

    static func stopAll() {
        player.stopAll()
        try? session.setActive(false, options: .notifyOthersOnDeactivation)
    }
}
