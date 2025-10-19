import Foundation
import AVFoundation

let SECOND = 1000
let MINUTE = SECOND * 60
let HOUR = MINUTE * 60
let DAY = HOUR * 24

func unixNow() -> Int {
    return Int(Date().timeIntervalSince1970 * 1000)
}

private struct TimerClip {
    let url: URL
    let duration: TimeInterval
}

private let timerClip: TimerClip? = {
    guard let url = Bundle.main.url(forResource: "timer", withExtension: "mp3", subdirectory: "Files") else {
        return nil
    }
    let asset = AVURLAsset(url: url)
    let seconds = CMTimeGetSeconds(asset.duration)
    if seconds.isNaN || seconds <= 0 {
        return nil
    }
    return TimerClip(url: url, duration: seconds)
}()

@MainActor
private final class TimerPlayer: NSObject, AVAudioPlayerDelegate {
    private var continuation: CheckedContinuation<Bool, Never>?
    private var audioPlayer: AVAudioPlayer?

    func play(length: TimeInterval, clip: TimerClip) async -> Bool {
        cleanup()
        do {
            let player = try AVAudioPlayer(contentsOf: clip.url)
            audioPlayer = player
            player.delegate = self
            player.volume = 0
            player.prepareToPlay()
            let duration = max(player.duration, 0.01)
            let loops = Int(length / duration)
            let remainder = length.truncatingRemainder(dividingBy: duration)
            if remainder > 0 {
                player.currentTime = duration - remainder
                player.numberOfLoops = loops
            } else {
                player.currentTime = 0
                player.numberOfLoops = max(0, loops - 1)
            }
            return await withCheckedContinuation { cont in
                continuation = cont
                if !player.play() {
                    finish(result: false)
                }
            }
        } catch {
            cleanup()
            return false
        }
    }

    func stop() {
        audioPlayer?.stop()
        finish(result: false)
    }

    func audioPlayerDidFinishPlaying(_ player: AVAudioPlayer, successfully flag: Bool) {
        finish(result: flag)
    }

    func audioPlayerDecodeErrorDidOccur(_ player: AVAudioPlayer, error: Error?) {
        finish(result: false)
    }

    private func finish(result: Bool) {
        if let cont = continuation {
            cont.resume(returning: result)
        }
        cleanup()
    }

    private func cleanup() {
        continuation = nil
        audioPlayer?.delegate = nil
        audioPlayer = nil
    }
}

func waitWithTimer(ms: Int, segmentMs: Int = 1000) async {
    if ms <= 0 {
        return
    }
    guard let clip = timerClip else {
        await spinWait(milliseconds: ms)
        return
    }
    var remaining = Double(ms) / 1000
    let player = await MainActor.run { TimerPlayer() }
    let segmentSeconds = max(0.001, Double(max(1, segmentMs)) / 1000)
    while remaining > 0 {
        if Task.isCancelled {
            await MainActor.run { player.stop() }
            return
        }
        let chunk = min(remaining, min(segmentSeconds, clip.duration))
        let succeeded = await player.play(length: chunk, clip: clip)
        if Task.isCancelled {
            await MainActor.run { player.stop() }
            return
        }
        if !succeeded {
            await spinWait(milliseconds: Int(chunk * 1000))
        }
        remaining -= chunk
    }
    await MainActor.run { player.stop() }
}

private func spinWait(milliseconds: Int) async {
    if milliseconds <= 0 {
        return
    }
    let end = Date().addingTimeInterval(Double(milliseconds) / 1000)
    while Date() < end {
        if Task.isCancelled {
            return
        }
        await Task.yield()
    }
}
