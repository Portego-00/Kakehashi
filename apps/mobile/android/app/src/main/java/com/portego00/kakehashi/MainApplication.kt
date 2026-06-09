package com.portego00.kakehashi
import com.facebook.react.common.assets.ReactFontManager

import android.app.Application
import android.content.res.Configuration

import com.facebook.react.PackageList
import com.facebook.react.ReactApplication
import com.facebook.react.ReactNativeApplicationEntryPoint.loadReactNative
import com.facebook.react.ReactNativeHost
import com.facebook.react.ReactPackage
import com.facebook.react.ReactHost
import com.facebook.react.common.ReleaseLevel
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint
import com.facebook.react.defaults.DefaultReactNativeHost

import expo.modules.ApplicationLifecycleDispatcher
import expo.modules.ExpoReactHostFactory

class MainApplication : Application(), ReactApplication {

  private val extraPackages: List<ReactPackage> by lazy {
    PackageList(this).packages.apply {
      add(WaniKaniWebClientPackage())
      add(ReviewNotificationManagerPackage())
      add(KeyboardManagerPackage())
    }
  }

  override val reactNativeHost: ReactNativeHost =
      object : DefaultReactNativeHost(this) {
        override fun getPackages(): List<ReactPackage> = extraPackages

        override fun getJSMainModuleName(): String = ".expo/.virtual-metro-entry"

        override fun getUseDeveloperSupport(): Boolean = BuildConfig.DEBUG

        override val isNewArchEnabled: Boolean = BuildConfig.IS_NEW_ARCHITECTURE_ENABLED
      }

  override val reactHost: ReactHost
    get() = ExpoReactHostFactory.getDefaultReactHost(
      context = applicationContext,
      packageList = extraPackages,
      jsMainModulePath = ".expo/.virtual-metro-entry",
      useDevSupport = BuildConfig.DEBUG
    )

  override fun onCreate() {
    super.onCreate()
    // @generated begin xml-fonts-init - expo prebuild (DO NOT MODIFY) sync-da39a3ee5e6b4b0d3255bfef95601890afd80709

    // @generated end xml-fonts-init
    DefaultNewArchitectureEntryPoint.releaseLevel = ReleaseLevel.STABLE
    loadReactNative(this)
    ApplicationLifecycleDispatcher.onApplicationCreate(this)
  }

  override fun onConfigurationChanged(newConfig: Configuration) {
    super.onConfigurationChanged(newConfig)
    ApplicationLifecycleDispatcher.onConfigurationChanged(this, newConfig)
  }
}
