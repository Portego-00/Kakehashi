import Foundation

/// Touch owns the refresh gesture; scroll geometry only supplies its pull distance.
/// A GestureState reset may arrive before onEnded, so preserve a release candidate
/// without displaying or re-arming it. Cancellation itself never requests a refresh.
struct WatchRefreshGestureState {
  private enum Phase { case idle, dragging, awaitingEnd, suppressed }

  private(set) var isArmed = false
  private var phase = Phase.idle
  private var initialOffset: Double?
  private var latestOffset = 0.0
  private var touchStartOffset = 0.0
  private var beganAtTop = false
  private var maximumPull = 0.0
  private var translation = 0.0
  private var releaseCandidate = false
  private var refreshing = false
  private let threshold = 42.0

  mutating func observeOffset(_ offset: Double) {
    if initialOffset == nil { initialOffset = offset }
    latestOffset = offset
    updateArming()
  }

  mutating func beginTouch(isRefreshing: Bool) {
    guard phase != .dragging, phase != .suppressed else { return }
    clearTouch()
    refreshing = isRefreshing
    phase = isRefreshing ? .suppressed : .dragging
    touchStartOffset = latestOffset
    beganAtTop = latestOffset >= (initialOffset ?? latestOffset) - 4
  }

  mutating func dragChanged(translationY: Double, isRefreshing: Bool) {
    beginTouch(isRefreshing: isRefreshing)
    guard phase == .dragging else { return }
    translation = translationY
    if isRefreshing { setRefreshing(true) }
    updateArming()
  }

  mutating func gestureStateReset() {
    guard phase == .dragging || phase == .suppressed else { return }
    releaseCandidate = phase == .dragging && isArmed && !refreshing
    phase = .awaitingEnd
    isArmed = false
  }

  mutating func endTouch(translationY: Double, isRefreshing: Bool) -> Bool {
    let candidate = phase == .dragging ? isArmed : (phase == .awaitingEnd && releaseCandidate)
    let shouldRefresh = candidate && translationY > 0 && !isRefreshing && !refreshing
    clearTouch()
    phase = .idle
    return shouldRefresh
  }

  mutating func setRefreshing(_ value: Bool) {
    refreshing = value
    guard value else { return }
    isArmed = false
    releaseCandidate = false
    if phase != .idle { phase = .suppressed }
  }

  mutating func cancel() {
    clearTouch()
    phase = .idle
  }

  private mutating func updateArming() {
    guard phase == .dragging, beganAtTop, !refreshing else { return }
    let restingTop = max(initialOffset ?? latestOffset, touchStartOffset)
    maximumPull = max(maximumPull, latestOffset - restingTop)
    // Requiring actual downward touch movement also excludes a Crown rebound
    // that happens while a finger merely rests on the display.
    if maximumPull >= threshold && translation >= threshold { isArmed = true }
  }

  private mutating func clearTouch() {
    isArmed = false
    releaseCandidate = false
    beganAtTop = false
    maximumPull = 0
    translation = 0
  }
}
