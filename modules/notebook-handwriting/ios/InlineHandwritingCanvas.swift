import PencilKit
import UIKit

/// The native drawing surface used by the inline Expo view and its UIKit fixture.
/// Its bounds are display points; PKDrawing coordinates remain paper coordinates.
final class InlineHandwritingCanvas: UIView, PKCanvasViewDelegate, UIScribbleInteractionDelegate {
  let canvas = InlinePaperCanvasView()
  let toolPicker = PKToolPicker()
  private(set) var sessionId = ""
  private(set) var paperSize = CGSize(width: 768, height: 384)
  private(set) var revision = 0
  private(set) var recovered = false
  private(set) var drawingActive = false
  private var sourceId = ""
  private var toolsVisible = true
  private let touchObserver = InlineDrawingTouchObserver()
  private var delegateUsingTool = false
  private var appActive = true
  private var activationRevision = 0
  private var lastDisplayBounds = CGRect.null
  private var lastLayoutPaperSize = CGSize.zero
  var inputEnabled = true { didSet { if oldValue != inputEnabled { updateActivity() } } }
  private var draftKey: String?
  private var loaded = false
  private var applying = false
  private var requestedActive = false
  private var draftTimer: Timer?
  private var metadataTimer: Timer?
  private var observers: [NSObjectProtocol] = []
  private var dirty = false
  private var exportedRevision: Int?
  var fingerDrawing = false { didSet { if oldValue != fingerDrawing { canvas.drawingPolicy = fingerDrawing ? .anyInput : .pencilOnly } } }
  var onReady: (([String: Any]) -> Void)?
  var onChange: (([String: Any]) -> Void)?
  var onError: (([String: Any]) -> Void)?
  var onToolActivity: (([String: Any]) -> Void)?

  override init(frame: CGRect) {
    super.init(frame: frame)
    clipsToBounds = true
    backgroundColor = .white
    canvas.overrideUserInterfaceStyle = .light
    canvas.backgroundColor = .white
    canvas.isOpaque = true
    canvas.isScrollEnabled = false
    canvas.bounces = false
    canvas.clipsToBounds = true
    canvas.drawingPolicy = .pencilOnly
    canvas.tool = PKInkingTool(.pen, color: .black, width: 3)
    canvas.delegate = self
    touchObserver.acceptsTouch = { [weak self] touch in
      guard let self else { return false }
      return touch.type == .pencil || (touch.type == .direct && self.acceptsFingerDrawing)
    }
    touchObserver.onChange = { [weak self] in self?.reconcileDrawingActivity() }
    canvas.addGestureRecognizer(touchObserver)
    canvas.drawingGestureRecognizer.addTarget(self, action: #selector(drawingGestureChanged(_:)))
    canvas.accessibilityLabel = "Native handwriting paper"
    canvas.accessibilityIdentifier = "notebook-native-inline-paper"
    addSubview(canvas)
    // Apple recommends suppressing Scribble directly on drawing views, so a
    // nearby text input cannot claim the Pencil gesture instead of PencilKit.
    addInteraction(UIScribbleInteraction(delegate: self))
    canvas.addInteraction(UIScribbleInteraction(delegate: self))
    toolPicker.addObserver(canvas)
    observers.append(NotificationCenter.default.addObserver(forName: UIApplication.willResignActiveNotification,
      object: nil, queue: .main) { [weak self] _ in
        guard let self else { return }
        self.flushBestEffort(); self.appActive = false; self.resetInterruptedInteraction(); self.updateActivity()
      })
    observers.append(NotificationCenter.default.addObserver(forName: UIApplication.didEnterBackgroundNotification,
      object: nil, queue: .main) { [weak self] _ in self?.flushBestEffort() })
    observers.append(NotificationCenter.default.addObserver(forName: UIApplication.didBecomeActiveNotification,
      object: nil, queue: .main) { [weak self] _ in
        guard let self else { return }; self.appActive = true; self.updateActivity()
      })
    for name in [Notification.Name.NSUndoManagerDidUndoChange, .NSUndoManagerDidRedoChange, .NSUndoManagerDidCloseUndoGroup] {
      observers.append(NotificationCenter.default.addObserver(forName: name, object: nil, queue: .main) { [weak self] _ in
        guard let self, self.loaded else { return }; self.emitChange()
      })
    }
  }

  required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }

