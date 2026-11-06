package com.portego00.kakehashi;

import android.app.Instrumentation;
import android.app.UiAutomation;
import android.accessibilityservice.AccessibilityServiceInfo;
import android.graphics.Bitmap;
import android.graphics.Rect;
import android.os.Handler;
import android.os.Looper;
import android.os.SystemClock;
import android.view.InputDevice;
import android.view.MotionEvent;
import android.view.accessibility.AccessibilityNodeInfo;
import android.view.accessibility.AccessibilityWindowInfo;
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
  private String scenario;
  @Override public void onCreate(Bundle args) { super.onCreate(args);
    scenario = args == null ? "subjects" : args.getString("scenario", "subjects");
    android.content.SharedPreferences preferences = getTargetContext().getSharedPreferences("expo.modules.devmenu.sharedpreferences", 0);
    originalFab = preferences.getBoolean("showFab", true);
    preferences.edit().putBoolean("showFab", false).commit();
    start(); }
  @Override public void onStart() {
    ui = getUiAutomation();
    AccessibilityServiceInfo service = ui.getServiceInfo();
    service.flags |= AccessibilityServiceInfo.FLAG_RETRIEVE_INTERACTIVE_WINDOWS;
    ui.setServiceInfo(service);
    android.content.Intent launch = new android.content.Intent(android.content.Intent.ACTION_VIEW, android.net.Uri.parse("kakehashi://expo-development-client/?url=http%3A%2F%2F127.0.0.1%3A8096"));
    launch.setPackage("com.portego00.kakehashi"); launch.addFlags(android.content.Intent.FLAG_ACTIVITY_NEW_TASK);
    getTargetContext().startActivity(launch);
    Bundle result = new Bundle();
    try {
      if ("lessons".equals(scenario)) {
        lessonSynonymsAndTabsStayResponsive();
        result.putString("stream", "PASS: lesson synonyms, tabs, exit and both threads responsive\n");
      } else {
        detailsTabsStayResponsiveDuringProgressionUpdates();
        result.putString("stream", "PASS: subject tabs and both threads responsive\n");
      }
      restorePreferences(); finish(-1, result);
    }
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
    if (node.isVisibleToUser() && (label.equalsIgnoreCase(node.getText() == null ? "" : node.getText().toString()) ||
        label.contentEquals(node.getContentDescription() == null ? "" : node.getContentDescription()) ||
        label.contentEquals(node.getHintText() == null ? "" : node.getHintText()))) return node;
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
    System.out.println("TAP " + label + " bounds=" + bounds.toShortString() + " clickable=" + node.isClickable());
    if (node.isClickable() && node.getActionList().contains(AccessibilityNodeInfo.AccessibilityAction.ACTION_CLICK) &&
        node.performAction(AccessibilityNodeInfo.ACTION_CLICK)) {
      System.out.println("TAP_ACTION " + label + " accessibility");
      return;
    }
    System.out.println("TAP_ACTION " + label + " pointer");
    tapAt(bounds.centerX(), bounds.centerY());
  }

  private void tapAt(float x, float y) throws Exception {
    long time = SystemClock.uptimeMillis();
    MotionEvent down = MotionEvent.obtain(time, time, MotionEvent.ACTION_DOWN, x, y, 0);
    down.setSource(InputDevice.SOURCE_TOUCHSCREEN);
    MotionEvent up = MotionEvent.obtain(time, time + 50, MotionEvent.ACTION_UP, x, y, 0);
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
    String before = currentHeartbeat();
    assertNotNull("Missing JS heartbeat at " + step, before);
    long end = SystemClock.elapsedRealtime() + 2000;
    do {
      SystemClock.sleep(100); responsive(step);
      String after = currentHeartbeat();
      if (after != null && !before.equals(after)) {
        if ("lessons".equals(scenario)) {
          java.util.regex.Matcher timing = java.util.regex.Pattern.compile("JS max gap (\\d+) ms").matcher(after);
          assertTrue("Missing retained JS timing at " + step, timing.find());
          assertTrue("JS event loop stalled at " + step + " (" + after + ")", Long.parseLong(timing.group(1)) < 1000);
        }
        System.out.println("JS_HEARTBEAT " + step + " " + before + " -> " + after);
        return;
      }
    } while (SystemClock.elapsedRealtime() < end);
    throw new AssertionError("JS/render thread froze at " + step + " (" + before + ")");
  }

  private String currentHeartbeat() {
    ui.clearCache();
    String result = heartbeat(ui.getRootInActiveWindow());
    if (result != null) return result;
    // Some overlays leave the fixture's root accessible in another window.
    // Native Modal checks use actual editor state changes when Android hides it.
    for (AccessibilityWindowInfo window : ui.getWindows()) {
      result = heartbeat(window.getRoot());
      if (result != null) return result;
    }
    return null;
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
    awaitFixture();
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

  private void awaitFixture() throws Exception {
    long readyDeadline = SystemClock.elapsedRealtime() + 90000;
    while (true) {
      AccessibilityNodeInfo active = root();
      // A fresh development client shows this Expo-owned onboarding sheet over
      // the already running fixture. Match its observed copy before continuing.
      if (findContaining(active, "This is the developer menu.") != null && find(active, "Continue") != null) {
        tap("Continue");
        System.out.println("FIXTURE_START dismissed Expo developer-menu tutorial");
      } else if (find(active, "Reload") != null && find(active, "Close") != null &&
          findContaining(active, "Runtime version:") != null) {
        // Expo's FinishOnboarding only changes the menu page; AppInfo exposes
        // its close action as the documented accessibility description Close.
        tap("Close");
        System.out.println("FIXTURE_START closed Expo developer menu");
      } else if (heartbeat(active) != null) {
        return;
      }
      AccessibilityNodeInfo wait = find(active, "Wait");
      if (wait != null) { wait.performAction(AccessibilityNodeInfo.ACTION_CLICK); }
      if (SystemClock.elapsedRealtime() > readyDeadline) throw new AssertionError("Native fixture failed to start");
      SystemClock.sleep(250);
    }
  }

  public void lessonSynonymsAndTabsStayResponsive() throws Exception {
    awaitFixture();
    for (int i = 0; i < 3; i++) {
      long start = SystemClock.elapsedRealtime();
      tap("Open lesson");
      waitFor("R", 5000);
      waitFor("Kanji", 5000);
      waitFor("The Other Day", 5000);
      jsResponsive("lesson first render " + i);
      System.out.println("LESSON_RENDER " + i + " " + (SystemClock.elapsedRealtime() - start) + "ms");
      tap("Meaning");
      SystemClock.sleep(200);
      jsResponsive("lesson meaning before reading/context " + i);
      scrollTo("Manage");
      addLessonSynonym("android lesson synonym " + i, i);
      // The reported exit freeze also occurred before visiting Reading/Context.
      if (i == 0) {
        exitLesson("before reading/context");
        tap("Open lesson");
        waitFor("R", 5000);
        waitFor("Kanji", 5000);
        waitFor("The Other Day", 5000);
        jsResponsive("lesson reopen");
      }
      start = SystemClock.elapsedRealtime();
      tap("Reading");
      SystemClock.sleep(200);
      jsResponsive("lesson reading transition " + i);
      scrollTo("Reading Mnemonic");
      waitFor("Reading Mnemonic", 3000);
      jsResponsive("lesson reading " + i);
      System.out.println("LESSON_READING " + i + " " + (SystemClock.elapsedRealtime() - start) + "ms");
      if (i == 0) screenshot("lesson-reading");
      start = SystemClock.elapsedRealtime();
      tap("Context");
      SystemClock.sleep(200);
      jsResponsive("lesson context transition " + i);
      scrollTo("Context Sentences");
      waitFor("Context Sentences", 3000);
      jsResponsive("lesson context " + i);
      System.out.println("LESSON_CONTEXT " + i + " " + (SystemClock.elapsedRealtime() - start) + "ms");
      if (i == 0) screenshot("lesson-context");
      tap("Meaning");
      SystemClock.sleep(200);
      jsResponsive("lesson meaning after reading/context " + i);
      scrollTo("Manage");
      if (i == 0) screenshot("lesson-saved-synonym");
      exitLesson("after reading/context " + i);
    }
  }

  private void addLessonSynonym(String synonym, int iteration) throws Exception {
    long start = SystemClock.elapsedRealtime();
    tap("Manage");
    waitFor("Enter a synonym...", 2000);
    // Android 16 excludes the covered React root from accessibility while a
    // native Modal is open. Verify actual JS state round trips here instead of
    // treating the unobservable background heartbeat as a freeze.
    responsive("lesson synonym modal " + iteration);
    AccessibilityNodeInfo input = editable(root());
    assertNotNull("Synonym input missing", input);
    input.performAction(AccessibilityNodeInfo.ACTION_FOCUS);
    Bundle text = new Bundle();
    text.putCharSequence(AccessibilityNodeInfo.ACTION_ARGUMENT_SET_TEXT_CHARSEQUENCE, synonym);
    assertTrue(input.performAction(AccessibilityNodeInfo.ACTION_SET_TEXT, text));
    tap("Add");
    long draftDeadline = SystemClock.elapsedRealtime() + 2000;
    while (true) {
      AccessibilityNodeInfo active = root();
      AccessibilityNodeInfo draftInput = editable(active);
      if (draftInput != null && (draftInput.getText() == null || draftInput.getText().length() == 0 ||
          draftInput.isShowingHintText() || "Enter a synonym...".contentEquals(draftInput.getText()) ||
          (draftInput.getHintText() != null && draftInput.getHintText().equals(draftInput.getText()))) &&
          findNonEditableText(active, synonym) != null) break;
      responsive("lesson synonym draft " + iteration);
      if (SystemClock.elapsedRealtime() > draftDeadline) {
        throw new AssertionError("Synonym Add did not clear input and render draft chip within 2000ms");
      }
      SystemClock.sleep(100);
    }
    tap("Save");
    long deadline = SystemClock.elapsedRealtime() + 3000;
    while (find(root(), "Enter a synonym...") != null || findContaining(root(), synonym) == null) {
      responsive("saving lesson synonym");
      if (SystemClock.elapsedRealtime() > deadline) throw new AssertionError("Synonym save did not dismiss within 3000ms");
      SystemClock.sleep(100);
    }
    AccessibilityNodeInfo saved = findContaining(root(), synonym);
    assertNotNull("Saved lesson synonym did not render", saved);
    jsResponsive("lesson synonym saved " + iteration);
    System.out.println("LESSON_SYNONYM " + iteration + " " + (SystemClock.elapsedRealtime() - start) + "ms");
  }

  private AccessibilityNodeInfo findNonEditableText(AccessibilityNodeInfo node, String text) {
    if (node == null) return null;
    if (node.isVisibleToUser() && !node.isEditable() && node.getText() != null && text.contentEquals(node.getText())) return node;
    for (int i = 0; i < node.getChildCount(); i++) {
      AccessibilityNodeInfo found = findNonEditableText(node.getChild(i), text);
      if (found != null) return found;
    }
    return null;
  }

  private AccessibilityNodeInfo findContaining(AccessibilityNodeInfo node, String text) {
    if (node == null) return null;
    if (node.isVisibleToUser() && node.getText() != null && node.getText().toString().contains(text)) return node;
    for (int i = 0; i < node.getChildCount(); i++) {
      AccessibilityNodeInfo found = findContaining(node.getChild(i), text);
      if (found != null) return found;
    }
    return null;
  }

  private void exitLesson(String step) throws Exception {
    AccessibilityNodeInfo header = waitFor("R", 2000);
    Rect bounds = new Rect(); header.getBoundsInScreen(bounds);
    float density = getTargetContext().getResources().getDisplayMetrics().density;
    long start = SystemClock.elapsedRealtime();
    // The production close icon has no label; align the tap with its header row.
    tapAt(28 * density, bounds.centerY());
    waitFor("Lesson exited", 2000);
    jsResponsive("lesson exit " + step);
    System.out.println("LESSON_EXIT " + step + " " + (SystemClock.elapsedRealtime() - start) + "ms");
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
    if (node.isVisibleToUser() && node.isScrollable() &&
        String.valueOf(node.getClassName()).contains("ScrollView") &&
        node.getActionList().contains(AccessibilityNodeInfo.AccessibilityAction.ACTION_SCROLL_FORWARD)) return node;
    for (int i = 0; i < node.getChildCount(); i++) {
      AccessibilityNodeInfo result = scrollable(node.getChild(i)); if (result != null) return result;
    }
    return null;
  }

  private void scrollTo(String label) throws Exception {
    for (int i = 0; i < 10; i++) {
      if (find(root(), label) != null) return;
      AccessibilityNodeInfo scroll = scrollable(root());
      // Pager commits and scroll accessibility actions can arrive on different
      // frames. A pending tab must first fail the heartbeat assertion if frozen.
      if (scroll != null) scroll.performAction(AccessibilityNodeInfo.ACTION_SCROLL_FORWARD);
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

  private AccessibilityNodeInfo clickableAt(AccessibilityNodeInfo node, int x, int y) {
    if (node == null || !node.isVisibleToUser()) return null;
    Rect bounds = new Rect(); node.getBoundsInScreen(bounds);
    if (!bounds.contains(x, y)) return null;
    for (int i = node.getChildCount() - 1; i >= 0; i--) {
      AccessibilityNodeInfo found = clickableAt(node.getChild(i), x, y);
      if (found != null) return found;
    }
    return node.isClickable() && node.getActionList().contains(AccessibilityNodeInfo.AccessibilityAction.ACTION_CLICK) ? node : null;
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
    Rect inputBounds = new Rect(); input.getBoundsInScreen(inputBounds);
    float density = getTargetContext().getResources().getDisplayMetrics().density;
    int submitX = Math.round(inputBounds.right - 28 * density);
    int submitY = Math.round(inputBounds.top + 28 * density);
    // The production arrow is the actual submit action. A hardware Enter may
    // remain an editing key when the emulator has no active software IME.
    AccessibilityNodeInfo submit = clickableAt(root(), submitX, submitY);
    System.out.println("TAP review submit arrow x=" + submitX + " y=" + submitY);
    if (submit == null || !submit.performAction(AccessibilityNodeInfo.ACTION_CLICK)) tapAt(submitX, submitY);
    waitFor("Readings", 5000);
    jsResponsive("expanded wrong reading");
    screenshot("wrong-review");
    tap("Context"); scrollTo("Context Sentences"); waitFor("Context Sentences", 3000); jsResponsive("review context"); screenshot("review-context");
    tap("Meaning"); jsResponsive("review meaning");
  }
}
