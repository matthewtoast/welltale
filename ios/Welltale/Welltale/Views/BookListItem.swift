import SwiftUI

struct BookListItem: View {
    let story: Story
    let userLibrary: UserLibrary?
    @State private var showingContextMenu = false
    
    var body: some View {
        HStack(spacing: 12) {
            thumbnail
            
            VStack(alignment: .leading, spacing: 4) {
                Text(story.title)
                    .font(.headline)
                    .foregroundColor(.white)
                    .lineLimit(2)
                
                Text(story.authors.joined(separator: ", "))
                    .font(.subheadline)
                    .foregroundColor(.gray)
                    .lineLimit(1)
                
                HStack {
                    if let userLibrary = userLibrary {
                        Text(formatTimeRemaining(userLibrary.timeRemaining))
                            .font(.caption)
                            .foregroundColor(.gray)
                    } else {
                        Text(formatDuration(story.duration))
                            .font(.caption)
                            .foregroundColor(.gray)
                    }
                    
                    Spacer()
                    
                    playButton
                    
                    Button(action: { showingContextMenu.toggle() }) {
                        Image(systemName: "ellipsis")
                            .font(.title3)
                            .foregroundColor(.gray)
                    }
                }
            }
        }
        .padding(.vertical, 8)
        .contextMenu {
            contextMenuItems
        }
    }
    
    private var thumbnail: some View {
        AsyncImage(url: URL(string: story.thumbnailURL ?? "")) { image in
            image
                .resizable()
                .aspectRatio(contentMode: .fill)
        } placeholder: {
            Rectangle()
                .fill(.gray.opacity(0.3))
                .overlay {
                    Image(systemName: "book.closed")
                        .font(.title2)
                        .foregroundColor(.gray)
                }
        }
        .frame(width: 60, height: 80)
        .clipShape(RoundedRectangle(cornerRadius: 8))
    }
    
    private var playButton: some View {
        Button(action: playStory) {
            Image(systemName: userLibrary?.isStarted == true ? "play.circle.fill" : "play.circle")
                .font(.title2)
                .foregroundColor(.white)
        }
    }
    
    @ViewBuilder
    private var contextMenuItems: some View {
        Button(action: {}) {
            Label("Get Info", systemImage: "info.circle")
        }
        
        if userLibrary != nil {
            Button(action: {}) {
                Label("Rate", systemImage: "star")
            }
            
            Button(action: {}) {
                Label(userLibrary?.isFavorite == true ? "Unfavorite" : "Favorite", 
                      systemImage: userLibrary?.isFavorite == true ? "heart.slash" : "heart")
            }
            
            Button(action: {}) {
                Label("Mark as Finished", systemImage: "checkmark.circle")
            }
        }
        
        Button(action: {}) {
            Label("Share", systemImage: "square.and.arrow.up")
        }
    }
    
    private func playStory() {
        // Implement play functionality
    }
    
    private func formatDuration(_ duration: TimeInterval) -> String {
        let hours = Int(duration) / 3600
        let minutes = (Int(duration) % 3600) / 60
        return "\(hours)h \(minutes)m"
    }
    
    private func formatTimeRemaining(_ timeRemaining: TimeInterval) -> String {
        let hours = Int(timeRemaining) / 3600
        let minutes = (Int(timeRemaining) % 3600) / 60
        return "\(hours)h \(minutes)m left"
    }
}