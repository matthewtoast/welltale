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
                    
                    ScrollView {
                        VStack(alignment: .leading, spacing: 12) {
                            ForEach(Array(viewModel.engine?.storyEvents ?? []).indices, id: \.self) { index in
                                let event = viewModel.engine!.storyEvents[index]
                                HStack(alignment: .top, spacing: 8) {
                                    Text(event.from)
                                        .font(.caption)
                                        .fontWeight(.semibold)
                                        .foregroundColor(.blue)
                                        .frame(width: 80, alignment: .trailing)
                                    
                                    Text(event.body)
                                        .font(.body)
                                        .foregroundColor(.primary)
                                        .frame(maxWidth: .infinity, alignment: .leading)
                                }
                                .padding(.horizontal)
                            }
                        }
                        .padding(.vertical)
                    }
                    .frame(maxHeight: .infinity)
                    
                    if viewModel.engine?.isWaitingForInput == true {
                        VStack(spacing: 12) {
                            Text("What do you do?")
                                .font(.caption)
                                .foregroundColor(.secondary)
                            
                            HStack {
                                TextField("Enter your response...", text: $viewModel.userInput)
                                    .textFieldStyle(RoundedBorderTextFieldStyle())
                                    .onSubmit {
                                        Task {
                                            await viewModel.submitInput()
                                        }
                                    }
                                
                                Button("Submit") {
                                    Task {
                                        await viewModel.submitInput()
                                    }
                                }
                                .buttonStyle(.borderedProminent)
                                .disabled(viewModel.userInput.isEmpty)
                            }
                        }
                        .padding()
                        .background(Color(UIColor.secondarySystemBackground))
                    }
                    
                    HStack(spacing: 40) {
                        Button(action: viewModel.skipBack) {
                            Image(systemName: "backward.fill")
                                .font(.system(size: 30))
                                .foregroundColor(.primary)
                        }
                        .disabled(true)
                        
                        Button(action: {
                            Task {
                                await viewModel.togglePlayPause()
                            }
                        }) {
                            Image(systemName: (viewModel.engine?.isPlaying == true || viewModel.engine?.isProcessing == true) ? "pause.circle.fill" : "play.circle.fill")
                                .font(.system(size: 60))
                                .foregroundColor(.blue)
                        }
                        .disabled(viewModel.engine?.seamType == .finish || viewModel.engine?.isWaitingForInput == true)
                        
                        Button(action: viewModel.skipForward) {
                            Image(systemName: "forward.fill")
                                .font(.system(size: 30))
                                .foregroundColor(.primary)
                        }
                        .disabled(viewModel.engine?.isProcessing == true || viewModel.engine?.isWaitingForInput == true || viewModel.engine?.seamType == .finish)
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
    @Published var userInput = ""
    
    private let auth = AuthState()
    private var storyService: StoryService {
        let client = APIClient(
            baseURL: AppConfig.apiBaseURL,
            tokenProvider: { self.auth.token }
        )
        return StoryService(client: client)
    }
    
    @Published var engine: StoryEngine?
    
    func loadStory(id: String) async {
        isLoading = true
        error = nil
        
        do {
            story = try await storyService.fetchStory(id: id)
            
            engine = StoryEngine(storyId: id, storyService: storyService)
            
            engine?.$error
                .compactMap { $0 }
                .assign(to: &$error)
            
            engine?.initializeSession()
            
        } catch {
            self.error = error.localizedDescription
        }
        
        isLoading = false
    }
    
    func togglePlayPause() async {
        guard let engine = engine else { return }
        
        if engine.seamType == .finish {
            return
        }
        
        if engine.isPlaying || engine.isProcessing {
            engine.pause()
        } else if engine.session != nil {
            engine.resume()
        } else {
            await engine.startStory()
        }
    }
    
    func skipBack() {
        print("Skip back not implemented yet")
    }
    
    func skipForward() {
        engine?.skipCurrent()
    }
    
    func submitInput() async {
        guard !userInput.isEmpty else { return }
        await engine?.submitInput(userInput)
        userInput = ""
    }
}

#Preview {
    NavigationView {
        StoryPlaybackView(storyId: "test-story-id")
    }
}
