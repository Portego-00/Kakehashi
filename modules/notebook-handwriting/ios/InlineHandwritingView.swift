import ExpoModulesCore
import UIKit

struct InlineHandwritingDocumentOptions: Record {
  @Field var sessionId: String = ""
  @Field var draftKey: String = ""
  @Field var sourceId: String = ""
  @Field var acceptedRecoverySourceId: String?
  @Field var inkFormat: String = "pencilkit-v1"
  @Field var inkBase64: String?
  @Field var width: Int = 768
  @Field var height: Int = 384
}
struct InlineHandwritingPaperSize: Record {
  @Field var width: Int = 768
  @Field var height: Int = 384
}

final class InlineHandwritingView: ExpoView {
  let surface = InlineHandwritingCanvas()
  let onReady = EventDispatcher()
  let onChange = EventDispatcher()
  let onError = EventDispatcher()
  let onToolActivity = EventDispatcher()
  var document: InlineHandwritingDocumentOptions?
  var paperSize: InlineHandwritingPaperSize?
  var paperColor = "#ffffff"
  var paperStyle = "light"
  var active = false
  var inputEnabled = true
  var fingerDrawing = false
  private var configured = false
  private var lastRequestedPaperSize: CGSize?

  required init(appContext: AppContext? = nil) {
    super.init(appContext: appContext)
    clipsToBounds = true
    addSubview(surface)
    surface.onReady = { [weak self] in self?.onReady($0) }
    surface.onChange = { [weak self] in self?.onChange($0) }
    surface.onError = { [weak self] in self?.onError($0) }
    surface.onToolActivity = { [weak self] in self?.onToolActivity($0) }
  }

  override func layoutSubviews() {
    super.layoutSubviews()
    surface.frame = bounds
  }

  func updateProps() {
    guard let document else { return }
    do {
      try surface.setPaperAppearance(color: paperColor, style: paperStyle)
      try surface.configure(sessionId: document.sessionId, draftKey: document.draftKey, sourceId: document.sourceId, acceptedRecoverySourceId: document.acceptedRecoverySourceId, inkFormat: document.inkFormat, inkBase64: document.inkBase64,
                            width: document.width, height: document.height)
      if let paperSize {
        let requested = CGSize(width: paperSize.width, height: paperSize.height)
        if configured, lastRequestedPaperSize != requested {
          lastRequestedPaperSize = requested
          try surface.resize(width: paperSize.width, height: paperSize.height)
        } else { lastRequestedPaperSize = requested }
      }
      configured = true
      surface.inputEnabled = inputEnabled
      surface.fingerDrawing = fingerDrawing
      surface.setActive(active)
    } catch {
      // Configure may fail before the surface accepts its session. Preserve the
      // requested identity so React Native can show the error for that block.
      if surface.sessionId.isEmpty {
        onError(["sessionId": document.sessionId, "message": error.localizedDescription])
      } else { surface.report(error) }
    }
  }

  override func hitTest(_ point: CGPoint, with event: UIEvent?) -> UIView? {
    guard active, inputEnabled, bounds.contains(point) else { return nil }
    if surface.shouldPassThrough(touchTypes: event?.allTouches?.map(\.type) ?? []) { return nil }
    return super.hitTest(point, with: event)
  }
}
