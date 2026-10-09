package expo.modules.kakehashiwidget

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.LinearGradient
import android.graphics.Paint
import android.graphics.Path
import android.graphics.RectF
import android.graphics.Shader
import android.graphics.Typeface
import android.text.Layout
import android.text.StaticLayout
import android.text.TextPaint
import org.json.JSONObject
import kotlin.math.ceil
import kotlin.math.max
import kotlin.math.min
import kotlin.math.pow
import kotlin.math.roundToInt
import kotlin.math.sqrt
import java.util.concurrent.ConcurrentHashMap

/** Mirrors homeWidgetLayout.ios.tsx in points, using the very same PNG artwork. */
internal object HomeWidgetRenderer {
  private val illustrations = mapOf(
    "low" to "LowReviewsWidgetWidgetSafe.png", "mid" to "MidReviewsWidgetWidgetSafe.png",
    "high" to "HighReviewsWidgetWidgetSafe.png", "veryHigh" to "VeryHighReviewsWidgetWidgetSafe.png"
  )
  private val images = ConcurrentHashMap<String, Bitmap>()
  private val regular = Typeface.create("sans-serif", Typeface.NORMAL)
  private val semibold = Typeface.create("sans-serif-medium", Typeface.NORMAL)
  private val bold = Typeface.create("sans-serif", Typeface.BOLD)
  private val rounded = Typeface.create("sans-serif-rounded", Typeface.BOLD)

  private fun image(context: Context, key: String): Bitmap? = images[key] ?: runCatching {
    context.assets.open("streak-icons/png/$key").use { BitmapFactory.decodeStream(it) }
      ?.also { images[key] = it }
  }.getOrNull()

  fun render(context: Context, props: JSONObject, width: Float, height: Float): Bitmap {
    // Two pixels per point, bounded independently of display density and launcher size.
    // Four responsive variants together stay below Android's RemoteViews bitmap budget.
    val resolutionScale = min(2f, min(800f / width, 400f / height))
    val desiredWidth = (width * resolutionScale).roundToInt().coerceAtLeast(1)
    val desiredHeight = (height * resolutionScale).roundToInt().coerceAtLeast(1)
    val display = context.resources.displayMetrics
    val maxPixelsPerVariant = display.widthPixels.toDouble() * display.heightPixels * 1.5 / 4
    val memoryScale = min(1.0, sqrt(maxPixelsPerVariant / (desiredWidth.toDouble() * desiredHeight)))
    val pixelWidth = (desiredWidth * memoryScale).toInt().coerceAtLeast(1)
    val pixelHeight = (desiredHeight * memoryScale).toInt().coerceAtLeast(1)
    val bitmap = Bitmap.createBitmap(pixelWidth, pixelHeight, Bitmap.Config.ARGB_8888)
    val canvas = Canvas(bitmap)
    canvas.scale(pixelWidth / width, pixelHeight / height)
    val medium = width >= 250
    // Retain iOS point sizes at ordinary sizes; shrink uniformly for smaller launchers.
    val fit = min(1f, min(width / (if (medium) 300f else 170f), height / 170f))
    canvas.scale(fit, fit)
    val w = width / fit
    val h = height / fit
    val clip = Path().apply { addRoundRect(RectF(0f, 0f, w, h), 18f, 18f, Path.Direction.CW) }
    canvas.clipPath(clip)
    val colors = gradientColors(props)
    canvas.drawRect(0f, 0f, w, h, Paint(Paint.ANTI_ALIAS_FLAG).apply {
      shader = LinearGradient(0f, 0f, w, h, colors, null, Shader.TileMode.CLAMP)
    })
    when (props.optString("contentMode", "reviews")) {
      "streak" -> streak(context, canvas, props, w, h, medium)
      "critical" -> critical(canvas, props, w, h, medium, colors)
      else -> reviews(context, canvas, props, w, h, medium)
    }
    return bitmap
  }

  private fun gradientColors(props: JSONObject): IntArray {
    val colors = props.optJSONArray("streakGradientColors")
    if (colors != null && colors.length() >= 2) {
      val parsed = runCatching {
        IntArray(colors.length()) { Color.parseColor(colors.getString(it)) }
      }.getOrNull()
      if (parsed != null) return parsed
    }
    return intArrayOf(Color.rgb(255, 122, 24), Color.rgb(255, 90, 61), Color.rgb(255, 63, 108))
  }

