import Foundation

extension Story {
    static func fromDTO(_ dto: StoryMetaDTO) -> Story {
        Story(
            id: dto.id,
            title: dto.title,
            authors: [dto.author],
            genre: dto.tags.first ?? "Story",
            thumbnailURL: nil,
            duration: 0,
            summary: dto.description,
            publishedDate: Date(timeIntervalSince1970: dto.createdAt / 1000),
            price: nil,
            isAvailableForPurchase: dto.publish == "published"
        )
    }
}
