import CryptoKit
import Foundation

struct HandwritingDraft: Codable {
  let inkBase64: String
  let width: Int
  let height: Int
  var sourceId: String? = nil
}

/// Account/page keys are hashed for file names; drawings never leave the app here.
enum HandwritingDraftStore {
  private static let maximumDraftBytes = 24 * 1_048_576

  private static func location(key: String) throws -> URL {
    guard !key.isEmpty, key.utf8.count <= 512 else { throw HandwritingError.invalidDraftKey }
    let digest = SHA256.hash(data: Data(key.utf8)).map { String(format: "%02x", $0) }.joined()
    let base = try FileManager.default.url(for: .applicationSupportDirectory, in: .userDomainMask,
                                            appropriateFor: nil, create: true)
    var directory = base.appendingPathComponent("NotebookHandwritingDrafts", isDirectory: true)
    try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true,
                                           attributes: [.protectionKey: FileProtectionType.completeUntilFirstUserAuthentication])
    var values = URLResourceValues()
    values.isExcludedFromBackup = true
    try directory.setResourceValues(values)
    return directory.appendingPathComponent(digest).appendingPathExtension("json")
  }

  static func read(key: String) throws -> HandwritingDraft? {
    let url = try location(key: key)
    guard FileManager.default.fileExists(atPath: url.path) else { return nil }
    let size = try url.resourceValues(forKeys: [.fileSizeKey]).fileSize ?? maximumDraftBytes + 1
    guard size <= maximumDraftBytes else { throw HandwritingError.invalidDraft }
    do { return try JSONDecoder().decode(HandwritingDraft.self, from: Data(contentsOf: url)) }
    catch { throw HandwritingError.invalidDraft }
  }

  static func write(_ draft: HandwritingDraft, key: String) throws {
    let bytes = try JSONEncoder().encode(draft)
    guard bytes.count <= maximumDraftBytes else { throw HandwritingError.inkTooLarge }
    try bytes.write(to: location(key: key), options: [.atomic, .completeFileProtectionUntilFirstUserAuthentication])
  }

  static func remove(key: String) throws {
    let url = try location(key: key)
    if FileManager.default.fileExists(atPath: url.path) { try FileManager.default.removeItem(at: url) }
  }
}
