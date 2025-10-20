import Foundation

struct StoryRunnerSnapshot {
    var events: [StoryEvent]
    var currentEvent: StoryEvent?
    var isWaitingForInput: Bool
    var isPlayingForeground: Bool
    var seam: SeamType
    var isPaused: Bool
}

struct StoryRunnerHandlers {
    var update: @Sendable (StoryRunnerSnapshot) async -> Void
    var requestInput: @Sendable () async -> Void
    var didFinish: @Sendable () async -> Void
    var didError: @Sendable (String) async -> Void
}

actor StoryRunner {
    private let coordinator: StoryCoordinator
    private let audio = StoryAudioBridge()
    private let handlers: StoryRunnerHandlers
    private var events: [StoryEvent] = []
    private var currentEvent: StoryEvent?
    private var waiting = false
    private var playingForeground = false
    private var seam: SeamType = .grant
    private var renderQueue: [StoryOperation] = []
    private var processing = false
    private var task: Task<Void, Never>?
    private var stopped = false
    private var finished = false
    private var errored = false
    private var paused = false
    private var audioReady = false

    init(coordinator: StoryCoordinator, handlers: StoryRunnerHandlers) {
        self.coordinator = coordinator
        self.handlers = handlers
    }

    func prepare() async {
        if audioReady {
            return
        }
        await audio.prepare()
        audioReady = true
    }

    func start() {
        if task != nil || stopped {
            return
        }
        paused = false
        task = Task {
            await self.prepare()
            await runCycle(input: nil)
        }
    }

    func submit(_ input: String, event: StoryEvent? = nil) async {
        if !waiting {
            return
        }
        waiting = false
        paused = false
        if let event {
            events.append(event)
            currentEvent = event
            if seam == .input {
                seam = .grant
            }
        }
        await emitSnapshot()
        task = Task {
            await runCycle(input: input)
        }
    }

    func pause() async {
        if paused {
            return
        }
        paused = true
        await audio.pauseAll()
        await emitSnapshot()
    }

    func resume() async {
        if !paused {
            return
        }
        paused = false
        await audio.resumeAll()
        await emitSnapshot()
    }

    func stop() async {
        stopped = true
        paused = false
        task?.cancel()
        task = nil
        await audio.stop()
        audioReady = false
    }

    private func runCycle(input: String?) async {
        guard !Task.isCancelled else {
            return
        }
        let result = await coordinator.run(input: input) { ops in
            await self.enqueue(ops)
        }
        guard let result else {
            let message = await coordinator.consumeLastError() ?? "Network error"
            await handlers.didError(message)
            return
        }
        events = result.response.session.checkpoints.flatMap { $0.events }
        currentEvent = events.last
        seam = result.response.seam
        if seam == .input {
            waiting = true
            await emitSnapshot()
            task = nil
            return
        }
        if seam == .finish {
            await emitSnapshot()
            if !finished {
                await handlers.didFinish()
            }
            finished = false
            task = nil
            return
        }
        if seam == .error {
            let msg = result.response.info["reason"] ?? result.accumulatedOps.last?.reason ?? "Unknown error"
            if !errored {
                await handlers.didError(msg)
            }
            errored = false
            task = nil
            return
        }
        await emitSnapshot()
        task = nil
    }

    private func enqueue(_ ops: [StoryOperation]) async {
        if ops.isEmpty {
            return
        }
        renderQueue.append(contentsOf: ops)
        if processing {
            return
        }
        processing = true
        while !renderQueue.isEmpty && !Task.isCancelled {
            let op = renderQueue.removeFirst()
            let shouldContinue = await handle(op)
            if !shouldContinue {
                renderQueue.removeAll()
                break
            }
        }
        processing = false
    }

    private func handle(_ op: StoryOperation) async -> Bool {
        switch op.type {
        case .playMedia:
            if let event = op.event {
                events.append(event)
                currentEvent = event
                await emitSnapshot()
            }
            guard let media = op.media else {
                return true
            }
            let volume = Float(op.volume ?? 1.0)
            if op.background {
                audio.playBackground(media, volume: volume)
                return true
            }
            playingForeground = true
            await emitSnapshot()
            await audio.playForeground(media, volume: volume)
            playingForeground = false
            await emitSnapshot()
            return true
        case .getInput:
            waiting = true
            seam = .input
            await emitSnapshot()
            await handlers.requestInput()
            return false
        case .storyError:
            let message = op.reason ?? "Unknown error"
            errored = true
            await handlers.didError(message)
            return false
        case .storyEnd:
            seam = .finish
            finished = true
            await emitSnapshot()
            await handlers.didFinish()
            return false
        case .sleep, .showMedia:
            return true
        }
    }

    private func emitSnapshot() async {
        let snapshot = StoryRunnerSnapshot(
            events: events,
            currentEvent: currentEvent,
            isWaitingForInput: waiting,
            isPlayingForeground: playingForeground,
            seam: seam,
            isPaused: paused
        )
        await handlers.update(snapshot)
    }
}