  func configure(sessionId: String, draftKey: String, sourceId: String = "", acceptedRecoverySourceId: String? = nil, inkFormat: String = "pencilkit-v1", inkBase64: String?, width: Int, height: Int) throws {
    guard !sessionId.isEmpty, sessionId.utf8.count <= 512 else { throw HandwritingError.invalidDraftKey }
    if loaded {
      guard self.sessionId == sessionId, self.draftKey == draftKey else {
        flushBestEffort()
        setActive(false)
        isHidden = true
        throw HandwritingError.invalidDraftKey
      }
      // A backend acknowledgment can replace drawingId in JS. Reapplying its
      // original ink must never replace newer Pencil strokes in the same view.
      return
    }
    let originalSize = try Self.validSize(width: width, height: height)
    let original: PKDrawing
    if let inkBase64 {
      guard inkBase64.utf8.count <= ((HandwritingViewController.maximumBytes + 2) / 3) * 4,
        let bytes = Data(base64Encoded: inkBase64), bytes.count <= HandwritingViewController.maximumBytes else {
        throw HandwritingError.invalidInk
      }
      if inkFormat == "strokes-v1" {
        original = try InlineHandwritingImport.drawing(from: bytes, width: width, height: height)
      } else if inkFormat == "pencilkit-v1" {
        do { original = try PKDrawing(data: bytes) } catch { throw HandwritingError.invalidInk }
      } else { throw HandwritingError.invalidInk }
    } else { original = PKDrawing() }
    let recovery = try HandwritingDraftStore.read(key: draftKey)
    let initial: PKDrawing
    if let recovery {
      guard let recoverySource = recovery.sourceId,
        recoverySource == sourceId || recoverySource == acceptedRecoverySourceId else {
        throw NSError(domain: "NotebookHandwriting", code: 4, userInfo: [NSLocalizedDescriptionKey: "This handwriting changed elsewhere. Its local recovery draft is retained; reopen the original drawing to continue."])
      }
      paperSize = try Self.validSize(width: recovery.width, height: recovery.height)
      guard let bytes = Data(base64Encoded: recovery.inkBase64) else { throw HandwritingError.invalidDraft }
      do { initial = try PKDrawing(data: bytes) } catch { throw HandwritingError.invalidDraft }
    } else { initial = original; paperSize = originalSize }
    self.sessionId = sessionId
    self.draftKey = draftKey
    self.sourceId = sourceId
    recovered = recovery != nil
    dirty = recovered
    applying = true
    canvas.drawing = initial
    applying = false
    canvas.undoManager?.removeAllActions()
    loaded = true
    isHidden = false
    setNeedsLayout()
    onReady?(state)
    updateActivity()
  }

  private static func validSize(width: Int, height: Int) throws -> CGSize {
    guard (1...4096).contains(width), (1...4096).contains(height), width * height <= 16_000_000 else {
      throw HandwritingError.invalidSize
    }
    return CGSize(width: width, height: height)
  }

  var minimumPaperSize: CGSize {
    let ink = canvas.drawing.bounds
    guard !ink.isNull, !ink.isInfinite else { return CGSize(width: 1, height: 1) }
    return CGSize(width: min(4096, max(1, ceil(ink.maxX))), height: min(4096, max(1, ceil(ink.maxY))))
  }

  var state: [String: Any] {
    let minimum = minimumPaperSize
    return ["sessionId": sessionId, "revision": revision, "width": Int(paperSize.width), "height": Int(paperSize.height),
            "minimumWidth": Int(minimum.width), "minimumHeight": Int(minimum.height),
            "hasInk": !canvas.drawing.strokes.isEmpty, "canUndo": canvas.undoManager?.canUndo == true,
            "canRedo": canvas.undoManager?.canRedo == true, "recovered": recovered, "dirty": dirty]
  }

