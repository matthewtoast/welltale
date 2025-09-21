import SwiftUI
import SwiftData

struct LibraryView: View {
    @Binding var auth: AuthState
    @Environment(\.modelContext) private var modelContext
    @Query private var userLibrary: [UserLibrary]
    @State private var selectedTab: PlaybackStatus = .all
    @State private var stories: [Story] = []
    
    var body: some View {
        NavigationStack {
            Group {
                if auth.isSignedIn {
                    VStack(spacing: 0) {
                        tabSelector

                        if filteredLibraryItems.isEmpty {
                            emptyStateView
                        } else {
                            libraryList
                        }
                    }
                    .onAppear {
                        loadUserLibrary()
                    }
                } else {
                    signedOutView
                }
            }
            .background(Color.black.ignoresSafeArea())
            .navigationTitle("Library")
            .navigationBarTitleDisplayMode(.large)
            .toolbarColorScheme(.dark, for: .navigationBar)
        }
    }
    
    private var tabSelector: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 16) {
                ForEach(PlaybackStatus.allCases, id: \.self) { status in
                    Button(action: { selectedTab = status }) {
                        VStack(spacing: 4) {
                            Text(status.rawValue)
                                .font(.subheadline.weight(.medium))
                                .foregroundColor(selectedTab == status ? .white : .gray)
                            
                            Rectangle()
                                .fill(selectedTab == status ? .white : .clear)
                                .frame(height: 2)
                        }
                    }
                    .frame(minWidth: 60)
                }
            }
            .padding(.horizontal, 20)
        }
        .padding(.vertical, 16)
    }
    
    private var libraryList: some View {
        ScrollView {
            LazyVStack(spacing: 12) {
                ForEach(filteredLibraryItems, id: \.storyId) { libraryItem in
                    if let story = stories.first(where: { $0.id == libraryItem.storyId }) {
                        BookListItem(story: story, userLibrary: libraryItem)
                    }
                }
            }
            .padding(.horizontal, 20)
            .padding(.top, 10)
        }
    }
    
    private var emptyStateView: some View {
        VStack(spacing: 16) {
            Image(systemName: selectedTab == .all ? "books.vertical" : 
                  selectedTab == .current ? "play.circle" :
                  selectedTab == .finished ? "checkmark.circle" : "plus.circle")
                .font(.system(size: 48))
                .foregroundColor(.gray)
            
            Text(emptyStateTitle)
                .font(.title2)
                .foregroundColor(.white)
            
            Text(emptyStateSubtitle)
                .foregroundColor(.gray)
                .multilineTextAlignment(.center)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .padding(.horizontal, 40)
    }

    private var signedOutView: some View {
        VStack(spacing: 16) {
            Image(systemName: "person.crop.circle.badge.exclamationmark")
                .font(.system(size: 48))
                .foregroundColor(.gray)

            Text("Sign in to view your library")
                .font(.title2)
                .foregroundColor(.white)

            Text("Stories will sync once you are signed in")
                .foregroundColor(.gray)
                .multilineTextAlignment(.center)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .padding(.horizontal, 40)
    }
    
    private var filteredLibraryItems: [UserLibrary] {
        switch selectedTab {
        case .all:
            return userLibrary
        case .current:
            return userLibrary.filter { $0.isStarted && !$0.isFinished }
        case .finished:
            return userLibrary.filter { $0.isFinished }
        case .new:
            return userLibrary.filter { !$0.isStarted }
        }
    }
    
    private var emptyStateTitle: String {
        switch selectedTab {
        case .all: return "No Stories in Library"
        case .current: return "No Stories in Progress"
        case .finished: return "No Finished Stories"
        case .new: return "No New Stories"
        }
    }
    
    private var emptyStateSubtitle: String {
        switch selectedTab {
        case .all: return "Browse the store to add stories to your library"
        case .current: return "Start listening to a story to see it here"
        case .finished: return "Complete stories will appear here"
        case .new: return "New stories you haven't started will appear here"
        }
    }
    
    private func loadUserLibrary() {
        stories = MockData.userLibraryStories
        
        // Add some sample library data if empty
        if userLibrary.isEmpty {
            for story in MockData.userLibraryStories.prefix(3) {
                let libraryItem = UserLibrary(
                    storyId: story.id,
                    currentPosition: TimeInterval.random(in: 0...(story.duration * 0.5)),
                    isFinished: Bool.random(),
                    isFavorite: Bool.random()
                )
                modelContext.insert(libraryItem)
            }
        }
    }
}