  private fun text(canvas: Canvas, value: String, x: Float, top: Float, size: Float,
      color: Int = Color.WHITE, face: Typeface = regular, maxWidth: Float = Float.MAX_VALUE,
      shadow: Float = 0f, lines: Int = 1): Float {
    val paint = TextPaint(Paint.ANTI_ALIAS_FLAG).apply {
      textSize = size; this.color = color; typeface = face
      if (shadow > 0) setShadowLayer(shadow, 0f, if (shadow >= 5) 2f else 1f, Color.argb(200, 0, 0, 0))
    }
    if (lines > 1) {
      val layout = StaticLayout.Builder.obtain(value, 0, value.length, paint, maxWidth.toInt().coerceAtLeast(1))
        .setAlignment(Layout.Alignment.ALIGN_NORMAL).setIncludePad(false).setMaxLines(lines)
        .setEllipsize(android.text.TextUtils.TruncateAt.END).build()
      canvas.save(); canvas.translate(x, top); layout.draw(canvas); canvas.restore()
      return layout.height.toFloat()
    }
    val display = android.text.TextUtils.ellipsize(value, paint, maxWidth,
      android.text.TextUtils.TruncateAt.END).toString()
    canvas.drawText(display, x, top - paint.fontMetrics.ascent, paint)
    return paint.measureText(display)
  }

