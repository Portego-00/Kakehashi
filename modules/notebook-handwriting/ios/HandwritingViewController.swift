import PencilKit
import UIKit

struct HandwritingExport {
  let inkBase64: String
  let previewBase64: String
  let width: Int
  let height: Int

  var dictionary: [String: Any] {
    ["inkBase64": inkBase64, "previewBase64": previewBase64, "width": width, "height": height]
  }
}

enum HandwritingError: LocalizedError {
  case invalidSize, invalidInk, inkTooLarge, previewTooLarge, emptyDrawing, invalidDraftKey, invalidDraft

  var errorDescription: String? {
    switch self {
    case .invalidSize: return "This handwriting page has an unsupported paper size."
    case .invalidInk: return "This handwriting could not be opened. The saved drawing has not been changed."
    case .inkTooLarge: return "This handwriting is too large to save. Keep this page shorter and put additional writing on another page."
    case .previewTooLarge: return "This handwriting preview is too large to save. Try removing dense shading or some strokes. Your writing is still here."
    case .emptyDrawing: return "Write something before saving this page."
    case .invalidDraftKey: return "This handwriting page could not create a recovery draft. Please reopen the notebook."
    case .invalidDraft: return "The unsaved handwriting draft could not be reopened. Your saved notebook has not been changed."
    }
  }
}

/// The canvas always uses light paper, independently of the surrounding app theme.
/// This keeps the stored strokes and the web preview visually identical.
final class HandwritingViewController: UIViewController, PKCanvasViewDelegate, UIScrollViewDelegate {
  static let maximumBytes = 1_048_576

