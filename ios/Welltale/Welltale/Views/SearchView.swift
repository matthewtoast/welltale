import SwiftUI

struct SearchView: View {
    @Environment(\.dismiss) private var dismiss
    @State private var searchText = ""
    @State private var selectedFilter: SearchFilter = .all
    @State private var searchResults: [Story] = []
    @State private var isSearching = false
    
    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                searchBar
                filterTabs
                
                if searchText.isEmpty {
                    searchPrompt
                } else if isSearching {
                    loadingView
                } else if searchResults.isEmpty {
                    noResultsView
                } else {
                    searchResultsList
                }
            }
            .background(Color.black.ignoresSafeArea())
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button("Done") { dismiss() }
                        .foregroundColor(.white)
                }
            }
        }
    }
    
    private var searchBar: some View {
        HStack {
            Image(systemName: "magnifyingglass")
                .foregroundColor(.gray)
            
            TextField("Search by title, author, genre...", text: $searchText)
                .textFieldStyle(.plain)
                .foregroundColor(.white)
                .onChange(of: searchText) { _, newValue in
                    performSearch(newValue)
                }
            
            if !searchText.isEmpty {
                Button(action: { searchText = "" }) {
                    Image(systemName: "xmark.circle.fill")
                        .foregroundColor(.gray)
                }
            }
        }
        .padding()
        .background(.gray.opacity(0.2))
        .clipShape(RoundedRectangle(cornerRadius: 12))
        .padding(.horizontal, 20)
        .padding(.top, 10)
    }
    
    private var filterTabs: some View {
        HStack {
            ForEach(SearchFilter.allCases, id: \.self) { filter in
                Button(action: { selectedFilter = filter }) {
                    Text(filter.rawValue)
                        .font(.subheadline.weight(.medium))
                        .foregroundColor(selectedFilter == filter ? .black : .white)
                        .padding(.horizontal, 16)
                        .padding(.vertical, 8)
                        .background(selectedFilter == filter ? .white : .clear)
                        .clipShape(Capsule())
                }
            }
            Spacer()
        }
        .padding(.horizontal, 20)
        .padding(.top, 16)
    }
    
    private var searchPrompt: some View {
        VStack(spacing: 16) {
            Image(systemName: "magnifyingglass")
                .font(.system(size: 48))
                .foregroundColor(.gray)
            
            Text("Search for audiobooks")
                .font(.title2)
                .foregroundColor(.white)
            
            Text("Find stories by title, author, or genre")
                .foregroundColor(.gray)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
    
    private var loadingView: some View {
        ProgressView()
            .scaleEffect(1.2)
            .tint(.white)
            .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
    
    private var noResultsView: some View {
        VStack(spacing: 16) {
            Image(systemName: "book.slash")
                .font(.system(size: 48))
                .foregroundColor(.gray)
            
            Text("No results found")
                .font(.title2)
                .foregroundColor(.white)
            
            Text("Try adjusting your search terms")
                .foregroundColor(.gray)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
    
    private var searchResultsList: some View {
        ScrollView {
            LazyVStack(spacing: 12) {
                ForEach(searchResults, id: \.id) { story in
                    BookListItem(story: story, userLibrary: nil)
                }
            }
            .padding(.horizontal, 20)
            .padding(.top, 20)
        }
    }
    
    private func performSearch(_ query: String) {
        guard !query.isEmpty else {
            searchResults = []
            return
        }
        
        isSearching = true
        
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) {
            searchResults = MockData.allStories.filter { story in
                story.title.localizedCaseInsensitiveContains(query) ||
                story.authors.joined().localizedCaseInsensitiveContains(query) ||
                story.genre.localizedCaseInsensitiveContains(query)
            }
            isSearching = false
        }
    }
}

enum SearchFilter: String, CaseIterable {
    case all = "All"
    case myLibrary = "My Library"
    case forSale = "For Sale"
}