const appVariant = process.env.APP_VARIANT ?? "production";
const isDevelopment = appVariant === "development";

module.exports = ({ config: expo }) => {
  const baseBundleIdentifier = expo.ios.bundleIdentifier;
  const iosBundleIdentifier = isDevelopment
    ? `${baseBundleIdentifier}.dev`
    : baseBundleIdentifier;
  const widgetBundleIdentifier = isDevelopment
    ? `${baseBundleIdentifier}.dev.widgets`
    : `${baseBundleIdentifier}.widgets`;
  const shareBundleIdentifier = isDevelopment
    ? `${baseBundleIdentifier}.dev.share`
    : `${baseBundleIdentifier}.share`;

  const plugins = expo.plugins.map((plugin) => {
    if (Array.isArray(plugin) && plugin[0] === "expo-widgets") {
      return [
        plugin[0],
        {
          ...plugin[1],
          bundleIdentifier: widgetBundleIdentifier,
        },
      ];
    }

    return plugin;
  });

  const appExtensions =
    expo.extra?.eas?.build?.experimental?.ios?.appExtensions?.map(
      (extension) => {
        if (extension.targetName === "KakehashiOCR") {
          return {
            ...extension,
            bundleIdentifier: shareBundleIdentifier,
          };
        }

        return extension;
      },
    ) ?? [];

  return {
    ...expo,
    name: isDevelopment ? `${expo.name} Dev` : expo.name,
    ios: {
      ...expo.ios,
      bundleIdentifier: iosBundleIdentifier,
    },
    plugins,
    extra: {
      ...expo.extra,
      eas: {
        ...expo.extra.eas,
        build: {
          ...expo.extra.eas.build,
          experimental: {
            ...expo.extra.eas.build.experimental,
            ios: {
              ...expo.extra.eas.build.experimental.ios,
              appExtensions,
            },
          },
        },
      },
    },
  };
};