  private fun reviews(context: Context, canvas: Canvas, props: JSONObject, w: Float, h: Float, medium: Boolean) {
    val count = max(0, props.optInt("reviewsCountValue"))
    val key = when { count <= 25 -> "low"; count <= 100 -> "mid"; count <= 250 -> "high"; else -> "veryHigh" }
    val layerWidth = if (medium) 320f else 190f
    val layerHeight = max(176f, h)
    image(context, illustrations.getValue(key))?.let { art ->
      val scale = max(layerWidth / art.width, layerHeight / art.height)
      val artWidth = art.width * scale
      val artHeight = art.height * scale
      canvas.save()
      canvas.clipRect(w - layerWidth, 0f, w, h)
      canvas.drawBitmap(art, null, RectF(w - layerWidth + (layerWidth - artWidth) / 2,
        (h - artHeight) / 2, w - layerWidth + (layerWidth + artWidth) / 2,
        (h + artHeight) / 2), Paint(Paint.ANTI_ALIAS_FLAG or Paint.FILTER_BITMAP_FLAG).apply { alpha = 250 })
      canvas.restore()
    }
    val scrimWidth = if (medium) 244f else 142f
    canvas.drawRoundRect(RectF(0f, 0f, scrimWidth, h), 12f, 12f, Paint().apply {
      shader = LinearGradient(0f, h / 2, scrimWidth, h / 2,
        intArrayOf(Color.argb(112, 0, 0, 0), Color.argb(56, 0, 0, 0), Color.TRANSPARENT),
        null, Shader.TileMode.CLAMP)
    })
    val x = if (medium) 12f else 30f
    // Native clock matches the filled SF Symbol used by iOS.
    canvas.drawCircle(x + 6, 27f, 6f, Paint(Paint.ANTI_ALIAS_FLAG).apply { color = Color.WHITE })
    val hands = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = Color.rgb(70, 90, 90); strokeWidth = 1.2f; strokeCap = Paint.Cap.ROUND }
    canvas.drawLine(x + 6, 23.5f, x + 6, 27f, hands)
    canvas.drawLine(x + 6, 27f, x + 8.5f, 28.5f, hands)
    text(canvas, "Reviews", x + 17, 20f, 12f, face = semibold, shadow = 2f)
    text(canvas, count.toString(), x, 42f, if (medium) 48f else 38f, face = rounded,
      maxWidth = w - x - 12, shadow = 5f)
    text(canvas, props.optString("reviewsSecondaryLabel", "Open Kakehashi to sync"), x,
      if (medium) 106f else 94f, if (medium) 12f else 11f, Color.argb(230, 255, 255, 255),
      semibold, min(if (medium) 202f else 140f, w - x - 12), shadow = 2f, lines = 2)
  }

  private fun flame(canvas: Canvas, x: Float, y: Float) {
    val path = Path().apply {
      moveTo(x + 8, y); cubicTo(x + 9, y + 6, x + 15, y + 6, x + 14, y + 12)
      cubicTo(x + 13, y + 20, x, y + 20, x + 1, y + 10)
      cubicTo(x + 1, y + 7, x + 4, y + 6, x + 4, y + 3)
      lineTo(x + 6, y + 8); cubicTo(x + 8, y + 5, x + 9, y + 3, x + 8, y); close()
    }
    canvas.drawPath(path, Paint(Paint.ANTI_ALIAS_FLAG).apply { color = Color.rgb(255, 209, 102) })
  }

  private fun streak(context: Context, canvas: Canvas, props: JSONObject, w: Float, h: Float, medium: Boolean) {
    val x = if (medium) 12f else 11f
    flame(canvas, x, 18f)
    text(canvas, "App Streak", x + 21, 19f, 14f, face = bold, maxWidth = w - x - 28)
    val days = props.optJSONArray("streakRecentDays")
    val hasDays = days != null && days.length() > 0
    val growth = (h / 170f).coerceIn(1f, 1.22f)
    val circleSize = (if (medium) 27f else 23f) * min(growth, 1.12f)
    val iconSize = (if (medium) 21f else 18f) * min(growth, 1.12f)
    val labelSize = if (medium) 10f else 9f
    // Android launchers assign different heights to the same two-row widget.
    // Keep the week row 12–14 points from the bottom, then center the count in
    // the space between the header and divider instead of leaving it at the top.
    val bottomInset = if (medium) 14f else 12f
    val divider = if (hasDays) h - bottomInset - circleSize - 4f - labelSize * 1.2f - 9f else h - bottomInset
    val countSize = (if (medium) 42f else 32f) * growth
    val countTop = max(47f, (37f + divider - countSize * 1.2f) / 2f)
    val count = Regex("[0-9]+").find(props.optString("streakPrimaryLabel", "0"))?.value?.toIntOrNull() ?: 0
    val countWidth = text(canvas, count.toString(), x, countTop, countSize, face = rounded, maxWidth = w - x - 44)
    text(canvas, "日", x + countWidth + 8, countTop + countSize * 0.4f, (if (medium) 24f else 18f) * growth,
      Color.argb(242, 255, 255, 255), bold)
    if (days == null) return
    if (days.length() == 0) return
    canvas.drawRect(x, divider, w - x, divider + 1, Paint().apply { color = Color.argb(53, 255, 255, 255) })
    val dayNumbers = arrayOfNulls<Int>(days.length())
    var activeAfter = 0
    for (index in days.length() - 1 downTo 0) {
      if (days.optJSONObject(index)?.optBoolean("active") == true) {
        dayNumbers[index] = (count - activeAfter).takeIf { it > 0 }; activeAfter++
      }
    }
    val start = if (medium) 0 else max(0, days.length() - 3)
    val cellWidth = (w - 2 * x) / (days.length() - start)
    for (index in start until days.length()) {
      val day = days.optJSONObject(index) ?: continue
      val active = day.optBoolean("active")
      val dayNumber = dayNumbers[index] ?: 0
      val icon = if (!active) "inactive" else if (dayNumber > 0 && dayNumber % 42 == 0) {
        when (dayNumber) { 84 -> "day84"; 126 -> "day126"; 168 -> "day168"; else -> "day42" }
      } else "active"
      val cx = x + (index - start + 0.5f) * cellWidth
      val cy = divider + 9 + circleSize / 2
      canvas.drawCircle(cx, cy, circleSize / 2, Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = Color.argb(if (active) 51 else 31, 255, 255, 255)
      })
      image(context, "$icon.png")?.let {
        canvas.drawBitmap(it, null, RectF(cx - iconSize / 2, cy - iconSize / 2,
          cx + iconSize / 2, cy + iconSize / 2), Paint(Paint.ANTI_ALIAS_FLAG or Paint.FILTER_BITMAP_FLAG))
      }
      val label = day.optString("label")
      val labelPaint = Paint().apply { textSize = labelSize; typeface = semibold }
      text(canvas, label, cx - labelPaint.measureText(label) / 2, cy + circleSize / 2 + 4,
        labelPaint.textSize, if (day.optBoolean("isToday")) Color.WHITE else Color.argb(209, 255, 255, 255),
        if (day.optBoolean("isToday")) bold else semibold)
    }
  }

  private fun luminance(channels: List<Double>): Double = channels.mapIndexed { index, c ->
    (if (c <= 0.04045) c / 12.92 else ((c + 0.055) / 1.055).pow(2.4)) * listOf(0.2126, 0.7152, 0.0722)[index]
  }.sum()

  private fun critical(canvas: Canvas, props: JSONObject, w: Float, h: Float, medium: Boolean, colors: IntArray) {
    val channels = colors.map { listOf(Color.red(it) / 255.0, Color.green(it) / 255.0, Color.blue(it) / 255.0) }
    val darkest = luminance((0..2).map { index -> channels.minOf { it[index] } })
    val brightest = luminance((0..2).map { index -> channels.maxOf { it[index] } })
    val black = (darkest + 0.05) / 0.05 >= 4.6
    val scrim = if (black || brightest == 0.0) 0.0 else max(0.0, ceil((1 - (1.05 / 4.6 - 0.05) / brightest) * 100) / 100)
    if (scrim > 0) canvas.drawRect(0f, 0f, w, h, Paint().apply { color = Color.argb(ceil(scrim * 255).toInt(), 0, 0, 0) })
    val foreground = if (black) Color.BLACK else Color.WHITE
    val count = props.optInt("criticalCount")
    val countText = count.toString()
    val countWidth = Paint().apply { textSize = 12f; typeface = semibold }.measureText(countText)
    text(canvas, "Critical Items", 14f, 14f, 12f, foreground, semibold, w - countWidth - 36)
    text(canvas, countText, w - 14 - countWidth, 14f, 12f, foreground, semibold)
    val items = props.optJSONArray("criticalItems")
    if (items == null || items.length() == 0) {
      val label = if (count > 0) "Open Kakehashi" else "No critical items"
      val message = if (count > 0) "Refresh to see your items." else "No items below 90% accuracy."
      val labelHeight = text(canvas, label, 14f, 36f, 18f, foreground, semibold, w - 28, lines = 2)
      text(canvas, message, 14f, 36 + labelHeight + 6, 12f, foreground, regular, w - 28, lines = 2)
      return
    }
    if (medium) {
      val rowCount = min(3, items.length())
      val growth = (h / 170f).coerceIn(1f, 1.22f)
      val rowHeight = 31f * growth
      val rowStep = if (rowCount > 1) max(38f, (h - 14f - rowHeight - 36f) / (rowCount - 1)) else 0f
      for (index in 0 until rowCount) {
        val item = items.optJSONObject(index) ?: continue
        val top = if (rowCount > 1) 36f + index * rowStep else max(36f, (36f + h - 14f - rowHeight) / 2f)
        val characters = item.optString("characters").trim().ifEmpty { "Radical" }
        text(canvas, characters, 14f, top, (if (characters.length > 4) 15f else 24f) * growth, foreground, semibold, 86f)
        val percentage = "${item.optDouble("percentage", 0.0).roundToInt()}%"
        val percentageWidth = Paint().apply { textSize = 11f * growth }.measureText(percentage)
        text(canvas, item.optString("meaning"), 110f, top + 2, 12f * growth, foreground, semibold, w - 134 - percentageWidth)
        val reading = item.optString("reading")
        if (reading.isNotEmpty()) text(canvas, reading, 110f, top + 18 * growth, 11f * growth, foreground, regular, w - 134 - percentageWidth)
        text(canvas, percentage, w - 14 - percentageWidth, top + 10 * growth, 11f * growth, foreground)
      }
    } else {
      val item = items.optJSONObject(0) ?: return
      val characters = item.optString("characters").trim()
      val primaryLabel = characters.ifEmpty { "Radical" }
      val preferredSize = (if (characters.isEmpty()) 20f else if (characters.length > 4) 24f else 38f) * (h / 170f).coerceIn(1f, 1.22f)
      val primaryWidth = Paint().apply { textSize = preferredSize; typeface = semibold }.measureText(primaryLabel)
      val size = preferredSize * min(1f, (w - 28) / primaryWidth)
      val reading = item.optString("reading")
      val accuracyTop = h - 14f - 11f * 1.2f
      val meaningTop = accuracyTop - 20f
      val firstDetailTop = if (reading.isNotEmpty()) meaningTop - 18f else meaningTop
      val primaryTop = max(36f, (29f + firstDetailTop - size * 1.2f) / 2f)
      text(canvas, primaryLabel, 14f, primaryTop, size, foreground, semibold, w - 28)
      if (reading.isNotEmpty()) text(canvas, reading, 14f, firstDetailTop, 12f, foreground, maxWidth = w - 28)
      text(canvas, item.optString("meaning"), 14f, meaningTop, 13f, foreground, semibold, w - 28)
      text(canvas, "${item.optDouble("percentage", 0.0).roundToInt()}% correct", 14f, accuracyTop, 11f, foreground, maxWidth = w - 28)
    }
  }

  fun description(props: JSONObject, medium: Boolean): String = when (props.optString("contentMode", "reviews")) {
    "streak" -> "App Streak, ${props.optString("streakPrimaryLabel", "0")} days. " +
      "${props.optString("streakSecondaryLabel")}. ${props.optString("streakTertiaryLabel")}. " +
      (props.optJSONArray("streakRecentDays")?.let { days ->
        (0 until days.length()).joinToString(". ") { index ->
          val day = days.optJSONObject(index)
          "${day?.optString("label")}: ${if (day?.optBoolean("active") == true) "active" else "inactive"}"
        }
      } ?: "")
    "critical" -> "Critical Items, ${props.optInt("criticalCount")}. " +
      (props.optJSONArray("criticalItems")?.let { items ->
        (0 until min(items.length(), if (medium) 3 else 1)).joinToString(". ") { index ->
          val item = items.getJSONObject(index)
          "${item.optString("characters").ifEmpty { "Radical" }}, ${item.optString("reading")}, " +
            "${item.optString("meaning")}, ${item.optDouble("percentage", 0.0).roundToInt()} percent correct"
        }
      }?.ifEmpty { "No critical items" } ?: "No critical items")
    else -> "Reviews, ${props.optInt("reviewsCountValue")} available. ${props.optString("reviewsSecondaryLabel", "Open Kakehashi to sync")}"
  }
}
