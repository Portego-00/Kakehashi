import UIKit
import PencilKit

@main final class AppDelegate: UIResponder, UIApplicationDelegate {
  var window: UIWindow?
  func application(_ application: UIApplication, didFinishLaunchingWithOptions options: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
    let window = UIWindow(frame: UIScreen.main.bounds); self.window = window
    let controller = UIViewController(); controller.view.backgroundColor = .white
    window.rootViewController = controller; window.makeKeyAndVisible()
    DispatchQueue.main.async { self.checks() }; return true
  }
  func checks() {
    var checks: [String: Bool] = [:]
    var metrics: [String: Any] = [:]
    var loadedInk: [String: Data] = [:]
    let directory = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
    let points = [CGPoint(x: 80, y: 100), CGPoint(x: 220, y: 120), CGPoint(x: 360, y: 140)].enumerated().map { index, location in
      PKStrokePoint(location: location, timeOffset: Double(index) * 0.1, size: CGSize(width: 6, height: 6), opacity: 1, force: 0.5, azimuth: 0.5, altitude: 1.1)
    }
    let drawing = PKDrawing(strokes: [PKStroke(ink: PKInk(.pen, color: .black), path: PKStrokePath(controlPoints: points, creationDate: Date(timeIntervalSince1970: 0)))])
    let original = drawing.dataRepresentation()
    func check(_ surface: InlineHandwritingCanvas, _ label: String) {
      surface.layoutIfNeeded()
      let first = surface.canvas.convert(points[0].location, to: surface)
      let last = surface.canvas.convert(points[2].location, to: surface)
      let sx = surface.canvas.transform.a, sy = surface.canvas.transform.d
      checks[label + "_scale"] = abs(sx - 0.75) < 0.0001 && abs(sy - 0.75) < 0.0001
      checks[label + "_position"] = abs(first.x - 60) < 0.0001 && abs(first.y - 75) < 0.0001 && abs(last.x - 270) < 0.0001 && abs(last.y - 105) < 0.0001
      checks[label + "_ink"] = surface.canvas.drawing.dataRepresentation() == loadedInk[surface.sessionId]
      metrics[label] = ["scale": [sx, sy], "first": [first.x, first.y], "last": [last.x, last.y], "display": [surface.bounds.width, surface.bounds.height], "paper": [surface.paperSize.width, surface.paperSize.height]]
    }
    do {
      for order in ["displayFirst", "paperFirst"] {
        let surface = InlineHandwritingCanvas(frame: CGRect(x: 0, y: 0, width: 576, height: 288))
        try surface.configure(sessionId: order, draftKey: "resize-qa/" + UUID().uuidString, sourceId: "synthetic", inkBase64: original.base64EncodedString(), width: 768, height: 384)
        loadedInk[order] = surface.canvas.drawing.dataRepresentation()
        check(surface, order + "_initial")
        if order == "displayFirst" {
          surface.bounds.size.height = 480; check(surface, order + "_expansionPending")
          try surface.resize(width: 768, height: 640)
        } else {
          try surface.resize(width: 768, height: 640); check(surface, order + "_expansionPending")
          surface.bounds.size.height = 480
        }
        check(surface, order + "_expanded")
        if order == "displayFirst" {
          surface.bounds.size.height = 288; check(surface, order + "_shrinkPending")
          try surface.resize(width: 768, height: 384)
        } else {
          try surface.resize(width: 768, height: 384); check(surface, order + "_shrinkPending")
          surface.bounds.size.height = 288
        }
        check(surface, order + "_shrunk")
      }
    } catch { checks["unexpectedError"] = false; metrics["error"] = error.localizedDescription }
    let failures = checks.filter { !$0.value }.map(\.key).sorted()
    let result: [String: Any] = ["checks": checks, "metrics": metrics, "passed": checks.count - failures.count, "total": checks.count, "failures": failures]
    try! JSONSerialization.data(withJSONObject: result, options: [.prettyPrinted, .sortedKeys]).write(to: directory.appendingPathComponent("resize-checks.json"), options: .atomic)
  }
}
