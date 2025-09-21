import Foundation

enum DevAuthSupport {
    static var session: AuthSession? {
        #if DEBUG
        guard let token = value(for: "DevSessionToken"), !token.isEmpty else {
            return nil
        }
        let user = APIUser(
            id: value(for: "DevSessionUserId") ?? "dev",
            provider: value(for: "DevSessionUserProvider") ?? "dev",
            email: emailValue(),
            roles: rolesValue()
        )
        let session = AuthSession(token: token, user: user)
        print("[welltale] dev session", session)
        return session
        #else
        return nil
        #endif
    }

    #if DEBUG
    private static func value(for key: String) -> String? {
        Bundle.main.object(forInfoDictionaryKey: key) as? String
    }

    private static func emailValue() -> String? {
        let raw = value(for: "DevSessionUserEmail")
        return (raw?.isEmpty ?? true) ? nil : raw
    }

    private static func rolesValue() -> [String] {
        let raw = value(for: "DevSessionUserRoles") ?? ""
        if raw.isEmpty { return [] }
        return raw.split(separator: ",").map { String($0) }
    }
    #endif
}
