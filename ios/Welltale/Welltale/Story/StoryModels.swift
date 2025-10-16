import Foundation

enum SeamType: String, Codable {
    case input = "input"
    case media = "media"
    case grant = "grant"
    case error = "error"
    case finish = "finish"
}

struct StorySession: Codable {
    var id: String
    var time: Int
    var turn: Int
    var cycle: Int
    var loops: Int
    var resume: Bool
    var address: String?
    var input: StoryInput?
    var outroed: Bool
    var stack: [StackFrame]
    var state: [String: AnyCodable]
    var checkpoints: [StoryCheckpoint]
    var meta: [String: AnyCodable]
    var cache: [String: AnyCodable]
    var target: String?
    var genie: [String: String]?
    var ddv: StoryDDV?
    var player: StoryPlayer?
    var voices: [String: StoryVoice]
    var scripts: [String: AnyCodable]
    var pronunciations: [String: String]
    var root: StoryNode?

    init(
        id: String,
        time: Int,
        turn: Int,
        cycle: Int,
        loops: Int,
        resume: Bool,
        address: String?,
        input: StoryInput?,
        outroed: Bool,
        stack: [StackFrame],
        state: [String: AnyCodable],
        checkpoints: [StoryCheckpoint],
        meta: [String: AnyCodable],
        cache: [String: AnyCodable],
        target: String?,
        genie: [String: String]?,
        ddv: StoryDDV?,
        player: StoryPlayer?,
        voices: [String: StoryVoice],
        scripts: [String: AnyCodable],
        pronunciations: [String: String],
        root: StoryNode?
    ) {
        self.id = id
        self.time = time
        self.turn = turn
        self.cycle = cycle
        self.loops = loops
        self.resume = resume
        self.address = address
        self.input = input
        self.outroed = outroed
        self.stack = stack
        self.state = state
        self.checkpoints = checkpoints
        self.meta = meta
        self.cache = cache
        self.target = target
        self.genie = genie
        self.ddv = ddv
        self.player = player
        self.voices = voices
        self.scripts = scripts
        self.pronunciations = pronunciations
        self.root = root
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = try container.decode(String.self, forKey: .id)
        time = try container.decodeIfPresent(Int.self, forKey: .time) ?? 0
        turn = try container.decodeIfPresent(Int.self, forKey: .turn) ?? 0
        cycle = try container.decodeIfPresent(Int.self, forKey: .cycle) ?? 0
        loops = try container.decodeIfPresent(Int.self, forKey: .loops) ?? 0
        resume = try container.decodeIfPresent(Bool.self, forKey: .resume) ?? false
        address = try container.decodeIfPresent(String.self, forKey: .address)
        input = try container.decodeIfPresent(StoryInput.self, forKey: .input)
        outroed = try container.decodeIfPresent(Bool.self, forKey: .outroed) ?? false
        stack = try container.decodeIfPresent([StackFrame].self, forKey: .stack) ?? []
        state = try container.decodeIfPresent([String: AnyCodable].self, forKey: .state) ?? [:]
        checkpoints = try container.decodeIfPresent([StoryCheckpoint].self, forKey: .checkpoints) ?? []
        meta = try container.decodeIfPresent([String: AnyCodable].self, forKey: .meta) ?? [:]
        cache = try container.decodeIfPresent([String: AnyCodable].self, forKey: .cache) ?? [:]
        target = try container.decodeIfPresent(String.self, forKey: .target)
        genie = try container.decodeIfPresent([String: String].self, forKey: .genie)
        ddv = try container.decodeIfPresent(StoryDDV.self, forKey: .ddv)
        player = try container.decodeIfPresent(StoryPlayer.self, forKey: .player)
        voices = try container.decodeIfPresent([String: StoryVoice].self, forKey: .voices) ?? [:]
        scripts = try container.decodeIfPresent([String: AnyCodable].self, forKey: .scripts) ?? [:]
        pronunciations = try container.decodeIfPresent([String: String].self, forKey: .pronunciations) ?? [:]
        root = try container.decodeIfPresent(StoryNode.self, forKey: .root)
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(id, forKey: .id)
        try container.encode(time, forKey: .time)
        try container.encode(turn, forKey: .turn)
        try container.encode(cycle, forKey: .cycle)
        try container.encode(loops, forKey: .loops)
        try container.encode(resume, forKey: .resume)
        try container.encodeIfPresent(address, forKey: .address)
        try container.encodeIfPresent(input, forKey: .input)
        try container.encode(outroed, forKey: .outroed)
        try container.encode(stack, forKey: .stack)
        try container.encode(state, forKey: .state)
        try container.encode(checkpoints, forKey: .checkpoints)
        try container.encode(meta, forKey: .meta)
        try container.encode(cache, forKey: .cache)
        try container.encodeIfPresent(target, forKey: .target)
        try container.encodeIfPresent(genie, forKey: .genie)
        try container.encodeIfPresent(ddv, forKey: .ddv)
        try container.encodeIfPresent(player, forKey: .player)
        try container.encode(voices, forKey: .voices)
        try container.encode(scripts, forKey: .scripts)
        try container.encode(pronunciations, forKey: .pronunciations)
        try container.encodeIfPresent(root, forKey: .root)
    }

