import Foundation

enum AuthError: Error {
    case invalidIdentityToken
    case unauthorized
}

struct AuthService {
    var baseURL: URL
    var session: URLSession

    init(baseURL: URL, session: URLSession = .shared) {
        self.baseURL = baseURL
        self.session = session
    }

    func exchangeApple(identityToken: String) async throws -> AuthSession {
        let payload = ExchangePayload(provider: "apple", token: identityToken)
        let encoder = JSONEncoder()
        guard let body = try? encoder.encode(payload) else {
            throw AuthError.invalidIdentityToken
        }
        let client = APIClient(baseURL: baseURL, session: session)
        do {
            let response: AuthExchangeResponse = try await client.request(
                method: "POST",
                path: "api/auth/exchange",
                body: body
            )
            if !response.ok {
                throw AuthError.unauthorized
            }
            return AuthSession(token: response.token, user: response.user)
        } catch {
            if case APIError.status(let code) = error, code == 401 {
                throw AuthError.unauthorized
            }
            throw error
        }
    }
}

private struct ExchangePayload: Encodable {
    let provider: String
    let token: String
}
