import Foundation

actor UserPreferences {
    static let shared = UserPreferences()

    private enum Key {
        static let autoInput = "prefs.autoInput"
    }

    private let defaults = UserDefaults.standard

    func autoInputEnabled() -> Bool {
        if defaults.object(forKey: Key.autoInput) == nil {
            return true
        }
        return defaults.bool(forKey: Key.autoInput)
    }

    func setAutoInputEnabled(_ enabled: Bool) {
        defaults.set(enabled, forKey: Key.autoInput)
    }
}
