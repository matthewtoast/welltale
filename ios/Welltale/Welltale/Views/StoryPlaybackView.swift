import SwiftUI
import Combine

struct StoryPlaybackView: View {
    let storyId: String
    @StateObject private var viewModel = StoryPlaybackViewModel()

    var body: some View {
        ZStack {
            Color.wellBackground.ignoresSafeArea()
            VStack(alignment: .leading, spacing: 16) {
                if viewModel.isLoading {
                    ProgressView("Loading")
                        .tint(Color.wellText)
                        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .center)
                } else if let story = viewModel.story {
                    VStack(alignment: .leading, spacing: 16) {
                        VStack(alignment: .leading, spacing: 4) {
                            Text(story.title)
                                .font(.title)
                                .fontWeight(.semibold)
                                .foregroundColor(Color.wellText)
                            Text(story.author)
                                .font(.subheadline)
                                .foregroundColor(Color.wellMuted)
                        }
                        ScrollView {
                            VStack(alignment: .leading, spacing: 12) {
                                ForEach(Array(viewModel.events.enumerated()), id: \.offset) { item in
                                    let event = item.element
                                    VStack(alignment: .leading, spacing: 4) {
                                        Text(event.from)
                                            .font(.caption)
                                            .foregroundColor(Color.wellMuted)
                                        Text(event.body)
                                            .font(.body)
                                            .foregroundColor(Color.wellText)
                                    }
                                    .frame(maxWidth: .infinity, alignment: .leading)
                                    .padding(.vertical, 4)
                                    .padding(.horizontal, 8)
                                    .background(Color.wellSurface)
                                    .clipShape(RoundedRectangle(cornerRadius: 8))
                                }
                            }
                            .frame(maxWidth: .infinity, alignment: .leading)
                        }
                        statusSection
                        if viewModel.isWaitingForInput {
                            inputSection
                        }
                        if viewModel.seam == .finish {
                            Text("Story complete")
                                .font(.headline)
                                .foregroundColor(.green)
                        }
                        if viewModel.seam == .error {
                            Text(viewModel.error ?? "An error occurred")
                                .font(.footnote)
                                .foregroundColor(.red)
                        }
                    }
                } else if let error = viewModel.error {
                    VStack(spacing: 12) {
                        Text("Failed to load story")
                            .font(.headline)
                            .foregroundColor(Color.wellText)
                        Text(error)
                            .font(.body)
                            .foregroundColor(Color.wellMuted)
                    }
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                } else {
                    Text("No story loaded")
                        .foregroundColor(Color.wellText)
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                }
            }
            .padding()
        }
        .tint(Color.wellText)
        .task {
            await viewModel.preparePermissions()
            await viewModel.loadStory(id: storyId)
        }
    }

    private var statusSection: some View {
        HStack(spacing: 12) {
            Circle()
                .fill(viewModel.isPlayingForeground ? Color.green : Color.wellMuted)
                .frame(width: 12, height: 12)
            Text(statusText)
                .font(.footnote)
                .foregroundColor(Color.wellMuted)
            Spacer()
            Button {
                viewModel.togglePlayback()
            } label: {
                Image(systemName: viewModel.playbackIcon)
                    .font(.footnote)
                    .foregroundColor(Color.wellText)
            }
            .disabled(!viewModel.canTogglePlayback)
            .accessibilityLabel(viewModel.playbackLabel)
        }
    }

    private var inputSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            if !viewModel.transcript.isEmpty {
                VStack(alignment: .leading, spacing: 4) {
                    Text("Transcript")
                        .font(.caption)
                        .foregroundColor(Color.wellMuted)
                    Text(viewModel.transcript)
                        .font(.body)
                        .padding(8)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .background(Color.wellPanel)
                        .clipShape(RoundedRectangle(cornerRadius: 8))
                        .foregroundColor(Color.wellText)
                }
            }
            VStack(alignment: .leading, spacing: 8) {
                Text("Respond")
                    .font(.caption)
                    .foregroundColor(Color.wellMuted)
                TextField("Type your response", text: $viewModel.inputDraft)
                    .padding(10)
                    .background(Color.wellPanel)
                    .cornerRadius(8)
                    .foregroundColor(Color.wellText)
                    .colorScheme(.dark)
                HStack {
                    Button("Use Transcript") {
                        viewModel.useTranscript()
                    }
                    .disabled(viewModel.transcript.isEmpty)
                    .foregroundColor(Color.wellText)
                    Spacer()
                    Button("Submit") {
                        viewModel.submitInput()
                    }
                    .disabled(!viewModel.canSubmit)
                    .foregroundColor(Color.wellText)
                }
            }
        }
        .padding()
        .background(Color.wellSurface)
        .clipShape(RoundedRectangle(cornerRadius: 12))
    }

    private var statusText: String {
        if viewModel.seam == .finish {
            return "Finished"
        }
        if viewModel.seam == .error {
            return "Error"
        }
        if viewModel.isWaitingForInput {
            return "Listening"
        }
        if viewModel.isPaused {
            return "Paused"
        }
        return viewModel.isPlayingForeground ? "Playing" : "Idle"
    }
}

@MainActor
final class StoryPlaybackViewModel: ObservableObject {
    @Published var story: StoryMetaDTO?
    @Published var isLoading = false
    @Published var error: String?
    @Published var events: [StoryEvent] = []
    @Published var currentEvent: StoryEvent?
    @Published var isWaitingForInput = false
    @Published var isPlayingForeground = false
    @Published var seam: SeamType = .grant
    @Published var inputDraft = ""
    @Published var transcript = ""
    @Published var isSpeechActive = false
    @Published var isPaused = false
    @Published var hasPlaybackControls = false