  /// Paper is presentation metadata, never a mutation of the stored strokes.
  func setPaperAppearance(color hex: String, style: String) throws {
    guard hex.range(of: "^#[0-9a-fA-F]{6}$", options: .regularExpression) != nil,
      let rgb = UInt32(hex.dropFirst(), radix: 16), style == "light" || style == "dark" else {
      throw NSError(domain: "NotebookHandwriting", code: 5, userInfo: [NSLocalizedDescriptionKey: "This handwriting paper color is invalid."])
    }
    let color = UIColor(red: CGFloat((rgb >> 16) & 255) / 255, green: CGFloat((rgb >> 8) & 255) / 255,
                        blue: CGFloat(rgb & 255) / 255, alpha: 1)
    let appearance: UIUserInterfaceStyle = style == "dark" ? .dark : .light
    // UIKit can make the changed canvas traits current while notifying its
    // observers. Restore the surrounding drawing context after this update so
    // sibling labels do not resolve their dynamic colors using the paper style.
    traitCollection.performAsCurrent {
      if backgroundColor != color { backgroundColor = color; canvas.backgroundColor = color }
      if canvas.overrideUserInterfaceStyle != appearance { canvas.overrideUserInterfaceStyle = appearance }
      if toolPicker.colorUserInterfaceStyle != appearance { toolPicker.colorUserInterfaceStyle = appearance }
    }
  }

  /// Change paper bounds without transforming existing ink or silently cropping it.
  func resize(width: Int, height: Int) throws {
    guard loaded else { return }
    let proposed = try Self.validSize(width: width, height: height)
    guard proposed != paperSize else { return }
    reconcileDrawingActivity()
    guard !drawingActive else { throw NSError(domain: "NotebookHandwriting", code: 1, userInfo: [NSLocalizedDescriptionKey: "Finish the current Pencil stroke before resizing."]) }
    let minimum = minimumPaperSize
    guard (proposed.width == paperSize.width || proposed.width >= minimum.width),
      (proposed.height == paperSize.height || proposed.height >= minimum.height) else {
      throw NSError(domain: "NotebookHandwriting", code: 2, userInfo: [NSLocalizedDescriptionKey: "Keep the writing area large enough to show all of its ink."])
    }
    paperSize = proposed
    revision += 1
    dirty = true
    setNeedsLayout()
    scheduleDraft()
    emitChange()
  }

  override func layoutSubviews() {
    super.layoutSubviews()
    guard bounds.width > 0, bounds.height > 0 else { return }
    // React Native can lay out this view after every metadata event. Reapplying
    // identical transforms while PencilKit draws can interrupt its recognizer.
    guard lastDisplayBounds != bounds || lastLayoutPaperSize != paperSize else { return }
    lastDisplayBounds = bounds; lastLayoutPaperSize = paperSize
    // Parent must supply the full paper frame and clip that frame externally.
    // An independent x/y transform is intentional: the web frame can be scaled
    // by viewport zoom, but the saved paper dimensions never change implicitly.
    canvas.transform = .identity
    canvas.bounds = CGRect(origin: .zero, size: paperSize)
    canvas.center = CGPoint(x: bounds.midX, y: bounds.midY)
    canvas.contentSize = paperSize
    canvas.transform = CGAffineTransform(scaleX: bounds.width / paperSize.width, y: bounds.height / paperSize.height)
  }

  func setActive(_ active: Bool) {
    guard active != requestedActive else { return }
    if !active { flushBestEffort(); resetInterruptedInteraction() }
    else { toolsVisible = true }
    requestedActive = active
    updateActivity()
  }

  private var acceptsFingerDrawing: Bool {
    canvas.drawingPolicy == .anyInput ||
      (canvas.drawingPolicy == .default && !UIPencilInteraction.prefersPencilOnlyDrawing)
  }

