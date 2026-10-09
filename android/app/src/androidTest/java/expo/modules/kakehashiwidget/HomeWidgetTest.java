package expo.modules.kakehashiwidget;

import android.appwidget.AppWidgetHost;
import android.appwidget.AppWidgetManager;
import android.content.ComponentName;
import android.content.Context;
import android.graphics.Bitmap;
import android.os.Bundle;
import androidx.test.platform.app.InstrumentationRegistry;
import org.junit.Before;
import org.junit.Test;
import static org.junit.Assert.*;
import java.io.File;
import java.io.FileOutputStream;
import org.json.JSONArray;
import org.json.JSONObject;

/** Device tests exercise the shipped renderer, persistence, providers and launcher IPC. */
@SuppressWarnings("deprecation")
public class HomeWidgetTest {
  private Context context;

  @Before public void setUp() throws Exception {
    context = InstrumentationRegistry.getInstrumentation().getTargetContext();
  }

  private JSONObject props(String mode, String[] colors) throws Exception {
    JSONObject props = new JSONObject();
    props.put("contentMode", mode);
    props.put("reviewsCountValue", 84);
    props.put("reviewsSecondaryLabel", "+16 at 14:00");
    props.put("streakPrimaryLabel", "84");
    props.put("streakSecondaryLabel", "Best 126");
    props.put("streakTertiaryLabel", "Freeze ready");
    props.put("streakGradientColors", new JSONArray(colors));
    props.put("criticalCount", 12);
    JSONArray items = new JSONArray();
    String[][] values = {{"橋", "はし", "bridge", "20"}, {"川", "かわ", "river", "30"}, {"山", "やま", "mountain", "40"}};
    for (String[] value : values) {
      items.put(new JSONObject().put("characters", value[0]).put("reading", value[1])
        .put("meaning", value[2]).put("percentage", Integer.parseInt(value[3])));
    }
    props.put("criticalItems", items);
    JSONArray days = new JSONArray();
    String[] labels = {"S", "S", "M", "T", "W", "T", "F"};
    for (int i = 0; i < 7; i++) {
      days.put(new JSONObject().put("label", labels[i]).put("active", i != 0).put("isToday", i == 6));
    }
    props.put("streakRecentDays", days);
    return props;
  }

  private void save(Bitmap bitmap, String name) throws Exception {
    File directory = new File(context.getExternalFilesDir(null), "widget-proof");
    directory.mkdirs();
    try (FileOutputStream file = new FileOutputStream(new File(directory, name + ".png"))) {
      assertTrue(bitmap.compress(Bitmap.CompressFormat.PNG, 100, file));
    }
  }

  @Test public void testAllModesColorsSizesAndAccessibility() throws Exception {
    String[][] palettes = {
      {"#FF7A18", "#FF5A3D", "#FF3F6C"}, {"#0EA5E9", "#2563EB", "#4338CA"},
      {"#10B981", "#059669", "#0F766E"}, {"#A855F7", "#7C3AED", "#4C1D95"},
      {"#FB7185", "#F43F5E", "#BE185D"}, {"#F59E0B", "#F97316", "#EA580C"},
      {"#06B6D4", "#14B8A6", "#22C55E"}, {"#64748B", "#475569", "#334155"},
      {"#38BDF8", "#6366F1", "#A78BFA"}, {"#111827", "#030712", "#020617"},
      {"#4B5563", "#1F2937", "#111827"}, {"#4338CA", "#312E81", "#111827"},
      {"#FDE68A", "#FDBA74", "#FB7185"}, {"#7DD3FC", "#38BDF8", "#60A5FA"},
      {"#6366F1", "#4338CA", "#1E1B4B"}, {"#334155", "#1E293B", "#0F172A"},
      {"#164E63", "#155E75", "#0F172A"}, {"#111827", "#0F172A", "#020617"}
    };
    for (String mode : new String[]{"reviews", "critical", "streak"}) {
      for (float width : new float[]{170, 364}) {
        Bitmap previous = null;
        for (int index = 0; index < palettes.length; index++) {
          JSONObject data = props(mode, palettes[index]);
          Bitmap bitmap = HomeWidgetRenderer.INSTANCE.render(context, data, width, 170);
          assertEquals((int) width * 2, bitmap.getWidth());
          assertEquals(340, bitmap.getHeight());
          assertEquals(0, bitmap.getPixel(0, 0)); // rounded clipping
          assertEquals(255, bitmap.getPixel(bitmap.getWidth() / 2, bitmap.getHeight() / 2) >>> 24);
          if (previous != null) assertFalse("Color change must redraw " + mode, previous.sameAs(bitmap));
          String description = HomeWidgetRenderer.INSTANCE.description(data, width >= 250);
          if (mode.equals("critical")) {
            assertTrue(description.contains("bridge"));
            assertEquals(width >= 250, description.contains("river"));
          } else if (mode.equals("streak")) assertTrue(description.contains("84 days"));
          else assertTrue(description.contains("84 available"));
          if (index == 0 || index == 1 || index == 12) save(bitmap, mode + "-" + (int) width + "-palette-" + index);
          if (previous != null) previous.recycle();
          previous = bitmap;
        }
        if (previous != null) previous.recycle();
      }
    }
    // Artwork changes at every review-load boundary.
    Bitmap previous = null;
    for (int count : new int[]{0, 25, 26, 100, 101, 250, 251, 9999}) {
      JSONObject data = props("reviews", palettes[1]).put("reviewsCountValue", count);
      Bitmap bitmap = HomeWidgetRenderer.INSTANCE.render(context, data, 364, 170);
      if (previous != null) assertFalse(previous.sameAs(bitmap));
      save(bitmap, "reviews-count-" + count);
      if (previous != null) previous.recycle();
      previous = bitmap;
    }
    if (previous != null) previous.recycle();
  }

