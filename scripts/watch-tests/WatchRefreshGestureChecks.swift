import Foundation

@main struct WatchRefreshGestureChecks {
  static var count = 0

  static func main() {
    var gesture = WatchRefreshGestureState()
    gesture.observeOffset(20)
    gesture.beginTouch(isRefreshing: false)
    gesture.dragChanged(translationY: 100, isRefreshing: false)
    gesture.observeOffset(70)
    check(gesture.isArmed, "a downward pull from the resting top arms")
    gesture.observeOffset(25)
    check(gesture.isArmed, "scroll rebound cannot erase a crossed threshold")
    gesture.gestureStateReset()
    check(!gesture.isArmed, "reset/cancellation removes the release label")
    check(gesture.endTouch(translationY: 100, isRefreshing: false), "reset before onEnded still refreshes once")
    check(!gesture.endTouch(translationY: 100, isRefreshing: false), "a duplicate end cannot refresh twice")

    gesture = armedGesture()
    check(gesture.endTouch(translationY: 100, isRefreshing: false), "onEnded before reset also refreshes")
    gesture.gestureStateReset()
    check(!gesture.isArmed && !gesture.endTouch(translationY: 100, isRefreshing: false),
          "late reset cannot create another candidate")

    gesture = armedGesture()
    gesture.gestureStateReset() // Cancelled: the platform never calls onEnded.
    gesture.observeOffset(0)
    gesture.beginTouch(isRefreshing: false)
    gesture.dragChanged(translationY: 5, isRefreshing: false)
    gesture.gestureStateReset()
    check(!gesture.endTouch(translationY: 5, isRefreshing: false), "a cancelled drag cannot arm the next small drag")

    gesture = armedGesture()
    gesture.cancel()
    check(!gesture.endTouch(translationY: 100, isRefreshing: false), "disappearing cancels even a pending release")

    gesture = WatchRefreshGestureState()
    gesture.observeOffset(0)
    gesture.observeOffset(70) // Crown overscroll without a touch.
    check(!gesture.isArmed, "Digital Crown movement cannot arm refresh")
    gesture.beginTouch(isRefreshing: false)
    gesture.dragChanged(translationY: 0, isRefreshing: false)
    gesture.observeOffset(115)
    check(!gesture.isArmed, "Crown rebound beneath a resting finger cannot arm refresh")
    check(!gesture.endTouch(translationY: 0, isRefreshing: false), "a stationary touch never refreshes")

    gesture = WatchRefreshGestureState()
    gesture.observeOffset(0)
    gesture.observeOffset(-100)
    gesture.beginTouch(isRefreshing: false)
    gesture.dragChanged(translationY: 300, isRefreshing: false)
    gesture.observeOffset(60)
    check(!gesture.isArmed, "a drag beginning in the middle cannot arm after reaching the top")
    check(!gesture.endTouch(translationY: 300, isRefreshing: false), "scrolling to the top does not refresh")

    gesture = WatchRefreshGestureState()
    gesture.observeOffset(0)
    gesture.beginTouch(isRefreshing: false)
    gesture.dragChanged(translationY: 41, isRefreshing: false)
    gesture.observeOffset(41)
    check(!gesture.endTouch(translationY: 41, isRefreshing: false), "a short pull does not refresh")
    gesture = armedGesture()
    check(!gesture.endTouch(translationY: -5, isRefreshing: false), "an upward release cannot refresh")

    gesture = armedGesture()
    gesture.setRefreshing(true)
    check(!gesture.isArmed && !gesture.endTouch(translationY: 100, isRefreshing: true), "active refresh consumes any armed gesture")
    gesture.beginTouch(isRefreshing: true)
    gesture.dragChanged(translationY: 100, isRefreshing: true)
    gesture.observeOffset(100)
    gesture.setRefreshing(false)
    gesture.dragChanged(translationY: 130, isRefreshing: false)
    check(!gesture.endTouch(translationY: 130, isRefreshing: false), "a touch started during refresh stays suppressed until it ends")

    gesture = armedGesture()
    gesture.gestureStateReset()
    gesture.setRefreshing(true)
    check(!gesture.endTouch(translationY: 100, isRefreshing: true), "refresh starting between reset and end prevents reentry")
    print("PASS: \(count) Watch refresh gesture checks")
  }

  static func armedGesture() -> WatchRefreshGestureState {
    var gesture = WatchRefreshGestureState()
    gesture.observeOffset(0)
    gesture.beginTouch(isRefreshing: false)
    gesture.dragChanged(translationY: 100, isRefreshing: false)
    gesture.observeOffset(60)
    return gesture
  }

  static func check(_ condition: @autoclosure () -> Bool, _ message: String) {
    count += 1
    if !condition() { print("FAIL: \(message)"); exit(1) }
  }
}
