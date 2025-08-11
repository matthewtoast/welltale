import SwiftUI

struct MainTabView: View {
    @State private var selectedTab = 2
    @State private var showingAddModal = true
    
    var body: some View {
        TabView(selection: $selectedTab) {
            HomeView()
                .tabItem {
                    Image(systemName: "house.fill")
                    Text("Home")
                }
                .tag(0)
            
            InsightsView()
                .tabItem {
                    Image(systemName: "chart.bar.fill")
                    Text("Insights")
                }
                .tag(1)
            
            Color.clear
                .tabItem {
                    Image(systemName: "plus.circle.fill")
                    Text("Add")
                }
                .tag(2)
            
            DiscoverView()
                .tabItem {
                    Image(systemName: "magnifyingglass")
                    Text("Discover")
                }
                .tag(3)
            
            ProfileView()
                .tabItem {
                    Image(systemName: "person.fill")
                    Text("Profile")
                }
                .tag(4)
        }
        .accentColor(.blue)
        .onChange(of: selectedTab) { newTab in
            if newTab == 2 {
                showingAddModal = true
            }
        }
        .fullScreenCover(isPresented: $showingAddModal) {
            AddView(onDismiss: {
                showingAddModal = false
                selectedTab = 0
            })
        }
    }
}