  private func updateActivity() {
    let active = requestedActive && loaded && appActive && window != nil && !isHidden
    // Save locks new contacts through hitTest, not isUserInteractionEnabled.
    // Keep PencilKit receiving the captured touch and its delayed pressure
    // updates even if our passive observer sees touch-up before PencilKit does.
    let interactive = active
    if canvas.isUserInteractionEnabled != interactive { canvas.isUserInteractionEnabled = interactive }
    activationRevision += 1
    if active {
      if !canvas.isFirstResponder { canvas.becomeFirstResponder() }
      toolPicker.setVisible(toolsVisible, forFirstResponder: canvas)
      let expected = activationRevision
      // DOM focus/Expo attachment can complete later in the same turn. Reassert
      // once after attachment; never run a timer that steals focus from controls.
      DispatchQueue.main.async { [weak self] in
        guard let self, self.activationRevision == expected, self.requestedActive,
          self.appActive, self.window != nil, !self.isHidden else { return }
        if !self.canvas.isFirstResponder { self.canvas.becomeFirstResponder() }
        self.toolPicker.setVisible(self.toolsVisible, forFirstResponder: self.canvas)
      }
    } else {
      toolPicker.setVisible(false, forFirstResponder: canvas)
      canvas.resignFirstResponder()
    }
  }

  func setToolsVisible(_ visible: Bool) { toolsVisible = visible; updateActivity() }

  override func didMoveToWindow() {
    super.didMoveToWindow()
    if window == nil { flushBestEffort(); resetInterruptedInteraction() }
    updateActivity()
  }

  private func resetInterruptedInteraction() {
    delegateUsingTool = false
    touchObserver.clearTracking()
    setDrawingActive(false)
    flushBestEffort()
  }

  private func setDrawingActive(_ active: Bool) {
    guard active != drawingActive else { return }
    drawingActive = active
    onToolActivity?(["sessionId": sessionId, "drawing": active])
    if !active {
      flushBestEffort(); emitChange(immediate: true)
      if !inputEnabled { updateActivity() }
    }
  }

  /// Ended/cancelled UITouches are authoritative even when PencilKit omits its
  /// delegate end callback. No time-based expiry can interrupt a stationary pen.
  func reconcileDrawingActivity() {
    let touchesActive = touchObserver.hasActiveTouches
    let gesture = canvas.drawingGestureRecognizer
    let gestureActive = gesture.state == .began || gesture.state == .changed
    if !touchesActive && (touchObserver.observedTerminal || !gestureActive && gesture.numberOfTouches == 0) {
      delegateUsingTool = false
    }
    setDrawingActive(touchesActive || (!touchObserver.observedTerminal && gestureActive) || delegateUsingTool)
  }

  @objc private func drawingGestureChanged(_ recognizer: UIGestureRecognizer) {
    switch recognizer.state {
    case .ended, .cancelled, .failed: delegateUsingTool = false
    default: break
    }
    reconcileDrawingActivity()
  }

  /// Returning nil lets React Native's box-none wrapper hit-test its WebView
  /// sibling. A direct touch during an active Pencil stroke stays in PencilKit
  /// for palm rejection instead of unexpectedly scrolling the notebook.
  func shouldPassThrough(touchTypes: [UITouch.TouchType]) -> Bool {
    reconcileDrawingActivity()
    return !acceptsFingerDrawing && !drawingActive && !touchTypes.isEmpty && !touchTypes.contains(.pencil)
  }

  override func hitTest(_ point: CGPoint, with event: UIEvent?) -> UIView? {
    guard requestedActive, loaded, appActive, inputEnabled, !isHidden, bounds.contains(point) else { return nil }
    if shouldPassThrough(touchTypes: event?.allTouches?.map(\.type) ?? []) { return nil }
    return super.hitTest(point, with: event)
  }

  func scribbleInteraction(_ interaction: UIScribbleInteraction, shouldBeginAt location: CGPoint) -> Bool { false }

  func canvasViewDidBeginUsingTool(_ canvasView: PKCanvasView) {
    delegateUsingTool = true
    touchObserver.beginToolSequence()
    setDrawingActive(true)
    DispatchQueue.main.async { [weak self] in self?.reconcileDrawingActivity() }
  }

  func canvasViewDidEndUsingTool(_ canvasView: PKCanvasView) {
    delegateUsingTool = false
    reconcileDrawingActivity()
    flushBestEffort()
    emitChange(immediate: true)
  }

  func canvasViewDrawingDidChange(_ canvasView: PKCanvasView) {
    guard loaded, !applying else { return }
    revision += 1
    dirty = true
    scheduleDraft()
    emitChange()
  }

