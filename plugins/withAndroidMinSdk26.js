const { withAppBuildGradle } = require('@expo/config-plugins');

const MIN_SDK_LINE = 'minSdkVersion 26';

module.exports = function withAndroidMinSdk26(config) {
  return withAppBuildGradle(config, (config) => {
    const src = config.modResults.contents;
    if (src.includes(MIN_SDK_LINE)) {
      return config;
    }
    config.modResults.contents = src.replace(
      /minSdkVersion\s+rootProject\.ext\.minSdkVersion/,
      MIN_SDK_LINE
    );
    return config;
  });
};
