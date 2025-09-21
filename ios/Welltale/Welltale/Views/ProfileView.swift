import SwiftUI
import AuthenticationServices

struct ProfileView: View {
    @Binding var auth: AuthState
    @State private var isSigningIn = false
    @State private var errorMessage: String?

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 24) {
                    if auth.isSignedIn {
                        signedInSection
                    } else {
                        signedOutSection
                    }
                    if let errorMessage {
                        Text(errorMessage)
                            .foregroundColor(.red)
                            .font(.footnote)
                    }
                }
                .padding(.horizontal, 20)
                .padding(.top, 20)
            }
            .background(Color.black.ignoresSafeArea())
            .navigationTitle("Profile")
            .navigationBarTitleDisplayMode(.large)
            .toolbarColorScheme(.dark, for: .navigationBar)
        }
    }

    private var signedInSection: some View {
        VStack(spacing: 16) {
            let user = auth.session?.user
            Circle()
                .fill(.gray.opacity(0.3))
                .frame(width: 100, height: 100)
                .overlay {
                    Image(systemName: "person.fill")
                        .font(.system(size: 40))
                        .foregroundColor(.gray)
                }

            VStack(spacing: 4) {
                Text(user?.email ?? "Signed In")
                    .font(.title2.bold())
                    .foregroundColor(.white)

                Text(user?.id ?? "")
                    .font(.footnote)
                    .foregroundColor(.gray)
            }

            Button(action: signOut) {
                Text("Sign Out")
                    .foregroundColor(.red)
                    .padding(.horizontal, 24)
                    .padding(.vertical, 12)
                    .background(.gray.opacity(0.2))
                    .clipShape(Capsule())
            }
        }
    }

    private var signedOutSection: some View {
        VStack(spacing: 16) {
            Image(systemName: "person.crop.circle.badge.plus")
                .font(.system(size: 60))
                .foregroundColor(.gray)

            Text("Sign in with Apple")
                .font(.title2)
                .foregroundColor(.white)

            Text("Required to upload and browse stories")
                .foregroundColor(.gray)

            SignInWithAppleButton(.signIn) { request in
                request.requestedScopes = [.email]
            } onCompletion: { result in
                switch result {
                case .success(let authorization):
                    Task { await handleAuthorization(authorization) }
                case .failure(let error):
                    errorMessage = error.localizedDescription
                    isSigningIn = false
                }
            }
            .frame(height: 45)
            .signInWithAppleButtonStyle(.white)
            .disabled(isSigningIn)

#if DEBUG
            Button("Use Dev Session") {
                useDevSession()
            }
            .foregroundColor(.white)
            .padding(.horizontal, 24)
            .padding(.vertical, 12)
            .background(.gray.opacity(0.2))
            .clipShape(Capsule())
#endif

            if isSigningIn {
                ProgressView()
                    .tint(.white)
            }
        }
    }

    private func signOut() {
        auth.session = nil
        errorMessage = nil
    }

#if DEBUG
    private func useDevSession() {
        guard let session = DevAuthSupport.session else {
            errorMessage = "Dev session unavailable"
            return
        }
        auth.session = session
        errorMessage = nil
    }
#endif

    private func handleAuthorization(_ authorization: ASAuthorization) async {
        await MainActor.run {
            isSigningIn = true
            errorMessage = nil
        }
        guard let credential = authorization.credential as? ASAuthorizationAppleIDCredential,
              let tokenData = credential.identityToken,
              let token = String(data: tokenData, encoding: .utf8) else {
            await MainActor.run {
                errorMessage = "Invalid identity token"
                isSigningIn = false
            }
            return
        }
        do {
            let session = try await AuthService(baseURL: AppConfig.apiBaseURL).exchangeApple(identityToken: token)
            await MainActor.run {
                auth.session = session
                isSigningIn = false
            }
        } catch {
            let message: String
            if let authError = error as? AuthError, authError == .unauthorized {
                message = "Authentication failed"
            } else {
                message = error.localizedDescription
            }
            await MainActor.run {
                errorMessage = message
                isSigningIn = false
            }
        }
    }
}
