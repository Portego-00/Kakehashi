#include <yoga/Yoga.h>
#include <cmath>
#include <cstdio>
#include <initializer_list>
#include "source-styles.h"

YGNodeRef child(YGConfigRef config, YGNodeRef parent) {
  auto node = YGNodeNewWithConfig(config);
  if (parent) YGNodeInsertChild(parent, node, YGNodeGetChildCount(parent));
  return node;
}

void scrollDefaults(YGNodeRef node) {
  // React Native ScrollView.js baseVertical, before application styles.
  YGNodeStyleSetFlexGrow(node, 1);
  YGNodeStyleSetFlexShrink(node, 1);
  YGNodeStyleSetFlexDirection(node, YGFlexDirectionColumn);
  YGNodeStyleSetOverflow(node, YGOverflowScroll);
}

YGSize measurePrompt(YGNodeConstRef node, float, YGMeasureMode, float, YGMeasureMode) {
  return {120, *static_cast<const float*>(YGNodeGetContext(node))};
}

bool check(float answerHeight, float promptHeight = 120, bool hinted = false,
    bool revealed = true, bool buttonless = false, float* promptCenterOut = nullptr,
    float paneHeight = 600, bool dense = false) {
  constexpr float bannerHeight = 32;
  const float controlsHeight = revealed && !buttonless ? 90 : 0;
  const float metadataHeight = dense ? 104 : 0;
  const float replayHeight = dense && revealed ? 42 : 0;
  const bool contentSized = contentSizedAnkiCard(revealed, buttonless);
  auto config = YGConfigNew();
  YGConfigSetUseWebDefaults(config, false);
  YGConfigSetErrata(config, YGErrataAll);
  YGConfigSetPointScaleFactor(config, 1);
  auto pane = child(config, nullptr);
  apply_reviewInteractionPane(pane);
  if (contentSized) apply_ankiContentSizedPane(pane);
  YGNodeStyleSetWidth(pane, 390);
  YGNodeStyleSetHeight(pane, paneHeight);
  auto promptScroll = child(config, pane);
  scrollDefaults(promptScroll);
  apply_characterScrollView(promptScroll);
  if (contentSized) apply_ankiContentSizedPrompt(promptScroll);
  if (contentSized && hinted) apply_ankiContextHintPrompt(promptScroll);
  if (contentSized && metadataOverlayInsetApplied && metadataHeight > 0) {
    YGNodeStyleSetMinHeight(promptScroll, 120 + metadataHeight);
  }
  auto promptWrapper = child(config, promptScroll);
  apply_characterWrapper(promptWrapper);
  if (hinted) apply_characterWrapperWithOpenHint(promptWrapper);
  if (metadataOverlayInsetApplied && metadataHeight > 0) {
    YGNodeStyleSetPadding(promptWrapper, YGEdgeBottom, metadataHeight + (hinted ? 8 : 0));
  }
  auto promptContainer = child(config, promptWrapper);
  apply_characterContainer(promptContainer);
  auto prompt = child(config, promptContainer);
  YGNodeSetContext(prompt, &promptHeight);
  YGNodeSetMeasureFunc(prompt, measurePrompt);
  auto card = child(config, pane);
  apply_ankiCardContainer(card);
  if (contentSized) apply_ankiContentSizedCard(card);
  if (buttonless && revealed) apply_ankiButtonlessNaturalHeight(card);
  auto answerContainer = child(config, card);
  apply_ankiAnswerContainer(answerContainer);
  if (contentSized) apply_ankiContentSizedCard(answerContainer);
  if (buttonless && revealed) apply_ankiButtonlessNaturalHeight(answerContainer);
  YGNodeRef metadata = nullptr;
  if (metadataHeight > 0) {
    metadata = child(config, answerContainer);
    apply_ankiPreCardOverlayRow(metadata);
    YGNodeStyleSetHeight(metadata, metadataHeight - 10);
  }
  auto banner = child(config, answerContainer);
  apply_banner(banner);
  YGNodeStyleSetHeight(banner, bannerHeight);
  auto content = child(config, answerContainer);
  apply_ankiContentContainer(content);
  YGNodeStyleSetMinHeight(content, revealed ? revealedAnswerMinHeight : unrevealedAnswerMinHeight);
  if (buttonless) apply_ankiButtonlessNaturalHeight(content);
  auto answerScroll = child(config, content);
  scrollDefaults(answerScroll);
  apply_ankiAnswerScroll(answerScroll);
  if (buttonless) apply_ankiButtonlessNaturalHeight(answerScroll);
  auto answer = child(config, answerScroll);
  apply_ankiAnswerSection(answer);
  // Measured answer text/composition, including this section's padding.
  YGNodeStyleSetHeight(answer, answerHeight);
  if (replayHeight > 0) {
    auto replay = child(config, content);
    YGNodeStyleSetHeight(replay, replayHeight);
  }
  if (controlsHeight > 0) {
    auto controls = child(config, content);
    apply_ankiButtonSection(controls);
    YGNodeStyleSetHeight(controls, controlsHeight);
  }

  YGNodeCalculateLayout(pane, 390, paneHeight, YGDirectionLTR);
  const auto viewport = YGNodeLayoutGetHeight(answerScroll);
  const auto promptViewport = YGNodeLayoutGetHeight(promptScroll);
  const auto cardBottom = YGNodeLayoutGetTop(card) + YGNodeLayoutGetHeight(card);
  const auto bannerTop = YGNodeLayoutGetTop(card) + YGNodeLayoutGetTop(answerContainer) + YGNodeLayoutGetTop(banner);
  const auto promptCenter = YGNodeLayoutGetTop(promptScroll) + YGNodeLayoutGetTop(promptWrapper) +
    YGNodeLayoutGetTop(promptContainer) + YGNodeLayoutGetTop(prompt) + YGNodeLayoutGetHeight(prompt) / 2;
  if (promptCenterOut) *promptCenterOut = promptCenter;
  const bool centered = hinted || std::fabs(promptCenter - bannerTop / 2) <= 1;
  const auto promptLimit = YGNodeStyleGetMaxHeight(promptScroll);
  const auto promptMinimum = YGNodeStyleGetMinHeight(promptScroll);
  const auto requiredPrompt = hinted && promptMinimum.unit == YGUnitPoint
    ? std::fmin(promptHeight, promptMinimum.value)
    : hinted && promptLimit.unit == YGUnitPercent
      ? std::fmin(promptHeight, paneHeight * promptLimit.value / 100) : promptHeight;
  const auto metadataInLayout = metadata && YGNodeStyleGetPositionType(metadata) != YGPositionTypeAbsolute ? metadataHeight : 0;
  const bool shouldFit = requiredPrompt + bannerHeight + answerHeight + controlsHeight + metadataInLayout + replayHeight <= paneHeight;
  const bool fits = viewport + 0.01f >= answerHeight;
  const bool pass = centered && cardBottom <= paneHeight + 0.01f &&
    promptViewport + 0.01f >= requiredPrompt && viewport > 0 &&
    (shouldFit ? fits : !fits);
  // Once revealed, scrollable hints must yield room to answer details while
  // retaining a readable 120-point subject area. Metadata and pinned controls
  // reproduce the crowded review screen rather than an answer-only card.
  const float availableAnswer = paneHeight - 120 - bannerHeight - metadataHeight - replayHeight - controlsHeight;
  const bool answerHasRoom = !dense || !revealed ||
    (promptViewport >= 120 && viewport + 1 >= std::fmin(answerHeight, availableAnswer));
  const bool hintsUseAvailableSpace = !hinted || !contentSized ||
    promptViewport + YGNodeLayoutGetHeight(card) >= paneHeight - 1;
  const float metadataBottom = metadata
    ? YGNodeLayoutGetTop(card) + YGNodeLayoutGetTop(answerContainer) +
      YGNodeLayoutGetTop(metadata) + YGNodeLayoutGetHeight(metadata) : 0;
  const bool hintsReachBehindMetadata = !hinted || !metadata ||
    promptViewport + 1 >= metadataBottom;
  std::printf("%s pane=%.0f revealed=%s buttonless=%s hints=%s dense=%s prompt=%.0f answer=%.0f promptViewport=%.0f cardHeight=%.0f answerViewport=%.0f overflow=%.0f\n",
    pass && answerHasRoom && hintsUseAvailableSpace && hintsReachBehindMetadata ? "PASS" : "FAIL", paneHeight, revealed ? "yes" : "no", buttonless ? "yes" : "no", hinted ? "yes" : "no", dense ? "yes" : "no", promptHeight, answerHeight, promptViewport, YGNodeLayoutGetHeight(card),
    viewport, std::fmax(0, answerHeight - viewport));
  if (!hintsUseAvailableSpace) {
    std::printf("  Context hints leave %.0f points unused above the card.\n", paneHeight - promptViewport - YGNodeLayoutGetHeight(card));
  }
  if (!hintsReachBehindMetadata) {
    std::printf("  Sentences stop %.0f points above the metadata bottom, masking the full row.\n", metadataBottom - promptViewport);
  }
  if (!answerHasRoom) {
    std::printf("  Answer viewport must reach %.0f points by letting revealed context hints scroll.\n", std::fmin(answerHeight, availableAnswer));
  }
  if (!centered) {
    std::printf("  Prompt center is %.1f; available space above banner centers at %.1f.\n", promptCenter, bannerTop / 2);
  }
  if (shouldFit && !fits) {
    std::printf("  Premature scrolling: the answer overflows even though prompt, banner, answer, and controls fit in %.0f points.\n", paneHeight);
  }
  YGNodeFreeRecursive(pane);
  YGConfigFree(config);
  return pass && answerHasRoom && hintsUseAvailableSpace && hintsReachBehindMetadata;
}