    private enum CodingKeys: String, CodingKey {
        case id
        case time
        case turn
        case cycle
        case loops
        case resume
        case address
        case input
        case outroed
        case stack
        case state
        case checkpoints
        case meta
        case cache
        case target
        case genie
        case ddv
        case player
        case voices
        case scripts
        case pronunciations
        case root
    }
}

struct StoryInput: Codable {
    var from: String
    var body: String?
    var atts: [String: AnyCodable]

    init(from: String, body: String?, atts: [String: AnyCodable]) {
        self.from = from
        self.body = body
        self.atts = atts
    }
}

struct StackFrame: Codable {
    var returnAddress: String
    var scope: [String: AnyCodable]?
    var blockType: String?
}

struct StoryCheckpoint: Codable {
    var addr: String?
    var turn: Int
    var cycle: Int
    var time: Int
    var state: [String: AnyCodable]
    var meta: [String: AnyCodable]
    var outroed: Bool?
    var stack: [StackFrame]
    var events: [StoryEvent]

    init(
        addr: String?,
        turn: Int,
        cycle: Int,
        time: Int,
        state: [String: AnyCodable],
        meta: [String: AnyCodable],
        outroed: Bool?,
        stack: [StackFrame],
        events: [StoryEvent]
    ) {
        self.addr = addr
        self.turn = turn
        self.cycle = cycle
        self.time = time
        self.state = state
        self.meta = meta
        self.outroed = outroed
        self.stack = stack
        self.events = events
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        addr = try container.decodeIfPresent(String.self, forKey: .addr)
        turn = try container.decodeIfPresent(Int.self, forKey: .turn) ?? 0
        cycle = try container.decodeIfPresent(Int.self, forKey: .cycle) ?? 0
        time = try container.decodeIfPresent(Int.self, forKey: .time) ?? 0
        state = try container.decodeIfPresent([String: AnyCodable].self, forKey: .state) ?? [:]
        meta = try container.decodeIfPresent([String: AnyCodable].self, forKey: .meta) ?? [:]
        outroed = try container.decodeIfPresent(Bool.self, forKey: .outroed)
        stack = try container.decodeIfPresent([StackFrame].self, forKey: .stack) ?? []
        events = try container.decodeIfPresent([StoryEvent].self, forKey: .events) ?? []
    }

    private enum CodingKeys: String, CodingKey {
        case addr
        case turn
        case cycle
        case time
        case state
        case meta
        case outroed
        case stack
        case events
    }
}

struct StoryEvent: Codable {
    var time: Int
    var from: String
    var to: [String]
    var obs: [String]
    var body: String
    var tags: [String]

