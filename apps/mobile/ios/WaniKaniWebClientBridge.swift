//
//  WaniKaniWebClientBridge.swift
//  wanikani
//
//  Created by Claude on 7/26/25.
//

import Foundation
import React

@objc(WaniKaniWebClientBridge)
class WaniKaniWebClientBridge: NSObject {
  
  private let webClient = WaniKaniWebClient()
  
  @objc
  static func requiresMainQueueSetup() -> Bool {
    return false
  }
  
  @objc
  func login(_ email: String, password: String, resolver: @escaping RCTPromiseResolveBlock, rejecter: @escaping RCTPromiseRejectBlock) {
    webClient.login(email: email, password: password).done { result in
      let response: [String: Any] = [
        "cookie": result.cookie,
        "apiToken": result.apiToken
      ]
      resolver(response)
    }.catch { error in
      if let waniKaniError = error as? WaniKaniWebClientError {
        rejecter("WANIKANI_ERROR", waniKaniError.errorDescription, error)
      } else {
        rejecter("UNKNOWN_ERROR", "An unknown error occurred", error)
      }
    }
  }
}