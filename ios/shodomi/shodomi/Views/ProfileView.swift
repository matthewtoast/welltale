import SwiftUI
import SwiftData

struct ProfileView: View {
    @Environment(\.modelContext) private var modelContext
    @Query private var entries: [TrackingEntry]
    @State private var showingSettings = false
    
    var body: some View {
        NavigationView {
            ScrollView {
                VStack(spacing: 24) {
                    ProfileHeaderSection()
                    StatsOverviewSection()
                    SettingsSection()
                    AboutSection()
                }
                .padding()
            }
            .navigationTitle("Profile")
            .navigationBarTitleDisplayMode(.large)
            .sheet(isPresented: $showingSettings) {
                SettingsView()
            }
        }
    }
    
    @ViewBuilder
    private func ProfileHeaderSection() -> some View {
        VStack(spacing: 16) {
            Image(systemName: "person.circle.fill")
                .font(.system(size: 80))
                .foregroundColor(.blue)
            
            VStack(spacing: 4) {
                Text("Health Tracker")
                    .font(.title2)
                    .fontWeight(.semibold)
                
                Text("Member since January 2025")
                    .font(.subheadline)
                    .foregroundColor(.secondary)
            }
        }
        .padding(.vertical)
    }
    
    @ViewBuilder
    private func StatsOverviewSection() -> some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Your Stats")
                .font(.headline)
            
            LazyVGrid(columns: Array(repeating: GridItem(.flexible()), count: 2), spacing: 12) {
                StatCard(icon: "calendar", title: "Days Active", value: "42", color: .blue)
                StatCard(icon: "plus.circle", title: "Total Entries", value: "\(entries.count)", color: .green)
                StatCard(icon: "flame.fill", title: "Current Streak", value: "7", color: .orange)
                StatCard(icon: "target", title: "Weekly Goal", value: "85%", color: .purple)
            }
        }
    }
    
    @ViewBuilder
    private func SettingsSection() -> some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Settings")
                .font(.headline)
            
            VStack(spacing: 0) {
                SettingsRow(icon: "gearshape.fill", title: "App Settings", subtitle: "Notifications, privacy, data") {
                    showingSettings = true
                }
                
                Divider()
                    .padding(.leading, 44)
                
                SettingsRow(icon: "icloud.fill", title: "Data & Sync", subtitle: "Backup and sync options") {
                    // TODO: Data settings
                }
                
                Divider()
                    .padding(.leading, 44)
                
                SettingsRow(icon: "heart.fill", title: "Health Integration", subtitle: "Connect with Health app") {
                    // TODO: Health integration
                }
                
                Divider()
                    .padding(.leading, 44)
                
                SettingsRow(icon: "questionmark.circle.fill", title: "Help & Support", subtitle: "FAQ, contact us") {
                    // TODO: Help & support
                }
            }
            .background(Color(.systemGray6))
            .cornerRadius(12)
        }
    }
    
    @ViewBuilder
    private func AboutSection() -> some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("About")
                .font(.headline)
            
            VStack(spacing: 0) {
                SettingsRow(icon: "info.circle.fill", title: "About Shodomi", subtitle: "Version 1.0") {
                    // TODO: About page
                }
                
                Divider()
                    .padding(.leading, 44)
                
                SettingsRow(icon: "star.fill", title: "Rate the App", subtitle: "Share your feedback") {
                    // TODO: App Store rating
                }
                
                Divider()
                    .padding(.leading, 44)
                
                SettingsRow(icon: "envelope.fill", title: "Contact Us", subtitle: "Get in touch") {
                    // TODO: Contact form
                }
            }
            .background(Color(.systemGray6))
            .cornerRadius(12)
        }
    }
}

struct SettingsRow: View {
    let icon: String
    let title: String
    let subtitle: String
    let action: () -> Void
    
    var body: some View {
        Button(action: action) {
            HStack(spacing: 12) {
                Image(systemName: icon)
                    .font(.title3)
                    .foregroundColor(.blue)
                    .frame(width: 24)
                
                VStack(alignment: .leading, spacing: 2) {
                    Text(title)
                        .font(.subheadline)
                        .fontWeight(.medium)
                        .foregroundColor(.primary)
                    
                    Text(subtitle)
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
                
                Spacer()
                
                Image(systemName: "chevron.right")
                    .font(.caption)
                    .foregroundColor(.secondary)
            }
            .padding()
        }
        .buttonStyle(PlainButtonStyle())
    }
}

struct SettingsView: View {
    @Environment(\.dismiss) private var dismiss
    
    var body: some View {
        NavigationView {
            ScrollView {
                VStack(spacing: 24) {
                    Text("Settings")
                        .font(.largeTitle)
                        .padding()
                    
                    Text("App settings, notifications, and privacy controls will be available here.")
                        .multilineTextAlignment(.center)
                        .padding()
                    
                    Spacer()
                }
            }
            .navigationTitle("Settings")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button("Done") {
                        dismiss()
                    }
                }
            }
        }
    }
}

#Preview {
    ProfileView()
        .modelContainer(for: TrackingEntry.self, inMemory: true)
}