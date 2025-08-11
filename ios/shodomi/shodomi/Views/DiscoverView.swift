import SwiftUI

struct DiscoverView: View {
    var body: some View {
        NavigationView {
            ScrollView {
                VStack(spacing: 24) {
                    ComingSoonSection()
                    FeaturePreviewSection()
                }
                .padding()
            }
            .navigationTitle("Discover")
            .navigationBarTitleDisplayMode(.large)
        }
    }
    
    @ViewBuilder
    private func ComingSoonSection() -> some View {
        VStack(spacing: 16) {
            Image(systemName: "sparkles")
                .font(.system(size: 48))
                .foregroundColor(.blue)
            
            Text("Coming Soon!")
                .font(.title)
                .fontWeight(.bold)
            
            Text("This tab will feature community challenges, health tips, recipe recommendations, and more ways to discover new aspects of your health journey.")
                .multilineTextAlignment(.center)
                .foregroundColor(.secondary)
        }
        .padding(.vertical, 32)
    }
    
    @ViewBuilder
    private func FeaturePreviewSection() -> some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("Planned Features")
                .font(.headline)
            
            VStack(spacing: 12) {
                FeaturePreviewCard(
                    icon: "trophy.fill",
                    title: "Challenges",
                    description: "Join community challenges and compete with friends",
                    color: .yellow
                )
                
                FeaturePreviewCard(
                    icon: "book.fill",
                    title: "Health Tips",
                    description: "Personalized tips based on your tracking data",
                    color: .green
                )
                
                FeaturePreviewCard(
                    icon: "person.2.fill",
                    title: "Community",
                    description: "Connect with others on similar health journeys",
                    color: .purple
                )
                
                FeaturePreviewCard(
                    icon: "lightbulb.fill",
                    title: "Recommendations",
                    description: "Discover new foods, exercises, and habits",
                    color: .orange
                )
            }
        }
    }
}

struct FeaturePreviewCard: View {
    let icon: String
    let title: String
    let description: String
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
                
                Text(description)
                    .font(.caption)
                    .foregroundColor(.secondary)
                    .fixedSize(horizontal: false, vertical: true)
            }
            
            Spacer()
            
            Text("Soon")
                .font(.caption)
                .fontWeight(.medium)
                .foregroundColor(.blue)
                .padding(.horizontal, 8)
                .padding(.vertical, 4)
                .background(Color.blue.opacity(0.1))
                .cornerRadius(6)
        }
        .padding()
        .background(Color(.systemGray6))
        .cornerRadius(12)
    }
}

#Preview {
    DiscoverView()
}