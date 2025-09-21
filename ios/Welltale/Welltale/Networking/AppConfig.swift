import Foundation

struct AppConfig {
    static var apiBaseURL: URL {
        if let env = ProcessInfo.processInfo.environment["WELLTALE_API_BASE"],
           let url = URL(string: env) {
            return url
        }
        if let value = Bundle.main.object(forInfoDictionaryKey: "WelltaleAPIBase") as? String,
           let url = URL(string: value) {
            return url
        }
        return URL(string: "http://localhost:3000")!
    }
}
