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
                Section("Config") {
                    VStack(alignment: .leading, spacing: 4) {
                        Text("Base URL")
                            .font(.caption)
                            .foregroundColor(.secondary)
                        Text(configText(AppConfig.apiBaseURL?.absoluteString))
                            .font(.footnote)
                            .textSelection(.enabled)
                        Text("Raw: \(configText(AppConfig.rawAPIBase))")
                            .font(.caption2)
                            .foregroundColor(.secondary)
                    }
                    VStack(alignment: .leading, spacing: 4) {
                        Text("Token")
                            .font(.caption)
                            .foregroundColor(.secondary)
                        Text(configText(AppConfig.devSessionToken))
                            .font(.footnote)
                            .lineLimit(1)
                            .truncationMode(.middle)
                            .textSelection(.enabled)
                        Text("Raw: \(configText(AppConfig.rawDevSessionToken))")
                            .font(.caption2)
                            .foregroundColor(.secondary)
                    }
                }
                Section("Tools") {
                    NavigationLink(destination: SpeechTestView()) {
                        Label("Speech Test", systemImage: "waveform")
                    }
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
                            NavigationLink(destination: StoryPlaybackView(storyId: story.id)) {
                                StoryItemView(story: story)
                            }
                            .buttonStyle(PlainButtonStyle())
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
        baseURL: AppConfig.apiBaseURL ?? URL(string: "http://localhost:3000")!,
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
