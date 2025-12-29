const { withAppBuildGradle } = require('@expo/config-plugins');
const generateCode = require('@expo/config-plugins/build/utils/generateCode');
const withMobileVlcKit = require('react-native-vlc-media-player/expo/ios/withMobileVlcKit');

const resolveAppGradleString = (options) => {
  const rnJetifierName = options?.android?.legacyJetifier ? 'jetified-react-native' : 'jetified-react-android';

  return `tasks.whenTaskAdded((tas -> {
    if (tas.name.contains("merge") && tas.name.contains("NativeLibs")) {
        tasks.named(tas.name) {it
            doFirst {
                try {
                    def target = it.externalLibNativeLibs
                            .getFiles()
                            .stream()
                            .filter(file -> file.toString().contains("${rnJetifierName}"))
                            .findAny()
                            .orElse(null);
                    if (target != null) {
                        java.nio.file.Path notNeededDirectory = target.toPath();
                        java.nio.file.Files.walk(notNeededDirectory).forEach(file -> {
                            if (file.toString().contains("libc++_shared.so")) {
                                java.nio.file.Files.delete(file);
                            }
                        });
                    }
                } catch (Exception ignored) {}
            }
        }
    }
}))`;
};

const withGradleTasksFixed = (config, options) => {
  if (!options || !options.android) {
    return config;
  }

  return withAppBuildGradle(config, (config) => {
    let src = config.modResults.contents;
    // Remove any previous VLC snippet to avoid stale code in prebuild output.
    src = src.replace(
      /\/\/ @generated begin withVlcMediaPlayer[\s\S]*?\/\/ @generated end withVlcMediaPlayer\s*/g,
      ''
    );

    const result = generateCode.mergeContents({
      tag: 'withVlcMediaPlayer',
      src,
      newSrc: resolveAppGradleString(options),
      anchor: /android\s*\{/,
      offset: 0,
      comment: '//',
    });

    config.modResults.contents = result.contents;
    return config;
  });
};

const withVlcMediaPlayerFixed = (config, options) => {
  config = withGradleTasksFixed(config, options);
  config = withMobileVlcKit(config, options);
  return config;
};

module.exports = withVlcMediaPlayerFixed;
