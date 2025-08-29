import Foundation

struct MockData {
    static let recommendedStories: [Story] = [
        Story(
            id: "1",
            title: "The Midnight Library",
            authors: ["Matt Haig"],
            genre: "Fiction",
            duration: 8.5 * 3600,
            summary: "Between life and death there is a library.",
            publishedDate: Date()
        ),
        Story(
            id: "2", 
            title: "Project Hail Mary",
            authors: ["Andy Weir"],
            genre: "Science Fiction",
            duration: 16.2 * 3600,
            summary: "A lone astronaut must save humanity.",
            publishedDate: Date()
        ),
        Story(
            id: "3",
            title: "Klara and the Sun",
            authors: ["Kazuo Ishiguro"],
            genre: "Literary Fiction",
            duration: 9.5 * 3600,
            summary: "An artificial friend observes the world.",
            publishedDate: Date()
        ),
        Story(
            id: "4",
            title: "The Seven Moons of Maali Almeida",
            authors: ["Shehan Karunatilaka"],
            genre: "Magical Realism",
            duration: 12.3 * 3600,
            summary: "A photographer's afterlife adventure.",
            publishedDate: Date()
        )
    ]
    
    static let userLibraryStories: [Story] = [
        Story(
            id: "5",
            title: "Dune",
            authors: ["Frank Herbert"],
            genre: "Science Fiction",
            duration: 21.0 * 3600,
            summary: "Epic tale of desert planet Arrakis.",
            publishedDate: Date()
        ),
        Story(
            id: "6",
            title: "The Hobbit",
            authors: ["J.R.R. Tolkien"],
            genre: "Fantasy",
            duration: 11.5 * 3600,
            summary: "Bilbo's unexpected journey.",
            publishedDate: Date()
        ),
        Story(
            id: "7",
            title: "1984",
            authors: ["George Orwell"],
            genre: "Dystopian",
            duration: 10.2 * 3600,
            summary: "Big Brother is watching.",
            publishedDate: Date()
        )
    ]
    
    static let allStories: [Story] = recommendedStories + userLibraryStories + [
        Story(
            id: "8",
            title: "The Great Gatsby",
            authors: ["F. Scott Fitzgerald"],
            genre: "Classic",
            duration: 4.5 * 3600,
            summary: "The American Dream in the Jazz Age.",
            publishedDate: Date()
        ),
        Story(
            id: "9",
            title: "To Kill a Mockingbird",
            authors: ["Harper Lee"],
            genre: "Classic",
            duration: 12.5 * 3600,
            summary: "A story of racial injustice and childhood.",
            publishedDate: Date()
        )
    ]
    
    static let currentUser = User(
        name: "John Doe",
        email: "john.doe@example.com",
        profileImageURL: nil,
        totalBooksOwned: 24,
        totalListeningTime: 156.5 * 3600
    )
}