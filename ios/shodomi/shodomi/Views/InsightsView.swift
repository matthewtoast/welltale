import SwiftUI
import SwiftData

struct InsightsView: View {
    @Environment(\.modelContext) private var modelContext
    @Query private var entries: [TrackingEntry]
    @State private var showingChatBot = false
    
    var body: some View {
        NavigationView {
            ScrollView {
                VStack(spacing: 24) {
                    ChatBotSection()
                    AnalyticsSection()
                    TrendsSection()
                    CorrelationsSection()
                }
                .padding()
            }
            .navigationTitle("Insights")
            .navigationBarTitleDisplayMode(.large)
            .sheet(isPresented: $showingChatBot) {
                ChatBotView()
            }
        }
    }
    
    @ViewBuilder
    private func ChatBotSection() -> some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("AI Health Assistant")
                .font(.headline)
            
            Button(action: {
                showingChatBot = true
            }) {
                HStack {
                    VStack(alignment: .leading, spacing: 4) {
                        Text("Chat with your AI health coach")
                            .font(.subheadline)
                            .fontWeight(.medium)
                        
                        Text("Ask questions about your data, get personalized insights, and receive health recommendations.")
                            .font(.caption)
                            .foregroundColor(.secondary)
                    }
                    
                    Spacer()
                    
                    Image(systemName: "brain.head.profile")
                        .font(.title)
                        .foregroundColor(.blue)
                }
                .padding()
                .background(Color(.systemBlue).opacity(0.1))
                .cornerRadius(12)
            }
            .buttonStyle(PlainButtonStyle())
        }
    }
    
    @ViewBuilder
    private func AnalyticsSection() -> some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Analytics")
                .font(.headline)
            
            LazyVGrid(columns: Array(repeating: GridItem(.flexible()), count: 2), spacing: 12) {
                AnalyticsCard(title: "Weekly Avg", subtitle: "Entries per day", value: "4.2", trend: .up)
                AnalyticsCard(title: "Consistency", subtitle: "Days tracked", value: "85%", trend: .up)
                AnalyticsCard(title: "Top Category", subtitle: "Most tracked", value: "Nutrition", trend: .neutral)
                AnalyticsCard(title: "Mood Score", subtitle: "This week", value: "7.8/10", trend: .down)
            }
        }
    }
    
    @ViewBuilder
    private func TrendsSection() -> some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Trends")
                .font(.headline)
            
            VStack(spacing: 12) {
                TrendCard(
                    title: "Sleep Duration",
                    subtitle: "Past 7 days",
                    description: "You're averaging 7.2 hours per night, which is within the healthy range.",
                    icon: "bed.double.fill",
                    color: .purple
                )
                
                TrendCard(
                    title: "Exercise Frequency",
                    subtitle: "This month",
                    description: "Great job! You've worked out 12 times this month, up 20% from last month.",
                    icon: "dumbbell.fill",
                    color: .orange
                )
                
                TrendCard(
                    title: "Nutrition Quality",
                    subtitle: "Recent meals",
                    description: "Your protein intake has been consistent, but consider adding more vegetables.",
                    icon: "leaf.fill",
                    color: .green
                )
            }
        }
    }
    
    @ViewBuilder
    private func CorrelationsSection() -> some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Correlations")
                .font(.headline)
            
            VStack(spacing: 12) {
                CorrelationCard(
                    title: "Sleep & Mood",
                    correlation: "Strong positive correlation",
                    description: "You feel 40% better on days with 7+ hours of sleep.",
                    strength: 0.8
                )
                
                CorrelationCard(
                    title: "Exercise & Energy",
                    correlation: "Moderate positive correlation", 
                    description: "Morning workouts boost your energy levels throughout the day.",
                    strength: 0.6
                )
            }
        }
    }
}

struct AnalyticsCard: View {
    let title: String
    let subtitle: String
    let value: String
    let trend: TrendDirection
    
    enum TrendDirection {
        case up, down, neutral
        
        var icon: String {
            switch self {
            case .up: return "arrow.up"
            case .down: return "arrow.down"
            case .neutral: return "minus"
            }
        }
        
        var color: Color {
            switch self {
            case .up: return .green
            case .down: return .red
            case .neutral: return .gray
            }
        }
    }
    
    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text(title)
                    .font(.subheadline)
                    .fontWeight(.medium)
                
                Spacer()
                
                Image(systemName: trend.icon)
                    .font(.caption)
                    .foregroundColor(trend.color)
            }
            
            Text(value)
                .font(.title2)
                .fontWeight(.bold)
            
            Text(subtitle)
                .font(.caption)
                .foregroundColor(.secondary)
        }
        .padding()
        .background(Color(.systemGray6))
        .cornerRadius(12)
    }
}

struct TrendCard: View {
    let title: String
    let subtitle: String
    let description: String
    let icon: String
    let color: Color
    
    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: icon)
                .font(.title2)
                .foregroundColor(color)
                .frame(width: 40)
            
            VStack(alignment: .leading, spacing: 4) {
                Text(title)
                    .font(.subheadline)
                    .fontWeight(.medium)
                
                Text(subtitle)
                    .font(.caption)
                    .foregroundColor(.secondary)
                
                Text(description)
                    .font(.caption)
                    .foregroundColor(.primary)
                    .fixedSize(horizontal: false, vertical: true)
            }
            
            Spacer()
        }
        .padding()
        .background(Color(.systemGray6))
        .cornerRadius(12)
    }
}

struct CorrelationCard: View {
    let title: String
    let correlation: String
    let description: String
    let strength: Double
    
    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text(title)
                    .font(.subheadline)
                    .fontWeight(.medium)
                
                Spacer()
                
                Text(String(format: "%.0f%%", strength * 100))
                    .font(.caption)
                    .fontWeight(.medium)
                    .foregroundColor(.blue)
            }
            
            Text(correlation)
                .font(.caption)
                .foregroundColor(.secondary)
            
            Text(description)
                .font(.caption)
                .foregroundColor(.primary)
                .fixedSize(horizontal: false, vertical: true)
            
            ProgressView(value: strength)
                .tint(.blue)
        }
        .padding()
        .background(Color(.systemGray6))
        .cornerRadius(12)
    }
}

struct ChatBotView: View {
    @Environment(\.dismiss) private var dismiss
    
    var body: some View {
        NavigationView {
            VStack {
                Text("AI Health Coach")
                    .font(.largeTitle)
                    .padding()
                
                Text("Coming soon! Your personal AI health assistant will help you understand your data and provide personalized recommendations.")
                    .multilineTextAlignment(.center)
                    .padding()
                
                Spacer()
            }
            .navigationTitle("Health Coach")
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
    InsightsView()
        .modelContainer(for: TrackingEntry.self, inMemory: true)
}