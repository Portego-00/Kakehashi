import UIKit
import MobileCoreServices
import UniformTypeIdentifiers

class ShareViewController: UIViewController {
  private var hasCompletedRequest = false

  override func viewDidAppear(_ animated: Bool) {
    super.viewDidAppear(animated)
    handleShared()
  }

  private var imageTypeIdentifier: String {
    if #available(iOS 14.0, *) {
      return UTType.image.identifier
    }
    return kUTTypeImage as String
  }

  private var urlTypeIdentifier: String {
    if #available(iOS 14.0, *) {
      return UTType.url.identifier
    }
    return kUTTypeURL as String
  }

  private var textTypeIdentifier: String {
    if #available(iOS 14.0, *) {
      return UTType.plainText.identifier
    }
    return kUTTypePlainText as String
  }

  private func handleShared() {
    guard let extensionItem = extensionContext?.inputItems.first as? NSExtensionItem,
          let attachments = extensionItem.attachments,
          !attachments.isEmpty else {
      completeRequest()
      return
    }

    if let urlAttachment = attachments.first(where: { $0.hasItemConformingToTypeIdentifier(urlTypeIdentifier) }) {
      loadSharedUrl(from: urlAttachment)
      return
    }

    if let textAttachment = attachments.first(where: { $0.hasItemConformingToTypeIdentifier(textTypeIdentifier) }) {
      loadSharedText(from: textAttachment)
      return
    }

    if let imageAttachment = attachments.first(where: { $0.hasItemConformingToTypeIdentifier(imageTypeIdentifier) }) {
      loadSharedImage(from: imageAttachment)
      return
    }

    completeRequest()
  }

  private func loadSharedUrl(from attachment: NSItemProvider) {
    attachment.loadItem(forTypeIdentifier: urlTypeIdentifier, options: nil) { item, _ in
      if let url = item as? URL {
        self.openHostApp(withSharedUrl: url.absoluteString)
        return
      }

      if let nsUrl = item as? NSURL, let absoluteString = nsUrl.absoluteString {
        self.openHostApp(withSharedUrl: absoluteString)
        return
      }

      if let text = item as? String, let extractedUrl = self.extractFirstHttpUrl(from: text) {
        self.openHostApp(withSharedUrl: extractedUrl)
        return
      }

      if let nsString = item as? NSString,
         let extractedUrl = self.extractFirstHttpUrl(from: nsString as String) {
        self.openHostApp(withSharedUrl: extractedUrl)
        return
      }

      self.completeRequest()
    }
  }

  private func loadSharedText(from attachment: NSItemProvider) {
    attachment.loadItem(forTypeIdentifier: textTypeIdentifier, options: nil) { item, _ in
      if let text = item as? String, let extractedUrl = self.extractFirstHttpUrl(from: text) {
        self.openHostApp(withSharedUrl: extractedUrl)
        return
      }

      if let nsString = item as? NSString,
         let extractedUrl = self.extractFirstHttpUrl(from: nsString as String) {
        self.openHostApp(withSharedUrl: extractedUrl)
        return
      }

      if let url = item as? URL {
        self.openHostApp(withSharedUrl: url.absoluteString)
        return
      }

      self.completeRequest()
    }
  }

  private func loadSharedImage(from attachment: NSItemProvider) {
    attachment.loadItem(forTypeIdentifier: imageTypeIdentifier, options: nil) { item, _ in
      if let url = item as? URL {
        self.processAndOpen(imageURL: url)
      } else if let image = item as? UIImage, let data = image.pngData() {
        self.processAndOpen(imageData: data, suggestedName: "shared.png")
      } else {
        self.completeRequest()
      }
    }
  }

  private func extractFirstHttpUrl(from text: String) -> String? {
    let fullTextRange = NSRange(location: 0, length: (text as NSString).length)
    if let detector = try? NSDataDetector(types: NSTextCheckingResult.CheckingType.link.rawValue),
       let match = detector.firstMatch(in: text, options: [], range: fullTextRange),
       let url = match.url,
       let scheme = url.scheme?.lowercased(),
       scheme == "http" || scheme == "https" {
      return url.absoluteString
    }

    let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
    guard let parsed = URL(string: trimmed),
          let scheme = parsed.scheme?.lowercased(),
          scheme == "http" || scheme == "https" else {
      return nil
    }

    return parsed.absoluteString
  }

  private func processAndOpen(imageURL: URL) {
    guard let container = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: "group.com.kakehashi.reviewdata") else {
      completeRequest()
      return
    }

    let sharedDir = container.appendingPathComponent("sharedData", isDirectory: true)
    try? FileManager.default.createDirectory(at: sharedDir, withIntermediateDirectories: true)

    let extensionName = imageURL.pathExtension.isEmpty ? "jpg" : imageURL.pathExtension
    let destURL = sharedDir.appendingPathComponent("\(UUID().uuidString).\(extensionName)")

    do {
      if FileManager.default.fileExists(atPath: destURL.path) {
        try? FileManager.default.removeItem(at: destURL)
      }
      try FileManager.default.copyItem(at: imageURL, to: destURL)
      openHostApp(withImageFileUrl: destURL)
    } catch {
      completeRequest()
    }
  }

  private func processAndOpen(imageData: Data, suggestedName: String) {
    guard let container = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: "group.com.kakehashi.reviewdata") else {
      completeRequest()
      return
    }

    let sharedDir = container.appendingPathComponent("sharedData", isDirectory: true)
    try? FileManager.default.createDirectory(at: sharedDir, withIntermediateDirectories: true)

    let destURL = sharedDir.appendingPathComponent("\(UUID().uuidString)_\(suggestedName)")
    do {
      try imageData.write(to: destURL)
      openHostApp(withImageFileUrl: destURL)
    } catch {
      completeRequest()
    }
  }

  private func openHostApp(withImageFileUrl fileURL: URL) {
    let encoded = fileURL.absoluteString.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? ""
    guard let deepLink = URL(string: "kakehashi://?imageUri=\(encoded)") else {
      completeRequest()
      return
    }

    openHostApp(withDeepLink: deepLink)
  }

  private func openHostApp(withSharedUrl sharedUrl: String) {
    let encoded = sharedUrl.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? ""
    guard let deepLink = URL(string: "kakehashi://?sharedUrl=\(encoded)") else {
      completeRequest()
      return
    }

    openHostApp(withDeepLink: deepLink)
  }

  private func openHostApp(withDeepLink url: URL) {
    DispatchQueue.main.async {
      _ = self.openURL(url)
      self.completeRequest()
    }
  }

  private func completeRequest() {
    DispatchQueue.main.async {
      guard !self.hasCompletedRequest else {
        return
      }
      self.hasCompletedRequest = true
      self.extensionContext?.completeRequest(returningItems: nil, completionHandler: nil)
    }
  }

  @objc private func openURL(_ url: URL) -> Bool {
    var responder: UIResponder? = self
    while responder != nil {
      if let application = responder as? UIApplication {
        application.open(url)
        return true
      }
      responder = responder?.next
    }
    return false
  }
}
