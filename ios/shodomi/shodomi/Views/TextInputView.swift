import SwiftUI

struct TextInputView: View {
    @Environment(\.modelContext) private var modelContext
    @Environment(\.dismiss) private var dismiss
    @State private var text = ""
    @State private var isProcessing = false
    @FocusState private var isTextFieldFocused: Bool
    
    var body: some View {
        NavigationView {
            VStack(spacing: 24) {
                HeaderView()
                TextEditorView()
                
                if isProcessing {
                    ProcessingView()
                } else {
                    Spacer()
                }
            }
            .padding()
            .navigationTitle("Text Input")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) {
                    Button("Cancel") {
                        dismiss()
                    }
                }
                
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button("Save") {
                        saveEntry()
                    }
                    .disabled(text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || isProcessing)
                }
            }
            .onAppear {
                isTextFieldFocused = true
            }
        }
    }
    
    @ViewBuilder
    private func HeaderView() -> some View {
        VStack(spacing: 8) {
            Text("What would you like to track?")
                .font(.headline)
            
            Text("Type anything about your nutrition, exercise, sleep, mood, or activities")
                .font(.subheadline)
                .foregroundColor(.secondary)
                .multilineTextAlignment(.center)
        }
        .padding(.top)
    }
    
    @ViewBuilder
    private func TextEditorView() -> some View {
        VStack(alignment: .leading, spacing: 8) {
            TextEditor(text: $text)
                .focused($isTextFieldFocused)
                .font(.body)
                .padding(12)
                .background(Color(.systemGray6))
                .cornerRadius(12)
                .frame(minHeight: 120)
                .overlay(
                    RoundedRectangle(cornerRadius: 12)
                        .stroke(Color(.systemGray4), lineWidth: 1)
                )
                .overlay(
                    Group {
                        if text.isEmpty {
                            VStack {
                                HStack {
                                    Text("Examples:\n• Had a protein shake after workout\n• Slept 7 hours last night\n• Benched 140 lbs for 3 sets\n• Feeling anxious about work")
                                        .font(.subheadline)
                                        .foregroundColor(.secondary)
                                        .padding(.horizontal, 16)
                                        .padding(.top, 16)
                                    Spacer()
                                }
                                Spacer()
                            }
                        }
                    }
                )
            
            HStack {
                Spacer()
                Text("\(text.count) characters")
                    .font(.caption)
                    .foregroundColor(.secondary)
            }
        }
    }
    
    @ViewBuilder
    private func ProcessingView() -> some View {
        VStack(spacing: 12) {
            ProgressView()
                .scaleEffect(1.2)
            
            Text("Processing your entry...")
                .font(.subheadline)
                .foregroundColor(.secondary)
        }
        .padding()
    }
    
    private func saveEntry() {
        let trimmedText = text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmedText.isEmpty else { return }
        
        isProcessing = true
        
        let entry = TrackingEntry(inputType: .text, rawInput: trimmedText)
        entry.isProcessing = true
        
        modelContext.insert(entry)
        
        Task {
            do {
                let atoms = try await LLMParsingService.shared.parseTranscript(trimmedText)
                
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