    init(time: Int, from: String, to: [String], obs: [String], body: String, tags: [String]) {
        self.time = time
        self.from = from
        self.to = to
        self.obs = obs
        self.body = body
        self.tags = tags
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        time = try container.decodeIfPresent(Int.self, forKey: .time) ?? 0
        from = try container.decodeIfPresent(String.self, forKey: .from) ?? ""
        to = try container.decodeIfPresent([String].self, forKey: .to) ?? []
        obs = try container.decodeIfPresent([String].self, forKey: .obs) ?? []
        body = try container.decodeIfPresent(String.self, forKey: .body) ?? ""
        tags = try container.decodeIfPresent([String].self, forKey: .tags) ?? []
    }

    private enum CodingKeys: String, CodingKey {
        case time
        case from
        case to
        case obs
        case body
        case tags
    }
}

struct StoryOptions: Codable {
    var verbose: Bool
    var seed: String
    var loop: Int
    var ream: Int
    var doGenerateAudio: Bool
    var doGenerateImage: Bool
    var maxCheckpoints: Int
    var inputRetryMax: Int
    var models: [String]
}

enum StoryOperationType: String, Codable {
    case playMedia = "play-media"
    case getInput = "get-input"
    case sleep = "sleep"
    case showMedia = "show-media"
    case storyError = "story-error"
    case storyEnd = "story-end"
}

struct StoryOperation: Codable {
    var type: StoryOperationType
    var event: StoryEvent?
    var media: String?
    var background: Bool
    var volume: Double?
    var fadeAtMs: Int?
    var fadeDurationMs: Int?
    var duration: Int?
    var atts: [String: AnyCodable]
    var reason: String?

    init(
        type: StoryOperationType,
        event: StoryEvent?,
        media: String?,
        background: Bool,
        volume: Double?,
        fadeAtMs: Int?,
        fadeDurationMs: Int?,
        duration: Int?,
        atts: [String: AnyCodable],
        reason: String?
    ) {
        self.type = type
        self.event = event
        self.media = media
        self.background = background
        self.volume = volume
        self.fadeAtMs = fadeAtMs
        self.fadeDurationMs = fadeDurationMs
        self.duration = duration
        self.atts = atts
        self.reason = reason
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        type = try container.decode(StoryOperationType.self, forKey: .type)
        event = try container.decodeIfPresent(StoryEvent.self, forKey: .event)
        media = try container.decodeIfPresent(String.self, forKey: .media)
        background = try container.decodeIfPresent(Bool.self, forKey: .background) ?? false
        volume = try container.decodeIfPresent(Double.self, forKey: .volume)
        fadeAtMs = try container.decodeIfPresent(Int.self, forKey: .fadeAtMs)
        fadeDurationMs = try container.decodeIfPresent(Int.self, forKey: .fadeDurationMs)
        duration = try container.decodeIfPresent(Int.self, forKey: .duration)
        atts = try container.decodeIfPresent([String: AnyCodable].self, forKey: .atts) ?? [:]
        reason = try container.decodeIfPresent(String.self, forKey: .reason)
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(type, forKey: .type)
        try container.encodeIfPresent(event, forKey: .event)
        try container.encodeIfPresent(media, forKey: .media)
        if background { try container.encode(background, forKey: .background) }
        try container.encodeIfPresent(volume, forKey: .volume)
        try container.encodeIfPresent(fadeAtMs, forKey: .fadeAtMs)
        try container.encodeIfPresent(fadeDurationMs, forKey: .fadeDurationMs)
        try container.encodeIfPresent(duration, forKey: .duration)
        if !atts.isEmpty { try container.encode(atts, forKey: .atts) }
        try container.encodeIfPresent(reason, forKey: .reason)
    }

    private enum CodingKeys: String, CodingKey {
        case type
        case event
        case media
        case background
        case volume
        case fadeAtMs
        case fadeDurationMs
        case duration
        case atts
        case reason
    }
}

