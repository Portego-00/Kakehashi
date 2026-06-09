//
//  KeyboardManager.swift
//  wanikani
//

import Foundation
import UIKit
import React

// Global flag checked by the swizzled textInputMode getter
var km_shouldUseJapaneseKeyboard = false

@objc(KeyboardManager)
class KeyboardManager: NSObject {

  @objc static func requiresMainQueueSetup() -> Bool {
    return true
  }

  override init() {
    super.init()
    KeyboardManager.performSwizzle()
  }

  // MARK: - Exported methods

  /// Returns true if the user has at least one Japanese keyboard installed.
  @objc func hasJapaneseKeyboard(
    _ resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    DispatchQueue.main.async {
      resolve(KeyboardManager.japaneseInputMode != nil)
    }
  }

  /// Set whether the active text field should present a Japanese keyboard.
  /// If the text field is currently focused, the keyboard is reloaded
  /// (resign + becomeFirstResponder) so the change takes effect immediately.
  @objc func setUseJapaneseKeyboard(
    _ enabled: Bool,
    resolver resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    DispatchQueue.main.async {
      let changed = km_shouldUseJapaneseKeyboard != enabled
      km_shouldUseJapaneseKeyboard = enabled

      if changed, let textField = Self.findFirstResponderTextField() {
        textField.resignFirstResponder()
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.05) {
          textField.becomeFirstResponder()
          resolve(true)
        }
        return
      }
      resolve(true)
    }
  }

  // MARK: - Japanese input mode lookup

  static var japaneseInputMode: UITextInputMode? {
    UITextInputMode.activeInputModes.first { mode in
      mode.primaryLanguage?.starts(with: "ja") == true
    }
  }

  // MARK: - First responder lookup

  private static func findFirstResponderTextField() -> UITextField? {
    let keyWindow = UIApplication.shared.connectedScenes
      .compactMap { $0 as? UIWindowScene }
      .flatMap { $0.windows }
      .first { $0.isKeyWindow }
    return findTextField(in: keyWindow)
  }

  private static func findTextField(in view: UIView?) -> UITextField? {
    guard let view = view else { return nil }
    if let textField = view as? UITextField, textField.isFirstResponder {
      return textField
    }
    for subview in view.subviews {
      if let found = findTextField(in: subview) {
        return found
      }
    }
    return nil
  }

  // MARK: - Method swizzling

  private static var hasSwizzled = false

  static func performSwizzle() {
    guard !hasSwizzled else { return }
    hasSwizzled = true

    let originalSelector = #selector(getter: UIResponder.textInputMode)
    let swizzledSelector = #selector(UITextField.km_swizzled_textInputMode)

    // textInputMode is declared on UIResponder, not UITextField.
    // class_getInstanceMethod walks the superclass chain, so originalMethod
    // points to the UIResponder implementation. We must first give UITextField
    // its own copy before exchanging, or we'd corrupt UIResponder's method table.
    guard let swizzledMethod = class_getInstanceMethod(UITextField.self, swizzledSelector),
          let originalMethod = class_getInstanceMethod(UITextField.self, originalSelector) else {
      return
    }

    // class_addMethod succeeds only if UITextField itself doesn't already
    // define textInputMode (i.e., it's inherited from UIResponder).
    let didAdd = class_addMethod(
      UITextField.self,
      originalSelector,
      method_getImplementation(swizzledMethod),
      method_getTypeEncoding(swizzledMethod)
    )

    if didAdd {
      // We just added our swizzled IMP as UITextField's textInputMode.
      // Now point the swizzled selector at the original (superclass) IMP
      // so that km_swizzled_textInputMode() calls the original behavior.
      class_replaceMethod(
        UITextField.self,
        swizzledSelector,
        method_getImplementation(originalMethod),
        method_getTypeEncoding(originalMethod)
      )
    } else {
      // UITextField already overrides textInputMode — safe to exchange.
      method_exchangeImplementations(originalMethod, swizzledMethod)
    }
  }
}

// MARK: - Swizzled textInputMode

extension UITextField {
  @objc func km_swizzled_textInputMode() -> UITextInputMode? {
    if km_shouldUseJapaneseKeyboard,
       let japaneseMode = KeyboardManager.japaneseInputMode {
      return japaneseMode
    }
    // Calls the original implementation (selectors were swapped)
    return self.km_swizzled_textInputMode()
  }
}
