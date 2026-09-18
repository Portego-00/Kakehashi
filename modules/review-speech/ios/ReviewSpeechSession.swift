import AVFoundation
import Speech

@available(iOS 26.0, *)
@MainActor
final class ReviewSpeechSession {
  let id: Int
  private let localeIdentifier: String
  private let emit: (String, Any) -> Void
  private let audioEngine = AVAudioEngine()
  private var analyzer: SpeechAnalyzer?
  private var continuation: AsyncStream<AnalyzerInput>.Continuation?
  private var setupTask: Task<Void, Never>?
  private var resultsTask: Task<Void, Never>?
  private var finishTask: Task<Void, Never>?
  private var timeoutTask: Task<Void, Never>?
  private var download: AssetInstallationRequest?
  private var progressTask: Task<Void, Never>?
  private var interruptionObserver: NSObjectProtocol?
  private var transcript = ReviewSpeechTranscript()
  private var tapInstalled = false
  private var audioSessionActive = false
  private var listening = false
  private var finishing = false
  private var ended = false
  private var cancelled = false

  init(id: Int, locale: String, emit: @escaping (String, Any) -> Void) {
    self.id = id
    self.localeIdentifier = locale
    self.emit = emit
  }

  func start() {
    setupTask = Task { [weak self] in
      guard let self else { return }
      do { try await self.prepareAndStart() }
      catch is CancellationError { self.abort() }
      catch { await self.fail(error.localizedDescription) }
    }
  }

  private func checkActive() throws {
    try Task.checkCancellation()
    if cancelled || ended { throw CancellationError() }
  }

  private func prepareAndStart() async throws {
    emit("status", ["message": "Preparing speech…"])
    guard SpeechTranscriber.isAvailable,
      let locale = await SpeechTranscriber.supportedLocale(equivalentTo: Locale(identifier: localeIdentifier)) else {
      throw failure("On-device speech is unavailable for this language.")
    }
    try checkActive()
    let transcriber = SpeechTranscriber(locale: locale, transcriptionOptions: [],
      reportingOptions: [.volatileResults, .alternativeTranscriptions],
      attributeOptions: [.audioTimeRange])
    // Reservations are app-scoped. Retain Japanese/English between questions;
    // never evict another feature's assets to make room.
    // false means it was already reserved, which is normal on the next question.
    _ = try await AssetInventory.reserve(locale: locale)
    try checkActive()
    if let request = try await AssetInventory.assetInstallationRequest(supporting: [transcriber]) {
      try checkActive()
      download = request
      emit("status", ["message": "Downloading speech model…"])
      progressTask = Task { [weak self] in
        while !Task.isCancelled {
          guard let self, !self.cancelled, !self.ended else { return }
          let percent = Int(max(0, min(1, request.progress.fractionCompleted)) * 100)
          self.emit("status", ["message": "Downloading speech model… \(percent)%"])
          try? await Task.sleep(for: .milliseconds(500))
        }
      }
      try await request.downloadAndInstall()
      progressTask?.cancel()
      progressTask = nil
      download = nil
    }
    try checkActive()
    guard await AssetInventory.status(forModules: [transcriber]) == .installed else {
      throw failure("The speech model is not installed. Connect to the internet and try again.")
    }
    try checkActive()
    let analyzer = SpeechAnalyzer(modules: [transcriber])
    self.analyzer = analyzer
    guard let format = await SpeechAnalyzer.bestAvailableAudioFormat(compatibleWith: [transcriber]) else {
      throw failure("No compatible microphone format is available.")
    }
    try checkActive()
    try await analyzer.prepareToAnalyze(in: format)
    try checkActive()
    let (stream, continuation) = AsyncStream<AnalyzerInput>.makeStream()
    self.continuation = continuation
    resultsTask = Task { [weak self] in
      do {
        for try await result in transcriber.results {
          guard let self, !self.cancelled, !self.ended else { return }
          // Even finalized ranges remain provisional until our utterance endpoint.
          // This prevents a short prefix from becoming a submitted answer.
          let alternatives = ([result.text] + result.alternatives).map {
            String($0.characters).trimmingCharacters(in: .whitespacesAndNewlines)
          }
          self.transcript.replace(start: result.range.start.seconds,
            end: CMTimeRangeGetEnd(result.range).seconds, alternatives: alternatives)
          self.emitResults(final: false)
        }
      } catch {
        guard let self, !self.cancelled, !self.ended else { return }
        await self.fail(error.localizedDescription)
      }
    }
    try await analyzer.start(inputSequence: stream)
    try checkActive()
    emit("status", ["message": "Starting microphone…"])
    let audioSession = AVAudioSession.sharedInstance()
    try audioSession.setCategory(.playAndRecord, mode: .measurement,
      options: [.defaultToSpeaker, .allowBluetoothHFP])
    try audioSession.setActive(true)
    audioSessionActive = true
    let input = audioEngine.inputNode
    let inputFormat = input.outputFormat(forBus: 0)
    guard inputFormat.sampleRate > 0, inputFormat.channelCount > 0,
      let audioInput = ReviewSpeechAudioInput(from: inputFormat, to: format, continuation: continuation,
        volume: { [weak self] value in Task { @MainActor in
          guard let self, self.listening, !self.ended, !self.cancelled else { return }
          self.emit("volumechange", ["value": value])
        } }, failed: { [weak self] in Task { @MainActor in
          await self?.fail("Unable to process microphone audio.")
        } }) else { throw failure("The microphone is unavailable.") }
    input.installTap(onBus: 0, bufferSize: 1024, format: inputFormat) { buffer, _ in
      audioInput.append(buffer)
    }
    tapInstalled = true
    interruptionObserver = NotificationCenter.default.addObserver(
      forName: AVAudioSession.interruptionNotification, object: nil, queue: .main
    ) { [weak self] notification in
      guard let type = notification.userInfo?[AVAudioSessionInterruptionTypeKey] as? UInt,
        type == AVAudioSession.InterruptionType.began.rawValue else { return }
      Task { @MainActor in await self?.fail("The microphone was interrupted. Tap the mic to try again.") }
    }
    audioEngine.prepare()
    try audioEngine.start()
    listening = true
    emit("start", NSNull())
  }

