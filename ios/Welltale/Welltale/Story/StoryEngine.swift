import Foundation
import AVFoundation
import Combine

@MainActor
class StoryEngine: ObservableObject {
    @Published var session: StorySession?
    @Published var currentOps: [StoryOperation] = []
    @Published var seamType: SeamType = .grant
    @Published var isProcessing = false
    @Published var error: String?
    @Published var storyEvents: [StoryEvent] = []
    @Published var isWaitingForInput = false
    @Published var currentMedia: String?
    @Published var isPlaying = false
    
    private let storyId: String
    private let storyService: StoryService
    private var audioPlayer: AVAudioPlayer?
    private var cancellables = Set<AnyCancellable>()
    private var operationQueue: [StoryOperation] = []
    private var currentOperationIndex = 0
    private var isAdvancing = false
    private var prefetchTask: Task<Void, Never>?
    private var pendingResponse: StoryAdvanceResponse?
    
    private let defaultOptions = StoryOptions(
        verbose: false,
        seed: "default",
        loop: 0,
        ream: 100,
        doGenerateAudio: true,
        maxCheckpoints: 20,
        inputRetryMax: 3,
        models: ["openai/gpt-4.1-mini", "openai/gpt-4.1-nano"]
    )
    
    init(storyId: String, storyService: StoryService) {
        self.storyId = storyId
        self.storyService = storyService
    }
    
    func initializeSession() {
        session = StorySession(
            id: storyId,
            time: 0,
            turn: 0,
            cycle: 0,
            loops: 0,
            resume: false,
            address: nil,
            input: nil,
            outroed: false,
            stack: [],
            state: [:],
            checkpoints: [],
            meta: [:],
            cache: [:],
            target: nil,
            genie: nil
        )
    }
    
    func startStory() async {
        guard session != nil else {
            initializeSession()
        }
        await advanceStory()
    }
    
    func advanceStory(input: String? = nil) async {
        guard !isAdvancing else { return }
        guard var currentSession = session else { return }
        
        isAdvancing = true
        isProcessing = true
        error = nil
        
        if let input = input, seamType == .input {
            currentSession = updateSessionWithInput(currentSession, input: input)
        }
        
        do {
            // Cancel any pending prefetch
            prefetchTask?.cancel()
            prefetchTask = nil
            pendingResponse = nil
            
            let response = try await storyService.advanceStory(
                id: storyId,
                session: currentSession,
                options: defaultOptions
            )
            
            await applyResponse(response)
            
        } catch {
            self.error = error.localizedDescription
            seamType = .error
        }
        
        isProcessing = false
        isAdvancing = false
    }
    
    private func updateSessionWithInput(_ session: StorySession, input: String) -> StorySession {
        StorySession(
            id: session.id,
            time: session.time,
            turn: session.turn,
            cycle: session.cycle,
            loops: session.loops,
            resume: session.resume,
            address: session.address,
            input: StoryInput(from: "user", body: input, atts: [:]),
            outroed: session.outroed,
            stack: session.stack,
            state: session.state,
            checkpoints: session.checkpoints,
            meta: session.meta,
            cache: session.cache,
            target: session.target,
            genie: session.genie
        )
    }
    
    private func processOperations() async {
        currentOps = operationQueue
        
        for (index, operation) in operationQueue.enumerated() {
            if index < currentOperationIndex {
                continue
            }
            
            currentOperationIndex = index
            
            // Start prefetching next batch when we start processing current ops
            if index == 0 && (seamType == .grant || seamType == .media) && prefetchTask == nil {
                startPrefetch()
            }
            
            switch operation {
            case .playEvent(let event, let media, let background, let volume, _, _):
                storyEvents.append(event)
                if let media = media, background != true {
                    await playAudio(url: media, volume: volume)
                }
                
            case .playMedia(let media, let background, let volume, _, _):
                if background != true {
                    await playAudio(url: media, volume: volume)
                }
                
            case .sleep(let duration):
                try? await Task.sleep(nanoseconds: UInt64(duration) * 1_000_000)
                
            case .getInput:
                isWaitingForInput = true
                prefetchTask?.cancel()
                prefetchTask = nil
                return
                
            case .storyError(let reason):
                error = reason
                prefetchTask?.cancel()
                prefetchTask = nil
                return
                
            case .storyEnd:
                prefetchTask?.cancel()
                prefetchTask = nil
                return
            }
        }
        
        // Operations completed, check if we have prefetched response ready
        if let pending = pendingResponse {
            pendingResponse = nil
            await applyResponse(pending)
        } else if seamType == .grant || seamType == .media {
            // No prefetch available, fetch now
            await advanceStory()
        } else if seamType == .input {
            isWaitingForInput = true
        }
    }
    
    private func startPrefetch() {
        guard let currentSession = session else { return }
        
        prefetchTask = Task {
            do {
                let response = try await storyService.advanceStory(
                    id: storyId,
                    session: currentSession,
                    options: defaultOptions
                )
                
                if !Task.isCancelled {
                    pendingResponse = response
                }
            } catch {
                if !Task.isCancelled {
                    print("Prefetch error: \(error)")
                }
            }
        }
    }
    
    private func applyResponse(_ response: StoryAdvanceResponse) async {
        session = response.session
        seamType = response.seam
        operationQueue = response.ops
        currentOperationIndex = 0
        
        await processOperations()
    }
    
    private func playAudio(url: String, volume: Double?) async {
        guard let audioURL = URL(string: url) else { return }
        
        isPlaying = true
        currentMedia = url
        
        do {
            let data = try await URLSession.shared.data(from: audioURL).0
            audioPlayer = try AVAudioPlayer(data: data)
            audioPlayer?.volume = Float(volume ?? 1.0)
            audioPlayer?.prepareToPlay()
            audioPlayer?.play()
            
            await withCheckedContinuation { continuation in
                Timer.scheduledTimer(withTimeInterval: 0.1, repeats: true) { [weak self] timer in
                    if self?.audioPlayer?.isPlaying != true {
                        timer.invalidate()
                        continuation.resume()
                    }
                }
            }
        } catch {
            print("Failed to play audio: \(error)")
        }
        
        isPlaying = false
        currentMedia = nil
    }
    
    func submitInput(_ input: String) async {
        guard isWaitingForInput else { return }
        isWaitingForInput = false
        await advanceStory(input: input)
    }
    
    func skipCurrent() {
        if isPlaying {
            audioPlayer?.stop()
            isPlaying = false
        }
        
        // If we have pending response ready, apply it immediately
        if let pending = pendingResponse {
            pendingResponse = nil
            Task {
                await applyResponse(pending)
            }
        } else if currentOperationIndex < operationQueue.count - 1 {
            // Skip to next operation in current batch
            currentOperationIndex += 1
            Task {
                await processOperations()
            }
        } else if seamType == .grant || seamType == .media {
            // No more ops and no prefetch, advance now
            Task {
                await advanceStory()
            }
        }
    }
    
    func pause() {
        if isPlaying {
            audioPlayer?.pause()
        }
    }
    
    func resume() {
        if let player = audioPlayer, !player.isPlaying {
            player.play()
        }
    }
}
