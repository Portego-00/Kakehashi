package com.portego00.kakehashi

import android.content.pm.PackageManager
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReadableArray
import com.facebook.react.modules.core.PermissionAwareActivity
import com.facebook.react.modules.core.PermissionListener
import com.ichi2.anki.api.AddContentApi

class AnkiDroidModule(
  private val reactContext: ReactApplicationContext
) : ReactContextBaseJavaModule(reactContext) {

  companion object {
    private const val PERMISSION_REQUEST_CODE = 9461
  }

  private var pendingPermissionPromise: Promise? = null

  override fun getName(): String = "AnkiDroid"

  @ReactMethod
  fun isAvailable(promise: Promise) {
    promise.resolve(AddContentApi.getAnkiDroidPackageName(reactContext) != null)
  }

  @ReactMethod
  fun hasPermission(promise: Promise) {
    promise.resolve(hasReadWritePermission())
  }

  @ReactMethod
  fun requestPermission(promise: Promise) {
    if (hasReadWritePermission()) {
      promise.resolve(true)
      return
    }

    if (pendingPermissionPromise != null) {
      promise.reject("PERMISSION_PENDING", "AnkiDroid permission request already in progress")
      return
    }

    val activity = reactContext.currentActivity as? PermissionAwareActivity
    if (activity == null) {
      promise.reject("NO_ACTIVITY", "No active activity to request AnkiDroid permission")
      return
    }

    pendingPermissionPromise = promise
    val listener = PermissionListener { requestCode, _, grantResults ->
      if (requestCode != PERMISSION_REQUEST_CODE) {
        return@PermissionListener false
      }

      val granted =
        grantResults.isNotEmpty() && grantResults[0] == PackageManager.PERMISSION_GRANTED
      pendingPermissionPromise?.resolve(granted)
      pendingPermissionPromise = null
      true
    }

    try {
      activity.requestPermissions(
        arrayOf(AddContentApi.READ_WRITE_PERMISSION),
        PERMISSION_REQUEST_CODE,
        listener
      )
    } catch (error: Throwable) {
      pendingPermissionPromise = null
      promise.reject("PERMISSION_REQUEST_FAILED", error.message, error)
    }
  }

  @ReactMethod
  fun getDecks(promise: Promise) {
    if (!requireReady(promise)) return

    try {
      val result = Arguments.createArray()
      AddContentApi(reactContext).deckList
        ?.entries
        ?.sortedBy { it.value.lowercase() }
        ?.forEach { (id, name) ->
          result.pushMap(Arguments.createMap().apply {
            putString("id", id.toString())
            putString("name", name)
          })
        }
      promise.resolve(result)
    } catch (error: Throwable) {
      rejectApiError(promise, "DECKS_FAILED", "Could not load AnkiDroid decks", error)
    }
  }

  @ReactMethod
  fun getNoteTypes(promise: Promise) {
    if (!requireReady(promise)) return

    try {
      val result = Arguments.createArray()
      AddContentApi(reactContext).getModelList(2)
        ?.entries
        ?.sortedBy { it.value.lowercase() }
        ?.forEach { (id, name) ->
          result.pushMap(Arguments.createMap().apply {
            putString("id", id.toString())
            putString("name", name)
          })
        }
      promise.resolve(result)
    } catch (error: Throwable) {
      rejectApiError(promise, "NOTE_TYPES_FAILED", "Could not load AnkiDroid note types", error)
    }
  }

  @ReactMethod
  fun getFields(noteTypeId: String, promise: Promise) {
    if (!requireReady(promise)) return

    try {
      val id = noteTypeId.toLongOrNull()
      if (id == null) {
        promise.reject("INVALID_NOTE_TYPE", "Invalid AnkiDroid note type")
        return
      }

      val fields = AddContentApi(reactContext).getFieldList(id)
      if (fields == null || fields.size < 2) {
        promise.reject("FIELDS_FAILED", "The selected AnkiDroid note type is unavailable")
        return
      }

      promise.resolve(Arguments.fromList(fields.toList()))
    } catch (error: Throwable) {
      rejectApiError(promise, "FIELDS_FAILED", "Could not load AnkiDroid fields", error)
    }
  }

  @ReactMethod
  fun addNote(
    deckId: String,
    noteTypeId: String,
    fields: ReadableArray,
    tags: ReadableArray,
    promise: Promise
  ) {
    if (!requireReady(promise)) return

    try {
      val parsedDeckId = deckId.toLongOrNull()
      val parsedNoteTypeId = noteTypeId.toLongOrNull()
      if (parsedDeckId == null || parsedNoteTypeId == null) {
        promise.reject("INVALID_CONFIGURATION", "Invalid AnkiDroid export configuration")
        return
      }

      val fieldValues = Array(fields.size()) { index -> fields.getString(index) ?: "" }
      val expectedFields = AddContentApi(reactContext).getFieldList(parsedNoteTypeId)
      if (expectedFields == null || expectedFields.size != fieldValues.size) {
        promise.reject(
          "FIELDS_CHANGED",
          "The fields in the selected AnkiDroid note type have changed. Configure export again."
        )
        return
      }

      val tagValues = buildSet {
        for (index in 0 until tags.size()) {
          tags.getString(index)?.trim()?.takeIf { it.isNotEmpty() }?.let(::add)
        }
      }
      val noteId = AddContentApi(reactContext).addNote(
        parsedNoteTypeId,
        parsedDeckId,
        fieldValues,
        tagValues
      )
      if (noteId == null) {
        promise.reject("ADD_FAILED", "AnkiDroid did not add the note")
        return
      }

      promise.resolve(noteId.toString())
    } catch (error: Throwable) {
      rejectApiError(promise, "ADD_FAILED", "Could not add the note to AnkiDroid", error)
    }
  }

  private fun hasReadWritePermission(): Boolean {
    return reactContext.checkSelfPermission(AddContentApi.READ_WRITE_PERMISSION) ==
      PackageManager.PERMISSION_GRANTED
  }

  private fun requireReady(promise: Promise): Boolean {
    if (AddContentApi.getAnkiDroidPackageName(reactContext) == null) {
      promise.reject("ANKIDROID_NOT_INSTALLED", "AnkiDroid is not installed")
      return false
    }
    if (!hasReadWritePermission()) {
      promise.reject("PERMISSION_DENIED", "AnkiDroid access was not granted")
      return false
    }
    return true
  }

  private fun rejectApiError(
    promise: Promise,
    code: String,
    message: String,
    error: Throwable
  ) {
    if (error is SecurityException) {
      promise.reject("PERMISSION_DENIED", "AnkiDroid access was not granted", error)
    } else {
      promise.reject(code, error.message ?: message, error)
    }
  }
}