  private func emitChange(immediate: Bool = false) {
    guard loaded else { return }
    if immediate {
      metadataTimer?.invalidate(); metadataTimer = nil; onChange?(state)
    } else if metadataTimer == nil {
      metadataTimer = Timer.scheduledTimer(withTimeInterval: 0.1, repeats: false) { [weak self] _ in
        guard let self else { return }; self.metadataTimer = nil; self.onChange?(self.state)
      }
      if let metadataTimer { RunLoop.main.add(metadataTimer, forMode: .common) }
    }
  }

  private func scheduleDraft() {
    // Throttle rather than continually postponing persistence during a long
    // stroke. Completed strokes also flush synchronously from the delegate.
    guard draftTimer == nil else { return }
    draftTimer = Timer.scheduledTimer(withTimeInterval: 0.3, repeats: false) { [weak self] _ in self?.flushBestEffort() }
    if let draftTimer { RunLoop.main.add(draftTimer, forMode: .common) }
  }

  func flushDraft() throws {
    draftTimer?.invalidate(); draftTimer = nil
    guard loaded, dirty, let draftKey else { return }
    try HandwritingDraftStore.write(HandwritingDraft(inkBase64: canvas.drawing.dataRepresentation().base64EncodedString(),
                                                     width: Int(paperSize.width), height: Int(paperSize.height), sourceId: sourceId), key: draftKey)
  }

  private func flushBestEffort() {
    do { try flushDraft() } catch { report(error) }
  }

  func exportDrawing() throws -> [String: Any] {
    reconcileDrawingActivity()
    guard loaded, !drawingActive else {
      throw NSError(domain: "NotebookHandwriting", code: 3, userInfo: [NSLocalizedDescriptionKey: "Finish the current Pencil stroke before saving."])
    }
    let output = try Self.exportIncludingBlank(drawing: canvas.drawing, paperSize: paperSize)
    try flushDraft()
    exportedRevision = revision
    return output.merging(["sessionId": sessionId, "revision": revision, "inkFormat": "pencilkit-v1"]) { _, new in new }
  }

  /// Export independent transparent variants so the notebook chooses paper color
  /// without baking it into the ink. Explicit traits keep both previews stable
  /// even when the app changes appearance while the drawing is being saved.
  private static func exportIncludingBlank(drawing: PKDrawing, paperSize: CGSize) throws -> [String: Any] {
    let ink = drawing.dataRepresentation()
    guard ink.count <= HandwritingViewController.maximumBytes else { throw HandwritingError.inkTooLarge }
    let rect = CGRect(origin: .zero, size: paperSize)
    func preview(style: UIUserInterfaceStyle) throws -> String {
      let format = UIGraphicsImageRendererFormat(); format.scale = 1; format.opaque = false
      var png: Data?
      UITraitCollection(userInterfaceStyle: style).performAsCurrent {
        let image = UIGraphicsImageRenderer(size: paperSize, format: format).image { context in
          context.cgContext.clear(rect)
          drawing.image(from: rect, scale: 1).draw(in: rect)
        }
        png = image.pngData()
      }
      guard let png, png.count <= HandwritingViewController.maximumBytes else { throw HandwritingError.previewTooLarge }
      return png.base64EncodedString()
    }
    return ["inkBase64": ink.base64EncodedString(), "previewBase64": try preview(style: .light),
            "darkPreviewBase64": try preview(style: .dark), "previewFormat": "themed-v1",
            "width": Int(paperSize.width), "height": Int(paperSize.height)]
  }

  /// An upload acknowledgment must not delete strokes written after its export.
  func acknowledgeSave(revision savedRevision: Int, sourceId savedSourceId: String? = nil) throws -> Bool {
    reconcileDrawingActivity()
    guard loaded, !drawingActive, exportedRevision == savedRevision, revision == savedRevision, let draftKey else { return false }
    if let savedSourceId {
      guard !savedSourceId.isEmpty, savedSourceId.utf8.count <= 512 else { throw HandwritingError.invalidDraftKey }
    }
    try HandwritingDraftStore.remove(key: draftKey)
    if let savedSourceId { sourceId = savedSourceId }
    dirty = false
    recovered = false
    exportedRevision = nil
    emitChange()
    return true
  }

