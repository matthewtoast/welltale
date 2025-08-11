import SwiftUI

struct VoiceRecordingView: View {
    @StateObject private var speechService = SpeechService()
    @Environment(\.modelContext) private var modelContext
    @Environment(\.dismiss) private var dismiss
    @State private var isProcessing = false
    
    var body: some View {
        NavigationView {
            VStack(spacing: 24) {
                Spacer()
                
                if !speechService.hasPermission {
                    PermissionView()
                } else {
                    RecordingInterface()
                }
                
                Spacer()
            }
            .padding()
            .navigationTitle("Voice Recording")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) {
                    Button("Cancel") {
                        speechService.stopRecording()
                        dismiss()
                    }
                }
                
                if !speechService.transcript.isEmpty && !speechService.isRecording {
                    ToolbarItem(placement: .navigationBarTrailing) {
                        Button("Save") {
                            saveEntry()
                        }
                        .disabled(isProcessing)
                    }
                }
            }
        }
    }
    
    @ViewBuilder
    private func PermissionView() -> some View {
        VStack(spacing: 16) {
            Image(systemName: "mic.slash")
                .font(.system(size: 48))
                .foregroundColor(.gray)
            
            Text("Microphone Permission Required")
                .font(.headline)
            
            Text("Please enable microphone access in Settings to record voice notes.")
                .multilineTextAlignment(.center)
                .foregroundColor(.secondary)
            
            Button("Check Permissions") {
                speechService.checkPermissions()
            }
            .buttonStyle(.borderedProminent)
        }
    }
    
    @ViewBuilder
    private func RecordingInterface() -> some View {
        VStack(spacing: 24) {
            RecordButton()
            
            if !speechService.transcript.isEmpty {
                TranscriptView()
            }
            
            if isProcessing {
                ProcessingView()
            }
        }
    }
    
    @ViewBuilder
    private func RecordButton() -> some View {
        Button(action: {
            if speechService.isRecording {
                speechService.stopRecording()
            } else {
                speechService.startRecording()
            }
        }) {
            ZStack {
                Circle()
                    .fill(speechService.isRecording ? Color.red : Color.blue)
                    .frame(width: 120, height: 120)
                
                Image(systemName: speechService.isRecording ? "stop.fill" : "mic.fill")
                    .font(.system(size: 40))
                    .foregroundColor(.white)
            }
        }
        .scaleEffect(speechService.isRecording ? 1.1 : 1.0)
        .animation(.easeInOut(duration: 0.1), value: speechService.isRecording)
    }
    
    @ViewBuilder
    private func TranscriptView() -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Transcript:")
                .font(.headline)
            
            ScrollView {
                Text(speechService.transcript)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding()
                    .background(Color(.systemGray6))
                    .cornerRadius(8)
            }
            .frame(maxHeight: 150)
        }
    }
    
    @ViewBuilder
    private func ProcessingView() -> some View {
        VStack(spacing: 12) {
            ProgressView()
                .scaleEffect(1.2)
            
            Text("Processing...")
                .font(.subheadline)
                .foregroundColor(.secondary)
        }
    }
    
    private func saveEntry() {
        guard !speechService.transcript.isEmpty else { return }
        
        isProcessing = true
        
        let entry = TrackingEntry(inputType: .voice, rawInput: speechService.transcript)
        entry.transcript = speechService.transcript
        entry.isProcessing = true
        
        modelContext.insert(entry)
        
        Task {
            do {
                let atoms = try await LLMParsingService.shared.parseTranscript(speechService.transcript)
                
                await MainActor.run {
                    entry.atoms = atoms
                    entry.isProcessing = false
                    isProcessing = false
                    dismiss()
                }
            } catch {
                await MainActor.run {
                    entry.processingError = error.localizedDescription
                    entry.isProcessing = false
                    isProcessing = false
                    dismiss()
                }
            }
        }
    }
}