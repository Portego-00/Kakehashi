import PencilKit
import UIKit

/// Imports the earlier portable canvas format once. Export always preserves the
/// complete PKDrawing, including Pencil force, altitude, and azimuth samples.
enum InlineHandwritingImport {
  private struct Document: Decodable { let version: Int; let width: Int; let height: Int; let strokes: [Stroke] }
  private struct Stroke: Decodable { let id: String; let tool: String; let color: String; let width: Double; let points: [[Double]] }

  static func drawing(from data: Data, width: Int, height: Int) throws -> PKDrawing {
    guard data.count <= HandwritingViewController.maximumBytes else { throw HandwritingError.invalidInk }
    let document: Document
    do { document = try JSONDecoder().decode(Document.self, from: data) } catch { throw HandwritingError.invalidInk }
    guard document.version == 1, document.width == width, document.height == height,
      (1...4096).contains(width), (1...4096).contains(height), width * height <= 16_000_000,
      document.strokes.count <= 2048 else { throw HandwritingError.invalidInk }
    var ids = Set<String>(); var totalPoints = 0
    let strokes = try document.strokes.map { stroke -> PKStroke in
      guard stroke.id.range(of: "^[A-Za-z0-9][A-Za-z0-9:_-]{0,63}$", options: .regularExpression) != nil,
        ids.insert(stroke.id).inserted, ["pen", "marker"].contains(stroke.tool),
        stroke.color.range(of: "^#[0-9a-f]{6}$", options: .regularExpression) != nil,
        stroke.width.isFinite, (0.5...24).contains(stroke.width), !stroke.points.isEmpty else { throw HandwritingError.invalidInk }
      totalPoints += stroke.points.count
      guard totalPoints <= 32768, let rgb = UInt32(stroke.color.dropFirst(), radix: 16) else { throw HandwritingError.invalidInk }
      let color = UIColor(red: CGFloat((rgb >> 16) & 255) / 255, green: CGFloat((rgb >> 8) & 255) / 255, blue: CGFloat(rgb & 255) / 255, alpha: 1)
      let marker = stroke.tool == "marker"
      let points = try stroke.points.enumerated().map { index, point -> PKStrokePoint in
        guard point.count == 3, point.allSatisfy(\.isFinite), (0...1).contains(point[2]) else { throw HandwritingError.invalidInk }
        let pressure = point[2]
        let diameter = stroke.width * (marker ? 1 : 0.35 + pressure * 0.65)
        return PKStrokePoint(location: CGPoint(x: min(Double(width), max(0, point[0])), y: min(Double(height), max(0, point[1]))),
          timeOffset: Double(index) / 120, size: CGSize(width: diameter, height: diameter), opacity: marker ? 0.28 : 1,
          force: pressure, azimuth: 0, altitude: .pi / 2)
      }
      // A pen ink with the original size/opacity avoids PencilKit's marker
      // texture changing the older renderer's flat highlighted stroke.
      return PKStroke(ink: PKInk(.pen, color: color), path: PKStrokePath(controlPoints: points, creationDate: Date(timeIntervalSince1970: 0)))
    }
    return PKDrawing(strokes: strokes)
  }
}
