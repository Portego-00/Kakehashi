module.exports = {
  dependencies: {
    // Keep VLC native module on iOS, but do not autolink it on Android.
    "react-native-vlc-media-player": {
      platforms: {
        android: null,
      },
    },
  },
};
