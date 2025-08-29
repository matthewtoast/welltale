//
//  WelltaleApp.swift
//  Welltale
//
//  Created by Matthew Trost on 8/29/25.
//

import SwiftUI
import SwiftData

@main
struct WelltaleApp: App {
    var sharedModelContainer: ModelContainer = {
        let schema = Schema([
            Story.self,
            UserLibrary.self,
        ])
        let modelConfiguration = ModelConfiguration(schema: schema, isStoredInMemoryOnly: false)

        do {
            return try ModelContainer(for: schema, configurations: [modelConfiguration])
        } catch {
            fatalError("Could not create ModelContainer: \(error)")
        }
    }()

    var body: some Scene {
        WindowGroup {
            ContentView()
        }
        .modelContainer(sharedModelContainer)
    }
}
