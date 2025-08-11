import SwiftUI
import SwiftData

struct HomeView: View {
    @Environment(\.modelContext) private var modelContext
    @Query private var entries: [TrackingEntry]
    
    var body: some View {
        NavigationView {
            ScrollView {
                VStack(spacing: 24) {
                    WelcomeSection()
                    StreakSection()
                    QuickStatsSection()
                    RecentActivitySection()
                }
                .padding()
            }
            .navigationTitle("Shodomi")
            .navigationBarTitleDisplayMode(.large)
        }
    }
    
    @ViewBuilder
    private func WelcomeSection() -> some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                VStack(alignment: .leading) {
                    Text("Good morning! 👋")
                        .font(.title2)
                        .fontWeight(.semibold)
                    
                    Text("Ready to track your health today?")
                        .font(.subheadline)
                        .foregroundColor(.secondary)
                }
                Spacer()
            }
            .padding()
            .background(Color(.systemBlue).opacity(0.1))
            .cornerRadius(12)
        }
    }
    
    @ViewBuilder
    private func StreakSection() -> some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Your Streak")
                .font(.headline)
            
            HStack(spacing: 20) {
                StreakCard(title: "Current Streak", value: "7", subtitle: "days")
                StreakCard(title: "Best Streak", value: "23", subtitle: "days")
                StreakCard(title: "This Week", value: "5", subtitle: "entries")
            }
        }
    }
    
    @ViewBuilder
    private func QuickStatsSection() -> some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Today's Summary")
                .font(.headline)
            
            LazyVGrid(columns: Array(repeating: GridItem(.flexible()), count: 2), spacing: 12) {
                StatCard(icon: "fork.knife", title: "Meals", value: "3", color: .green)
                StatCard(icon: "dumbbell.fill", title: "Workouts", value: "1", color: .orange)
                StatCard(icon: "bed.double.fill", title: "Sleep", value: "7.5h", color: .purple)
                StatCard(icon: "heart.fill", title: "Mood", value: "Good", color: .red)
            }
        }
    }
    
    @ViewBuilder
    private func RecentActivitySection() -> some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Text("Recent Activity")
                    .font(.headline)
                Spacer()
                Button("See All") {
                    // TODO: Navigate to full activity list
                }
                .font(.subheadline)
                .foregroundColor(.blue)
            }
            
            if entries.isEmpty {
                VStack(spacing: 12) {
                    Image(systemName: "tray")
                        .font(.largeTitle)
                        .foregroundColor(.secondary)
                    
                    Text("No entries yet")
                        .font(.headline)
                        .foregroundColor(.secondary)
                    
                    Text("Tap the + button to start tracking!")
                        .font(.subheadline)
                        .foregroundColor(.secondary)
                }
                .padding(.vertical, 32)
            } else {
                ForEach(Array(entries.prefix(3)), id: \.id) { entry in
                    EntryRowView(entry: entry)
                }
            }
        }
    }
}

struct StreakCard: View {
    let title: String
    let value: String
    let subtitle: String
    
    var body: some View {
        VStack(spacing: 4) {
            Text(title)
                .font(.caption)
                .foregroundColor(.secondary)
            
            Text(value)
                .font(.title)
                .fontWeight(.bold)
                .foregroundColor(.primary)
            
            Text(subtitle)
                .font(.caption)
                .foregroundColor(.secondary)
        }
        .frame(maxWidth: .infinity)
        .padding()
        .background(Color(.systemGray6))
        .cornerRadius(12)
    }
}

struct StatCard: View {
    let icon: String
    let title: String
    let value: String
    let color: Color
    
    var body: some View {
        VStack(spacing: 8) {
            Image(systemName: icon)
                .font(.title2)
                .foregroundColor(color)
            
            Text(title)
                .font(.caption)
                .foregroundColor(.secondary)
            
            Text(value)
                .font(.headline)
                .fontWeight(.semibold)
        }
        .frame(maxWidth: .infinity)
        .padding()
        .background(Color(.systemGray6))
        .cornerRadius(12)
    }
}

#Preview {
    HomeView()
        .modelContainer(for: TrackingEntry.self, inMemory: true)
}