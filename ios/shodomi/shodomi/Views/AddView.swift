import SwiftUI
import SwiftData
import AVFoundation

enum InputMode: CaseIterable {
    case voice, photo, text
    
    var title: String {
        switch self {
        case .voice: return "Voice"
        case .photo: return "Photo"
        case .text: return "Text"
        }
    }
    
    var icon: String {
        switch self {
        case .voice: return "mic.fill"
        case .photo: return "camera.fill"
        case .text: return "text.cursor"
        }
    }
    
    var color: Color {
        switch self {
        case .voice: return .blue
        case .photo: return .green
        case .text: return .orange
        }
    }
}

struct AddView: View {
    @Environment(\.modelContext) private var modelContext
    @Query private var entries: [TrackingEntry]
    @State private var selectedTab = 1
    @State private var capturedImage: UIImage?
    @State private var textInput = ""
    @FocusState private var isTextFieldFocused: Bool
    @State private var isRecording = false
    @State private var hasCameraPermission = false
    @StateObject private var speechService = SpeechService()
    let onDismiss: () -> Void
    
    var body: some View {
        ZStack {
            Color.black.ignoresSafeArea()
            
            TabView(selection: $selectedTab) {
                VoiceView()
                    .tag(0)
                
                PhotoView()
                    .tag(1)
                
                TextView()
                    .tag(2)
            }
            .tabViewStyle(.page(indexDisplayMode: .never))
            .ignoresSafeArea()
            
            VStack {
                HStack {
                    Button(action: onDismiss) {
                        Image(systemName: "xmark")
                            .font(.title2)
                            .foregroundColor(.white)
                            .padding(12)
                            .background(Circle().fill(Color.black.opacity(0.5)))
                    }
                    .padding()
                    
                    Spacer()
                }
                
                Spacer()
                
                HStack(spacing: 8) {
                    ForEach(0..<3) { index in
                        Circle()
                            .fill(selectedTab == index ? Color.white : Color.white.opacity(0.3))
                            .frame(width: 8, height: 8)
                    }
                }
                .padding(.bottom, 30)
            }
        }
        .onAppear {
            checkCameraPermission()
        }
    }
    
    func checkCameraPermission() {
        CameraView.requestCameraPermission { granted in
            hasCameraPermission = granted
        }
    }
    
    @ViewBuilder
    private func PhotoView() -> some View {
        ZStack {
            if hasCameraPermission {
                CameraViewWrapper(capturedImage: $capturedImage) {
                    handlePhotoCaptured()
                }
                .ignoresSafeArea()
            } else {
                VStack(spacing: 20) {
                    Image(systemName: "camera.fill")
                        .font(.system(size: 60))
                        .foregroundColor(.white.opacity(0.5))
                    
                    Text("Camera access required")
                        .font(.title2)
                        .foregroundColor(.white)
                    
                    Button("Open Settings") {
                        if let url = URL(string: UIApplication.openSettingsURLString) {
                            UIApplication.shared.open(url)
                        }
                    }
                    .foregroundColor(.blue)
                }
            }
        }
    }
    
    @ViewBuilder
    private func VoiceView() -> some View {
        ZStack {
            Color.black.ignoresSafeArea()
            
            VStack(spacing: 40) {
                Spacer()
                
                ZStack {
                    Circle()
                        .fill(Color.blue.opacity(0.2))
                        .frame(width: 200, height: 200)
                        .scaleEffect(isRecording ? 1.2 : 1.0)
                        .animation(.easeInOut(duration: 1.5).repeatForever(autoreverses: true), value: isRecording)
                    
                    Circle()
                        .fill(Color.blue.opacity(0.3))
                        .frame(width: 150, height: 150)
                        .scaleEffect(isRecording ? 1.3 : 1.0)
                        .animation(.easeInOut(duration: 1.5).repeatForever(autoreverses: true).delay(0.2), value: isRecording)
                    
                    Circle()
                        .fill(Color.blue)
                        .frame(width: 100, height: 100)
                        .overlay(
                            Image(systemName: "mic.fill")
                                .font(.system(size: 40))
                                .foregroundColor(.white)
                        )
                }
                .onLongPressGesture(minimumDuration: .infinity, pressing: { pressing in
                    handleRecordingState(pressing)
                }) {
                }
                
                Text(isRecording ? "Recording..." : "Hold to record")
                    .font(.title3)
                    .foregroundColor(.white)
                
                if !speechService.transcript.isEmpty {
                    Text(speechService.transcript)
                        .font(.body)
                        .foregroundColor(.white.opacity(0.8))
                        .multilineTextAlignment(.center)
                        .padding(.horizontal, 40)
                        .frame(maxHeight: 100)
                }
                
                Spacer()
            }
        }
    }
    
