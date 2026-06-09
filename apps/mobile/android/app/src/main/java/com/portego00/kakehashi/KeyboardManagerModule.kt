package com.portego00.kakehashi

import android.content.Context
import android.os.Build
import android.os.LocaleList
import android.view.View
import android.view.inputmethod.InputMethodManager
import android.widget.TextView
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import java.util.Locale

class KeyboardManagerModule(
  private val reactContext: ReactApplicationContext
) : ReactContextBaseJavaModule(reactContext) {

  override fun getName(): String = "KeyboardManager"

  @ReactMethod
  fun hasJapaneseKeyboard(promise: Promise) {
    // Android IMEs such as Gboard can manage their language list internally
    // without exposing Japanese as an enabled InputMethodSubtype to apps.
    // The actual switch is only a best-effort hint, so do not block the setting.
    promise.resolve(true)
  }

  @ReactMethod
  fun setUseJapaneseKeyboard(enabled: Boolean, promise: Promise) {
    val activity = reactContext.currentActivity
    activity?.runOnUiThread {
      try {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.N) {
          promise.resolve(false)
          return@runOnUiThread
        }

        val focusedTextView = findFocusedTextView(activity.window?.decorView)
        if (focusedTextView == null) {
          promise.resolve(false)
          return@runOnUiThread
        }

        focusedTextView.setImeHintLocales(
          if (enabled) LocaleList(Locale.JAPAN) else null
        )

        val inputMethodManager = reactContext.getSystemService(
          Context.INPUT_METHOD_SERVICE
        ) as InputMethodManager
        inputMethodManager.restartInput(focusedTextView)

        promise.resolve(true)
      } catch (error: Exception) {
        promise.reject("KEYBOARD_SWITCH_FAILED", "Failed to update keyboard language hint", error)
      }
    } ?: promise.resolve(false)
  }

  private fun findFocusedTextView(view: View?): TextView? {
    if (view == null) return null

    val focusedView = view.findFocus()
    if (focusedView is TextView) {
      return focusedView
    }

    return null
  }

}
