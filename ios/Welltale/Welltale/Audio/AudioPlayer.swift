import AVFoundation
import SwiftUI

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
