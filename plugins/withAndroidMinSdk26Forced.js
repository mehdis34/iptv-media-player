const fs = require('fs');
const path = require('path');
const { withDangerousMod } = require('@expo/config-plugins');

const MIN_SDK_VALUE = 26;

function ensureRootMinSdk(projectRoot) {
  const buildGradlePath = path.join(projectRoot, 'build.gradle');
  const src = fs.readFileSync(buildGradlePath, 'utf8');

  if (src.includes(`minSdkVersion = ${MIN_SDK_VALUE}`)) {
    return;
  }

  const extBlock = `ext {\n    minSdkVersion = ${MIN_SDK_VALUE}\n}\n\n`;
  const updated = src.replace(/allprojects\s*\{/, `${extBlock}allprojects {`);
  fs.writeFileSync(buildGradlePath, updated);
}

function ensureAppMinSdk(projectRoot) {
  const appGradlePath = path.join(projectRoot, 'app', 'build.gradle');
  const src = fs.readFileSync(appGradlePath, 'utf8');
  const updated = src.replace(
    /minSdkVersion\s+rootProject\.ext\.minSdkVersion/,
    `minSdkVersion ${MIN_SDK_VALUE}`
  );
  fs.writeFileSync(appGradlePath, updated);
}

module.exports = function withAndroidMinSdk26Forced(config) {
  return withDangerousMod(config, [
    'android',
    async (config) => {
      ensureRootMinSdk(config.modRequest.platformProjectRoot);
      ensureAppMinSdk(config.modRequest.platformProjectRoot);
      return config;
    },
  ]);
};
