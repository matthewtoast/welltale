import Foundation

enum SeamType: String, Codable {
    case input = "input"
    case media = "media"
    case grant = "grant"
    case error = "error"
    case finish = "finish"
}

struct StorySession: Codable {
    let id: String
    let time: Int
    let turn: Int
    let cycle: Int
    let loops: Int
    let resume: Bool
    let address: String?
    let input: StoryInput?
    let outroDone: Bool
    let stack: [StackFrame]
    let state: [String: AnyCodable]
    let checkpoints: [StoryCheckpoint]
    let meta: [String: AnyCodable]
    let cache: [String: AnyCodable]
    let flowTarget: String?
    let genie: [String: String]?
    let inputTries: [String: Int]
    let inputLast: String?
}

struct StoryInput: Codable {
    let from: String
    let body: String?
    let atts: [String: AnyCodable]
}

struct StackFrame: Codable {
    let returnAddress: String
    let scope: [String: AnyCodable]?
    let blockType: BlockType?
    
    enum BlockType: String, Codable {
        case scope
        case yield
        case intro
        case resume
        case outro
    }
}

struct StoryCheckpoint: Codable {
    let addr: String?
    let turn: Int
    let cycle: Int
    let time: Int
    let state: [String: AnyCodable]
    let meta: [String: AnyCodable]
    let outroDone: Bool?
    let stack: [StackFrame]
    let events: [StoryEvent]
}

struct StoryEvent: Codable {
    let time: Int
    let from: String
    let to: [String]
    let obs: [String]
    let body: String
    let tags: [String]
}

struct StoryOptions: Codable {
    let verbose: Bool
    let seed: String
    let loop: Int
    let ream: Int
    let doGenerateSpeech: Bool
    let doGenerateAudio: Bool
    let maxCheckpoints: Int
    let inputRetryMax: Int
    let models: [String]
}

enum StoryOperation: Codable {
    case sleep(duration: Int)
    case getInput(timeLimit: Int?)
    case playMedia(media: String, background: Bool?, volume: Double?, fadeAtMs: Int?, fadeDurationMs: Int?)
    case playEvent(event: StoryEvent, media: String?, background: Bool?, volume: Double?, fadeAtMs: Int?, fadeDurationMs: Int?)
    case storyError(reason: String)
    case storyEnd
    
    private enum CodingKeys: String, CodingKey {
        case type
        case duration
        case timeLimit
        case media
        case background
        case volume
        case fadeAtMs
        case fadeDurationMs
        case event
        case reason
    }
    
    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let type = try container.decode(String.self, forKey: .type)
        
