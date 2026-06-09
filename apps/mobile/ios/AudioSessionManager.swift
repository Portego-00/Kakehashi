//
//  AudioSessionManager.swift
//  wanikani
//
//  Created by Pedro Ortego on 8/3/25.
//

import Foundation
import AVFoundation
import React

@objc(AudioSessionManager)
class AudioSessionManager: NSObject {
  @objc static func requiresMainQueueSetup() -> Bool {
    return true
  }

  @objc func overrideSpeaker(_ resolve: RCTPromiseResolveBlock, rejecter reject: RCTPromiseRejectBlock) {
    let session = AVAudioSession.sharedInstance()
    do {
      // Keep other apps audible by default; ducking is managed per-active playback in JS.
      let options: AVAudioSession.CategoryOptions = [
        .mixWithOthers,
        .allowBluetooth,
        .allowBluetoothA2DP,
      ]
      try session.setCategory(.playback, mode: .default, options: options)
      try session.setActive(true)

      let outputs = session.currentRoute.outputs
      let headphonePorts: Set<AVAudioSession.Port> = [.headphones, .bluetoothA2DP, .bluetoothHFP, .bluetoothLE]
      let hasHeadphones = outputs.contains { headphonePorts.contains($0.portType) }

      if hasHeadphones {
        resolve("Headphone output active")
      } else {
        resolve("Speaker output active")
      }
    } catch let error {
      reject("E_AUDIO_SESSION_ERROR", error.localizedDescription, error)
    }
  }
}
