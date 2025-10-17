import Foundation

struct StoryMetaDTO: Codable, Identifiable, Hashable {
    enum Publish: String, Codable {
        case draft
        case published
    }

    enum Compile: String, Codable {
        case pending
        case ready
    }

    let id: String
    let title: String
    let author: String
    let description: String
    let tags: [String]
    let publish: Publish
    let compile: Compile
    let createdAt: TimeInterval
    let updatedAt: TimeInterval

    private enum CodingKeys: String, CodingKey {
        case id
        case title
        case author
        case description
        case tags
        case publish
        case compile
        case createdAt
        case updatedAt
    }

    init(
        id: String,
        title: String,
        author: String,
        description: String,
        tags: [String],
        publish: Publish,
        compile: Compile,
        createdAt: TimeInterval,
        updatedAt: TimeInterval
    ) {
        self.id = id
        self.title = title
        self.author = author
        self.description = description
        self.tags = tags
        self.publish = publish
        self.compile = compile
        self.createdAt = createdAt
        self.updatedAt = updatedAt
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let id = try container.decode(String.self, forKey: .id)
        let title = try container.decode(String.self, forKey: .title)
        let author = try container.decode(String.self, forKey: .author)
        let description = try container.decode(String.self, forKey: .description)
        let tags = try container.decodeIfPresent([String].self, forKey: .tags) ?? []
        let publish = try container.decode(Publish.self, forKey: .publish)
        let compile = try container.decode(Compile.self, forKey: .compile)
        let createdAt = try container.decode(TimeInterval.self, forKey: .createdAt)
        let updatedAt = try container.decode(TimeInterval.self, forKey: .updatedAt)
        self.init(
            id: id,
            title: title,
            author: author,
            description: description,
            tags: tags,
            publish: publish,
            compile: compile,
            createdAt: createdAt,
            updatedAt: updatedAt
        )
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(id, forKey: .id)
        try container.encode(title, forKey: .title)
        try container.encode(author, forKey: .author)
        try container.encode(description, forKey: .description)
        try container.encode(tags, forKey: .tags)
        try container.encode(publish, forKey: .publish)
        try container.encode(compile, forKey: .compile)
        try container.encode(createdAt, forKey: .createdAt)
        try container.encode(updatedAt, forKey: .updatedAt)
    }
}

extension StoryMetaDTO {
    static func == (lhs: StoryMetaDTO, rhs: StoryMetaDTO) -> Bool {
        lhs.id == rhs.id &&
        lhs.title == rhs.title &&
        lhs.author == rhs.author &&
        lhs.description == rhs.description &&
        lhs.tags == rhs.tags &&
        lhs.publish == rhs.publish &&
        lhs.compile == rhs.compile &&
        lhs.createdAt == rhs.createdAt &&
        lhs.updatedAt == rhs.updatedAt
    }

    func hash(into hasher: inout Hasher) {
        hasher.combine(id)
        hasher.combine(title)
        hasher.combine(author)
        hasher.combine(description)
        hasher.combine(tags)
        hasher.combine(publish)
        hasher.combine(compile)
        hasher.combine(createdAt)
        hasher.combine(updatedAt)
    }
}

struct StorySearchResponse: Codable {
    let items: [StoryMetaDTO]
}

struct StoryDetailResponse: Codable {
    let meta: StoryMetaDTO
    let source: StorySourceDTO?
}

struct StorySourceDTO: Codable {
    let root: StoryNode
    let scripts: [String: AnyCodable]
    let voices: [String: StoryVoice]
    let pronunciations: [String: String]
    let meta: [String: AnyCodable]

    init(
        root: StoryNode,
        scripts: [String: AnyCodable],
        voices: [String: StoryVoice],
        pronunciations: [String: String],
        meta: [String: AnyCodable]
    ) {
        self.root = root
        self.scripts = scripts
        self.voices = voices
        self.pronunciations = pronunciations
        self.meta = meta
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let root = try container.decodeIfPresent(StoryNode.self, forKey: .root) ?? StoryNode(addr: "", type: "root", atts: [:], kids: [], text: "")
        let scripts = try container.decodeIfPresent([String: AnyCodable].self, forKey: .scripts) ?? [:]
        let voices = try container.decodeIfPresent([String: StoryVoice].self, forKey: .voices) ?? [:]
        let pronunciations = try container.decodeIfPresent([String: String].self, forKey: .pronunciations) ?? [:]
        let meta = try container.decodeIfPresent([String: AnyCodable].self, forKey: .meta) ?? [:]
        self.init(
            root: root,
            scripts: scripts,
            voices: voices,
            pronunciations: pronunciations,
            meta: meta
        )
    }

    private enum CodingKeys: String, CodingKey {
        case root
        case scripts
        case voices
        case pronunciations
        case meta
    }
}