    private var runner: StoryRunner?
    private let speechController = SpeechCaptureController(locale: .en_us, config: .default)
    private var speechListenersConfigured = false
    private var started = false

    deinit {
        let currentRunner = runner
        runner = nil
        Task {
            await currentRunner?.stop()
        }
    }

    func loadStory(id: String) async {
        if isLoading {
            return
        }
        isLoading = true
        error = nil
        hasPlaybackControls = false
        started = false
        isPaused = false
        do {
            guard let configuration = StoryConfiguration.load() else {
                error = "Missing WelltaleAPIBase or DevSessionToken"
                isLoading = false
                return
            }
            let service = StoryService(configuration: configuration)
            let detail = try await service.fetchStory(id: id)
            story = detail.meta
            let options = makeOptions(storyId: id)
            let session = StorySessionFactory.make(id: id, source: detail.source)
            let coordinator = StoryCoordinator(session: session, options: options, service: service)
            let handlers = makeHandlers()
            let runner = StoryRunner(coordinator: coordinator, handlers: handlers)
            self.runner = runner
            hasPlaybackControls = true
            isPaused = true
            configureSpeechCallbacks()
        } catch {
            self.error = error.localizedDescription
        }
        isLoading = false
    }

    func submitInput() {
        let trimmedDraft = inputDraft.trimmingCharacters(in: .whitespacesAndNewlines)
        let trimmedTranscript = transcript.trimmingCharacters(in: .whitespacesAndNewlines)
        let payload = trimmedDraft.isEmpty ? trimmedTranscript : trimmedDraft
        if payload.isEmpty {
            return
        }
        stopSpeechCapture()
        inputDraft = ""
        transcript = ""
        let event = StoryEvent(
            time: Int(Date().timeIntervalSince1970 * 1000),
            from: "YOU",
            to: "",
            obs: [],
            body: payload,
            tags: []
        )
        events.append(event)
        currentEvent = event
        isWaitingForInput = false
        guard let currentRunner = runner else {
            return
        }
        Task {
            await currentRunner.submit(payload)
        }
    }

    func preparePermissions() async {
        await speechController.preparePermissions()
    }

    func play() {
        if isWaitingForInput || seam == .finish || seam == .error {
            return
        }
        if !started {
            started = true
            isPaused = false
            guard let currentRunner = runner else {
                return
            }
            Task {
                await currentRunner.start()
            }
            return
        }
        if isPaused {
            isPaused = false
            guard let currentRunner = runner else {
                return
            }
            Task {
                await currentRunner.resume()
            }
        }
    }

    func pause() {
        if !started || isPaused {
            return
        }
        isPaused = true
        guard let currentRunner = runner else {
            return
        }
        Task {
            await currentRunner.pause()
        }
    }

    func togglePlayback() {
        if isPaused {
            play()
        } else {
            pause()
        }
    }

    func useTranscript() {
        if transcript.isEmpty {
            return
        }
        inputDraft = transcript
    }

    var canSubmit: Bool {
        let hasDraft = !inputDraft.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
        let hasTranscript = !transcript.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
        return hasDraft || hasTranscript
    }

    private func makeHandlers() -> StoryRunnerHandlers {
        StoryRunnerHandlers(
            update: { [weak self] snapshot in
                await MainActor.run {
                    self?.apply(snapshot: snapshot)
                }
            },
            requestInput: { [weak self] in
                await MainActor.run {
                    self?.beginSpeechCapture()
                }
            },
            didFinish: { [weak self] in
                await MainActor.run {
                    self?.seam = .finish
                }
            },
            didError: { [weak self] message in
                await MainActor.run {
                    self?.error = message
                    self?.seam = .error
                }
            }
        )
    }

    private func apply(snapshot: StoryRunnerSnapshot) {
        events = snapshot.events
        currentEvent = snapshot.currentEvent
        isWaitingForInput = snapshot.isWaitingForInput
        isPlayingForeground = snapshot.isPlayingForeground
        seam = snapshot.seam
        isPaused = snapshot.isPaused
    }

    private func makeOptions(storyId: String) -> StoryOptions {
        StoryOptions(
            verbose: false,
            seed: "ios-\(storyId)",
            loop: 0,
            ream: 100,
            doGenerateAudio: true,
            doGenerateImage: false,
            maxCheckpoints: 20,
            inputRetryMax: 3,
            models: ["openai/gpt-4.1-mini", "openai/gpt-4.1-nano"]
        )
    }

    private func beginSpeechCapture() {
        configureSpeechCallbacks()
        isSpeechActive = true
        transcript = ""
        Task {
            await speechController.start()
        }
    }

    private func stopSpeechCapture() {
        speechController.stop(reason: .user)
        isSpeechActive = false
    }

    private func configureSpeechCallbacks() {
        if speechListenersConfigured {
            return
        }
        speechListenersConfigured = true
        speechController.emitter.on(.transcriptUpdated) { [weak self] in
            Task { @MainActor [weak self] in
                self?.transcript = self?.speechController.accumulatedText ?? ""
            }
        }
        speechController.emitter.on(.stopped) { [weak self] in
            Task { @MainActor [weak self] in
                self?.isSpeechActive = false
            }
        }
    }

    var canTogglePlayback: Bool {
        hasPlaybackControls && seam != .finish && seam != .error && !isWaitingForInput
    }

    var playbackIcon: String {
        isPaused ? "play.fill" : "pause.fill"
    }

    var playbackLabel: String {
        isPaused ? "Play" : "Pause"
    }
}

#Preview {
    StoryPlaybackView(storyId: "demo")
}
