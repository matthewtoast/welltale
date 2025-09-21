import SwiftUI

struct HomeView: View {
    @State private var auth = AuthState()
    @State private var search = ""
    @State private var stories: [StoryMetaDTO] = []
    @State private var isLoading = false
    @State private var errorMessage: String?
    @State private var searchTask: Task<Void, Never>?
    
    var body: some View {
        NavigationView {
            List {
                Section {
                    TextField("Search stories", text: $search)
                        .textInputAutocapitalization(.never)
                        .disableAutocorrection(true)
                }
                Section {
                    if isLoading && stories.isEmpty {
                        HStack {
                            Spacer()
                            ProgressView()
                            Spacer()
                        }
                    } else if let message = errorMessage {
                        Text(message)
                            .foregroundStyle(.secondary)
                    } else if stories.isEmpty {
                        Text("No stories found")
                            .foregroundStyle(.secondary)
                    } else {
                        ForEach(stories) { story in
                            VStack(alignment: .leading, spacing: 6) {
                                Text(story.title)
                                    .font(.headline)
                                Text(story.author)
                                    .font(.subheadline)
                                    .foregroundStyle(.secondary)
                                if !story.description.isEmpty {
                                    Text(story.description)
                                        .font(.footnote)
                                        .foregroundStyle(.secondary)
                                        .lineLimit(3)
                                }
                                if !story.tags.isEmpty {
                                    Text(story.tags.joined(separator: ", "))
                                        .font(.caption)
                                        .foregroundStyle(.secondary)
                                }
                            }
                            .padding(.vertical, 6)
                        }
                    }
                }
            }
            .listStyle(.insetGrouped)
            .navigationTitle("Stories")
        }
        .onChange(of: search) { _ in
            scheduleSearch()
        }
        .task {
            await load(query: search)
        }
        .onDisappear {
            searchTask?.cancel()
        }
    }
}

private func makeStoryService(auth: AuthState) -> StoryService {
    let client = APIClient(
        baseURL: AppConfig.apiBaseURL,
        tokenProvider: { auth.token }
    )
    return StoryService(client: client)
}

private func trimmedQuery(_ value: String) -> String {
    value.trimmingCharacters(in: .whitespacesAndNewlines)
}

extension HomeView {
    private func scheduleSearch() {
        searchTask?.cancel()
        let query = search
        searchTask = Task {
            try? await Task.sleep(nanoseconds: 100_000_000)
            if Task.isCancelled { return }
            await load(query: query)
        }
    }

    @MainActor
    private func load(query: String) async {
        isLoading = true
        errorMessage = nil
        let normalized = trimmedQuery(query)
        let service = makeStoryService(auth: auth)
        defer { isLoading = false }
        do {
            let items = try await service.search(query: normalized.isEmpty ? nil : normalized)
            if Task.isCancelled { return }
            stories = items
        } catch {
            if Task.isCancelled { return }
            errorMessage = "Unable to load stories"
        }
    }
}

#Preview {
    HomeView()
}