    @ViewBuilder
    private func TextView() -> some View {
        ZStack {
            Color.black.ignoresSafeArea()
            
            VStack(spacing: 20) {
                HStack {
                    Spacer()
                    
                    Button("Done") {
                        handleTextSubmit()
                    }
                    .foregroundColor(.blue)
                    .padding()
                    .disabled(textInput.isEmpty)
                }
                
                ScrollView {
                    TextField("What did you do today?", text: $textInput, axis: .vertical)
                        .font(.system(size: 24))
                        .foregroundColor(.white)
                        .padding()
                        .focused($isTextFieldFocused)
                        .onAppear {
                            isTextFieldFocused = true
                        }
                        .textFieldStyle(.plain)
                }
                .padding(.horizontal)
                
                Spacer()
            }
        }
    }
    
    struct CameraViewWrapper: View {
        @Binding var capturedImage: UIImage?
        let onCapture: () -> Void
        @State private var coordinator: CameraView.Coordinator?
        
        var body: some View {
            ZStack {
                CameraView(capturedImage: $capturedImage, onCapture: onCapture)
                    .onAppear { coordinator = CameraView.Coordinator(CameraView(capturedImage: $capturedImage, onCapture: onCapture)) }
                
                VStack {
                    Spacer()
                    
                    Button(action: {
                        coordinator?.capturePhoto()
                    }) {
                        ZStack {
                            Circle()
                                .fill(Color.white)
                                .frame(width: 70, height: 70)
                            
                            Circle()
                                .stroke(Color.white, lineWidth: 4)
                                .frame(width: 80, height: 80)
                        }
                    }
                    .padding(.bottom, 50)
                }
            }
        }
    }
    
    func handlePhotoCaptured() {
        guard let image = capturedImage else { return }
        
        let entry = TrackingEntry(inputType: .photo, rawInput: "Photo captured at \(Date())")
        entry.photoData = image.jpegData(compressionQuality: 0.8)
        modelContext.insert(entry)
        
        do {
            try modelContext.save()
            onDismiss()
        } catch {
            print("Error saving photo entry: \(error)")
        }
    }
    
    func handleRecordingState(_ isPressed: Bool) {
        isRecording = isPressed
        
        if isPressed {
            speechService.startRecording()
        } else {
            speechService.stopRecording()
            if !speechService.transcript.isEmpty {
                saveVoiceEntry()
            }
        }
    }
    
    func saveVoiceEntry() {
        let entry = TrackingEntry(inputType: .voice, rawInput: speechService.transcript)
        entry.transcript = speechService.transcript
        modelContext.insert(entry)
        
        do {
            try modelContext.save()
            speechService.transcript = ""
            onDismiss()
        } catch {
            print("Error saving voice entry: \(error)")
        }
    }
    
    func handleTextSubmit() {
        guard !textInput.isEmpty else { return }
        
        let entry = TrackingEntry(inputType: .text, rawInput: textInput)
        modelContext.insert(entry)
        
        do {
            try modelContext.save()
            onDismiss()
        } catch {
            print("Error saving text entry: \(error)")
        }
    }
}

#Preview {
    AddView(onDismiss: {})
        .modelContainer(for: TrackingEntry.self, inMemory: true)
}