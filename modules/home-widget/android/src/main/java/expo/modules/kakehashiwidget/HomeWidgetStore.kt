package expo.modules.kakehashiwidget

import android.app.AlarmManager
import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import org.json.JSONArray
import org.json.JSONObject

/** Durable, credential-free snapshots; launcher updates never need the JS process. */
internal object HomeWidgetStore {
  private fun preferences(context: Context) =
    context.getSharedPreferences("kakehashi_home_widget", Context.MODE_PRIVATE)

  fun saveSnapshot(context: Context, props: JSONObject) {
    preferences(context).edit().putString("snapshot", props.toString())
      .remove("timeline").commit()
  }

  fun saveTimeline(context: Context, entries: JSONArray) {
    // JS builds a bounded, chronological timeline shared with iOS.
    preferences(context).edit().putString("timeline", entries.toString()).commit()
  }

  fun timeline(context: Context): JSONArray =
    runCatching { JSONArray(preferences(context).getString("timeline", "[]") ?: "[]") }
      .getOrDefault(JSONArray())

  fun current(context: Context, now: Long = System.currentTimeMillis()): JSONObject {
    val entries = timeline(context)
    var selected: JSONObject? = null
    var latest = Long.MIN_VALUE
    for (index in 0 until entries.length()) {
      val entry = entries.optJSONObject(index) ?: continue
      val timestamp = entry.optLong("timestamp", Long.MAX_VALUE)
      if (timestamp <= now && timestamp >= latest) {
        selected = entry.optJSONObject("props")
        latest = timestamp
      }
    }
    return selected ?: runCatching {
      JSONObject(preferences(context).getString("snapshot", "{}") ?: "{}")
    }.getOrDefault(JSONObject())
  }

  fun widgetIds(context: Context): IntArray {
    val manager = AppWidgetManager.getInstance(context)
    return listOf(SmallHomeWidgetProvider::class.java, MediumHomeWidgetProvider::class.java)
      .flatMap { manager.getAppWidgetIds(ComponentName(context, it)).toList() }.toIntArray()
  }

  fun refresh(context: Context) {
    val manager = AppWidgetManager.getInstance(context)
    val props = current(context)
    widgetIds(context).forEach { HomeWidgetProvider.update(context, manager, it, props) }
    scheduleNext(context)
  }

  fun scheduleNext(context: Context) {
    val alarms = context.getSystemService(AlarmManager::class.java)
    val intent = PendingIntent.getBroadcast(context, 420,
      Intent(context, HomeWidgetRefreshReceiver::class.java).setAction("kakehashi.widget.TIMELINE"),
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
    alarms.cancel(intent)
    if (widgetIds(context).isEmpty()) return
    val now = System.currentTimeMillis()
    val entries = timeline(context)
    val next = (0 until entries.length()).mapNotNull {
      entries.optJSONObject(it)?.optLong("timestamp")?.takeIf { timestamp -> timestamp > now }
    }.minOrNull() ?: return
    // No exact-alarm permission. Android may defer this in power-saving modes;
    // every refresh selects the newest due entry, never an expired count.
    alarms.setAndAllowWhileIdle(AlarmManager.RTC, next, intent)
  }
}
