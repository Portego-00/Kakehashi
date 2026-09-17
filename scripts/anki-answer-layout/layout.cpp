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
    bool revealed = true, bool buttonless = false, float* promptCenterOut = nullptr) {
  constexpr float paneHeight = 600;
  constexpr float bannerHeight = 32;
  const float controlsHeight = revealed && !buttonless ? 90 : 0;
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
  auto promptWrapper = child(config, promptScroll);
  apply_characterWrapper(promptWrapper);
  if (hinted) apply_characterWrapperWithOpenHint(promptWrapper);
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
  const auto requiredPrompt = hinted && promptLimit.unit == YGUnitPercent
    ? std::fmin(promptHeight, paneHeight * promptLimit.value / 100) : promptHeight;
  const bool shouldFit = promptHeight + bannerHeight + answerHeight + controlsHeight <= paneHeight;
  const bool fits = viewport + 0.01f >= answerHeight;
  const bool pass = centered && cardBottom <= paneHeight + 0.01f &&
    promptViewport + 0.01f >= requiredPrompt && viewport > 0 &&
    (shouldFit ? fits : !fits);
  std::printf("%s revealed=%s buttonless=%s hints=%s prompt=%.0f answer=%.0f promptViewport=%.0f cardHeight=%.0f answerViewport=%.0f overflow=%.0f\n",
    pass ? "PASS" : "FAIL", revealed ? "yes" : "no", buttonless ? "yes" : "no", hinted ? "yes" : "no", promptHeight, answerHeight, promptViewport, YGNodeLayoutGetHeight(card),
    viewport, std::fmax(0, answerHeight - viewport));
  if (!centered) {
    std::printf("  Prompt center is %.1f; available space above banner centers at %.1f.\n", promptCenter, bannerTop / 2);
  }
  if (shouldFit && !fits) {
    std::printf("  Premature scrolling: the answer overflows even though prompt, banner, answer, and controls fit in %.0f points.\n", paneHeight);
  }
  YGNodeFreeRecursive(pane);
  YGConfigFree(config);
  return pass;
}

int main() {
  std::puts("Native Yoga: source-derived Anki layout, 390x600 pane");
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
  return pass ? 0 : 1;
}
