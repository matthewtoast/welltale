import Foundation

class LLMParsingService {
    static let shared = LLMParsingService()
    
    private init() {}
    
    func parseTranscript(_ transcript: String) async throws -> [TrackableAtom] {
        try await Task.sleep(nanoseconds: 2_000_000_000)
        
        let atoms = mockParseTranscript(transcript)
        return atoms
    }
    
    private func mockParseTranscript(_ transcript: String) -> [TrackableAtom] {
        let lowercased = transcript.lowercased()
        var atoms: [TrackableAtom] = []
        
        if lowercased.contains("bench") && lowercased.contains("pounds") {
            let atom = TrackableAtom(
                category: .exercise,
                action: "lifted",
                item: "bench press",
                quantity: extractNumber(from: lowercased, near: "pounds"),
                unit: "lbs",
                confidence: 0.8,
                tags: ["strength", "workout"]
            )
            atoms.append(atom)
        }
        
        if lowercased.contains("protein shake") || lowercased.contains("shake") {
            let atom = TrackableAtom(
                category: .nutrition,
                action: "drank",
                item: "protein shake",
                quantity: 1.0,
                unit: "serving",
                confidence: 0.9,
                tags: ["protein", "supplement"]
            )
            atoms.append(atom)
        }
        
        if lowercased.contains("slept") || lowercased.contains("sleep") {
            let atom = TrackableAtom(
                category: .sleep,
                action: "slept",
                item: "sleep",
                quantity: extractNumber(from: lowercased, near: "hour") ?? 8.0,
                unit: "hours",
                confidence: 0.7,
                tags: ["rest"]
            )
            atoms.append(atom)
        }
        
        return atoms
    }
    
    private func extractNumber(from text: String, near keyword: String) -> Double? {
        let words = text.components(separatedBy: .whitespacesAndNewlines)
        guard let keywordIndex = words.firstIndex(where: { $0.contains(keyword) }) else { return nil }
        
        for i in max(0, keywordIndex - 3)...min(words.count - 1, keywordIndex + 1) {
            if let number = Double(words[i].filter { $0.isNumber || $0 == "." }) {
                return number
            }
        }
        return nil
    }
}