//
//  ContentView.swift
//  Welltale
//
//  Created by Matthew Trost on 8/29/25.
//

import SwiftUI

struct ContentView: View {
    @State private var auth = AuthState()

    var body: some View {
        TabView {
            HomeView(auth: $auth)
                .tabItem {
                    Image(systemName: "house.fill")
                    Text("Home")
                }

            LibraryView(auth: $auth)
                .tabItem {
                    Image(systemName: "books.vertical.fill")
                    Text("Library")
                }

            ProfileView(auth: $auth)
                .tabItem {
                    Image(systemName: "person.fill")
                    Text("Profile")
                }
        }
        .preferredColorScheme(.dark)
    }
}

#Preview {
    ContentView()
        .modelContainer(for: [Story.self, UserLibrary.self], inMemory: true)
}
