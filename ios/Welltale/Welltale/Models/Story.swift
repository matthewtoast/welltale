import Foundation
import SwiftData

@Model
final class Story {
    var id: String
    var title: String
    var authors: [String]
    var genre: String
    var thumbnailURL: String?
    var duration: TimeInterval
    var summary: String
    var publishedDate: Date
    var price: Double?
    var isAvailableForPurchase: Bool
    
    init(
        id: String,
        title: String,
        authors: [String],
        genre: String,
        thumbnailURL: String? = nil,
        duration: TimeInterval,
        summary: String,
        publishedDate: Date,
        price: Double? = nil,
        isAvailableForPurchase: Bool = true
    ) {
        self.id = id
        self.title = title
        self.authors = authors
        self.genre = genre
        self.thumbnailURL = thumbnailURL
        self.duration = duration
        self.summary = summary
        self.publishedDate = publishedDate
        self.price = price
        self.isAvailableForPurchase = isAvailableForPurchase
    }
}