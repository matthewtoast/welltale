import SwiftUI

struct StoryItemView: View {
    let story: StoryMetaDTO
    
    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(story.title)
                .font(.headline)
                .foregroundColor(Color.wellText)
                .lineLimit(2)
            
            Text(story.author)
                .font(.subheadline)
                .foregroundColor(Color.wellText)
            
            if !story.description.isEmpty {
                Text(story.description)
                    .font(.caption)
                    .foregroundColor(Color.wellText)
                    .lineLimit(3)
            }
            
            if !story.tags.isEmpty {
                Text(story.tags.joined(separator: ", "))
                    .font(.caption2)
                    .foregroundColor(Color.wellText)
            }
        }
        .padding()
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color.wellSurface)
        .cornerRadius(10)
    }
}

#Preview {
    StoryItemView(story: StoryMetaDTO(
        id: "123",
        title: "Sample Story",
        author: "John Doe",
        description: "This is a sample story description that shows how the story item will look in the list.",
        tags: ["fiction", "adventure"],
        publish: .published,
        compile: .ready,
        createdAt: Date().timeIntervalSince1970,
        updatedAt: Date().timeIntervalSince1970
    ))
    .padding()
}