struct StoryAdvanceRequest: Codable {
    var session: StorySession
    var options: StoryOptions
}

struct StoryAdvanceResponse: Codable {
    var ops: [StoryOperation]
    var session: StorySession
    var seam: SeamType
    var info: [String: String]
}

struct StoryAdvanceResult {
    var response: StoryAdvanceResponse
    var accumulatedOps: [StoryOperation]
}

struct StoryNode: Codable {
    var addr: String
    var type: String
    var atts: [String: String]
    var kids: [StoryNode]
    var text: String

    init(addr: String, type: String, atts: [String: String], kids: [StoryNode], text: String) {
        self.addr = addr
        self.type = type
        self.atts = atts
        self.kids = kids
        self.text = text
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        addr = try container.decodeIfPresent(String.self, forKey: .addr) ?? ""
        type = try container.decodeIfPresent(String.self, forKey: .type) ?? ""
        atts = try container.decodeIfPresent([String: String].self, forKey: .atts) ?? [:]
        kids = try container.decodeIfPresent([StoryNode].self, forKey: .kids) ?? []
        text = try container.decodeIfPresent(String.self, forKey: .text) ?? ""
    }

    private enum CodingKeys: String, CodingKey {
        case addr
        case type
        case atts
        case kids
        case text
    }
}

struct StoryDDV: Codable {
    var cycles: [String: Int]
    var bags: [String: StoryBag]

    init(cycles: [String: Int], bags: [String: StoryBag]) {
        self.cycles = cycles
        self.bags = bags
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        cycles = try container.decodeIfPresent([String: Int].self, forKey: .cycles) ?? [:]
        bags = try container.decodeIfPresent([String: StoryBag].self, forKey: .bags) ?? [:]
    }

    private enum CodingKeys: String, CodingKey {
        case cycles
        case bags
    }
}

struct StoryBag: Codable {
    var order: [Int]
    var idx: Int

    init(order: [Int], idx: Int) {
        self.order = order
        self.idx = idx
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        order = try container.decodeIfPresent([Int].self, forKey: .order) ?? []
        idx = try container.decodeIfPresent(Int.self, forKey: .idx) ?? 0
    }

    private enum CodingKeys: String, CodingKey {
        case order
        case idx
    }
}

struct StoryPlayer: Codable {
    var id: String
}

struct StoryVoice: Codable {
    var name: String
    var ref: String
    var id: String
    var tags: [String]

    init(name: String, ref: String, id: String, tags: [String]) {
        self.name = name
        self.ref = ref
        self.id = id
        self.tags = tags
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        name = try container.decodeIfPresent(String.self, forKey: .name) ?? ""
        ref = try container.decodeIfPresent(String.self, forKey: .ref) ?? ""
        id = try container.decodeIfPresent(String.self, forKey: .id) ?? ""
        tags = try container.decodeIfPresent([String].self, forKey: .tags) ?? []
    }

    private enum CodingKeys: String, CodingKey {
        case name
        case ref
        case id
        case tags
    }
}

struct AnyCodable: Codable {
    var value: Any

    init(_ value: Any) {
        self.value = value
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        if let bool = try? container.decode(Bool.self) {
            value = bool
            return
        }
        if let int = try? container.decode(Int.self) {
            value = int
            return
        }
        if let double = try? container.decode(Double.self) {
            value = double
            return
        }
        if let string = try? container.decode(String.self) {
            value = string
            return
        }
        if let array = try? container.decode([AnyCodable].self) {
            value = array.map { $0.value }
            return
        }
        if let dict = try? container.decode([String: AnyCodable].self) {
            value = dict.mapValues { $0.value }
            return
        }
        if container.decodeNil() {
            value = NSNull()
            return
        }
        throw DecodingError.dataCorruptedError(in: container, debugDescription: "Unsupported value")
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
            throw EncodingError.invalidValue(value, EncodingError.Context(codingPath: [], debugDescription: "Unsupported value"))
        }
    }
}
