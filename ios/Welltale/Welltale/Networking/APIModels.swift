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

struct UploadTicketDTO: Codable {
    let method: String
    let url: URL
    let headers: [String: String]
}
