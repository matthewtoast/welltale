import Foundation

actor StoryCoordinator {
    private var session: StorySession
    private let options: StoryOptions
    private let service: StoryService

    init(session: StorySession, options: StoryOptions, service: StoryService) {
        self.session = session
        self.options = options
        self.service = service
    }

    func run(
        input: String?,
        render: @escaping ([StoryOperation]) async -> Void
    ) async -> StoryAdvanceResult? {
        let stream = StoryStream { [weak self] value in
            guard let self else { return nil }
            return await self.advance(input: value)
        }
        await stream.push(input)
        var collected: [StoryOperation] = []
        var last: StoryAdvanceResponse?
        while true {
            guard let result = await stream.next() else {
                break
            }
            if !result.ops.isEmpty {
                collected.append(contentsOf: result.ops)
                await render(result.ops)
            }
            last = result
            if result.seam == .media || result.seam == .grant {
                continue
            }
            if result.seam == .error {
                if !result.info.isEmpty {
                    print("[welltale] story error", result.info)
                }
            }
            break
        }
        await stream.close()
        guard let response = last else {
            return nil
        }
        return StoryAdvanceResult(response: response, accumulatedOps: collected)
    }

    func replaceSession(_ session: StorySession) {
        self.session = session
    }

    private func advance(input: String?) async -> StoryAdvanceResponse? {
        if let text = input {
            let payload = StoryInput(from: "user", body: text, atts: [:])
            session.input = payload
        }
        guard let response = try? await service.advanceStory(session: session, options: options) else {
            return nil
        }
        session = response.session
        return response
    }
}

private actor StoryStream {
    private let advance: (String?) async -> StoryAdvanceResponse?
    private var inputs: [String?] = []
    private var ready: [StoryAdvanceResponse] = []
    private var waiters: [CheckedContinuation<StoryAdvanceResponse?, Never>] = []
    private var running = false
    private var closed = false
    private var blocked = true

    init(advance: @escaping (String?) async -> StoryAdvanceResponse?) {
        self.advance = advance
    }

    func push(_ input: String?) async {
        if closed {
            return
        }
        inputs.append(input)
        blocked = false
        await runLoop()
    }

    func next() async -> StoryAdvanceResponse? {
        if !ready.isEmpty {
            return ready.removeFirst()
        }
        if closed {
            return nil
        }
        return await withCheckedContinuation { continuation in
            waiters.append(continuation)
        }
    }

    func close() async {
        if closed {
            return
        }
        closed = true
        inputs.removeAll()
        drain()
    }

    private func emit(_ result: StoryAdvanceResponse) {
        if waiters.isEmpty {
            ready.append(result)
            return
        }
        let continuation = waiters.removeFirst()
        continuation.resume(returning: result)
    }

    private func drain() {
        while !waiters.isEmpty {
            let continuation = waiters.removeFirst()
            continuation.resume(returning: nil)
        }
    }

    private func runLoop() async {
        if running || closed {
            return
        }
        running = true
        while !closed {
            if blocked && inputs.isEmpty {
                break
            }
            let nextInput = inputs.isEmpty ? nil : inputs.removeFirst()
            guard let result = await advance(nextInput) else {
                blocked = true
                closed = true
                drain()
                break
            }
            emit(result)
            if result.seam == .media || result.seam == .grant {
                blocked = false
                continue
            }
            blocked = true
            break
        }
        running = false
        if !closed && !inputs.isEmpty {
            await runLoop()
        }
    }
}
