import Foundation

@propertyWrapper struct Published<Value> {
  var wrappedValue: Value
}
protocol ObservableObject {}
enum WCSessionActivationState { case notActivated, activated }
protocol WCSessionDelegate: AnyObject {}

final class WCSession {
  struct Message {
    let value: [String: Any]
    let reply: ([String: Any]) -> Void
    let fail: (Error) -> Void
  }
  static var `default` = WCSession()
  static func isSupported() -> Bool { true }
  weak var delegate: WCSessionDelegate?
  var activationState = WCSessionActivationState.activated
  var isReachable = true
  var messages: [Message] = []
  func activate() {}
  func sendMessage(_ message: [String: Any], replyHandler: @escaping ([String: Any]) -> Void,
                   errorHandler: @escaping (Error) -> Void) {
    messages.append(Message(value: message, reply: replyHandler, fail: errorHandler))
  }
}
