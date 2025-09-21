import Foundation

struct APIUser: Codable, Equatable {
    let id: String
    let provider: String
    let email: String?
    let roles: [String]
}

struct AuthSession: Codable, Equatable {
    let token: String
    let user: APIUser
}

struct AuthExchangeResponse: Codable {
    let ok: Bool
    let token: String
    let user: APIUser
}

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

struct StorySearchResponse: Codable {
    let items: [StoryMetaDTO]
}

struct StoryDetailResponse: Codable {
    let meta: StoryMetaDTO
}

struct UploadTicketDTO: Codable {
    let method: String
    let url: URL
    let headers: [String: String]
}
