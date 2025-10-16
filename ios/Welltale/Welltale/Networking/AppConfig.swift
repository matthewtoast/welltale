import Foundation

struct AppConfig {
    static var apiBaseURL: URL? {
        guard let raw = processedValue(for: "WelltaleAPIBase"),
              let url = URL(string: raw) else {
            return nil
        }
        return url
    }

    static var devSessionToken: String? {
        processedValue(for: "DevSessionToken")
    }

    static var rawAPIBase: String? {
        rawValue(for: "WelltaleAPIBase")
    }

    static var rawDevSessionToken: String? {
        rawValue(for: "DevSessionToken")
    }

    private static func rawValue(for key: String) -> String? {
        guard let value = Bundle.main.object(forInfoDictionaryKey: key) as? String else {
            return nil
        }
        let trimmed = value.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else {
            return nil
        }
        return unquoted(trimmed)
    }

    private static func processedValue(for key: String) -> String? {
        guard let raw = rawValue(for: key) else {
            return nil
        }
        guard !raw.contains("$(") else {
            return nil
        }
        return raw
            .replacingOccurrences(of: "\\/", with: "/")
    }

    private static func unquoted(_ value: String) -> String {
        if value.count >= 2,
           value.first == "\"",
           value.last == "\"" {
            return String(value.dropFirst().dropLast())
        }
        return value
    }
}