  @Test public void testEmptyRadicalsLongTextAndResize() throws Exception {
    JSONObject data = props("critical", new String[]{"#FDE68A", "#FDBA74", "#FB7185"});
    data.put("criticalItems", new JSONArray()).put("criticalCount", 0);
    save(HomeWidgetRenderer.INSTANCE.render(context, data, 170, 170), "critical-empty");
    assertTrue(HomeWidgetRenderer.INSTANCE.description(data, false).contains("No critical items"));
    data.put("criticalItems", new JSONArray().put(new JSONObject().put("characters", "")
      .put("meaning", "a radical with a very long meaning").put("percentage", 0)));
    save(HomeWidgetRenderer.INSTANCE.render(context, data, 170, 170), "critical-radical");
    assertTrue(HomeWidgetRenderer.INSTANCE.description(data, false).contains("Radical"));
    data.getJSONArray("criticalItems").getJSONObject(0).put("characters", "国際連合安全保障理事会")
      .put("reading", "こくさいれんごうあんぜんほしょうりじかい");
    for (float[] size : new float[][]{{110, 110}, {170, 220}, {250, 110}, {364, 170}, {600, 400}}) {
      Bitmap bitmap = HomeWidgetRenderer.INSTANCE.render(context, data, size[0], size[1]);
      assertTrue(bitmap.getAllocationByteCount() <= 800 * 400 * 4);
      save(bitmap, "resize-" + (int) size[0] + "x" + (int) size[1]);
      bitmap.recycle();
    }
  }

  @Test public void testReviewIllustrationsAndStreakMilestoneArtwork() throws Exception {
    String[] colors = {"#0EA5E9", "#2563EB", "#4338CA"};
    Bitmap previous = null;
    int previousCount = -1;
    for (int count : new int[]{0, 25, 26, 100, 101, 250, 251}) {
      JSONObject data = props("reviews", colors).put("reviewsCountValue", count);
      Bitmap bitmap = HomeWidgetRenderer.INSTANCE.render(context, data, 364, 170);
      Bitmap artwork = Bitmap.createBitmap(bitmap, 500, 0, 228, 340);
      if (previous != null) {
        boolean sameBucket = (previousCount == 0 && count == 25) ||
          (previousCount == 26 && count == 100) || (previousCount == 101 && count == 250);
        assertEquals("Review illustration boundary at " + count, sameBucket, previous.sameAs(artwork));
        previous.recycle();
      }
      previous = artwork;
      previousCount = count;
      bitmap.recycle();
    }
    previous.recycle();
    previous = null;
    for (int count : new int[]{41, 42, 84, 126, 168}) {
      Bitmap bitmap = HomeWidgetRenderer.INSTANCE.render(context,
        props("streak", colors).put("streakPrimaryLabel", String.valueOf(count)), 170, 170);
      Bitmap icons = Bitmap.createBitmap(bitmap, 0, 212, 340, 128);
      if (previous != null) {
        assertFalse("Milestone icons must change at " + count, previous.sameAs(icons));
        previous.recycle();
      }
      previous = icons;
      save(bitmap, "streak-milestone-" + count);
      bitmap.recycle();
    }
    previous.recycle();
  }

