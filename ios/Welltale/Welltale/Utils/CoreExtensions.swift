import CommonCrypto
import SwiftUI

extension String {
    func sha256() -> String {
        let data = Data(self.utf8)
        var hash = [UInt8](repeating: 0, count: Int(CC_SHA256_DIGEST_LENGTH))
        data.withUnsafeBytes {
            _ = CC_SHA256($0.baseAddress, CC_LONG(data.count), &hash)
        }
        return hash.map { String(format: "%02x", $0) }.joined()
    }
}

extension Binding {
    func onChange(_ handler: @escaping (Value) -> Void) -> Binding<Value> {
        return Binding(
            get: { self.wrappedValue },
            set: { newValue in
                self.wrappedValue = newValue
                handler(newValue)
            }
        )
    }

    init?(optional: Binding<Value?>) {
        guard let value = optional.wrappedValue else { return nil }
        self.init(
            get: { value },
            set: { optional.wrappedValue = $0 }
        )
    }
}

extension Dictionary where Key == String, Value == Any {
    func value<T>(_ key: Key) -> T? {
        return self[key] as? T
    }

    func value<T>(_ key: Key, _ defaultValue: T) -> T {
        return self[key] as? T ?? defaultValue
    }
}

extension String {
    func trim() -> String {
        self.trimmingCharacters(in: .whitespacesAndNewlines)
    }
}

extension Array {
    subscript(safe index: Int) -> Element? {
        return indices.contains(index) ? self[index] : nil
    }
    
    mutating func removeUpto(index: Int) {
        self = Array(self.dropFirst(index + 1))
    }
}

extension Array where Element: Equatable {
    mutating func remove(element: Element) {
        self = self.filter { $0 != element }
    }
}

extension Color {
    static let wellBackground = Color(red: 11.0 / 255.0, green: 10.0 / 255.0, blue: 19.0 / 255.0)
    static let wellSurface = Color(red: 17.0 / 255.0, green: 15.0 / 255.0, blue: 29.0 / 255.0)
    static let wellPanel = Color(red: 15.0 / 255.0, green: 20.0 / 255.0, blue: 30.0 / 255.0)
    static let wellText = Color(red: 250.0 / 255.0, green: 246.0 / 255.0, blue: 239.0 / 255.0)
    static let wellMuted = Color(red: 119.0 / 255.0, green: 119.0 / 255.0, blue: 119.0 / 255.0)
}
