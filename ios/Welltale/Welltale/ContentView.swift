import SwiftUI

struct ContentView: View {
    @State private var auth = AuthState()
    @State private var count = 0
    
    var body: some View {
        VStack(spacing: 20) {
            Text("Welcome")
                .font(.largeTitle)
            
            Text("Count: \(count)")
            
            Button("Increase") {
                count += 1
            }
            .padding()
            .background(.blue)
            .foregroundStyle(.white)
            .clipShape(Capsule())
        }
        .padding()
    }
}

#Preview {
    ContentView()
}
