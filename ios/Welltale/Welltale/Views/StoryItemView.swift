import SwiftUI

struct StoryItemView: View {
    let story: StoryMetaDTO

    var body: some View {
        HStack(spacing: 12) {
            thumbnail
            VStack(alignment: .leading, spacing: 4) {
                HStack(spacing: 6) {
                    Text(story.title)
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundColor(Color.wellText)
                        .lineLimit(1)
                    Text(story.author)
                        .font(.system(size: 13))
                        .foregroundColor(Color.wellMuted.opacity(0.8))
                        .lineLimit(1)
                }
                if !story.description.isEmpty {
                    Text(story.description)
                        .font(.caption2)
                        .foregroundColor(Color.wellMuted.opacity(0.8))
                        .lineLimit(2)
                }
            }
            Spacer()
        }
        .padding(.vertical, 8)
    }
}

private extension StoryItemView {
    var thumbnail: some View {
        let url = URL(string: story.thumbnail)
        return Group {
            if let url {
                AsyncImage(url: url) { image in
                    image
                        .resizable()
                        .scaledToFill()
                        .clipped()
                } placeholder: {
                    Color.gray.opacity(0.3)
                }
            } else {
                Color.gray.opacity(0.3)
            }
        }
        .frame(width: 48, height: 48)
        .clipShape(RoundedRectangle(cornerRadius: 8))
    }
}

#Preview {
    StoryItemView(story: StoryMetaDTO(
        id: "123",
        title: "Sample Story",
        author: "John Doe",
        description: "This is a sample story description that shows how the story item will look in the list.",
        thumbnail: "",
        tags: ["fiction", "adventure"],
        publish: .published,
        compile: .ready,
        createdAt: Date().timeIntervalSince1970,
        updatedAt: Date().timeIntervalSince1970
    ))
    .padding()
}
