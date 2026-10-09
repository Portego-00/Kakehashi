package expo.modules.kakehashiwidget

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.util.SizeF
import android.widget.RemoteViews
import org.json.JSONObject

open class HomeWidgetProvider : AppWidgetProvider() {
  override fun onUpdate(context: Context, manager: AppWidgetManager, ids: IntArray) {
    val props = HomeWidgetStore.current(context)
    ids.forEach { update(context, manager, it, props) }
    HomeWidgetStore.scheduleNext(context)
  }

  override fun onAppWidgetOptionsChanged(context: Context, manager: AppWidgetManager,
      id: Int, options: Bundle) {
    update(context, manager, id, HomeWidgetStore.current(context))
  }

  override fun onDeleted(context: Context, ids: IntArray) {
    HomeWidgetStore.scheduleNext(context)
  }

  companion object {
    internal fun views(context: Context, props: JSONObject, width: Float, height: Float): RemoteViews {
      return RemoteViews(context.packageName, R.layout.kakehashi_home_widget).apply {
        setImageViewBitmap(R.id.widget_image, HomeWidgetRenderer.render(context, props, width, height))
        setContentDescription(R.id.widget_image, HomeWidgetRenderer.description(props, width >= 250))
        val launch = Intent(Intent.ACTION_VIEW, Uri.parse("kakehashi://"))
          .setPackage(context.packageName).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
        setOnClickPendingIntent(R.id.widget_image, PendingIntent.getActivity(context, 421, launch,
          PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE))
      }
    }

    internal fun update(context: Context, manager: AppWidgetManager, id: Int, props: JSONObject) {
      val options = manager.getAppWidgetOptions(id)
      val isMediumProvider = manager.getAppWidgetInfo(id)?.provider?.className == MediumHomeWidgetProvider::class.java.name
      val defaultWidth = if (isMediumProvider) 364f else 170f
      val width = options.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH, defaultWidth.toInt()).toFloat().coerceAtLeast(110f)
      val height = options.getInt(AppWidgetManager.OPTION_APPWIDGET_MAX_HEIGHT, 170).toFloat().coerceAtLeast(110f)
      val sizes = if (Build.VERSION.SDK_INT >= 31) {
        @Suppress("DEPRECATION")
        options.getParcelableArrayList<SizeF>(AppWidgetManager.OPTION_APPWIDGET_SIZES)
      } else null
      val remoteViews = if (!sizes.isNullOrEmpty() && Build.VERSION.SDK_INT >= 31) {
        // Limit bitmap memory even on launchers that report many possible sizes.
        RemoteViews(sizes.distinct().take(4).associateWith {
          views(context, props, it.width.coerceAtLeast(110f), it.height.coerceAtLeast(110f))
        })
      } else views(context, props, width, height)
      manager.updateAppWidget(id, remoteViews)
    }
  }
}

class SmallHomeWidgetProvider : HomeWidgetProvider()
class MediumHomeWidgetProvider : HomeWidgetProvider()

class HomeWidgetRefreshReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    HomeWidgetStore.refresh(context)
  }
}
