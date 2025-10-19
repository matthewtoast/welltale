import SwiftUI
import Combine
import AudioToolbox

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
            HStack {
                Text("Respond")
                    .font(.caption)
                    .foregroundColor(Color.wellMuted)
                Spacer()
                Toggle("Auto", isOn: Binding(
                    get: { viewModel.mode == .auto },
                    set: { viewModel.setAuto($0) }
                ))
                .toggleStyle(SwitchToggleStyle(tint: Color.wellText))
                .foregroundColor(Color.wellText)
            }
            HStack(spacing: 8) {
                TextField(
                    "Type your response",
                    text: Binding(
                        get: { viewModel.inputDraft },
                        set: { viewModel.updateDraft($0) }
                    )
                )
                .padding(10)
                .background(Color.wellPanel)
                .cornerRadius(8)
                .foregroundColor(Color.wellText)
                .colorScheme(.dark)
                .onSubmit {
                    viewModel.submitInput()
                }
                Button {
                    viewModel.toggleMic()
                } label: {
                    Image(systemName: viewModel.micIcon)
                        .font(.body)
                        .foregroundColor(Color.wellText)
                }
                Button("Submit") {
                    viewModel.submitInput()
                }
                .disabled(!viewModel.canSubmit)
                .foregroundColor(Color.wellText)
            }
            if viewModel.showAutoProgress {
                GeometryReader { proxy in
                    ZStack(alignment: .leading) {
                        Capsule()
                            .fill(Color.wellPanel)
                            .frame(height: 2)
                        Capsule()
                            .fill(Color.wellText)
                            .frame(width: proxy.size.width * CGFloat(viewModel.autoProgress), height: 2)
                    }
                }
                .frame(height: 2)
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
            return viewModel.isSpeechActive ? "Listening" : "Awaiting input"
        }
        if viewModel.isPaused {
            return "Paused"
        }
        return viewModel.isPlayingForeground ? "Playing" : "Idle"
    }
}

@MainActor
final class StoryPlaybackViewModel: ObservableObject {
    enum InputMode {
        case manual
        case auto
    }

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
    @Published var mode: InputMode = .auto
    @Published var autoProgress = 1.0

    private var runner: StoryRunner?
    private let speechController = SpeechCaptureController(locale: .en_us, config: .default)
    private var speechListenersConfigured = false
    private var started = false
    private var autoCountdownTask: Task<Void, Never>?
    private var updatingDraftFromSpeech = false
    private var micFillsDraft = false

    init() {
        Task { [weak self] in
            let enabled = await UserPreferences.shared.autoInputEnabled()
            await MainActor.run {
                self?.mode = enabled ? .auto : .manual
            }
        }
    }

