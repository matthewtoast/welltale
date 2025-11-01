struct StorySessionFactory {
    static func make(id: String, source: StorySourceDTO?) -> StorySession {
        var session = StorySession(
            id: id,
            time: 0,
            turn: 0,
            cycle: 0,
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
            ddv: StoryDDV(cycles: [:], bags: [:]),
            player: StoryPlayer(id: id),
            voices: [:],
            scripts: [:],
            pronunciations: [:],
            root: nil
        )
        let root = source?.root ?? StoryNode(addr: "", type: "root", atts: [:], kids: [], text: "")
        session.root = root
        session.voices = source?.voices ?? [:]
        session.scripts = source?.scripts ?? [:]
        session.pronunciations = source?.pronunciations ?? [:]
        session.meta = source?.meta ?? [:]
        return session
    }
}
