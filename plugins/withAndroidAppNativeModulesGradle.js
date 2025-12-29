const { withAppBuildGradle } = require('@expo/config-plugins');
const generateCode = require('@expo/config-plugins/build/utils/generateCode');

const APPLY_SNIPPET = `apply from: new File(["node", "--print", "require.resolve('@react-native-community/cli-platform-android/native_modules.gradle', { paths: [require.resolve('react-native/package.json')] })"].execute(null, rootDir).text.trim())\napplyNativeModulesAppBuildGradle(project)\n`;

module.exports = function withAndroidAppNativeModulesGradle(config) {
  return withAppBuildGradle(config, (config) => {
    const src = config.modResults.contents;
    if (src.includes('applyNativeModulesAppBuildGradle(project)')) {
      return config;
    }
    const result = generateCode.mergeContents({
      tag: 'withAndroidAppNativeModulesGradle',
      src,
      newSrc: APPLY_SNIPPET,
      anchor: /android\s*\{/,
      offset: 0,
      comment: '//',
    });
    config.modResults.contents = result.contents;
    return config;
  });
};
