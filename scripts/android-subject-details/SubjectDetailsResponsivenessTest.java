package com.portego00.kakehashi;

import android.app.Instrumentation;
import android.app.UiAutomation;
import android.graphics.Bitmap;
import android.graphics.Rect;
import android.os.Handler;
import android.os.Looper;
import android.os.SystemClock;
import android.view.InputDevice;
import android.view.KeyEvent;
import android.view.MotionEvent;
import android.view.accessibility.AccessibilityNodeInfo;
import android.os.Bundle;

import java.io.File;
import java.io.FileOutputStream;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;


/** Runs against the isolated Metro fixture, with the shipped Android renderer. */
public class SubjectDetailsResponsivenessTest extends Instrumentation {
  private final Instrumentation instrumentation = this;
  private UiAutomation ui;
  private boolean originalFab;
  @Override public void onCreate(Bundle args) { super.onCreate(args);
    android.content.SharedPreferences preferences = getTargetContext().getSharedPreferences("expo.modules.devmenu.sharedpreferences", 0);
    originalFab = preferences.getBoolean("showFab", true);
    preferences.edit().putBoolean("showFab", false).commit();
    start(); }
  @Override public void onStart() {
    ui = getUiAutomation();
    android.content.Intent launch = new android.content.Intent(android.content.Intent.ACTION_VIEW, android.net.Uri.parse("kakehashi://expo-development-client/?url=http%3A%2F%2F127.0.0.1%3A8096"));
    launch.setPackage("com.portego00.kakehashi"); launch.addFlags(android.content.Intent.FLAG_ACTIVITY_NEW_TASK);
    getTargetContext().startActivity(launch);
    Bundle result = new Bundle();
    try { detailsTabsStayResponsiveDuringProgressionUpdates(); result.putString("stream", "PASS: subject tabs and both threads responsive\n"); restorePreferences(); finish(-1, result); }
    catch (Throwable error) { try { screenshot("failure"); } catch (Throwable ignored) {} java.io.StringWriter text = new java.io.StringWriter(); error.printStackTrace(new java.io.PrintWriter(text)); result.putString("stream", "FAIL: " + text.toString()); sendStatus(0, result); SystemClock.sleep(1000); restorePreferences(); finish(0, result); }
  }
  private void restorePreferences() { getTargetContext().getSharedPreferences("expo.modules.devmenu.sharedpreferences", 0).edit().putBoolean("showFab", originalFab).commit(); }
  private void assertTrue(boolean condition) { assertTrue("assertion failed", condition); }
  private void assertTrue(String message, boolean condition) { if (!condition) throw new AssertionError(message); }
  private void assertNotNull(Object value) { assertNotNull("missing value", value); }
  private void assertNotNull(String message, Object value) { if (value == null) throw new AssertionError(message); }

  private AccessibilityNodeInfo root() { ui.clearCache(); return ui.getRootInActiveWindow(); }

  private void responsive(String step) throws Exception {
    CountDownLatch latch = new CountDownLatch(1);
    long start = SystemClock.elapsedRealtime();
    new Handler(Looper.getMainLooper()).post(latch::countDown);
    assertTrue("Android main thread froze at " + step, latch.await(1500, TimeUnit.MILLISECONDS));
    System.out.println("MAIN_THREAD " + step + " " + (SystemClock.elapsedRealtime() - start) + "ms");
  }

  private AccessibilityNodeInfo find(AccessibilityNodeInfo node, String label) {
    if (node == null) return null;
    if (node.isVisibleToUser() && (label.contentEquals(node.getText() == null ? "" : node.getText()) ||
        label.contentEquals(node.getContentDescription() == null ? "" : node.getContentDescription()))) return node;
    for (int i = 0; i < node.getChildCount(); i++) {
      AccessibilityNodeInfo result = find(node.getChild(i), label);
      if (result != null) return result;
    }
    return null;
  }

  private AccessibilityNodeInfo waitFor(String label, long timeout) throws Exception {
    long end = SystemClock.elapsedRealtime() + timeout;
    do {
      responsive("waiting for " + label);
      AccessibilityNodeInfo result = find(root(), label);
      if (result != null) return result;
      SystemClock.sleep(100);
    } while (SystemClock.elapsedRealtime() < end);
    throw new AssertionError("Screen did not render " + label + " within " + timeout + "ms");
  }

  private void tap(String label) throws Exception {
    AccessibilityNodeInfo node = waitFor(label, 3000);
    Rect bounds = new Rect(); node.getBoundsInScreen(bounds);
    long time = SystemClock.uptimeMillis();
    MotionEvent down = MotionEvent.obtain(time, time, MotionEvent.ACTION_DOWN, bounds.centerX(), bounds.centerY(), 0);
    down.setSource(InputDevice.SOURCE_TOUCHSCREEN);
    MotionEvent up = MotionEvent.obtain(time, time + 50, MotionEvent.ACTION_UP, bounds.centerX(), bounds.centerY(), 0);
    up.setSource(InputDevice.SOURCE_TOUCHSCREEN);
    assertTrue(ui.injectInputEvent(down, true)); assertTrue(ui.injectInputEvent(up, true));
    down.recycle(); up.recycle();
  }

  private String heartbeat(AccessibilityNodeInfo node) {
    if (node == null) return null;
    CharSequence description = node.getContentDescription();
    if (description != null && description.toString().startsWith("Heartbeat ")) return description.toString();
    for (int i = 0; i < node.getChildCount(); i++) {
      String result = heartbeat(node.getChild(i)); if (result != null) return result;
    }
    return null;
  }