  @Test public void testContentBottomInsetAtLauncherHeights() throws Exception {
    String[] colors = {"#0EA5E9", "#2563EB", "#4338CA"};
    for (String mode : new String[]{"streak", "critical"}) {
    for (float width : new float[]{170, 364}) {
      for (float height : new float[]{170, 224, 280}) {
        JSONObject data = props(mode, colors);
        JSONObject empty = new JSONObject(data.toString()).put("streakRecentDays", new JSONArray())
          .put("criticalItems", new JSONArray()).put("criticalCount", 0);
        Bitmap populated = HomeWidgetRenderer.INSTANCE.render(context, data, width, height);
        Bitmap withoutDays = HomeWidgetRenderer.INSTANCE.render(context, empty, width, height);
        int lastDayPixel = -1;
        for (int y = (int) (populated.getHeight() * 0.7); y < populated.getHeight(); y++) {
          for (int x = 40; x < populated.getWidth() - 40; x++) {
            if (populated.getPixel(x, y) != withoutDays.getPixel(x, y)) lastDayPixel = y;
          }
        }
        assertTrue("The final content row must remain visible", lastDayPixel >= 0);
        float bottomInset = (populated.getHeight() - 1 - lastDayPixel) * height / populated.getHeight();
        assertTrue(mode + " leaves excessive bottom space: " + bottomInset, bottomInset <= 20);
        assertTrue(mode + " content must not touch the widget edge", bottomInset >= 10);
        populated.recycle();
        withoutDays.recycle();
      }
    }
    }
  }

  @Test public void testExportAllModesAtActualLauncherSize() throws Exception {
    String[] colors = {"#0EA5E9", "#2563EB", "#4338CA"};
    for (String mode : new String[]{"reviews", "critical", "streak"}) {
      for (float width : new float[]{170, 364}) {
        Bitmap bitmap = HomeWidgetRenderer.INSTANCE.render(context, props(mode, colors), width, 224);
        save(bitmap, "launcher-" + mode + "-" + (width < 250 ? "small" : "medium"));
        bitmap.recycle();
      }
    }
    String previewMode = InstrumentationRegistry.getArguments().getString("widgetMode");
    if (previewMode != null) {
      assertTrue(previewMode.equals("reviews") || previewMode.equals("critical") || previewMode.equals("streak"));
      HomeWidgetStore.INSTANCE.saveSnapshot(context, props(previewMode, colors));
      HomeWidgetStore.INSTANCE.refresh(context);
    }
  }

  @Test public void testTimelinePersistenceAndReset() throws Exception {
    JSONObject now = props("reviews", new String[]{"#10B981", "#0F766E", "#134E4A"});
    JSONObject future = props("streak", new String[]{"#0EA5E9", "#2563EB", "#4338CA"});
    long timestamp = System.currentTimeMillis();
    HomeWidgetStore.INSTANCE.saveSnapshot(context, now);
    HomeWidgetStore.INSTANCE.saveTimeline(context, new JSONArray()
      .put(new JSONObject().put("timestamp", timestamp).put("props", now))
      .put(new JSONObject().put("timestamp", timestamp + 1000).put("props", future)));
    assertEquals("reviews", HomeWidgetStore.INSTANCE.current(context, timestamp).getString("contentMode"));
    assertEquals("streak", HomeWidgetStore.INSTANCE.current(context, timestamp + 1001).getString("contentMode"));
    assertEquals(2, HomeWidgetStore.INSTANCE.timeline(context).length());
    HomeWidgetStore.INSTANCE.saveSnapshot(context, new JSONObject().put("reviewsCountValue", 0));
    assertEquals(0, HomeWidgetStore.INSTANCE.timeline(context).length());
    assertEquals(0, HomeWidgetStore.INSTANCE.current(context, timestamp + 1001).getInt("reviewsCountValue"));
  }

  @Test public void testRealWidgetBindingUpdatesAndResize() throws Exception {
    AppWidgetHost host = new AppWidgetHost(context, 9420);
    AppWidgetManager manager = AppWidgetManager.getInstance(context);
    String[] colors = {"#0EA5E9", "#2563EB", "#4338CA"};
    for (Class<?> provider : new Class<?>[]{SmallHomeWidgetProvider.class, MediumHomeWidgetProvider.class}) {
      int id = host.allocateAppWidgetId();
      try {
        Bundle options = new Bundle();
        options.putInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH, 170);
        options.putInt(AppWidgetManager.OPTION_APPWIDGET_MAX_HEIGHT, 170);
        assertTrue("Grant appwidget bind access before running device tests",
          manager.bindAppWidgetIdIfAllowed(id, new ComponentName(context, provider), options));
        for (String mode : new String[]{"reviews", "critical", "streak"}) {
          HomeWidgetStore.INSTANCE.saveSnapshot(context, props(mode, colors));
          HomeWidgetStore.INSTANCE.refresh(context);
          assertNotNull(manager.getAppWidgetInfo(id));
          options.putInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH, 364);
          manager.updateAppWidgetOptions(id, options);
          new HomeWidgetProvider().onAppWidgetOptionsChanged(context, manager, id, options);
          assertEquals(364, manager.getAppWidgetOptions(id).getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH));
        }
      } finally { host.deleteAppWidgetId(id); }
    }
    // Leave a useful sample for manual launcher inspection in this emulator.
    HomeWidgetStore.INSTANCE.saveSnapshot(context, props("reviews", colors));
    HomeWidgetStore.INSTANCE.refresh(context);
  }
}
