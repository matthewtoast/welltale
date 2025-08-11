//
//  shodomiApp.swift
//  shodomi
//
//  Created by Matthew Trost on 7/31/25.
//

import SwiftUI
import SwiftData

@main
struct shodomiApp: App {
    var sharedModelContainer: ModelContainer = {
        let schema = Schema([
            TrackingEntry.self,
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
            MainTabView()
        }
        .modelContainer(sharedModelContainer)
    }
}
