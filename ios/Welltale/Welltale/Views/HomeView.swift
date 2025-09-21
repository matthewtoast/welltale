import SwiftUI

struct HomeView: View {
    @Binding var auth: AuthState
    @State private var showingSearch = false
    @State private var recommendedStories: [Story] = []
    @State private var isLoading = false

    var body: some View {
        NavigationStack {
            ZStack {
                Color.black.ignoresSafeArea()
                
                VStack(spacing: 0) {
                    headerView
                    
                    ScrollView {
                        VStack(spacing: 24) {
                            if isLoading {
                                loadingView
                            } else if !recommendedStories.isEmpty {
                                recommendedBooksCarousel
                            } else {
                                emptyState
                            }
                        }
                        .padding(.top, 20)
                    }
                }
            }
            .sheet(isPresented: $showingSearch) {
                SearchView(auth: $auth)
            }
            .task(id: auth.token) {
                await loadRecommendedStories()
            }
        }
    }
    
    private var headerView: some View {
        HStack {
            Text("Welltale")
                .font(.title.bold())
                .foregroundColor(.white)
            
            Spacer()
            
            Button(action: { showingSearch = true }) {
                Image(systemName: "magnifyingglass")
                    .font(.title2)
                    .foregroundColor(.white)
            }
        }
        .padding(.horizontal, 20)
        .padding(.top, 10)
    }
    
    private var recommendedBooksCarousel: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("Recommended for You")
                .font(.title2.bold())
                .foregroundColor(.white)
                .padding(.horizontal, 20)
            
            ScrollView(.horizontal, showsIndicators: false) {
                LazyHStack(spacing: 16) {
                    ForEach(recommendedStories, id: \.id) { story in
                        BookCarouselCard(story: story)
                    }
                }
                .padding(.horizontal, 20)
            }
        }
    }
    
    private var loadingView: some View {
        VStack(spacing: 16) {
            ProgressView()
                .scaleEffect(1.2)
                .tint(.white)
            
            Text("Loading recommendations...")
                .foregroundColor(.gray)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    private var emptyState: some View {
        VStack(spacing: 16) {
            Image(systemName: auth.isSignedIn ? "books.vertical" : "person.crop.circle.badge.exclamationmark")
                .font(.system(size: 48))
                .foregroundColor(.gray)

            Text(auth.isSignedIn ? "No stories yet" : "Sign in to see stories")
                .font(.title2)
                .foregroundColor(.white)

            Text(auth.isSignedIn ? "Upload a cartridge to get started" : "Sign in from the Profile tab")
                .foregroundColor(.gray)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
    
    private func loadRecommendedStories() async {
        await MainActor.run {
            isLoading = true
        }
        guard let token = auth.token else {
            await MainActor.run {
                recommendedStories = []
                isLoading = false
            }
            return
        }
        let client = APIClient(
            baseURL: AppConfig.apiBaseURL,
            tokenProvider: { token }
        )
        let service = StoryService(client: client)
        do {
            let items = try await service.fetchAll()
            let stories = items.map { Story.fromDTO($0) }
            await MainActor.run {
                recommendedStories = stories
                isLoading = false
            }
        } catch {
            await MainActor.run {
                recommendedStories = []
                isLoading = false
            }
        }
    }
}
