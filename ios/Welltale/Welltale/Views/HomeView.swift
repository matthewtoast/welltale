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
            ZStack {
                Color.wellBackground.ignoresSafeArea()
                List {
                    HStack {
                        TextField("Search stories", text: $search)
                            .padding(10)
                            .background(Color.wellPanel)
                            .cornerRadius(10)
                            .textInputAutocapitalization(.never)
                            .disableAutocorrection(true)
                            .foregroundColor(Color.wellText)
                            .colorScheme(.dark)
                    }
                    .listRowInsets(EdgeInsets(top: 12, leading: 16, bottom: 8, trailing: 16))
                    .listRowBackground(Color.clear)
                    .listRowSeparator(.hidden)

                    if isLoading && stories.isEmpty {
                        HStack {
                            Spacer()
                            ProgressView()
                                .tint(Color.wellText)
                            Spacer()
                        }
                        .listRowInsets(EdgeInsets(top: 24, leading: 0, bottom: 24, trailing: 0))
                        .listRowBackground(Color.clear)
                        .listRowSeparator(.hidden)
                    } else if let message = errorMessage {
                        Text(message)
                            .foregroundColor(Color.wellMuted)
                            .listRowInsets(EdgeInsets(top: 24, leading: 16, bottom: 24, trailing: 16))
                            .listRowBackground(Color.clear)
                            .listRowSeparator(.hidden)
                    } else if stories.isEmpty {
                        Text("No stories found")
                            .foregroundColor(Color.wellMuted)
                            .listRowInsets(EdgeInsets(top: 24, leading: 16, bottom: 24, trailing: 16))
                            .listRowBackground(Color.clear)
                            .listRowSeparator(.hidden)
                    } else {
                        ForEach(stories) { story in
                            NavigationLink(destination: StoryPlaybackView(storyId: story.id)) {
                                StoryItemView(story: story)
                            }
                            .listRowInsets(EdgeInsets(top: 4, leading: 16, bottom: 4, trailing: 16))
                            .listRowBackground(Color.clear)
                            .buttonStyle(PlainButtonStyle())
                            .listRowSeparator(.hidden)
                        }
                    }
                }
                .listStyle(.plain)
                .scrollContentBackground(.hidden)
            }
            .navigationBarTitleDisplayMode(.inline)
            .navigationTitle("")
        }
        .background(Color.wellBackground)
        .tint(Color.wellText)
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
        baseURL: AppConfig.apiBaseURL!,
        tokenProvider: { auth.token }
    )
    return StoryService(client: client)
}

private func trimmedQuery(_ value: String) -> String {
    value.trimmingCharacters(in: .whitespacesAndNewlines)
}

extension HomeView {
    private func configText(_ value: String?) -> String {
        value ?? "(missing)"
    }

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
