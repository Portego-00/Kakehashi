import ExpoModulesCore
import Speech

public final class ReviewSpeechModule: Module {
  // Keep the stored type loadable on iOS versions older than SpeechAnalyzer.
  private var session: AnyObject?

  public func definition() -> ModuleDefinition {
    Name("ReviewSpeech")
    Events("speechEvent")

    AsyncFunction("getCapabilities") { (locale: String) -> [String: Any] in
      guard #available(iOS 26.0, *) else {
        return ["supported": false, "reason": "SpeechTranscriber requires iOS 26 or later."]
      }
      guard SpeechTranscriber.isAvailable else {
        return ["supported": false, "reason": "SpeechTranscriber is unavailable on this device."]
      }
      guard await SpeechTranscriber.supportedLocale(equivalentTo: Locale(identifier: locale)) != nil else {
        return ["supported": false, "reason": "SpeechTranscriber does not support \(locale) on this device."]
      }
      return ["supported": true]
    }

    AsyncFunction("start") { (id: Int, locale: String, promise: Promise) in
      MainActor.assumeIsolated {
        guard #available(iOS 26.0, *) else {
          promise.reject("ERR_SPEECH_UNSUPPORTED", "SpeechTranscriber requires iOS 26.")
          return
        }
        guard self.session == nil else {
          promise.reject("ERR_SPEECH_BUSY", "The previous speech capture is still stopping.")
          return
        }
        let session = ReviewSpeechSession(id: id, locale: locale) { [weak self] name, payload in
          if name == "end" { self?.session = nil }
          self?.sendEvent("speechEvent", ["sessionId": id, "name": name, "payload": payload])
        }
        self.session = session
        session.start()
        promise.resolve()
      }
    }.runOnQueue(.main)

    AsyncFunction("stop") { (id: Int) in
      MainActor.assumeIsolated {
        if #available(iOS 26.0, *), let session = self.session as? ReviewSpeechSession, session.id == id {
          session.stop()
        }
      }
    }.runOnQueue(.main)

    AsyncFunction("abort") { (id: Int) in
      MainActor.assumeIsolated {
        if #available(iOS 26.0, *), let session = self.session as? ReviewSpeechSession, session.id == id {
          session.abort()
        }
      }
    }.runOnQueue(.main)

    OnDestroy {
      Task { @MainActor in
        if #available(iOS 26.0, *), let session = self.session as? ReviewSpeechSession {
          session.abort()
        }
      }
    }
  }
}
