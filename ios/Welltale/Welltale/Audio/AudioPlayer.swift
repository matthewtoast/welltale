import AVFoundation
import SwiftUI

class AudioPlayer {
    private var players: [UUID: AVPlayer] = [:]
    private var completions: [UUID: (Result<Void, Error>) -> Void] = [:]

    func pausePlayback() {
        for (id, _) in players {
            players[id]?.pause()
        }
    }

    func playAudioFromURL(_ urlString: String, volume: Float) async throws {
        guard let url = URL(string: urlString) else {
            throw NSError(domain: "AudioPlayer", code: 0, userInfo: [NSLocalizedDescriptionKey: "Failed to load audio URL"])
        }

        let id = UUID()
        let player = AVPlayer(url: url)
        player.volume = volume
        players[id] = player

        NotificationCenter.default.addObserver(self,
                                               selector: #selector(playerDidFinishPlaying(_:)),
                                               name: .AVPlayerItemDidPlayToEndTime,
                                               object: player.currentItem)

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
        players[id] = player

        NotificationCenter.default.addObserver(self,
                                               selector: #selector(playerDidFinishPlaying(_:)),
                                               name: .AVPlayerItemDidPlayToEndTime,
                                               object: player.currentItem)

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


    @objc private func playerDidFinishPlaying(_ notification: Notification) {
        guard let item = notification.object as? AVPlayerItem,
              let id = players.first(where: { $0.value.currentItem === item })?.key
        else {
            return
        }

        completions[id]?(.success(()))
        cleanupPlayer(id: id)
    }

    private func cleanupPlayer(id: UUID) {
        NotificationCenter.default.removeObserver(self, name: .AVPlayerItemDidPlayToEndTime, object: players[id]?.currentItem)
        players[id] = nil
        completions[id] = nil
    }
}
