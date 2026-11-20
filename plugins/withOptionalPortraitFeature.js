const { withAndroidManifest } = require('@expo/config-plugins');

/**
 * Keeps `"orientation": "portrait"` in app.json while marking
 * `android.hardware.screen.portrait` as optional (`android:required="false"`)
 * so Google Play does not restrict landscape-only tablets, Chromebooks, or XR devices.
 */
module.exports = function withOptionalPortraitFeature(config) {
  return withAndroidManifest(config, (modConfig) => {
    const manifest = modConfig.modResults.manifest;
    if (!manifest['uses-feature']) {
      manifest['uses-feature'] = [];
    }

    const featureName = 'android.hardware.screen.portrait';
    const existing = manifest['uses-feature'].find(
      (f) => f.$ && f.$['android:name'] === featureName
    );

    if (existing) {
      existing.$['android:required'] = 'false';
    } else {
      manifest['uses-feature'].push({
        $: {
          'android:name': featureName,
          'android:required': 'false',
        },
      });
    }

    return modConfig;
  });
};
