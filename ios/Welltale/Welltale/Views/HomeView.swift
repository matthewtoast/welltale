import SwiftUI

struct HomeView: View {
    @State private var showingSearch = false
    @State private var recommendedStories: [Story] = []
    
    var body: some View {
        NavigationStack {
            ZStack {
                Color.black.ignoresSafeArea()
                
                VStack(spacing: 0) {
                    headerView
                    
                    ScrollView {
                        VStack(spacing: 24) {
                            if !recommendedStories.isEmpty {
                                recommendedBooksCarousel
                            } else {
                                loadingView
                            }
                        }
                        .padding(.top, 20)
                    }
                }
            }
            .onAppear {
                loadRecommendedStories()
            }
            .sheet(isPresented: $showingSearch) {
                SearchView()
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
    
    private func loadRecommendedStories() {
        DispatchQueue.main.asyncAfter(deadline: .now() + 1) {
            recommendedStories = MockData.recommendedStories
        }
    }
}