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
    let id: String
    let title: String
    let author: String
    let description: String
    let tags: [String]
    let publish: String
    let compile: String
    let createdAt: TimeInterval
    let updatedAt: TimeInterval
}

struct StorySearchResponse: Codable {
    let items: [StoryMetaDTO]
}

struct UploadTicketDTO: Codable {
    let method: String
    let url: URL
    let headers: [String: String]
}