  private let paperSize: CGSize
  private let initialInk: Data
  private let darkMode: Bool
  private let completion: (HandwritingExport?) -> Void
  let draftKey: String?
  private let canvas = PKCanvasView()
  private let scrollView = UIScrollView()
  private let toolPicker = PKToolPicker()
  private var lastViewportSize = CGSize.zero
  private var finished = false
  private var fingerDrawing = false
  private var historyObservers: [NSObjectProtocol] = []
  private var draftTimer: Timer?
  private let recoveredDraft: Bool
  private lazy var doneButton = UIBarButtonItem(barButtonSystemItem: .done, target: self, action: #selector(saveDrawing))
  private lazy var undoButton = UIBarButtonItem(image: UIImage(systemName: "arrow.uturn.backward"), style: .plain, target: self, action: #selector(undoDrawing))
  private lazy var redoButton = UIBarButtonItem(image: UIImage(systemName: "arrow.uturn.forward"), style: .plain, target: self, action: #selector(redoDrawing))
  private lazy var fingerButton = UIBarButtonItem(image: UIImage(systemName: "hand.draw"), style: .plain, target: self, action: #selector(toggleFingerDrawing))

  init(inkBase64: String?, width: Int, height: Int, darkMode: Bool, draftKey: String? = nil,
       completion: @escaping (HandwritingExport?) -> Void) throws {
    let draft = try draftKey.flatMap { try HandwritingDraftStore.read(key: $0) }
    let paperWidth = draft?.width ?? width
    let paperHeight = draft?.height ?? height
    guard (1...4096).contains(paperWidth), (1...4096).contains(paperHeight), paperWidth * paperHeight <= 16_000_000 else {
      throw HandwritingError.invalidSize
    }
    let drawing: PKDrawing
    if let inkBase64 {
      guard inkBase64.utf8.count <= ((Self.maximumBytes + 2) / 3) * 4,
        let bytes = Data(base64Encoded: inkBase64), bytes.count <= Self.maximumBytes else {
        throw HandwritingError.invalidInk
      }
      do { drawing = try PKDrawing(data: bytes) } catch { throw HandwritingError.invalidInk }
    } else {
      drawing = PKDrawing()
    }
    self.initialInk = drawing.dataRepresentation()
    let restoredDrawing: PKDrawing
    if let draft {
      guard let bytes = Data(base64Encoded: draft.inkBase64) else { throw HandwritingError.invalidDraft }
      do { restoredDrawing = try PKDrawing(data: bytes) } catch { throw HandwritingError.invalidDraft }
    } else { restoredDrawing = drawing }
    self.paperSize = CGSize(width: paperWidth, height: paperHeight)
    self.darkMode = darkMode
    self.completion = completion
    self.draftKey = draftKey
    self.recoveredDraft = draft != nil
    super.init(nibName: nil, bundle: nil)
    canvas.drawing = restoredDrawing
    isModalInPresentation = true
  }

  required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }

  override func viewDidLoad() {
    super.viewDidLoad()
    title = "Handwriting"
    if recoveredDraft { navigationItem.prompt = "Recovered unsaved handwriting" }
    overrideUserInterfaceStyle = darkMode ? .dark : .light
    view.backgroundColor = .systemGroupedBackground
    navigationItem.leftBarButtonItem = UIBarButtonItem(barButtonSystemItem: .cancel, target: self, action: #selector(cancelDrawing))
    navigationItem.rightBarButtonItems = [doneButton, redoButton, undoButton, fingerButton]
    doneButton.accessibilityIdentifier = "handwriting-done"
    undoButton.accessibilityLabel = "Undo"
    redoButton.accessibilityLabel = "Redo"
    fingerButton.accessibilityLabel = "Draw with finger"
    fingerButton.accessibilityIdentifier = "handwriting-finger"

    scrollView.translatesAutoresizingMaskIntoConstraints = false
    scrollView.delegate = self
    scrollView.contentInsetAdjustmentBehavior = .never
    scrollView.bouncesZoom = true
    scrollView.showsHorizontalScrollIndicator = false
    scrollView.showsVerticalScrollIndicator = false
    view.addSubview(scrollView)
    NSLayoutConstraint.activate([
      scrollView.leadingAnchor.constraint(equalTo: view.safeAreaLayoutGuide.leadingAnchor),
      scrollView.trailingAnchor.constraint(equalTo: view.safeAreaLayoutGuide.trailingAnchor),
      scrollView.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor),
      // The docked PencilKit palette can otherwise cover the last lines of the paper.
      scrollView.bottomAnchor.constraint(equalTo: view.safeAreaLayoutGuide.bottomAnchor, constant: -100)
    ])

    canvas.frame = CGRect(origin: .zero, size: paperSize)
    canvas.overrideUserInterfaceStyle = .light
    canvas.backgroundColor = .white
    canvas.isOpaque = true
    canvas.isScrollEnabled = false
    canvas.bounces = false
    canvas.clipsToBounds = true
    canvas.contentSize = paperSize
    canvas.tool = PKInkingTool(.pen, color: .black, width: 3)
    canvas.drawingPolicy = .pencilOnly
    canvas.delegate = self
    canvas.accessibilityLabel = "Handwriting paper"
    canvas.accessibilityIdentifier = "handwriting-paper"
    scrollView.addSubview(canvas)
    toolPicker.addObserver(canvas)

    for name in [Notification.Name.NSUndoManagerDidUndoChange, .NSUndoManagerDidRedoChange,
                 .NSUndoManagerDidCloseUndoGroup] {
      historyObservers.append(NotificationCenter.default.addObserver(forName: name, object: nil, queue: .main) { [weak self] _ in
        self?.updateButtons()
      })
    }
    historyObservers.append(NotificationCenter.default.addObserver(forName: UIApplication.didEnterBackgroundNotification,
      object: nil, queue: .main) { [weak self] _ in self?.saveRecoveryDraft() })
    updateButtons()
  }

  override func viewDidAppear(_ animated: Bool) {
    super.viewDidAppear(animated)
    toolPicker.setVisible(true, forFirstResponder: canvas)
    canvas.becomeFirstResponder()
    updateButtons()
  }

  override func viewDidLayoutSubviews() {
    super.viewDidLayoutSubviews()
    let size = scrollView.bounds.size
    guard size.width > 0, size.height > 0 else { return }
    if size != lastViewportSize {
      lastViewportSize = size
      let fit = max(0.01, min((size.width - 32) / paperSize.width, (size.height - 32) / paperSize.height))
      scrollView.minimumZoomScale = fit
      scrollView.maximumZoomScale = max(4, fit * 4)
      scrollView.zoomScale = fit
    }
    centerPaper()
  }

  func viewForZooming(in scrollView: UIScrollView) -> UIView? { canvas }
  func scrollViewDidZoom(_ scrollView: UIScrollView) { centerPaper() }

  private func centerPaper() {
    let vertical = max(16, (scrollView.bounds.height - paperSize.height * scrollView.zoomScale) / 2)
    let horizontal = max(16, (scrollView.bounds.width - paperSize.width * scrollView.zoomScale) / 2)
    scrollView.contentInset = UIEdgeInsets(top: vertical, left: horizontal, bottom: vertical, right: horizontal)
  }

  func canvasViewDrawingDidChange(_ canvasView: PKCanvasView) {
    updateButtons()
    draftTimer?.invalidate()
    draftTimer = Timer.scheduledTimer(withTimeInterval: 0.3, repeats: false) { [weak self] _ in
      self?.saveRecoveryDraft()
    }
  }

  private func saveRecoveryDraft() {
    do { try persistRecoveryDraft() } catch {
      navigationItem.prompt = "Recovery draft couldn’t save — keep this page open"
    }
  }

  private func persistRecoveryDraft() throws {
    draftTimer?.invalidate()
    draftTimer = nil
    guard let draftKey else { return }
    try HandwritingDraftStore.write(HandwritingDraft(inkBase64: canvas.drawing.dataRepresentation().base64EncodedString(),
                                                    width: Int(paperSize.width), height: Int(paperSize.height)), key: draftKey)
  }

  private func updateButtons() {
    doneButton.isEnabled = !canvas.drawing.strokes.isEmpty
    undoButton.isEnabled = canvas.undoManager?.canUndo == true
    redoButton.isEnabled = canvas.undoManager?.canRedo == true
    fingerButton.tintColor = fingerDrawing ? .systemBlue : .secondaryLabel
    fingerButton.accessibilityValue = fingerDrawing ? "On" : "Off"
  }

  @objc private func toggleFingerDrawing() {
    fingerDrawing.toggle()
    canvas.drawingPolicy = fingerDrawing ? .anyInput : .pencilOnly
    scrollView.panGestureRecognizer.minimumNumberOfTouches = fingerDrawing ? 2 : 1
    updateButtons()
  }

  @objc private func undoDrawing() { canvas.undoManager?.undo(); updateButtons() }
  @objc private func redoDrawing() { canvas.undoManager?.redo(); updateButtons() }

  @objc private func saveDrawing() {
    do {
      let result = try Self.export(drawing: canvas.drawing, paperSize: paperSize)
      try persistRecoveryDraft()
      finish(result)
    } catch {
      let message = (error as? HandwritingError)?.errorDescription
        ?? "The recovery draft couldn’t be saved on this iPad. Check that there is free storage and try again. Your handwriting is still here."
      let alert = UIAlertController(title: "Couldn’t save handwriting", message: message, preferredStyle: .alert)
      alert.addAction(UIAlertAction(title: "Keep writing", style: .default))
      present(alert, animated: true)
    }
  }

  static func export(drawing: PKDrawing, paperSize: CGSize) throws -> HandwritingExport {
    guard !drawing.strokes.isEmpty else { throw HandwritingError.emptyDrawing }
    let ink = drawing.dataRepresentation()
    guard ink.count <= maximumBytes else { throw HandwritingError.inkTooLarge }
    let rect = CGRect(origin: .zero, size: paperSize)
    let format = UIGraphicsImageRendererFormat()
    format.scale = 1
    format.opaque = true
    var png: Data?
    UITraitCollection(userInterfaceStyle: .light).performAsCurrent {
      let image = UIGraphicsImageRenderer(size: paperSize, format: format).image { context in
        UIColor.white.setFill()
        context.fill(rect)
        drawing.image(from: rect, scale: 1).draw(in: rect)
      }
      png = image.pngData()
    }
    guard let png, png.count <= maximumBytes else { throw HandwritingError.previewTooLarge }
    return HandwritingExport(inkBase64: ink.base64EncodedString(), previewBase64: png.base64EncodedString(),
                             width: Int(paperSize.width), height: Int(paperSize.height))
  }

  @objc private func cancelDrawing() {
    guard canvas.drawing.dataRepresentation() != initialInk else { discardChanges(); return }
    let alert = UIAlertController(title: "Discard handwriting changes?", message: "Your previously saved handwriting will stay unchanged.", preferredStyle: .alert)
    alert.addAction(UIAlertAction(title: "Keep writing", style: .cancel))
    alert.addAction(UIAlertAction(title: "Discard changes", style: .destructive) { [weak self] _ in self?.discardChanges() })
    present(alert, animated: true)
  }

  private func discardChanges() {
    draftTimer?.invalidate()
    do {
      if let draftKey { try HandwritingDraftStore.remove(key: draftKey) }
      finish(nil)
    } catch {
      let alert = UIAlertController(title: "Couldn’t discard draft", message: "The recovery draft could not be removed. Your handwriting is still here.", preferredStyle: .alert)
      alert.addAction(UIAlertAction(title: "Keep writing", style: .default))
      present(alert, animated: true)
    }
  }

  private func finish(_ result: HandwritingExport?) {
    guard !finished else { return }
    finished = true
    draftTimer?.invalidate()
    toolPicker.setVisible(false, forFirstResponder: canvas)
    canvas.resignFirstResponder()
    dismiss(animated: true) { [completion] in completion(result) }
  }

  func closeForInvalidatedModule() { saveRecoveryDraft(); finish(nil) }

  deinit {
    historyObservers.forEach(NotificationCenter.default.removeObserver)
    draftTimer?.invalidate()
    toolPicker.removeObserver(canvas)
  }
}
