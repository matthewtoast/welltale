import SwiftUI

struct StoryItemView: View {
    let story: StoryMetaDTO
    
    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(story.title)
                .font(.headline)
                .foregroundColor(.primary)
                .lineLimit(2)
            
            Text(story.author)
                .font(.subheadline)
                .foregroundColor(.secondary)
            
            if !story.description.isEmpty {
                Text(story.description)
                    .font(.caption)
                    .foregroundColor(.secondary)
                    .lineLimit(3)
            }
            
            if !story.tags.isEmpty {
                Text(story.tags.joined(separator: ", "))
                    .font(.caption2)
                    .foregroundColor(.blue)
            }
        }
        .padding()
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color(UIColor.secondarySystemBackground))
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