        switch type {
        case "sleep":
            let duration = try container.decode(Int.self, forKey: .duration)
            self = .sleep(duration: duration)
        case "get-input":
            let timeLimit = try container.decodeIfPresent(Int.self, forKey: .timeLimit)
            self = .getInput(timeLimit: timeLimit)
        case "play-media":
            let media = try container.decode(String.self, forKey: .media)
            let background = try container.decodeIfPresent(Bool.self, forKey: .background)
            let volume = try container.decodeIfPresent(Double.self, forKey: .volume)
            let fadeAtMs = try container.decodeIfPresent(Int.self, forKey: .fadeAtMs)
            let fadeDurationMs = try container.decodeIfPresent(Int.self, forKey: .fadeDurationMs)
            self = .playMedia(media: media, background: background, volume: volume, fadeAtMs: fadeAtMs, fadeDurationMs: fadeDurationMs)
        case "play-event":
            let event = try container.decode(StoryEvent.self, forKey: .event)
            let media = try container.decodeIfPresent(String.self, forKey: .media)
            let background = try container.decodeIfPresent(Bool.self, forKey: .background)
            let volume = try container.decodeIfPresent(Double.self, forKey: .volume)
            let fadeAtMs = try container.decodeIfPresent(Int.self, forKey: .fadeAtMs)
            let fadeDurationMs = try container.decodeIfPresent(Int.self, forKey: .fadeDurationMs)
            self = .playEvent(event: event, media: media, background: background, volume: volume, fadeAtMs: fadeAtMs, fadeDurationMs: fadeDurationMs)
        case "story-error":
            let reason = try container.decode(String.self, forKey: .reason)
            self = .storyError(reason: reason)
        case "story-end":
            self = .storyEnd
        default:
            throw DecodingError.dataCorruptedError(forKey: .type, in: container, debugDescription: "Unknown operation type: \(type)")
        }
    }
    
    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        
        switch self {
        case .sleep(let duration):
            try container.encode("sleep", forKey: .type)
            try container.encode(duration, forKey: .duration)
        case .getInput(let timeLimit):
            try container.encode("get-input", forKey: .type)
            try container.encodeIfPresent(timeLimit, forKey: .timeLimit)
        case .playMedia(let media, let background, let volume, let fadeAtMs, let fadeDurationMs):
            try container.encode("play-media", forKey: .type)
            try container.encode(media, forKey: .media)
            try container.encodeIfPresent(background, forKey: .background)
            try container.encodeIfPresent(volume, forKey: .volume)
            try container.encodeIfPresent(fadeAtMs, forKey: .fadeAtMs)
            try container.encodeIfPresent(fadeDurationMs, forKey: .fadeDurationMs)
        case .playEvent(let event, let media, let background, let volume, let fadeAtMs, let fadeDurationMs):
            try container.encode("play-event", forKey: .type)
            try container.encode(event, forKey: .event)
            try container.encodeIfPresent(media, forKey: .media)
            try container.encodeIfPresent(background, forKey: .background)
            try container.encodeIfPresent(volume, forKey: .volume)
            try container.encodeIfPresent(fadeAtMs, forKey: .fadeAtMs)
            try container.encodeIfPresent(fadeDurationMs, forKey: .fadeDurationMs)
        case .storyError(let reason):
            try container.encode("story-error", forKey: .type)
            try container.encode(reason, forKey: .reason)
        case .storyEnd:
            try container.encode("story-end", forKey: .type)
        }
    }
}

struct StoryAdvanceRequest: Codable {
    let session: StorySession
    let options: StoryOptions
}

struct StoryAdvanceResponse: Codable {
    let ops: [StoryOperation]
    let session: StorySession
    let seam: SeamType
    let info: [String: String]
}

struct AnyCodable: Codable {
    let value: Any
    
    init(_ value: Any) {
        self.value = value
    }
    
    init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        if let bool = try? container.decode(Bool.self) {
            value = bool
        } else if let int = try? container.decode(Int.self) {
            value = int
        } else if let double = try? container.decode(Double.self) {
            value = double
        } else if let string = try? container.decode(String.self) {
            value = string
        } else if let array = try? container.decode([AnyCodable].self) {
            value = array.map { $0.value }
        } else if let dict = try? container.decode([String: AnyCodable].self) {
            value = dict.mapValues { $0.value }
        } else if container.decodeNil() {
            value = NSNull()
        } else {
            throw DecodingError.dataCorruptedError(in: container, debugDescription: "Cannot decode value")
        }
    }
    
    func encode(to encoder: Encoder) throws {
        var container = encoder.singleValueContainer()
        switch value {
        case let bool as Bool:
            try container.encode(bool)
        case let int as Int:
            try container.encode(int)
        case let double as Double:
            try container.encode(double)
        case let string as String:
            try container.encode(string)
        case let array as [Any]:
            try container.encode(array.map { AnyCodable($0) })
        case let dict as [String: Any]:
            try container.encode(dict.mapValues { AnyCodable($0) })
        case is NSNull:
            try container.encodeNil()
        default:
            throw EncodingError.invalidValue(value, EncodingError.Context(codingPath: [], debugDescription: "Cannot encode value"))
        }
    }
}