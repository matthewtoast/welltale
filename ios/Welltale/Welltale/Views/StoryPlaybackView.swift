import AudioToolbox
import Combine
import SwiftUI

struct StoryPlaybackView: View {
    let storyId: String
    @StateObject private var viewModel = StoryPlaybackViewModel()
    @State private var showSettings = false

    var body: some View {
        ZStack {
            Color.wellBackground.ignoresSafeArea()
            VStack(alignment: .leading, spacing: 16) {
                if viewModel.story != nil {
                    VStack(alignment: .leading, spacing: 16) {
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
                        playbackControls
                        inputSection
                    }
                } else if viewModel.isLoading {
                    ProgressView("Loading")
                        .tint(Color.wellText)
                        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .center)
                } else {
                    Spacer()
                }
            }
            .padding()
        }
        .tint(Color.wellText)
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .navigationBarTrailing) {
                Button {
                    showSettings = true
                } label: {
                    Image(systemName: "gearshape")
                        .font(.body)
                        .foregroundColor(Color.wellText)
                }
            }
            ToolbarItem(placement: .principal) {
                if let story = viewModel.story {
                    VStack(spacing: 4) {
                        Text(story.title)
                            .font(.subheadline)
                            .fontWeight(.semibold)
                            .foregroundColor(Color.wellText)
                            .lineLimit(1)
                        Text(story.author)
                            .font(.caption)
                            .foregroundColor(Color.wellMuted)
                            .lineLimit(1)
                        statusIndicator
                    }
                }
            }
        }
        .sheet(isPresented: $showSettings) {
            NavigationStack {
                VStack(alignment: .leading, spacing: 24) {
                    Toggle(
                        "Auto mode",
                        isOn: Binding(
                            get: { viewModel.mode == .auto },
                            set: { viewModel.setAuto($0) }
                        )
                    )
                    .tint(Color.green)
                    Spacer()
                }
                .padding()
                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
                .background(Color.wellBackground.ignoresSafeArea())
                .navigationTitle("Settings")
                .navigationBarTitleDisplayMode(.inline)
                .toolbar {
                    ToolbarItem(placement: .cancellationAction) {
                        Button {
                            showSettings = false
                        } label: {
                            Image(systemName: "xmark")
                                .font(.body)
                                .foregroundColor(Color.wellText)
                        }
                    }
                }
            }
            .tint(Color.wellText)
        }
        .task {
            await viewModel.preparePermissions()
            await viewModel.loadStory(id: storyId)
        }
    }

    private var inputSection: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack(spacing: 8) {
                if viewModel.mode == .manual {
                    TextField(
                        "Type your response",
                        text: Binding(
                            get: { viewModel.inputDraft },
                            set: { viewModel.updateDraft($0) }
                        )
                    )
                    .padding(10)
                    .frame(maxWidth: .infinity)
                    .background(Color.wellPanel)
                    .cornerRadius(8)
                    .foregroundColor(Color.wellText)
                    .colorScheme(.dark)
                    .onSubmit {
                        viewModel.submitInput()
                    }
                    .disabled(!viewModel.canEditInput)
                    Button {
                        viewModel.toggleMic()
                    } label: {
                        Image(systemName: viewModel.micIcon)
                            .font(.body)
                            .foregroundColor(Color.wellText)
                    }
                    .disabled(!viewModel.canUseMic)
                    Button {
                        viewModel.submitInput()
                    } label: {
                        Image(systemName: "paperplane.fill")
                            .font(.body)
                            .foregroundColor(Color.wellText)
                    }
                    .disabled(!viewModel.canSubmit || !viewModel.canEditInput)
                } else {
                    Text(viewModel.autoDisplayText)
                        .font(.body)
                        .foregroundColor(viewModel.autoDisplayColor)
                        .padding(10)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .background(Color.wellPanel)
                        .cornerRadius(8)
                }
            }

            GeometryReader { proxy in
                let baseWidth = proxy.size.width
                let inset: CGFloat = 20
                let totalWidth = max(0, baseWidth - inset)
                let fillWidth = viewModel.showAutoProgress ? totalWidth * CGFloat(viewModel.autoProgress) : 0
                HStack {
                    Spacer()
                    ZStack(alignment: .leading) {
                        Capsule()
                            .fill(Color.wellPanel)
                            .frame(width: totalWidth, height: 2)
                        Capsule()
                            .fill(Color.wellText)
                            .frame(width: fillWidth, height: 2)
                    }
                    Spacer()
                }
            }
            .frame(height: 2)
            .offset(y: 0)
        }
    }

    private var playbackControls: some View {
        HStack {
            Spacer()
            Button {
                viewModel.togglePlayback()
            } label: {
                Image(systemName: viewModel.playbackIcon)
                    .font(.title2)
                    .foregroundColor(Color.black)
                    .padding(12)
                    .background(viewModel.playButtonColor)
                    .clipShape(Circle())
            }
            .disabled(!viewModel.canTogglePlayback)
            .accessibilityLabel(viewModel.playbackLabel)
        }
    }
}

private extension StoryPlaybackView {
    struct StatusDisplay {
        let text: String
        let dotColor: Color
    }

    var statusIndicator: some View {
        let display = statusDisplay
        return HStack(spacing: 4) {
            Circle()
                .fill(display.dotColor)
                .frame(width: 8, height: 8)
            Text(display.text)
                .font(.caption2)
                .foregroundColor(display.dotColor)
                .lineLimit(1)
        }
    }

