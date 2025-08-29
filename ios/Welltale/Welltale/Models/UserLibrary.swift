import Foundation
import SwiftData

@Model
final class UserLibrary {
    var storyId: String
    var currentPosition: TimeInterval
    var isFinished: Bool
    var isFavorite: Bool
    var dateAdded: Date
    var dateLastPlayed: Date?
    var rating: Int?
    
    var timeRemaining: TimeInterval {
        guard let story = story else { return 0 }
        return story.duration - currentPosition
    }
    
    var isStarted: Bool {
        currentPosition > 0
    }
    
    var status: PlaybackStatus {
        if isFinished { return .finished }
        if isStarted { return .current }
        return .new
    }
    
    @Relationship(inverse: \Story.id)
    var story: Story?
    
    init(
        storyId: String,
        currentPosition: TimeInterval = 0,
        isFinished: Bool = false,
        isFavorite: Bool = false,
        dateAdded: Date = Date(),
        dateLastPlayed: Date? = nil,
        rating: Int? = nil
    ) {
        self.storyId = storyId
        self.currentPosition = currentPosition
        self.isFinished = isFinished
        self.isFavorite = isFavorite
        self.dateAdded = dateAdded
        self.dateLastPlayed = dateLastPlayed
        self.rating = rating
    }
}

enum PlaybackStatus: String, CaseIterable {
    case new = "New"
    case current = "Current" 
    case finished = "Finished"
    case all = "All"
}