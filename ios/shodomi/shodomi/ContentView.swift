//
//  ContentView.swift
//  shodomi
//
//  Created by Matthew Trost on 7/31/25.
//

import SwiftUI
import SwiftData

struct ContentView: View {
    @Environment(\.modelContext) private var modelContext
    @Query private var entries: [TrackingEntry]
    @State private var showingVoiceRecording = false
    @State private var showingTextInput = false
    @State private var showingPhotoInput = false
    
    var body: some View {
        NavigationView {
            VStack(spacing: 24) {
                HeaderView()
                InputButtonsView()
                RecentEntriesView()
                Spacer()
            }
            .padding()
            .navigationTitle("Shodomi")
            .sheet(isPresented: $showingVoiceRecording) {
                VoiceRecordingView()
            }
            .sheet(isPresented: $showingTextInput) {
                TextInputView()
            }
            .sheet(isPresented: $showingPhotoInput) {
                PhotoInputView()
            }
        }
    }
    
    @ViewBuilder
    private func HeaderView() -> some View {
        VStack(spacing: 8) {
            Text("Track Your Health")
                .font(.title2)
                .fontWeight(.semibold)
            
            Text("Choose how you'd like to log your activity")
                .font(.subheadline)
                .foregroundColor(.secondary)
        }
        .padding(.top)
    }
    
    @ViewBuilder
    private func InputButtonsView() -> some View {
        VStack(spacing: 16) {
            HStack(spacing: 16) {
                InputTypeButton(
                    title: "Voice",
                    icon: "mic.fill",
                    color: .blue,
                    isSelected: false
                ) {
                    showingVoiceRecording = true
                }
                
                InputTypeButton(
                    title: "Photo",
                    icon: "camera.fill",
                    color: .green,
                    isSelected: false
                ) {
                    showingPhotoInput = true
                }
            }
            
            InputTypeButton(
                title: "Text",
                icon: "text.cursor",
                color: .orange,
                isSelected: false
            ) {
                showingTextInput = true
            }
        }
    }
    
    @ViewBuilder
    private func RecentEntriesView() -> some View {
        if !entries.isEmpty {
            VStack(alignment: .leading, spacing: 12) {
                Text("Recent Entries")
                    .font(.headline)
                
                ForEach(Array(entries.prefix(3)), id: \.id) { entry in
                    EntryRowView(entry: entry)
                }
            }
        }
    }
}

struct EntryRowView: View {
    let entry: TrackingEntry
    
    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack {
                Image(systemName: iconForInputType(entry.inputType))
                    .foregroundColor(colorForInputType(entry.inputType))
                
                Text(entry.inputTimestamp, style: .time)
                    .font(.caption)
                    .foregroundColor(.secondary)
                
                Spacer()
                
                if entry.isProcessing {
                    ProgressView()
                        .scaleEffect(0.8)
                }
            }
            
            Text(entry.transcript ?? entry.imageDescription ?? entry.rawInput)
                .font(.subheadline)
                .lineLimit(2)
            
            if !entry.atoms.isEmpty {
                Text("\(entry.atoms.count) item\(entry.atoms.count == 1 ? "" : "s") tracked")
                    .font(.caption)
                    .foregroundColor(.secondary)
            }
        }
        .padding()
        .background(Color(.systemGray6))
        .cornerRadius(8)
    }
    
    private func iconForInputType(_ type: InputType) -> String {
        switch type {
        case .voice: return "mic.fill"
        case .photo: return "camera.fill"
        case .text: return "text.cursor"
        }
    }
    
    private func colorForInputType(_ type: InputType) -> Color {
        switch type {
        case .voice: return .blue
        case .photo: return .green
        case .text: return .orange
        }
    }
}

#Preview {
    ContentView()
        .modelContainer(for: TrackingEntry.self, inMemory: true)
}