  func stop() {
    guard !ended, !cancelled, !finishing else { return }
    guard listening, let analyzer else { abort(); return }
    finishing = true
    stopAudio()
    continuation?.finish()
    continuation = nil
    timeoutTask = Task { [weak self] in
      do { try await Task.sleep(for: .seconds(10)) } catch { return }
      await self?.fail("Speech recognition took too long. Please try again.")
    }
    finishTask = Task { [weak self] in
      guard let self else { return }
      do {
        try await analyzer.finalizeAndFinishThroughEndOfInput()
        await self.resultsTask?.value
        guard !self.ended, !self.cancelled else { return }
        self.emitResults(final: true)
        self.end()
      } catch { await self.fail(error.localizedDescription) }
    }
  }

  func abort() {
    guard !ended, !cancelled else { return }
    cancelled = true
    setupTask?.cancel()
    finishTask?.cancel()
    resultsTask?.cancel()
    progressTask?.cancel()
    download?.progress.cancel()
    stopAudio()
    continuation?.finish()
    continuation = nil
    Task { [self] in
      await analyzer?.cancelAndFinishNow()
      end()
    }
  }

  private func fail(_ message: String) async {
    guard !ended, !cancelled else { return }
    emit("error", ["error": "audio-capture", "message": message, "code": -1])
    abort()
  }

  private func emitResults(final: Bool) {
    let results = transcript.results(joiner: localeIdentifier.hasPrefix("ja") ? "" : " ")
    if !results.isEmpty { emit("result", ["isFinal": final, "results": results]) }
  }

  private func stopAudio() {
    listening = false
    if tapInstalled { audioEngine.inputNode.removeTap(onBus: 0); tapInstalled = false }
    audioEngine.stop()
  }

  private func end() {
    guard !ended else { return }
    ended = true
    timeoutTask?.cancel()
    progressTask?.cancel()
    stopAudio()
    if let interruptionObserver { NotificationCenter.default.removeObserver(interruptionObserver) }
    interruptionObserver = nil
    if audioSessionActive {
      try? AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation)
      audioSessionActive = false
    }
    emit("end", NSNull())
  }

  private func failure(_ message: String) -> NSError {
    NSError(domain: "ReviewSpeech", code: 1, userInfo: [NSLocalizedDescriptionKey: message])
  }
}

/// AVAudioConverter is accessed only by the serial input-node tap. Each yielded
/// buffer is newly allocated: AVAudioEngine is free to reuse its input buffers.
@available(iOS 26.0, *)
private final class ReviewSpeechAudioInput: @unchecked Sendable {
  private let converter: AVAudioConverter
  private let format: AVAudioFormat
  private let continuation: AsyncStream<AnalyzerInput>.Continuation
  private let volume: (Float) -> Void
  private let failed: () -> Void
  private var volumeFrames: AVAudioFrameCount = 0

  init?(from: AVAudioFormat, to: AVAudioFormat, continuation: AsyncStream<AnalyzerInput>.Continuation,
        volume: @escaping (Float) -> Void, failed: @escaping () -> Void) {
    guard let converter = AVAudioConverter(from: from, to: to) else { return nil }
    self.converter = converter
    self.format = to
    self.continuation = continuation
    self.volume = volume
    self.failed = failed
  }

  func append(_ input: AVAudioPCMBuffer) {
    volumeFrames += input.frameLength
    if volumeFrames >= AVAudioFrameCount(input.format.sampleRate * 0.05), let samples = input.floatChannelData {
      volumeFrames = 0
      var peak: Float = 0.0000001
      for index in 0..<Int(input.frameLength) { peak = max(peak, abs(samples[0][index * input.stride])) }
      volume(max(-2, min(10, (20 * log10(peak) + 60) / 5 - 2)))
    }
    let capacity = AVAudioFrameCount(ceil(Double(input.frameLength) * format.sampleRate / input.format.sampleRate)) + 32
    guard let output = AVAudioPCMBuffer(pcmFormat: format, frameCapacity: capacity) else { failed(); return }
    var supplied = false
    var error: NSError?
    let status = converter.convert(to: output, error: &error) { _, state in
      if supplied { state.pointee = .noDataNow; return nil }
      supplied = true
      state.pointee = .haveData
      return input
    }
    if status == .error || error != nil { failed(); return }
    if output.frameLength > 0 { continuation.yield(AnalyzerInput(buffer: output)) }
  }
}
