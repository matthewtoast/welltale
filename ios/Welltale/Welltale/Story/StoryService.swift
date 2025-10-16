import Foundation

struct StoryService {
    var client: APIClient

    init(client: APIClient) {
        self.client = client
    }

    init(configuration: StoryConfiguration) {
        let client = APIClient(
            baseURL: configuration.baseURL,
            tokenProvider: { configuration.token }
        )
        self.init(client: client)
    }

    func search(query: String?) async throws -> [StoryMetaDTO] {
        var queryItems: [URLQueryItem] = []
        if let query, !query.isEmpty {
            queryItems.append(URLQueryItem(name: "q", value: query))
        }
        let response: StorySearchResponse = try await client.request(
            method: "GET",
            path: "api/stories",
            query: queryItems
        )
        return response.items
    }

    func fetchAll() async throws -> [StoryMetaDTO] {
        try await search(query: nil)
    }
    
    func fetchStory(id: String) async throws -> StoryMetaDTO {
        let response: StoryDetailResponse = try await client.request(
            method: "GET",
            path: "api/stories/\(id)"
        )
        return response.meta
    }
    
    func advanceStory(session: StorySession, options: StoryOptions) async throws -> StoryAdvanceResponse {
        let request = StoryAdvanceRequest(session: session, options: options)
        let encoder = JSONEncoder()
        encoder.keyEncodingStrategy = .convertToSnakeCase
        let body = try encoder.encode(request)
        
        let response: StoryAdvanceResponse = try await client.request(
            method: "POST",
            path: "api/stories/advance",
            body: body
        )
        return response
    }
}
