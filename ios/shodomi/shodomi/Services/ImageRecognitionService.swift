import Foundation
import UIKit

class ImageRecognitionService {
    static let shared = ImageRecognitionService()
    
    private init() {}
    
    func analyzeImage(_ image: UIImage) async throws -> String {
        try await Task.sleep(nanoseconds: 3_000_000_000)
        
        let description = mockAnalyzeImage(image)
        return description
    }
    
    private func mockAnalyzeImage(_ image: UIImage) -> String {
        let foodDescriptions = [
            "A plate with grilled chicken breast, steamed broccoli, and brown rice. Estimated 400 calories with 35g protein, 45g carbs, and 8g fat.",
            "A bowl of oatmeal topped with fresh blueberries, sliced banana, and chopped walnuts. Approximately 350 calories with 12g protein and 8g fiber.",
            "A protein shake in a clear glass with what appears to be chocolate or vanilla flavor. Estimated 250 calories with 30g protein.",
            "A salad bowl containing mixed greens, cherry tomatoes, cucumber, grilled chicken, and what looks like olive oil dressing. About 320 calories.",
            "A peanut butter and jelly sandwich on whole wheat bread with a glass of milk. Approximately 480 calories with 18g protein.",
            "A cup of black coffee in a white mug. Essentially 0 calories unless cream or sugar is added.",
            "A slice of pizza with pepperoni and cheese. Estimated 285 calories with 15g fat and 12g protein per slice."
        ]
        
        let exerciseDescriptions = [
            "Person performing a deadlift exercise with a barbell in a gym setting. Heavy compound movement targeting posterior chain.",
            "Someone doing push-ups on a yoga mat, bodyweight exercise targeting chest, shoulders, and triceps.",
            "A person running on a treadmill at what appears to be moderate intensity based on their posture.",
            "Individual performing squats with dumbbells, lower body exercise targeting glutes and quadriceps.",
            "Person doing bicep curls with dumbbells, isolation exercise for arm muscles.",
            "Someone stretching or doing yoga poses on a mat, flexibility and mobility work."
        ]
        
        let supplementDescriptions = [
            "A bottle or container of protein powder, likely whey or plant-based protein supplement.",
            "Vitamin or supplement pills/capsules in someone's hand or on a surface.",
            "A pre-workout drink or energy supplement in a shaker bottle.",
            "Fish oil or omega-3 supplement capsules.",
            "Multivitamin tablets or gummies."
        ]
        
        let allDescriptions = foodDescriptions + exerciseDescriptions + supplementDescriptions
        return allDescriptions.randomElement() ?? foodDescriptions[0]
    }
}