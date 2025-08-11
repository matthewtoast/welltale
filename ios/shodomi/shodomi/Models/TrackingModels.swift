import Foundation
import SwiftData

@Model
final class TrackingEntry {
    var id: UUID
    var inputTimestamp: Date
    var inputType: InputType
    var rawInput: String
    var transcript: String?
    var photoData: Data?
    var imageDescription: String?
    var atomsData: Data?
    var isProcessing: Bool
    var processingError: String?
    
    init(inputType: InputType, rawInput: String) {
        self.id = UUID()
        self.inputTimestamp = Date()
        self.inputType = inputType
        self.rawInput = rawInput
        self.transcript = nil
        self.photoData = nil
        self.imageDescription = nil
        self.atomsData = try? JSONEncoder().encode([TrackableAtom]())
        self.isProcessing = false
        self.processingError = nil
    }
    
    var atoms: [TrackableAtom] {
        get {
            guard let atomsData = atomsData else { return [] }
            return (try? JSONDecoder().decode([TrackableAtom].self, from: atomsData)) ?? []
        }
        set {
            atomsData = try? JSONEncoder().encode(newValue)
        }
    }
}

struct TrackableAtom: Codable {
    let id: UUID
    let category: TrackingCategory
    let action: String
    let item: String
    let quantity: Double?
    let unit: String?
    let startTime: Date?
    let endTime: Date?
    let confidence: Double
    let location: String?
    let context: [String: String]
    let tags: [String]
    let mood: Int?
    let notes: String?
    
    init(category: TrackingCategory, action: String, item: String, quantity: Double? = nil, unit: String? = nil, startTime: Date? = nil, endTime: Date? = nil, confidence: Double = 1.0, location: String? = nil, context: [String: String] = [:], tags: [String] = [], mood: Int? = nil, notes: String? = nil) {
        self.id = UUID()
        self.category = category
        self.action = action
        self.item = item
        self.quantity = quantity
        self.unit = unit
        self.startTime = startTime
        self.endTime = endTime
        self.confidence = confidence
        self.location = location
        self.context = context
        self.tags = tags
        self.mood = mood
        self.notes = notes
    }
}

enum InputType: String, CaseIterable, Codable {
    case voice = "voice"
    case photo = "photo"
    case text = "text"
}

enum TrackingCategory: String, CaseIterable, Codable {
    case nutrition = "nutrition"
    case exercise = "exercise"
    case sleep = "sleep"
    case mood = "mood"
    case substance = "substance"
    case medication = "medication"
    case symptom = "symptom"
    case social = "social"
    case productivity = "productivity"
    case other = "other"
}