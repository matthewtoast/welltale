import Foundation

struct StoryConfiguration {
    let baseURL: URL
    let token: String

    static func load() -> StoryConfiguration? {
        guard let base = AppConfig.apiBaseURL,
              let token = AppConfig.devSessionToken else {
            return nil
        }
        return StoryConfiguration(baseURL: base, token: token)
    }
}
