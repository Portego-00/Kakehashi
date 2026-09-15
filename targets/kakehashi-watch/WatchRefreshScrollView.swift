import SwiftUI

/// Watch scroll views don't present iPhone's refresh control. Observe the
/// existing scroll bounce so touch scrolling and the Digital Crown stay native.
struct WatchRefreshScrollView<Content: View>: View {
  let isRefreshing: Bool
  let onRefresh: () -> Void
  @ViewBuilder let content: () -> Content
  @State private var gesture = WatchRefreshGestureState()
  @GestureState private var touchIsActive = false
  @Namespace private var coordinateSpace

  var body: some View {
    ScrollView {
      content()
        .background {
          GeometryReader { geometry in
            Color.clear.preference(key: WatchRefreshOffset.self,
              value: geometry.frame(in: .named(coordinateSpace)).minY)
          }
        }
    }
    .coordinateSpace(name: coordinateSpace)
    .onPreferenceChange(WatchRefreshOffset.self) { offset in
      gesture.observeOffset(Double(offset))
    }
    .simultaneousGesture(
      DragGesture(minimumDistance: 0)
        .updating($touchIsActive) { _, active, _ in active = true }
        .onChanged { value in
          gesture.dragChanged(translationY: Double(value.translation.height), isRefreshing: isRefreshing)
        }
        .onEnded { value in
          if gesture.endTouch(translationY: Double(value.translation.height), isRefreshing: isRefreshing) {
            onRefresh()
          }
        }
    )
    .onChange(of: touchIsActive) { _, active in
      if active { gesture.beginTouch(isRefreshing: isRefreshing) }
      else { gesture.gestureStateReset() }
    }
    .onChange(of: isRefreshing) { _, refreshing in gesture.setRefreshing(refreshing) }
    .onDisappear { gesture.cancel() }
    .overlay(alignment: .top) {
      if isRefreshing {
        HStack(spacing: WatchTheme.smallGap) {
          ProgressView().controlSize(.mini)
          Text("Refreshing…").watchFont(.caption)
        }
        .padding(WatchTheme.smallGap)
        .background(WatchTheme.background, in: Capsule())
        .allowsHitTesting(false)
      } else if gesture.isArmed {
        Label("Release to refresh", systemImage: "arrow.down")
          .watchFont(.caption)
          .padding(WatchTheme.smallGap)
          .background(WatchTheme.background, in: Capsule())
          .allowsHitTesting(false)
      }
    }
    .accessibilityAction(named: "Refresh", onRefresh)
  }
}

private struct WatchRefreshOffset: PreferenceKey {
  static var defaultValue: CGFloat = 0
  static func reduce(value: inout CGFloat, nextValue: () -> CGFloat) { value = nextValue() }
}