int main() {
  std::puts("Native Yoga: source-derived Anki layout, normal and small panes");
  bool pass = true;
  float unrevealedPromptCenter;
  float revealedPromptCenter;
  pass = check(80, 120, false, false, false, &unrevealedPromptCenter) && pass;
  pass = check(80, 120, false, false, true) && pass;
  pass = check(260, 120, false, true, false, &revealedPromptCenter) && pass;
  const bool movesUpOnReveal = revealedPromptCenter < unrevealedPromptCenter - 1;
  std::printf("%s reveal moves prompt center from %.1f to %.1f\n", movesUpOnReveal ? "PASS" : "FAIL",
    unrevealedPromptCenter, revealedPromptCenter);
  pass = movesUpOnReveal && pass;
  for (float answerHeight : {120.0f, 650.0f}) {
    pass = check(answerHeight) && pass;
  }
  pass = check(260, 200, true) && pass;
  pass = check(260, 500, true) && pass;
  pass = check(80, 500, true, false, false, nullptr, 600, true) && pass;
  pass = check(80, 500, true, false, true, nullptr, 600, true) && pass;
  pass = check(80, 500, true, false, false, nullptr, 480, true) && pass;
  pass = check(260, 500, true, true, false, nullptr, 600, true) && pass;
  pass = check(260, 500, true, true, false, nullptr, 480, true) && pass;
  return pass ? 0 : 1;
}