    deinit {
        let currentRunner = runner
        runner = nil
        autoCountdownTask?.cancel()
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
        cancelAutoCountdown()
        inputDraft = ""
        transcript = ""
        micFillsDraft = false
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
        let payload = resolvedPayload()
        if payload.isEmpty {
            return
        }
        completeSubmission(payload: payload, reason: .user)
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

    func setAuto(_ enabled: Bool) {
        let newMode: InputMode = enabled ? .auto : .manual
        if mode == newMode {
            return
        }
        mode = newMode
        Task {
            await UserPreferences.shared.setAutoInputEnabled(enabled)
        }
        if newMode == .auto {
            if isWaitingForInput {
                prepareAutoInput()
            }
        } else {
            cancelAutoCountdown()
        }
    }

    func updateDraft(_ text: String) {
        if inputDraft == text {
            return
        }
        inputDraft = text
        if updatingDraftFromSpeech {
            return
        }
        transcript = text
        micFillsDraft = false
        if mode == .auto {
            cancelAutoCountdown()
        }
    }

    func toggleMic() {
        if isSpeechActive {
            micFillsDraft = false
            stopSpeechCapture()
            if mode == .auto {
                restartAutoCountdown()
            }
            return
        }
        micFillsDraft = true
        inputDraft = ""
        transcript = ""
        cancelAutoCountdown()
        autoProgress = 1
        beginSpeechCapture()
    }

    var canSubmit: Bool {
        let hasDraft = !inputDraft.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
        let hasTranscript = !transcript.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
        return hasDraft || hasTranscript
    }

    var micIcon: String {
        isSpeechActive ? "mic.fill" : "mic"
    }

    var showAutoProgress: Bool {
        mode == .auto && isWaitingForInput
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

    private func makeHandlers() -> StoryRunnerHandlers {
        StoryRunnerHandlers(
            update: { [weak self] snapshot in
                await MainActor.run {
                    self?.apply(snapshot: snapshot)
                }
            },
            requestInput: { [weak self] in
                await MainActor.run {
                    self?.handleInputRequest()
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
        let wasWaiting = isWaitingForInput
        events = snapshot.events
        currentEvent = snapshot.currentEvent
        isWaitingForInput = snapshot.isWaitingForInput
        isPlayingForeground = snapshot.isPlayingForeground
        seam = snapshot.seam
        isPaused = snapshot.isPaused
        if wasWaiting && !snapshot.isWaitingForInput {
            finishWaiting()
        }
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

    private func handleInputRequest() {
        if mode == .auto {
            prepareAutoInput()
        } else {
            micFillsDraft = false
            cancelAutoCountdown()
        }
    }

    private func prepareAutoInput() {
        micFillsDraft = true
        inputDraft = ""
        transcript = ""
        cancelAutoCountdown()
        autoProgress = 1
        playChime()
        beginSpeechCapture()
    }

    private func beginSpeechCapture() {
        configureSpeechCallbacks()
        isSpeechActive = true
        transcript = ""
        Task {
            await speechController.start()
        }
    }

    private func stopSpeechCapture(reason: SpeechCaptureStopReason = .user) {
        speechController.stop(reason: reason)
        isSpeechActive = false
    }

    private func configureSpeechCallbacks() {
        if speechListenersConfigured {
            return
        }
        speechListenersConfigured = true
        speechController.emitter.on(.transcriptUpdated) { [weak self] in
            Task { @MainActor [weak self] in
                self?.handleTranscriptUpdate()
            }
        }
        speechController.emitter.on(.stopped) { [weak self] in
            Task { @MainActor [weak self] in
                self?.isSpeechActive = false
                self?.handleSpeechStopped()
            }
        }
    }

    private func handleTranscriptUpdate() {
        let text = speechController.accumulatedText
        transcript = text
        if micFillsDraft {
            updatingDraftFromSpeech = true
            inputDraft = text
            updatingDraftFromSpeech = false
        }
        restartAutoCountdown()
    }

    private func handleSpeechStopped() {
        restartAutoCountdown()
    }

    private func restartAutoCountdown() {
        autoCountdownTask?.cancel()
        autoCountdownTask = nil
        autoProgress = 1
        guard mode == .auto, isWaitingForInput else {
            return
        }
        let trimmed = inputDraft.trimmingCharacters(in: .whitespacesAndNewlines)
        if trimmed.isEmpty {
            return
        }
        let gap = speechController.lineGapMs
        autoCountdownTask = Task { [weak self] in
            guard let self else {
                return
            }
            await waitWithTimer(ms: 1000, segmentMs: 200)
            if Task.isCancelled {
                return
            }
            if gap > 0 {
                let duration = Double(gap) / 1000
                await MainActor.run {
                    withAnimation(.linear(duration: duration)) {
                        self.autoProgress = 0
                    }
                }
                await waitWithTimer(ms: gap, segmentMs: 100)
            } else {
                await MainActor.run {
                    self.autoProgress = 0
                }
            }
            if Task.isCancelled {
                return
            }
            await MainActor.run {
                self.performAutoSubmitIfNeeded()
            }
        }
    }

    private func cancelAutoCountdown() {
        autoCountdownTask?.cancel()
        autoCountdownTask = nil
        autoProgress = 1
    }

    private func performAutoSubmitIfNeeded() {
        if !isWaitingForInput {
            return
        }
        let payload = resolvedPayload()
        if payload.isEmpty {
            return
        }
        completeSubmission(payload: payload, reason: .autoStop)
    }

    private func resolvedPayload() -> String {
        let draft = inputDraft.trimmingCharacters(in: .whitespacesAndNewlines)
        if !draft.isEmpty {
            return draft
        }
        return transcript.trimmingCharacters(in: .whitespacesAndNewlines)
    }

    private func completeSubmission(payload: String, reason: SpeechCaptureStopReason) {
        cancelAutoCountdown()
        stopSpeechCapture(reason: reason)
        inputDraft = ""
        transcript = ""
        micFillsDraft = false
        autoProgress = 1
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

    private func finishWaiting() {
        cancelAutoCountdown()
        micFillsDraft = false
    }

    private func playChime() {
        AudioServicesPlaySystemSound(1110)
    }
}
#Preview {
    StoryPlaybackView(storyId: "demo")
}
