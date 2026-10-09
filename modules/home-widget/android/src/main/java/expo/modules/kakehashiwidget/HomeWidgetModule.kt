package expo.modules.kakehashiwidget

import android.appwidget.AppWidgetManager
import android.content.ComponentName
import android.os.Bundle
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import org.json.JSONArray
import org.json.JSONObject

class HomeWidgetModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("KakehashiHomeWidget")
    Function("updateSnapshot") { json: String ->
      val context = requireNotNull(appContext.reactContext)
      HomeWidgetStore.saveSnapshot(context, JSONObject(json))
      HomeWidgetStore.refresh(context)
    }
    Function("updateTimeline") { json: String ->
      val context = requireNotNull(appContext.reactContext)
      HomeWidgetStore.saveTimeline(context, JSONArray(json))
      HomeWidgetStore.refresh(context)
    }
    Function("reload") {
      HomeWidgetStore.refresh(requireNotNull(appContext.reactContext))
    }
    AsyncFunction("getTimeline") {
      HomeWidgetStore.timeline(requireNotNull(appContext.reactContext)).toString()
    }
    AsyncFunction("requestPin") {
      val context = requireNotNull(appContext.reactContext)
      val manager = AppWidgetManager.getInstance(context)
      val extras = Bundle().apply {
        putParcelable(AppWidgetManager.EXTRA_APPWIDGET_PREVIEW,
          HomeWidgetProvider.views(context, HomeWidgetStore.current(context), 170f, 170f))
      }
      manager.isRequestPinAppWidgetSupported && manager.requestPinAppWidget(
        ComponentName(context, SmallHomeWidgetProvider::class.java), extras, null
      )
    }
  }
}
