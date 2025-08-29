import SwiftUI

struct ProfileView: View {
    @State private var user = MockData.currentUser
    
    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 24) {
                    profileHeader
                    settingsSection
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
    
    private var profileHeader: some View {
        VStack(spacing: 16) {
            AsyncImage(url: URL(string: user.profileImageURL ?? "")) { image in
                image
                    .resizable()
                    .aspectRatio(contentMode: .fill)
            } placeholder: {
                Circle()
                    .fill(.gray.opacity(0.3))
                    .overlay {
                        Image(systemName: "person.fill")
                            .font(.system(size: 40))
                            .foregroundColor(.gray)
                    }
            }
            .frame(width: 100, height: 100)
            .clipShape(Circle())
            
            VStack(spacing: 4) {
                Text(user.name)
                    .font(.title2.bold())
                    .foregroundColor(.white)
                
                Text(user.email)
                    .font(.subheadline)
                    .foregroundColor(.gray)
            }
            
            HStack(spacing: 32) {
                VStack(spacing: 4) {
                    Text("\(user.totalBooksOwned)")
                        .font(.title3.bold())
                        .foregroundColor(.white)
                    Text("Books")
                        .font(.caption)
                        .foregroundColor(.gray)
                }
                
                VStack(spacing: 4) {
                    Text(formatListeningTime(user.totalListeningTime))
                        .font(.title3.bold())
                        .foregroundColor(.white)
                    Text("Hours")
                        .font(.caption)
                        .foregroundColor(.gray)
                }
            }
        }
        .padding(.vertical, 20)
    }
    
    private var settingsSection: some View {
        VStack(spacing: 0) {
            Text("Settings")
                .font(.title3.bold())
                .foregroundColor(.white)
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(.bottom, 16)
            
            VStack(spacing: 1) {
                SettingsRow(
                    icon: "bell",
                    title: "Notifications",
                    action: {}
                )
                
                SettingsRow(
                    icon: "cloud",
                    title: "Sync & Backup",
                    action: {}
                )
                
                SettingsRow(
                    icon: "speaker.wave.2",
                    title: "Audio Settings",
                    action: {}
                )
                
                SettingsRow(
                    icon: "moon",
                    title: "Sleep Timer",
                    action: {}
                )
                
                SettingsRow(
                    icon: "questionmark.circle",
                    title: "Help & Support",
                    action: {}
                )
                
                SettingsRow(
                    icon: "info.circle",
                    title: "About",
                    action: {}
                )
                
                SettingsRow(
                    icon: "rectangle.portrait.and.arrow.right",
                    title: "Sign Out",
                    action: {},
                    isDestructive: true
                )
            }
            .background(.gray.opacity(0.1))
            .clipShape(RoundedRectangle(cornerRadius: 12))
        }
    }
    
    private func formatListeningTime(_ time: TimeInterval) -> String {
        let hours = Int(time) / 3600
        return "\(hours)"
    }
}

struct SettingsRow: View {
    let icon: String
    let title: String
    let action: () -> Void
    let isDestructive: Bool
    
    init(icon: String, title: String, action: @escaping () -> Void, isDestructive: Bool = false) {
        self.icon = icon
        self.title = title
        self.action = action
        self.isDestructive = isDestructive
    }
    
    var body: some View {
        Button(action: action) {
            HStack(spacing: 16) {
                Image(systemName: icon)
                    .font(.title3)
                    .foregroundColor(isDestructive ? .red : .white)
                    .frame(width: 24)
                
                Text(title)
                    .font(.body)
                    .foregroundColor(isDestructive ? .red : .white)
                
                Spacer()
                
                Image(systemName: "chevron.right")
                    .font(.caption)
                    .foregroundColor(.gray)
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 16)
        }
    }
}

struct User {
    let name: String
    let email: String
    let profileImageURL: String?
    let totalBooksOwned: Int
    let totalListeningTime: TimeInterval
}