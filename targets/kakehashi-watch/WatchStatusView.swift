import SwiftUI

struct WatchStatusView: View {
  let title: String
  let message: String
  var body: some View {
    VStack(alignment: .leading, spacing: WatchTheme.smallGap) {
      Text(title)
        .watchFont(.title)
        .foregroundStyle(WatchTheme.text)
        .fixedSize(horizontal: false, vertical: true)
      Text(message)
        .watchFont(.body)
        .foregroundStyle(WatchTheme.secondaryText)
        .fixedSize(horizontal: false, vertical: true)
    }
    .frame(maxWidth: .infinity, alignment: .leading)
  }
}
