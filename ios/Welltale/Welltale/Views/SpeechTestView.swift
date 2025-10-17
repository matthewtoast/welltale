import SwiftUI

struct SpeechTestView: View {
    @StateObject private var capture: SpeechCaptureController
    private let locale: LangLocale
    @State private var didSetupListener = false
    private let triggerPhrase = "the frog jumps"

    init(locale: LangLocale = .en_us, config: SpeechCaptureConfig = .default) {
        _capture = StateObject(wrappedValue: SpeechCaptureController(locale: locale, config: config))
        self.locale = locale
    }

    init(
        lineGapMs: Int,
        maxDurationMs: Int,
        segmentDurationMs: Int,
        segmentCharacterLimit: Int,
        autoStopAfterMs: Int = 0,
        locale: LangLocale = .en_us
    ) {
        let config = SpeechCaptureConfig(
            lineGapMs: lineGapMs,
            maxDurationMs: maxDurationMs,
            segmentDurationMs: segmentDurationMs,
            segmentCharacterLimit: segmentCharacterLimit,
            autoStopAfterMs: autoStopAfterMs
        )
        _capture = StateObject(wrappedValue: SpeechCaptureController(locale: locale, config: config))
        self.locale = locale
    }

    var body: some View {
        ZStack {
            Color.wellBackground.ignoresSafeArea()
            VStack(spacing: 24) {
                ScrollView {
                    LazyVStack(alignment: .leading, spacing: 12) {
                        ForEach(capture.lines) { line in
                            let text = line.text.trimmingCharacters(in: .whitespacesAndNewlines)
                            Text(text.isEmpty ? "Listening..." : text)
                                .foregroundColor(Color.wellText)
                                .frame(maxWidth: .infinity, alignment: .leading)
                                .padding(.vertical, 8)
                                .padding(.horizontal, 12)
                                .background(Color.wellSurface)
                                .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                        }
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(.horizontal)
                    .padding(.top)
                }
                VStack(spacing: 8) {
                    Button(action: handleToggle) {
                        HStack(spacing: 12) {
                            Image(systemName: capture.isRecording ? "stop.circle.fill" : "mic.circle.fill")
                                .font(.system(size: 28, weight: .bold))
                            Text(capture.isRecording ? "Stop" : "Start")
                                .font(.headline)
                        }
                        .foregroundColor(Color.wellText)
                        .padding(.horizontal, 24)
                        .padding(.vertical, 16)
                        .frame(maxWidth: .infinity)
                        .background(capture.isRecording ? Color.red.opacity(0.3) : Color.wellPanel)
                        .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
                    }
                    Text(capture.accumulatedText.isEmpty ? "" : capture.accumulatedText)
                        .font(.footnote)
                        .foregroundColor(Color.wellMuted)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(.horizontal)
                    if let reason = capture.stopReason {
                        Text(statusText(reason: reason, word: capture.stopWord))
                            .font(.caption)
                            .foregroundColor(Color.wellMuted)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .padding(.horizontal)
                    }
                }
                .padding(.horizontal)
                Spacer(minLength: 0)
            }
        }
        .navigationTitle("Speech Test")
        .tint(Color.wellText)
        .toolbar {
            ToolbarItem(placement: .principal) {
                VStack(spacing: 2) {
                    Text("Speech Test")
                        .font(.headline)
                    Text(localeLabel(locale))
                        .font(.caption)
                        .foregroundColor(Color.wellMuted)
                }
            }
        }
        .onAppear(perform: setupListener)
    }

    private func handleToggle() {
        if capture.isRecording {
            capture.stop(reason: .user)
        } else {
            Task {
                await capture.start()
            }
        }
    }

    private func localeLabel(_ value: LangLocale) -> String {
        langLocaleToName(value)
    }

    private func statusText(reason: SpeechCaptureStopReason, word: String?) -> String {
        switch reason {
        case .user:
            return "Stopped by user"
        case .maxDuration:
            return "Stopped after max duration"
        case .autoStop:
            return "Stopped by auto threshold"
        case .error:
            return "Stopped due to error"
        case .external:
            return "Stopped externally"
        }
    }

    private func setupListener() {
        if didSetupListener {
            return
        }
        didSetupListener = true
        capture.emitter.on(.transcriptUpdated) {
            let text = capture.accumulatedText.lowercased()
            if text.contains(triggerPhrase) {
                capture.stop(reason: .external, sourceWord: triggerPhrase)
            }
        }
    }
}

#Preview {
    SpeechTestView()
}
