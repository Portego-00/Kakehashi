import Foundation

public enum WCSessionActivationState { case notActivated, inactive, activated }
public protocol WCSessionDelegate: AnyObject {
  func session(_ session: WCSession, activationDidCompleteWith activationState: WCSessionActivationState, error: Error?)
  func sessionReachabilityDidChange(_ session: WCSession)
  func session(_ session: WCSession, didReceiveApplicationContext applicationContext: [String: Any])
  func session(_ session: WCSession, didReceiveMessage message: [String: Any])
}

public final class WCSession {
  public static let `default` = WCSession()
  public static func isSupported() -> Bool { true }
  public weak var delegate: WCSessionDelegate?
  public var activationState: WCSessionActivationState = .activated
  public var isReachable = true
  public struct Pending {
    public let message: [String: Any]
    public let reply: ([String: Any]) -> Void
    public let error: ((Error) -> Void)?
  }
  public var pending: [Pending] = []
  public func activate() { activationState = .activated }
  public func sendMessage(_ message: [String: Any], replyHandler: @escaping ([String: Any]) -> Void, errorHandler: ((Error) -> Void)?) {
    pending.append(Pending(message: message, reply: replyHandler, error: errorHandler))
  }
}
