import SwiftUI
import AVFoundation
import UIKit

struct PhotoInputView: View {
    @Environment(\.modelContext) private var modelContext
    @Environment(\.dismiss) private var dismiss
    @State private var capturedImage: UIImage?
    @State private var isProcessing = false
    @State private var processingStage = ""
    @State private var showingImagePicker = false
    @State private var showingCamera = false
    @State private var sourceType: UIImagePickerController.SourceType = .camera
    
    var body: some View {
        NavigationView {
            VStack(spacing: 24) {
                if let image = capturedImage {
                    CapturedImageView(image: image)
                } else {
                    SelectionView()
                }
                
                if isProcessing {
                    ProcessingView()
                } else {
                    Spacer()
                }
            }
            .padding()
            .navigationTitle("Photo Input")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) {
                    Button("Cancel") {
                        dismiss()
                    }
                }
                
                if capturedImage != nil && !isProcessing {
                    ToolbarItem(placement: .navigationBarTrailing) {
                        Button("Save") {
                            saveEntry()
                        }
                    }
                }
            }
            .sheet(isPresented: $showingImagePicker) {
                ImagePicker(image: $capturedImage, sourceType: sourceType)
            }
        }
    }
    
    @ViewBuilder
    private func SelectionView() -> some View {
        VStack(spacing: 24) {
            VStack(spacing: 8) {
                Text("Capture Your Activity")
                    .font(.headline)
                
                Text("Take a photo of food, workouts, supplements, or anything health-related")
                    .font(.subheadline)
                    .foregroundColor(.secondary)
                    .multilineTextAlignment(.center)
            }
            .padding(.top)
            
            VStack(spacing: 16) {
                Button(action: {
                    sourceType = .camera
                    showingCamera = true
                }) {
                    HStack {
                        Image(systemName: "camera.fill")
                            .font(.title2)
                        Text("Take Photo")
                            .font(.headline)
                    }
                    .foregroundColor(.white)
                    .frame(maxWidth: .infinity)
                    .padding()
                    .background(Color.blue)
                    .cornerRadius(12)
                }
                
                Button(action: {
                    sourceType = .photoLibrary
                    showingImagePicker = true
                }) {
                    HStack {
                        Image(systemName: "photo.fill")
                            .font(.title2)
                        Text("Choose from Library")
                            .font(.headline)
                    }
                    .foregroundColor(.blue)
                    .frame(maxWidth: .infinity)
                    .padding()
                    .background(Color(.systemGray6))
                    .cornerRadius(12)
                }
            }
        }
        .onReceive(NotificationCenter.default.publisher(for: .cameraPermissionGranted)) { _ in
            showingImagePicker = true
        }
        .onChange(of: showingCamera) { _, newValue in
            if newValue {
                checkCameraPermission()
            }
        }
    }
    
    @ViewBuilder
    private func CapturedImageView(image: UIImage) -> some View {
        VStack(spacing: 16) {
            Text("Photo Captured")
                .font(.headline)
            
            Image(uiImage: image)
                .resizable()
                .aspectRatio(contentMode: .fit)
                .frame(maxHeight: 300)
                .cornerRadius(12)
                .shadow(radius: 4)
            
            Button("Retake") {
                capturedImage = nil
            }
            .foregroundColor(.blue)
        }
    }
    
    @ViewBuilder
    private func ProcessingView() -> some View {
        VStack(spacing: 12) {
            ProgressView()
                .scaleEffect(1.2)
            
            Text(processingStage)
                .font(.subheadline)
                .foregroundColor(.secondary)
        }
        .padding()
    }
    
    private func checkCameraPermission() {
        let status = AVCaptureDevice.authorizationStatus(for: .video)
        
        switch status {
        case .authorized:
            showingImagePicker = true
        case .notDetermined:
            AVCaptureDevice.requestAccess(for: .video) { granted in
                DispatchQueue.main.async {
                    if granted {
                        showingImagePicker = true
                    }
                    showingCamera = false
                }
            }
        case .denied, .restricted:
            showingCamera = false
        @unknown default:
            showingCamera = false
        }
    }
    
    private func saveEntry() {
        guard let image = capturedImage else { return }
        
        isProcessing = true
        processingStage = "Analyzing image..."
        
        let entry = TrackingEntry(inputType: .photo, rawInput: "Photo captured")
        entry.photoData = image.jpegData(compressionQuality: 0.8)
        entry.isProcessing = true
        
        modelContext.insert(entry)
        
        Task {
            do {
                let imageDescription = try await ImageRecognitionService.shared.analyzeImage(image)
                
                await MainActor.run {
                    entry.imageDescription = imageDescription
                    processingStage = "Processing description..."
                }
                
                let atoms = try await LLMParsingService.shared.parseTranscript(imageDescription)
                
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

struct ImagePicker: UIViewControllerRepresentable {
    @Binding var image: UIImage?
    var sourceType: UIImagePickerController.SourceType
    @Environment(\.dismiss) private var dismiss
    
    func makeUIViewController(context: Context) -> UIImagePickerController {
        let picker = UIImagePickerController()
        picker.delegate = context.coordinator
        picker.sourceType = sourceType
        return picker
    }
    
    func updateUIViewController(_ uiViewController: UIImagePickerController, context: Context) {}
    
    func makeCoordinator() -> Coordinator {
        Coordinator(self)
    }
    
    class Coordinator: NSObject, UIImagePickerControllerDelegate, UINavigationControllerDelegate {
        let parent: ImagePicker
        
        init(_ parent: ImagePicker) {
            self.parent = parent
        }
        
        func imagePickerController(_ picker: UIImagePickerController, didFinishPickingMediaWithInfo info: [UIImagePickerController.InfoKey : Any]) {
            if let image = info[.originalImage] as? UIImage {
                parent.image = image
            }
            parent.dismiss()
        }
        
        func imagePickerControllerDidCancel(_ picker: UIImagePickerController) {
            parent.dismiss()
        }
    }
}

extension Notification.Name {
    static let cameraPermissionGranted = Notification.Name("cameraPermissionGranted")
}