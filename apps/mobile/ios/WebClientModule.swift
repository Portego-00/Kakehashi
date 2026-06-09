//
//  WebClientModule.swift
//  wanikani
//
//  Created by Pedro Ortego on 7/25/25.
//

import Foundation
import PromiseKit
import React

@objc(WebClientModule)
class WebClientModule: NSObject {
  private let client = WaniKaniWebClient()

  @objc(login:password:resolver:rejecter:)
  func login(_ email: String,
             password: String,
             resolver: @escaping RCTPromiseResolveBlock,
             rejecter: @escaping RCTPromiseRejectBlock) {

    client.login(email: email, password: password).done { result in
      resolver(["cookie": result.cookie, "apiToken": result.apiToken])
    }.catch { error in
      let code = (error as? WaniKaniWebClientError)?.rawValue.description ?? "E_UNKNOWN"
      rejecter(code, error.localizedDescription, error)
    }
  }

  @objc static func requiresMainQueueSetup() -> Bool { false }
}
