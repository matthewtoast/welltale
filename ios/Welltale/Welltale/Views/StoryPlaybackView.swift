import SwiftUI
import Combine

struct StoryPlaybackView: View {
    let storyId: String
    @StateObject private var viewModel = StoryPlaybackViewModel()
    
    var body: some View {
        VStack {
            if viewModel.isLoading {
                ProgressView("Loading story...")
                    .progressViewStyle(CircularProgressViewStyle())
                    .scaleEffect(1.5)
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else if let story = viewModel.story {
                VStack(spacing: 20) {
                    VStack(spacing: 8) {
                        Text(story.title)
                            .font(.largeTitle)
                            .fontWeight(.bold)
                            .multilineTextAlignment(.center)
                            .padding(.horizontal)
                        
                        Text("by \(story.author)")
                            .font(.title3)
                            .foregroundColor(.secondary)
                    }
                    .padding(.top, 40)
                    
                    Spacer()
                    
                    HStack(spacing: 40) {
                        Button(action: viewModel.skipBack) {
                            Image(systemName: "gobackward.10")
                                .font(.system(size: 30))
                                .foregroundColor(.primary)
                        }
                        
                        Button(action: viewModel.togglePlayPause) {
                            Image(systemName: viewModel.isPlaying ? "pause.circle.fill" : "play.circle.fill")
                                .font(.system(size: 60))
                                .foregroundColor(.blue)
                        }
                        
                        Button(action: viewModel.skipForward) {
                            Image(systemName: "goforward.10")
                                .font(.system(size: 30))
                                .foregroundColor(.primary)
                        }
                    }
                    .padding(.bottom, 50)
                }
            } else if let error = viewModel.error {
                VStack(spacing: 20) {
                    Image(systemName: "exclamationmark.triangle")
                        .font(.system(size: 50))
                        .foregroundColor(.red)
                    
                    Text("Failed to load story")
                        .font(.title2)
                        .fontWeight(.semibold)
                    
                    Text(error)
                        .font(.body)
                        .foregroundColor(.secondary)
                        .multilineTextAlignment(.center)
                        .padding(.horizontal)
                    
                    Button("Try Again") {
                        Task {
                            await viewModel.loadStory(id: storyId)
                        }
                    }
                    .buttonStyle(.borderedProminent)
                }
            }
        }
        .navigationBarTitleDisplayMode(.inline)
        .task {
            await viewModel.loadStory(id: storyId)
        }
    }
}

@MainActor
class StoryPlaybackViewModel: ObservableObject {
    @Published var story: StoryMetaDTO?
    @Published var isLoading = false
    @Published var error: String?
    @Published var isPlaying = false
    
    private let auth = AuthState()
    private var storyService: StoryService {
        let client = APIClient(
            baseURL: AppConfig.apiBaseURL,
            tokenProvider: { self.auth.token }
        )
        return StoryService(client: client)
    }
    
    func loadStory(id: String) async {
        isLoading = true
        error = nil
        
        do {
            story = try await storyService.fetchStory(id: id)
        } catch {
            self.error = error.localizedDescription
        }
        
        isLoading = false
    }
    
    func togglePlayPause() {
        isPlaying.toggle()
    }
    
    func skipBack() {
        print("Skip back 10 seconds")
    }
    
    func skipForward() {
        print("Skip forward 10 seconds")
    }
}

#Preview {
    NavigationView {
        StoryPlaybackView(storyId: "test-story-id")
    }
}
