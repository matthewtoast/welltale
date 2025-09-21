import SwiftUI

struct ContentView: View {
    @State private var auth = AuthState()
    @State private var count = 0
    
    var body: some View {
        HomeView()
    }
}

#Preview {
    ContentView()
}