  private void jsResponsive(String step) throws Exception {
    responsive(step);
    String before = heartbeat(root());
    assertNotNull("Missing JS heartbeat at " + step, before);
    long end = SystemClock.elapsedRealtime() + 2000;
    do {
      SystemClock.sleep(100); responsive(step);
      if (!before.equals(heartbeat(root()))) return;
    } while (SystemClock.elapsedRealtime() < end);
    throw new AssertionError("JS/render thread froze at " + step + " (" + before + ")");
  }

  private void screenshot(String name) throws Exception {
    File directory = new File(instrumentation.getTargetContext().getExternalFilesDir(null), "subject-details-proof");
    directory.mkdirs();
    try (FileOutputStream file = new FileOutputStream(new File(directory, name + ".png"))) {
      Bitmap bitmap = ui.takeScreenshot(); assertNotNull(bitmap);
      bitmap.compress(Bitmap.CompressFormat.PNG, 100, file); bitmap.recycle();
    }
  }

  public void detailsTabsStayResponsiveDuringProgressionUpdates() throws Exception {
    long readyDeadline = SystemClock.elapsedRealtime() + 90000;
    while (heartbeat(root()) == null) {
      AccessibilityNodeInfo wait = find(root(), "Wait");
      if (wait != null) { wait.performAction(AccessibilityNodeInfo.ACTION_CLICK); }
      if (SystemClock.elapsedRealtime() > readyDeadline) throw new AssertionError("Native fixture failed to start");
      SystemClock.sleep(250);
    }
    waitFor("Open details", 5000);
    for (int i = 0; i < 8; i++) {
      tap("Open details"); waitFor("The Other Day", 5000);
      jsResponsive("open " + i);
      tap("Reading"); waitFor("Readings", 3000); jsResponsive("reading " + i);
      if (i == 0) { screenshot("reading"); tap("Kenichi (male)"); verifyAudioStarted(); jsResponsive("audio"); }
      tap("Context"); waitFor("Context Sentences", 3000); jsResponsive("context " + i);
      if (i == 0) screenshot("context");
      tap("Meaning"); waitFor("Name", 3000); jsResponsive("meaning " + i);
    }
    scrollTo("Your Progression");
    waitFor("Guru 1", 3000); jsResponsive("loaded progression"); screenshot("progression");
    wrongReview();
  }

  private void verifyAudioStarted() throws Exception {
    android.media.AudioManager manager = (android.media.AudioManager) getTargetContext().getSystemService(android.content.Context.AUDIO_SERVICE);
    long start = SystemClock.elapsedRealtime();
    while (!manager.isMusicActive()) {
      responsive("audio loading");
      if (SystemClock.elapsedRealtime() - start > 5000) throw new AssertionError("Native audio did not start within 5000ms");
      SystemClock.sleep(20);
    }
    System.out.println("AUDIO_START " + (SystemClock.elapsedRealtime() - start) + "ms");
  }

  private AccessibilityNodeInfo scrollable(AccessibilityNodeInfo node) {
    if (node == null) return null;
    if (node.isVisibleToUser() && node.isScrollable() && String.valueOf(node.getClassName()).contains("ScrollView")) return node;
    for (int i = 0; i < node.getChildCount(); i++) {
      AccessibilityNodeInfo result = scrollable(node.getChild(i)); if (result != null) return result;
    }
    return null;
  }

  private void scrollTo(String label) throws Exception {
    for (int i = 0; i < 10; i++) {
      if (find(root(), label) != null) return;
      AccessibilityNodeInfo scroll = scrollable(root());
      assertNotNull("No scroll container for " + label, scroll);
      assertTrue(scroll.performAction(AccessibilityNodeInfo.ACTION_SCROLL_FORWARD));
      SystemClock.sleep(200); jsResponsive("scroll to " + label);
    }
    throw new AssertionError("Could not scroll to " + label);
  }

  private AccessibilityNodeInfo editable(AccessibilityNodeInfo node) {
    if (node == null) return null;
    if (node.isVisibleToUser() && node.isEditable()) return node;
    for (int i = 0; i < node.getChildCount(); i++) {
      AccessibilityNodeInfo result = editable(node.getChild(i)); if (result != null) return result;
    }
    return null;
  }

  private void wrongReview() throws Exception {
    tap("Wrong review");
    long deadline = SystemClock.elapsedRealtime() + 5000;
    AccessibilityNodeInfo input;
    while ((input = editable(root())) == null) {
      if (SystemClock.elapsedRealtime() > deadline) throw new AssertionError("Review answer input did not appear");
      SystemClock.sleep(100);
    }
    input.performAction(AccessibilityNodeInfo.ACTION_FOCUS);
    android.os.Bundle value = new android.os.Bundle();
    value.putCharSequence(AccessibilityNodeInfo.ACTION_ARGUMENT_SET_TEXT_CHARSEQUENCE, "きゅうじつ");
    assertTrue(input.performAction(AccessibilityNodeInfo.ACTION_SET_TEXT, value));
    SystemClock.sleep(300);
    instrumentation.sendKeyDownUpSync(KeyEvent.KEYCODE_ENTER);
    waitFor("Readings", 5000);
    jsResponsive("expanded wrong reading");
    screenshot("wrong-review");
    tap("Context"); scrollTo("Context Sentences"); waitFor("Context Sentences", 3000); jsResponsive("review context"); screenshot("review-context");
    tap("Meaning"); jsResponsive("review meaning");
  }
}