  func undo() { reconcileDrawingActivity(); guard !drawingActive else { return }; canvas.undoManager?.undo() }
  func redo() { reconcileDrawingActivity(); guard !drawingActive else { return }; canvas.undoManager?.redo() }

  func report(_ error: Error) {
    let message = (error as? HandwritingError)?.errorDescription
      ?? ((error as NSError).domain == "NotebookHandwriting" ? error.localizedDescription : "The recovery draft couldn’t save on this iPad. Your ink is still in the writing area.")
    onError?(["sessionId": sessionId, "message": message, "minimumWidth": Int(minimumPaperSize.width), "minimumHeight": Int(minimumPaperSize.height)])
  }

  deinit {
    draftTimer?.invalidate()
    metadataTimer?.invalidate()
    if loaded, dirty, let draftKey {
      try? HandwritingDraftStore.write(HandwritingDraft(inkBase64: canvas.drawing.dataRepresentation().base64EncodedString(),
                                                       width: Int(paperSize.width), height: Int(paperSize.height), sourceId: sourceId), key: draftKey)
    }
    observers.forEach(NotificationCenter.default.removeObserver)
    canvas.drawingGestureRecognizer.removeTarget(self, action: #selector(drawingGestureChanged(_:)))
    toolPicker.removeObserver(canvas)
  }
}


/// Do not begin drawing on controls outside paper. UIKit continues delivering an
/// already-captured touch after it crosses the edge; no move is re-hit-tested.
final class InlinePaperCanvasView: PKCanvasView {
  override func point(inside point: CGPoint, with event: UIEvent?) -> Bool {
    bounds.contains(point) && super.point(inside: point, with: event)
  }
}

/// A passive contact observer. It never recognizes a competing gesture, prevents
/// PencilKit, delays delivery, cancels touches, or replaces Apple's delegate.
private final class InlineDrawingTouchObserver: UIGestureRecognizer {
  var acceptsTouch: ((UITouch) -> Bool)?
  var onChange: (() -> Void)?
  private var contacts = Set<UITouch>()
  private var allContacts = Set<UITouch>()
  private(set) var observedTerminal = false
  var hasActiveTouches: Bool {
    let hadContacts = !contacts.isEmpty
    contacts = contacts.filter { $0.phase != .ended && $0.phase != .cancelled }
    if hadContacts && contacts.isEmpty { observedTerminal = true }
    return !contacts.isEmpty
  }
  func beginToolSequence() { observedTerminal = false }
  init() {
    super.init(target: nil, action: nil)
    cancelsTouchesInView = false
    delaysTouchesBegan = false
    delaysTouchesEnded = false
    requiresExclusiveTouchType = false
  }
  override func canPrevent(_ preventedGestureRecognizer: UIGestureRecognizer) -> Bool { false }
  override func canBePrevented(by preventingGestureRecognizer: UIGestureRecognizer) -> Bool { false }
  override func touchesBegan(_ touches: Set<UITouch>, with event: UIEvent) {
    allContacts.formUnion(touches)
    let accepted = touches.filter { acceptsTouch?($0) == true }
    if !accepted.isEmpty { observedTerminal = false; contacts.formUnion(accepted); onChange?() }
  }
  override func touchesMoved(_ touches: Set<UITouch>, with event: UIEvent) { onChange?() }
  override func touchesEnded(_ touches: Set<UITouch>, with event: UIEvent) { finish(touches) }
  override func touchesCancelled(_ touches: Set<UITouch>, with event: UIEvent) { finish(touches) }
  private func finish(_ touches: Set<UITouch>) {
    let hadContacts = !contacts.isEmpty
    contacts.subtract(touches)
    allContacts.subtract(touches)
    if hadContacts && !hasActiveTouches { observedTerminal = true }
    onChange?()
    // An ignored palm may stay down between Pencil strokes. Do not fail the
    // observer until every contact ends, or it would miss the next Pencil down.
    if allContacts.isEmpty { state = .failed }
  }
  func clearTracking() { contacts.removeAll(); allContacts.removeAll(); observedTerminal = true; onChange?() }
  override func reset() {
    super.reset()
    if !hasActiveTouches { contacts.removeAll(); onChange?() }
  }
}
