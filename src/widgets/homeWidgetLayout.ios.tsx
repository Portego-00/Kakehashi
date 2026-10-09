import {
  Circle,
  HStack,
  Image,
  RoundedRectangle,
  Spacer,
  Text,
  VStack,
  ZStack,
} from "@expo/ui/swift-ui";
import {
  accessibilityLabel,
  aspectRatio,
  allowsTightening,
  clipped,
  clipShape,
  font,
  frame,
  foregroundStyle,
  lineLimit,
  monospacedDigit,
  offset,
  opacity,
  padding,
  resizable,
  shadow,
  widgetAccentedRenderingMode,
} from "@expo/ui/swift-ui/modifiers";
import type { WidgetEnvironment } from "expo-widgets";
import type { HomeWidgetProps } from "./homeWidget";

export default function KakehashiHomeWidget(
  props: HomeWidgetProps,
  environment: WidgetEnvironment,
) {
  "widget";

  const isMedium = environment.widgetFamily === "systemMedium";
  const widgetEnvironment = environment as WidgetEnvironment & {
    showsContainerBackground?: boolean;
    showsWidgetContainerBackground?: boolean;
  };
  const widgetRenderingMode = widgetEnvironment.widgetRenderingMode ?? "fullColor";
  const isAccentedRenderingMode =
    widgetRenderingMode === "accented" || widgetRenderingMode === "vibrant";
  const hasContainerBackground =
    (widgetEnvironment.showsContainerBackground ??
      widgetEnvironment.showsWidgetContainerBackground) !== false;
  const shouldRenderGradientBackground =
    hasContainerBackground && !isAccentedRenderingMode;
  const shouldUseAccentedImageRendering =
    isAccentedRenderingMode || !hasContainerBackground;

  // Expo Widgets serializes this component into the widget extension, so keep
  // this branch self-contained and avoid calling file-scope helpers here.
  if (
    environment.widgetFamily === "accessoryCircular" ||
    environment.widgetFamily === "accessoryRectangular" ||
    environment.widgetFamily === "accessoryInline"
  ) {
    const rawReviewCount = Number.isFinite(props.reviewsCountValue)
      ? props.reviewsCountValue
      : 0;
    const reviewCount = Math.max(0, Math.round(rawReviewCount));
    const countLabel = `${reviewCount}`;
    const reviewStateLabel =
      reviewCount === 1 ? "review ready" : "reviews ready";
    const secondaryLabel =
      typeof props.reviewsSecondaryLabel === "string" &&
      props.reviewsSecondaryLabel.trim().length > 0
        ? props.reviewsSecondaryLabel
        : "No upcoming reviews";

    if (environment.widgetFamily === "accessoryInline") {
      return (
        <Text
          modifiers={[
            font({ size: 14, weight: "semibold" }),
            monospacedDigit(),
            lineLimit(1),
            allowsTightening(true),
          ]}
        >
          {countLabel} {reviewStateLabel}
        </Text>
      );
    }

    if (environment.widgetFamily === "accessoryCircular") {
      const countFontSize =
        countLabel.length >= 5
          ? 12
          : countLabel.length >= 4
            ? 15
            : countLabel.length >= 3
              ? 18
              : 22;

      return (
        <ZStack
          alignment="center"
          modifiers={[frame({ maxWidth: 999, maxHeight: 999 })]}
        >
          <Circle
            modifiers={[
              frame({ width: 56, height: 56 }),
              foregroundStyle({ type: "hierarchical", style: "quaternary" }),
            ]}
          />
          <VStack alignment="center" spacing={0}>
            {props.reviewsIconUri ? (
              <Image
                uiImage={props.reviewsIconUri}
                modifiers={[
                  resizable(),
                  aspectRatio({ ratio: 640 / 489, contentMode: "fit" }),
                  frame({ width: 10, height: 10 }),
                  widgetAccentedRenderingMode("fullColor"),
                ]}
              />
            ) : (
              <Image systemName="clock.fill" size={10} />
            )}
            <Text
              modifiers={[
                font({
                  size: countFontSize,
                  weight: "bold",
                  design: "rounded",
                }),
                monospacedDigit(),
                foregroundStyle({ type: "hierarchical", style: "primary" }),
                lineLimit(1),
                allowsTightening(true),
              ]}
            >
              {countLabel}
            </Text>
            <Text
              modifiers={[
                font({ size: 8, weight: "semibold" }),
                foregroundStyle({
                  type: "hierarchical",
                  style: "secondary",
                }),
                lineLimit(1),
              ]}
            >
              rev
            </Text>
          </VStack>
        </ZStack>
      );
    }

    const countFontSize =
      countLabel.length >= 5
        ? 17
        : countLabel.length >= 4
          ? 17
          : countLabel.length >= 3
            ? 20
            : 24;

    return (
      <ZStack
        alignment="leading"
        modifiers={[frame({ maxWidth: 999, maxHeight: 999 })]}
      >
        <VStack
          alignment="leading"
          spacing={2}
          modifiers={[
            padding({ horizontal: 8, vertical: 5 }),
            frame({ maxWidth: 999, maxHeight: 999, alignment: "leading" }),
          ]}
        >
          <HStack spacing={4} alignment="center">
            {props.reviewsIconUri ? (
              <Image
                uiImage={props.reviewsIconUri}
                modifiers={[
                  resizable(),
                  aspectRatio({ ratio: 640 / 489, contentMode: "fit" }),
                  frame({ width: 11, height: 11 }),
                  widgetAccentedRenderingMode("fullColor"),
                ]}
              />
            ) : (
              <Image systemName="clock.fill" size={11} />
            )}
            <Text
              modifiers={[
                font({ size: 11, weight: "semibold" }),
                foregroundStyle({ type: "hierarchical", style: "secondary" }),
                lineLimit(1),
              ]}
            >
              Reviews
            </Text>
          </HStack>

          <HStack spacing={5} alignment="lastTextBaseline">
            <Text
              modifiers={[
                font({
                  size: countFontSize,
                  weight: "bold",
                  design: "rounded",
                }),
                monospacedDigit(),
                foregroundStyle({ type: "hierarchical", style: "primary" }),
                lineLimit(1),
                allowsTightening(true),
              ]}
            >
              {countLabel}
            </Text>
            <Text
              modifiers={[
                font({ size: 11, weight: "semibold" }),
                foregroundStyle({ type: "hierarchical", style: "primary" }),
                lineLimit(1),
                allowsTightening(true),
              ]}
            >
              {reviewStateLabel}
            </Text>
          </HStack>

          <Text
            modifiers={[
              font({ size: 10, weight: "medium" }),
              foregroundStyle({ type: "hierarchical", style: "secondary" }),
              lineLimit(1),
              allowsTightening(true),
            ]}
          >
            {secondaryLabel}
          </Text>
        </VStack>
      </ZStack>
    );
  }

  if (props.contentMode === "reviews") {
    const countLabel = `${Math.max(0, Math.round(props.reviewsCountValue))}`;
    const gradientColors =
      Array.isArray(props.streakGradientColors) &&
      props.streakGradientColors.length >= 2
        ? props.streakGradientColors
        : ["#FF7A18", "#FF5A3D", "#FF3F6C"];
    const imageAspectRatio =
      Number.isFinite(props.reviewsImageAspectRatio) &&
      props.reviewsImageAspectRatio > 0
        ? props.reviewsImageAspectRatio
        : 1.6;
    const imageLayerWidth = isMedium ? 320 : 190;
    const imageLayerHeight = 176;
    const textColumnWidth = isMedium ? 226 : 200;
    const textScrimWidth = isMedium ? 244 : 142;
    const shouldUseAdaptiveReviewTextStyling = !shouldRenderGradientBackground;
    const reviewTitleShadowConfig = shouldRenderGradientBackground
      ? { radius: 2, x: 0, y: 1, color: "rgba(0, 0, 0, 0.75)" }
      : { radius: 1, x: 0, y: 1, color: "rgba(0, 0, 0, 0.42)" };
    const reviewCountShadowConfig = shouldRenderGradientBackground
      ? { radius: 5, x: 0, y: 2, color: "rgba(0, 0, 0, 0.8)" }
      : { radius: 2, x: 0, y: 1, color: "rgba(0, 0, 0, 0.5)" };
    const reviewSecondaryShadowConfig = shouldRenderGradientBackground
      ? { radius: 2, x: 0, y: 1, color: "rgba(0, 0, 0, 0.72)" }
      : { radius: 1, x: 0, y: 1, color: "rgba(0, 0, 0, 0.38)" };

    const reviewImageModifiers = [
      resizable(),
      aspectRatio({ ratio: imageAspectRatio, contentMode: "fill" }),
      frame({
        width: imageLayerWidth,
        height: imageLayerHeight,
      }),
      offset({ x: 0, y: 0 }),
      opacity(0.98),
    ];
    if (shouldUseAccentedImageRendering) {
      reviewImageModifiers.push(widgetAccentedRenderingMode("fullColor"));
    }
    const reviewTitleModifiers = [
      font({ size: 12, weight: "semibold" }),
      shouldUseAdaptiveReviewTextStyling
        ? foregroundStyle({ type: "hierarchical", style: "primary" })
        : foregroundStyle("#FFFFFF"),
      lineLimit(1),
      shadow(reviewTitleShadowConfig),
    ];
    const reviewCountModifiers = [
      font({
        size: isMedium ? 48 : 38,
        weight: "bold",
        design: "rounded",
      }),
      monospacedDigit(),
      shouldUseAdaptiveReviewTextStyling
        ? foregroundStyle({ type: "hierarchical", style: "primary" })
        : foregroundStyle("#FFFFFF"),
      lineLimit(1),
      shadow(reviewCountShadowConfig),
    ];
    const reviewSecondaryModifiers = [
      font({ size: isMedium ? 12 : 11, weight: "semibold" }),
      shouldUseAdaptiveReviewTextStyling
        ? foregroundStyle({ type: "hierarchical", style: "secondary" })
        : foregroundStyle("rgba(255, 255, 255, 0.9)"),
      lineLimit(2),
      shadow(reviewSecondaryShadowConfig),
    ];

    return (
      <ZStack
        alignment="topLeading"
        modifiers={[
          frame({ maxWidth: 999, maxHeight: 999 }),
          clipShape("roundedRectangle", 18),
        ]}
      >
        {shouldRenderGradientBackground ? (
          <RoundedRectangle
            cornerRadius={18}
            modifiers={[
              frame({ maxWidth: 999, maxHeight: 999 }),
              foregroundStyle({
                type: "linearGradient",
                colors: gradientColors,
                startPoint: { x: 0, y: 0 },
                endPoint: { x: 1, y: 1 },
              }),
            ]}
          />
        ) : null}
        {props.reviewsImageUri ? (
          <HStack
            spacing={0}
            alignment="center"
            modifiers={[frame({ maxWidth: 999, maxHeight: 999 })]}
          >
            <Spacer />
            <ZStack
              alignment="trailing"
              modifiers={[
                frame({
                  width: imageLayerWidth,
                  maxHeight: 999,
                }),
                clipped(true),
              ]}
            >
              <Image
                uiImage={props.reviewsImageUri}
                modifiers={reviewImageModifiers}
              />
            </ZStack>
          </HStack>
        ) : null}
        <HStack
          spacing={0}
          alignment="center"
          modifiers={[frame({ maxWidth: 999, maxHeight: 999 })]}
        >
          <RoundedRectangle
            cornerRadius={12}
            modifiers={[
              frame({ width: textScrimWidth, maxHeight: 999 }),
              foregroundStyle({
                type: "linearGradient",
                colors: [
                  "rgba(0, 0, 0, 0.44)",
                  "rgba(0, 0, 0, 0.22)",
                  "rgba(0, 0, 0, 0)",
                ],
                startPoint: { x: 0, y: 0.5 },
                endPoint: { x: 1, y: 0.5 },
              }),
            ]}
          />
          <Spacer />
        </HStack>
        <VStack
          alignment="leading"
          spacing={8}
          modifiers={[
            padding({
              top: 20,
              bottom: isMedium ? 14 : 12,
              horizontal: isMedium ? 12 : 30,
            }),
            frame({ width: textColumnWidth, alignment: "leading" }),
          ]}
        >
          <HStack spacing={5} alignment="center">
            <Image
              systemName="clock.fill"
              size={12}
              color={shouldUseAdaptiveReviewTextStyling ? undefined : "#FFFFFF"}
            />
            <Text modifiers={reviewTitleModifiers}>
              Reviews
            </Text>
          </HStack>

          <Text modifiers={reviewCountModifiers}>
            {countLabel}
          </Text>

          <Text modifiers={reviewSecondaryModifiers}>
            {props.reviewsSecondaryLabel}
          </Text>
        </VStack>
      </ZStack>
    );
  }

  if (props.contentMode === "streak") {
    const streakCountMatch = props.streakPrimaryLabel.match(/[0-9]+/);
    const parsedCount = streakCountMatch
      ? Number.parseInt(streakCountMatch[0], 10)
      : Number.NaN;
    const countLabel = Number.isFinite(parsedCount)
      ? String(parsedCount)
      : props.streakPrimaryLabel;
    const countValue = Number.isFinite(parsedCount) ? parsedCount : 0;
    const streakGradientColors =
      Array.isArray(props.streakGradientColors) &&
      props.streakGradientColors.length >= 2
        ? props.streakGradientColors
        : ["#FF7A18", "#FF5A3D", "#FF3F6C"];
    const streakIconUris = props.streakIconUris ?? {};
    const streakRecentDays = Array.isArray(props.streakRecentDays)
      ? props.streakRecentDays
      : [];
    const streakDayNumbers: (number | null)[] = new Array(
      streakRecentDays.length,
    ).fill(null);
    let activeDaysAfter = 0;
    for (let index = streakRecentDays.length - 1; index >= 0; index -= 1) {
      const day = streakRecentDays[index];
      if (!day?.active) {
        continue;
      }
      const streakDay = countValue - activeDaysAfter;
      streakDayNumbers[index] = streakDay > 0 ? streakDay : null;
      activeDaysAfter += 1;
    }
    const displayedStreakDays = isMedium
      ? streakRecentDays
      : streakRecentDays.slice(-3);
    const displayedDaysWithSourceIndex = displayedStreakDays.map(
      (day, index) => ({
        day,
        sourceIndex: isMedium
          ? index
          : streakRecentDays.length - displayedStreakDays.length + index,
      }),
    );

    return (
      <ZStack
        alignment="topLeading"
        modifiers={[frame({ maxWidth: 999, maxHeight: 999 })]}
      >
        {shouldRenderGradientBackground ? (
          <RoundedRectangle
            cornerRadius={18}
            modifiers={[
              frame({ maxWidth: 999, maxHeight: 999 }),
              foregroundStyle({
                type: "linearGradient",
                colors: streakGradientColors,
                startPoint: { x: 0, y: 0 },
                endPoint: { x: 1, y: 1 },
              }),
            ]}
          />
        ) : null}
        <VStack
          alignment="leading"
          spacing={10}
          modifiers={[
            padding({
              top: 19,
              bottom: isMedium ? 20 : 11,
              horizontal: isMedium ? 12 : 11,
            }),
          ]}
        >
          <HStack spacing={16} alignment="top">
            <HStack spacing={6} alignment="center">
              <Image systemName="flame.fill" size={15} color="#FFD166" />
              <Text
                modifiers={[
                  font({ size: 14, weight: "bold" }),
                  foregroundStyle("#FFFFFF"),
                  lineLimit(1),
                ]}
              >
                App Streak
              </Text>
            </HStack>
            <Spacer />
          </HStack>

          <HStack spacing={8} alignment="bottom">
            <Text
              modifiers={[
                font({
                  size: isMedium ? 42 : 32,
                  weight: "bold",
                  design: "rounded",
                }),
                monospacedDigit(),
                foregroundStyle("#FFFFFF"),
                lineLimit(1),
              ]}
            >
              {countLabel}
            </Text>
            <Text
              modifiers={[
                font({ size: isMedium ? 24 : 18, weight: "bold" }),
                foregroundStyle("rgba(255, 255, 255, 0.95)"),
                offset({ y: isMedium ? -2 : -1 }),
                lineLimit(1),
              ]}
            >
              日
            </Text>
          </HStack>

          {displayedDaysWithSourceIndex.length > 0 ? (
            <VStack alignment="leading" spacing={8}>
                <RoundedRectangle
                  cornerRadius={1}
                  modifiers={[
                    frame({ height: 1 }),
                    foregroundStyle("rgba(255, 255, 255, 0.22)"),
                    opacity(0.95),
                  ]}
                />
              <HStack spacing={0} alignment="top">
                {displayedDaysWithSourceIndex.map(({ day, sourceIndex }) => {
                  const streakDayNumber = streakDayNumbers[sourceIndex];
                  const milestoneVariant =
                    streakDayNumber !== null &&
                    streakDayNumber > 0 &&
                    streakDayNumber % 42 === 0
                      ? streakDayNumber === 84
                        ? "day84"
                        : streakDayNumber === 126
                          ? "day126"
                          : streakDayNumber === 168
                            ? "day168"
                            : "day42"
                      : "none";
                  const iconUri = day.active
                    ? milestoneVariant === "day84"
                      ? streakIconUris.day84
                      : milestoneVariant === "day126"
                        ? streakIconUris.day126
                        : milestoneVariant === "day168"
                          ? streakIconUris.day168
                          : milestoneVariant === "day42"
                            ? streakIconUris.day42
                            : streakIconUris.active
                    : streakIconUris.inactive;
                  const iconName = day.active
                    ? milestoneVariant === "none"
                      ? "checkmark"
                      : "star.fill"
                    : "circle";
                  const iconColor = day.active
                    ? milestoneVariant === "day84"
                      ? "#FFD166"
                      : milestoneVariant === "day126"
                        ? "#C8FF7A"
                        : milestoneVariant === "day168"
                          ? "#B8E8FF"
                          : "#FFFFFF"
                    : "rgba(255, 255, 255, 0.65)";
                  const iconImageModifiers = [
                    resizable(),
                    frame({
                      width: isMedium ? 21 : 18,
                      height: isMedium ? 21 : 18,
                    }),
                  ];
                  if (shouldUseAccentedImageRendering) {
                    iconImageModifiers.push(widgetAccentedRenderingMode("fullColor"));
                  }

                  return (
                    <VStack
                      key={`day-${day.label}-${sourceIndex}`}
                      alignment="center"
                      spacing={4}
                      modifiers={[frame({ maxWidth: 999 })]}
                    >
                      <ZStack
                        alignment="center"
                        modifiers={[
                          frame({
                            width: isMedium ? 27 : 23,
                            height: isMedium ? 27 : 23,
                          }),
                        ]}
                      >
                        <Circle
                          modifiers={[
                            frame({
                              width: isMedium ? 27 : 23,
                              height: isMedium ? 27 : 23,
                            }),
                            foregroundStyle(
                              day.active
                                ? "rgba(255, 255, 255, 0.2)"
                                : "rgba(255, 255, 255, 0.12)",
                            ),
                          ]}
                        />
                        {iconUri ? (
                          <Image uiImage={iconUri} modifiers={iconImageModifiers} />
                        ) : (
                          <Image
                            systemName={iconName}
                            size={11}
                            color={iconColor}
                          />
                        )}
                      </ZStack>
                      <Text
                        modifiers={[
                          font({
                            size: isMedium ? 10 : 9,
                            weight: day.isToday ? "bold" : "semibold",
                          }),
                          foregroundStyle(
                            day.isToday
                              ? "#FFFFFF"
                              : "rgba(255, 255, 255, 0.82)",
                          ),
                          lineLimit(1),
                        ]}
                      >
                        {day.label}
                      </Text>
                    </VStack>
                  );
                })}
              </HStack>
            </VStack>
          ) : null}
        </VStack>
      </ZStack>
    );
  }

  const criticalItems = (props.criticalItems ?? []).slice(0, isMedium ? 3 : 1);
  const firstItem = criticalItems[0];
  const gradientColors =
    Array.isArray(props.streakGradientColors) &&
    props.streakGradientColors.length >= 2 &&
    props.streakGradientColors.every((color) => /^#[0-9a-f]{6}$/i.test(color))
      ? props.streakGradientColors
      : ["#FF7A18", "#FF5A3D", "#FF3F6C"];
  // Keep contrast logic inside the serialized widget. Channel bounds cover
  // every point of the gradient, including colors between the stops.
  const channels = gradientColors.map((color) => [
    parseInt(color.slice(1, 3), 16) / 255,
    parseInt(color.slice(3, 5), 16) / 255,
    parseInt(color.slice(5, 7), 16) / 255,
  ]);
  const luminance = (rgb: number[]) => rgb.reduce((total, channel, index) => {
    const linear = channel <= 0.04045
      ? channel / 12.92
      : Math.pow((channel + 0.055) / 1.055, 2.4);
    return total + linear * [0.2126, 0.7152, 0.0722][index];
  }, 0);
  const darkest = luminance(
    [0, 1, 2].map((index) => channels.reduce((min, rgb) => Math.min(min, rgb[index]), 1)),
  );
  const brightest = luminance(
    [0, 1, 2].map((index) => channels.reduce((max, rgb) => Math.max(max, rgb[index]), 0)),
  );
  const useBlackText = (darkest + 0.05) / 0.05 >= 4.6;
  // A small margin above 4.5:1 protects even the smallest labels. Using a
  // linear-light bound also covers the darker sRGB alpha compositing case.
  const scrimOpacity = useBlackText || brightest === 0
    ? 0
    : Math.max(0, Math.ceil((1 - (1.05 / 4.6 - 0.05) / brightest) * 100) / 100);
  const textStyle = shouldRenderGradientBackground
    ? foregroundStyle(useBlackText ? "#000000" : "#FFFFFF")
    : foregroundStyle({ type: "hierarchical", style: "primary" });

  return (
    <ZStack modifiers={[frame({ maxWidth: 999, maxHeight: 999 })]}>
      {shouldRenderGradientBackground ? (
        <RoundedRectangle
          cornerRadius={0}
          modifiers={[
            foregroundStyle({
              type: "linearGradient",
              colors: gradientColors,
              startPoint: { x: 0, y: 0 },
              endPoint: { x: 1, y: 1 },
            }),
            frame({ maxWidth: 999, maxHeight: 999 }),
          ]}
        />
      ) : null}
      {shouldRenderGradientBackground && scrimOpacity > 0 ? (
        <RoundedRectangle
          cornerRadius={0}
          modifiers={[
            foregroundStyle("#000000"),
            opacity(scrimOpacity),
            frame({ maxWidth: 999, maxHeight: 999 }),
          ]}
        />
      ) : null}
      <VStack alignment="leading" spacing={6} modifiers={[padding({ all: 14 })]}>
        <HStack spacing={4}>
          <Text modifiers={[textStyle, font({ size: 12, weight: "semibold" }), lineLimit(1)]}>
            Critical Items
          </Text>
          <Spacer />
          <Text modifiers={[
            textStyle,
            font({ size: 12, weight: "semibold" }), monospacedDigit(),
            accessibilityLabel(`${props.criticalCount ?? 0} critical items`),
          ]}>
            {props.criticalCount ?? 0}
          </Text>
        </HStack>
        {firstItem ? (
          isMedium ? (
            <VStack alignment="leading" spacing={7}>
              {criticalItems.map((item, index) => (
                <HStack key={index} spacing={10}>
                  <Text modifiers={[
                    textStyle,
                    font({ size: (item.characters?.length ?? 0) > 4 ? 15 : 24, weight: "semibold" }),
                    lineLimit(1), allowsTightening(true),
                    frame({ width: 86, alignment: "leading" }),
                  ]}>
                    {item.characters?.trim() || "Radical"}
                  </Text>
                  <VStack alignment="leading" spacing={1} modifiers={[frame({ maxWidth: 999, alignment: "leading" })]}>
                    <Text modifiers={[textStyle, font({ size: 12, weight: "medium" }), lineLimit(1)]}>
                      {item.meaning}
                    </Text>
                    {item.reading ? (
                      <Text modifiers={[
                        textStyle,
                        font({ size: 11 }), lineLimit(1),
                      ]}>
                        {item.reading}
                      </Text>
                    ) : null}
                  </VStack>
                  <Text modifiers={[
                    textStyle,
                    font({ size: 11 }), monospacedDigit(),
                    accessibilityLabel(`${Math.round(item.percentage)} percent correct`),
                  ]}>
                    {Math.round(item.percentage)}%
                  </Text>
                </HStack>
              ))}
            </VStack>
          ) : (
            <VStack alignment="leading" spacing={3}>
              <Text modifiers={[
                textStyle,
                font({ size: !firstItem.characters ? 20 : firstItem.characters.length > 4 ? 24 : 38, weight: "semibold" }),
                lineLimit(1), allowsTightening(true),
              ]}>
                {firstItem.characters?.trim() || "Radical"}
              </Text>
              {firstItem.reading ? (
                <Text modifiers={[
                  textStyle,
                  font({ size: 12 }), lineLimit(1),
                ]}>
                  {firstItem.reading}
                </Text>
              ) : null}
              <Text modifiers={[textStyle, font({ size: 13, weight: "medium" }), lineLimit(1)]}>
                {firstItem.meaning}
              </Text>
              <Text modifiers={[
                textStyle,
                font({ size: 11 }), monospacedDigit(),
              ]}>
                {Math.round(firstItem.percentage)}% correct
              </Text>
            </VStack>
          )
        ) : (
          <VStack alignment="leading" spacing={6}>
            <Text modifiers={[textStyle, font({ size: 18, weight: "semibold" }), lineLimit(2)]}>
              {(props.criticalCount ?? 0) > 0 ? "Open Kakehashi" : "No critical items"}
            </Text>
            <Text modifiers={[
              textStyle,
              font({ size: 12 }), lineLimit(2),
            ]}>
              {(props.criticalCount ?? 0) > 0 ? "Refresh to see your items." : "No items below 90% accuracy."}
            </Text>
          </VStack>
        )}
        <Spacer minLength={0} />
      </VStack>
    </ZStack>
  );
}

