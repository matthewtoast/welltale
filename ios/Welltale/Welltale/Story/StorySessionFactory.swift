struct StorySessionFactory {
    static func make(id: String) -> StorySession {
        StorySession(
            id: id,
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
            genie: nil,
            ddv: StoryDDV(cycles: [:], bags: [:]),
            player: StoryPlayer(id: id),
            voices: [:],
            scripts: [:],
            pronunciations: [:],
            root: nil
        )
    }
}
