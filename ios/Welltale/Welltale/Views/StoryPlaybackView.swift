import SwiftUI
import Combine

struct StoryPlaybackView: View {
    let storyId: String
    @StateObject private var viewModel = StoryPlaybackViewModel()

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            if viewModel.isLoading {
                ProgressView("Loading")
                    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .center)
            } else if let story = viewModel.story {
                VStack(alignment: .leading, spacing: 16) {
                    VStack(alignment: .leading, spacing: 4) {
                        Text(story.title)
                            .font(.title)
                            .fontWeight(.semibold)
                        Text(story.author)
                            .font(.subheadline)
                            .foregroundColor(.secondary)
                    }
                    ScrollView {
                        VStack(alignment: .leading, spacing: 12) {
                            ForEach(Array(viewModel.events.enumerated()), id: \.offset) { item in
                                let event = item.element
                                VStack(alignment: .leading, spacing: 4) {
                                    Text(event.from)
                                        .font(.caption)
                                        .foregroundColor(.blue)
                                    Text(event.body)
                                        .font(.body)
                                }
                                .frame(maxWidth: .infinity, alignment: .leading)
                                .padding(.vertical, 4)
                                .padding(.horizontal, 8)
                                .background(Color(.secondarySystemBackground))
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
                    Text(error)
                        .font(.body)
                        .foregroundColor(.secondary)
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else {
                Text("No story loaded")
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            }
        }
        .padding()
        .task {
            await viewModel.loadStory(id: storyId)
        }
    }

    private var statusSection: some View {
        HStack(spacing: 12) {
            Circle()
                .fill(viewModel.isPlayingForeground ? Color.green : Color.gray)
                .frame(width: 12, height: 12)
            Text(statusText)
                .font(.footnote)
                .foregroundColor(.secondary)
        }
    }

    private var inputSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            if !viewModel.transcript.isEmpty {
                VStack(alignment: .leading, spacing: 4) {
                    Text("Transcript")
                        .font(.caption)
                        .foregroundColor(.secondary)
                    Text(viewModel.transcript)
                        .font(.body)
                        .padding(8)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .background(Color(.tertiarySystemBackground))
                        .clipShape(RoundedRectangle(cornerRadius: 8))
                }
            }
            VStack(alignment: .leading, spacing: 8) {
                Text("Respond")
                    .font(.caption)
                    .foregroundColor(.secondary)
                TextField("Type your response", text: $viewModel.inputDraft)
                    .textFieldStyle(RoundedBorderTextFieldStyle())
                HStack {
                    Button("Use Transcript") {
                        viewModel.useTranscript()
                    }
                    .disabled(viewModel.transcript.isEmpty)
                    Spacer()
                    Button("Submit") {
                        viewModel.submitInput()
                    }
                    .disabled(!viewModel.canSubmit)
                }
            }
        }
        .padding()
        .background(Color(.secondarySystemBackground))
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

    private var runner: StoryRunner?
    private let speechController = SpeechCaptureController(locale: .en_us, config: .default)
    private var speechListenersConfigured = false

    deinit {
        Task {
            await runner?.stop()
        }
    }

    func loadStory(id: String) async {
        if isLoading {
            return
        }
        isLoading = true
        error = nil
        do {
            guard let configuration = StoryConfiguration.load() else {
                error = "Missing WelltaleAPIBase or DevSessionToken"
                isLoading = false
                return
            }
            let service = StoryService(configuration: configuration)
            let meta = try await service.fetchStory(id: id)
            story = meta
            let options = makeOptions(storyId: id)
            let session = StorySessionFactory.make(id: id)
            let coordinator = StoryCoordinator(session: session, options: options, service: service)
            let handlers = makeHandlers()
            let runner = StoryRunner(coordinator: coordinator, handlers: handlers)
            self.runner = runner
            configureSpeechCallbacks()
            Task {
                await runner.start()
            }
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
            to: [],
            obs: [],
            body: payload,
            tags: []
        )
        events.append(event)
        currentEvent = event
        isWaitingForInput = false
        Task {
            await runner?.submit(payload)
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
}

#Preview {
    StoryPlaybackView(storyId: "demo")
}
