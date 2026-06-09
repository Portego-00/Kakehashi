/** @type {import('@bacons/apple-targets/app.plugin').ConfigFunction} */
module.exports = (config) => ({
  type: 'share',
  name: 'Kakehashi OCR',
  // Mirror the app group so we can write the shared image path
  entitlements: {
    'com.apple.security.application-groups':
      config.ios?.entitlements?.['com.apple.security.application-groups'] ?? [
        'group.com.kakehashi.reviewdata',
      ],
  },
  // Export JS not needed if we keep native-only controller; set false to avoid bundling RN
  exportJs: false,
  // The share extension should support images
  // Additional attributes in Info.plist will be provided by default for image activation
});

