import Foundation

struct AuthState: Equatable {
    var session: AuthSession?

    init(session: AuthSession? = DevAuthSupport.session) {
        self.session = session
    }

    var token: String? {
        session?.token
    }

    var isSignedIn: Bool {
        session != nil
    }
}