    var statusDisplay: StatusDisplay {
        if let message = viewModel.error?.trim(), !message.isEmpty {
            return StatusDisplay(text: message, dotColor: .red)
        }
        if viewModel.seam == .error {
            return StatusDisplay(text: "Error", dotColor: .red)
        }
        if viewModel.seam == .finish {
            return StatusDisplay(text: "Story complete", dotColor: .indigo)
        }
        if viewModel.isWaitingForInput {
            if viewModel.isSpeechActive {
                return StatusDisplay(text: "Listening", dotColor: .green)
            }
            return StatusDisplay(text: "Awaiting input", dotColor: .orange)
        }
        if viewModel.isPaused {
            return StatusDisplay(text: "Paused", dotColor: .yellow)
        }
        if viewModel.isPlayingForeground {
            return StatusDisplay(text: "Playing", dotColor: .green)
        }
        if viewModel.isPriming {
            return StatusDisplay(text: "Starting", dotColor: .gray)
        }
        if viewModel.isAdvancing {
            return StatusDisplay(text: "Continuing", dotColor: .gray)
        }
        if viewModel.isLoading {
            return StatusDisplay(text: "Loading", dotColor: .gray)
        }
        return StatusDisplay(text: "Idle", dotColor: .gray)
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
    @Published var isAdvancing = false

    private var runner: StoryRunner?
    private let speechController = SpeechCaptureController(locale: .en_us, config: .default)
    private var speechListenersConfigured = false
    private var started = false
    private var autoCountdownTask: Task<Void, Never>?
    private var updatingDraftFromSpeech = false
    private var micFillsDraft = false
    private let autoPlaceholder = "Speak when prompted"

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
        seam = .grant
        hasPlaybackControls = false
        started = false
        isPaused = false
        isAdvancing = false
        cancelAutoCountdown()
        inputDraft = ""
        transcript = ""
        micFillsDraft = false
        do {
            guard let configuration = StoryConfiguration.load() else {
                error = "Missing WelltaleAPIBase or DevSessionToken"
                seam = .error
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
            Task {
                await runner.prepare()
            }
            configureSpeechCallbacks()
        } catch {
            self.error = error.localizedDescription
            seam = .error
        }
        isLoading = false
    }

    func submitInput() {
        if !isWaitingForInput {
            return
        }
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
            guard let currentRunner = runner else {
                return
            }
            started = true
            isPaused = false
            isAdvancing = true
            Task {
                await currentRunner.start()
            }
            return
        }
        if isPaused {
            guard let currentRunner = runner else {
                return
            }
            isPaused = false
            isAdvancing = true
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
        isAdvancing = false
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
            if isSpeechActive {
                stopSpeechCapture()
            }
            micFillsDraft = false
        }
    }

    func updateDraft(_ text: String) {
        if !isWaitingForInput {
            return
        }
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
        if !isWaitingForInput {
            return
        }
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

    var autoDisplayText: String {
        let trimmedDraft = inputDraft.trimmingCharacters(in: .whitespacesAndNewlines)
        if !trimmedDraft.isEmpty {
            return trimmedDraft
        }
        let trimmedTranscript = transcript.trimmingCharacters(in: .whitespacesAndNewlines)
        if !trimmedTranscript.isEmpty {
            return trimmedTranscript
        }
        return autoPlaceholder
    }

    var autoDisplayColor: Color {
        let hasContent = !inputDraft.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ||
            !transcript.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
        return hasContent ? Color.wellText : Color.wellMuted
    }

    var canEditInput: Bool {
        isWaitingForInput
    }

    var canUseMic: Bool {
        isWaitingForInput
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

    var playButtonColor: Color {
        Color.white
    }

    var isPriming: Bool {
        isAdvancing && events.isEmpty
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
                    self?.isAdvancing = false
                }
            },
            didError: { [weak self] message in
                await MainActor.run {
                    self?.error = message
                    self?.seam = .error
                    self?.isAdvancing = false
                }
            }
        )
    }

    private func apply(snapshot: StoryRunnerSnapshot) {
        let wasWaiting = isWaitingForInput
        let prevCount = events.count
        events = snapshot.events
        currentEvent = snapshot.currentEvent
        isWaitingForInput = snapshot.isWaitingForInput
        isPlayingForeground = snapshot.isPlayingForeground
        seam = snapshot.seam
        isPaused = snapshot.isPaused
        if wasWaiting && !snapshot.isWaitingForInput {
            finishWaiting()
        }
        if snapshot.isWaitingForInput || snapshot.isPlayingForeground || snapshot.seam == .finish || snapshot.seam == .error || snapshot.isPaused || snapshot.events.count > prevCount {
            isAdvancing = false
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
        isAdvancing = false
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
        if !isWaitingForInput {
            return
        }
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
            let delay = gap > 0 ? max(gap, 300) : 300
            if delay > 0 {
                let duration = Double(delay) / 1000
                await MainActor.run {
                    withAnimation(.linear(duration: duration)) {
                        self.autoProgress = 0
                    }
                }
                await waitWithTimer(ms: delay, segmentMs: 100)
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
        isAdvancing = true
        guard let currentRunner = runner else {
            return
        }
        Task {
            await currentRunner.submit(payload, event: event)
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
