import Foundation

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
