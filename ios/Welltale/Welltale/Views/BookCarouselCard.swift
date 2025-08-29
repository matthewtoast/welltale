import SwiftUI

struct BookCarouselCard: View {
    let story: Story
    
    var body: some View {
        VStack(spacing: 12) {
            AsyncImage(url: URL(string: story.thumbnailURL ?? "")) { image in
                image
                    .resizable()
                    .aspectRatio(contentMode: .fill)
            } placeholder: {
                Rectangle()
                    .fill(.gray.opacity(0.3))
                    .overlay {
                        Image(systemName: "book.closed")
                            .font(.title)
                            .foregroundColor(.gray)
                    }
            }
            .frame(width: 160, height: 200)
            .clipShape(RoundedRectangle(cornerRadius: 12))
            .shadow(color: .black.opacity(0.3), radius: 8, x: 0, y: 4)
            
            VStack(alignment: .leading, spacing: 4) {
                Text(story.title)
                    .font(.headline)
                    .foregroundColor(.white)
                    .lineLimit(2)
                    .multilineTextAlignment(.leading)
                
                Text(story.authors.joined(separator: ", "))
                    .font(.subheadline)
                    .foregroundColor(.gray)
                    .lineLimit(1)
                
                Text(formatDuration(story.duration))
                    .font(.caption)
                    .foregroundColor(.gray)
            }
            .frame(width: 160, alignment: .leading)
        }
    }
    
    private func formatDuration(_ duration: TimeInterval) -> String {
        let hours = Int(duration) / 3600
        let minutes = (Int(duration) % 3600) / 60
        return "\(hours)h \(minutes)m"
    }
}