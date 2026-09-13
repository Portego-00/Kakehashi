import ExpoModulesCore
import UIKit

struct HandwritingOptions: Record {
  @Field var inkBase64: String?
  @Field var width: Int = 768
  @Field var height: Int = 1024
  @Field var theme: String = "light"
  @Field var draftKey: String?
}

public final class NotebookHandwritingModule: Module {
  private var editor: HandwritingViewController?

  public func definition() -> ModuleDefinition {
    Name("NotebookHandwriting")

    Function("isInlineAvailable") {
      UIDevice.current.userInterfaceIdiom == .pad
    }

    View(InlineHandwritingView.self) {
      Events("onReady", "onChange", "onError", "onToolActivity")
      Prop("document") { (view: InlineHandwritingView, document: InlineHandwritingDocumentOptions) in view.document = document }
      Prop("paperSize") { (view: InlineHandwritingView, size: InlineHandwritingPaperSize?) in view.paperSize = size }
      Prop("paperColor", "#ffffff") { (view: InlineHandwritingView, color: String) in view.paperColor = color }
      Prop("paperStyle", "light") { (view: InlineHandwritingView, style: String) in view.paperStyle = style }
      Prop("active", false) { (view: InlineHandwritingView, active: Bool) in view.active = active }
      Prop("inputEnabled", true) { (view: InlineHandwritingView, enabled: Bool) in view.inputEnabled = enabled }
      Prop("fingerDrawing", false) { (view: InlineHandwritingView, enabled: Bool) in view.fingerDrawing = enabled }
      OnViewDidUpdateProps { (view: InlineHandwritingView) in view.updateProps() }
      AsyncFunction("exportDrawing") { (view: InlineHandwritingView) throws in try view.surface.exportDrawing() }
      AsyncFunction("flushDraft") { (view: InlineHandwritingView) throws in try view.surface.flushDraft() }
      AsyncFunction("acknowledgeSave") { (view: InlineHandwritingView, revision: Int, sourceId: String?) throws in try view.surface.acknowledgeSave(revision: revision, sourceId: sourceId) }
      AsyncFunction("resizePaper") { (view: InlineHandwritingView, width: Int, height: Int) throws in try view.surface.resize(width: width, height: height); return view.surface.state }
      AsyncFunction("setToolsVisible") { (view: InlineHandwritingView, visible: Bool) in view.surface.setToolsVisible(visible) }
      AsyncFunction("undo") { (view: InlineHandwritingView) in view.surface.undo() }
      AsyncFunction("redo") { (view: InlineHandwritingView) in view.surface.redo() }
    }

    Function("isAvailable") {
      UIDevice.current.userInterfaceIdiom == .pad
    }

    AsyncFunction("edit") { (options: HandwritingOptions, promise: Promise) in
      guard UIDevice.current.userInterfaceIdiom == .pad else {
        promise.reject("ERR_HANDWRITING_UNAVAILABLE", "Handwriting is available on iPad.")
        return
      }
      guard self.editor == nil else {
        promise.reject("ERR_HANDWRITING_BUSY", "A handwriting page is already open.")
        return
      }
      guard let presenter = self.appContext?.utilities?.currentViewController(),
        presenter.viewIfLoaded?.window != nil,
        !presenter.isBeingDismissed,
        !presenter.isBeingPresented else {
        promise.reject("ERR_HANDWRITING_PRESENTATION", "The handwriting page could not open. Please try again.")
        return
      }

      do {
        let controller = try HandwritingViewController(
          inkBase64: options.inkBase64,
          width: options.width,
          height: options.height,
          darkMode: options.theme == "dark",
          draftKey: options.draftKey
        ) { [weak self] result in
          self?.editor = nil
          promise.resolve(result?.dictionary)
        }
        self.editor = controller
        let navigation = UINavigationController(rootViewController: controller)
        navigation.modalPresentationStyle = .fullScreen
        navigation.isModalInPresentation = true
        navigation.overrideUserInterfaceStyle = options.theme == "dark" ? .dark : .light
        presenter.present(navigation, animated: true)
      } catch {
        promise.reject("ERR_HANDWRITING_INVALID", error.localizedDescription)
      }
    }.runOnQueue(.main)

    AsyncFunction("clearDraft") { (draftKey: String) throws in
      guard self.editor?.draftKey != draftKey else { return }
      try HandwritingDraftStore.remove(key: draftKey)
    }.runOnQueue(.main)

    AsyncFunction("cancel") {
      self.editor?.closeForInvalidatedModule()
    }.runOnQueue(.main)

    OnDestroy {
      DispatchQueue.main.async {
        self.editor?.closeForInvalidatedModule()
        self.editor = nil
      }
    }
  }
}
