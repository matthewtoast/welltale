import Foundation

enum APIError: Error {
    case invalidURL
    case invalidResponse
    case status(Int)
    case decode
}

struct APIClient {
    var baseURL: URL
    var session: URLSession
    var tokenProvider: () -> String?

    init(
        baseURL: URL,
        session: URLSession = .shared,
        tokenProvider: @escaping () -> String? = { nil }
    ) {
        self.baseURL = baseURL
        self.session = session
        self.tokenProvider = tokenProvider
    }

    func request<T: Decodable>(
        method: String,
        path: String,
        query: [URLQueryItem] = [],
        body: Data? = nil
    ) async throws -> T {
        let data = try await rawRequest(method: method, path: path, query: query, body: body)
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .millisecondsSince1970
        decoder.keyDecodingStrategy = .convertFromSnakeCase
        guard let value = try? decoder.decode(T.self, from: data) else {
            throw APIError.decode
        }
        return value
    }

    func requestVoid(
        method: String,
        path: String,
        query: [URLQueryItem] = [],
        body: Data? = nil
    ) async throws {
        _ = try await rawRequest(method: method, path: path, query: query, body: body)
    }

    private func rawRequest(
        method: String,
        path: String,
        query: [URLQueryItem],
        body: Data?
    ) async throws -> Data {
        let trimmedPath = path.hasPrefix("/") ? String(path.dropFirst()) : path
        var components = URLComponents(url: baseURL, resolvingAgainstBaseURL: false)
        components?.path = baseURL.appendingPathComponent(trimmedPath).path
        if !query.isEmpty {
            components?.queryItems = query
        }
        guard let url = components?.url else {
            throw APIError.invalidURL
        }
        print("[welltale] API request", method, path, query, url)
        var request = URLRequest(url: url)
        request.httpMethod = method
        if let body = body {
            request.httpBody = body
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        }
        if let token = tokenProvider() {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
        let (data, response) = try await session.data(for: request)
        guard let http = response as? HTTPURLResponse else {
            throw APIError.invalidResponse
        }
        print("[welltale] API response", http.statusCode, http.url)
        if !(200...299).contains(http.statusCode) {
            throw APIError.status(http.statusCode)
        }
        return data
    }
}
