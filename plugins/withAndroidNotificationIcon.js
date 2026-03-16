const path = require("path");
const fs = require("fs");
const { withDangerousMod } = require("@expo/config-plugins");

/**
 * Adds `notification_icon` drawable for Android notifications/foreground services.
 *
 * Used by:
 * - Notifee `android.smallIcon`
 *
 * This runs during `expo prebuild` and writes into:
 *   android/app/src/main/res/drawable/notification_icon.png
 */
module.exports = function withAndroidNotificationIcon(config) {
  return withDangerousMod(config, [
    "android",
    async (config) => {
      const projectRoot = config.modRequest.projectRoot;
      const drawableDir = path.join(
        projectRoot,
        "android",
        "app",
        "src",
        "main",
        "res",
        "drawable",
      );

      await fs.promises.mkdir(drawableDir, { recursive: true });

      const targetPath = path.join(drawableDir, "notification_icon.png");
      const sourcePath = path.join(
        projectRoot,
        "assets",
        "images",
        "android-icon-monochrome.png",
      );

      if (fs.existsSync(sourcePath)) {
        await fs.promises.copyFile(sourcePath, targetPath);
      } else {
        // Fallback: 1x1 transparent PNG.
        const transparentPngBase64 =
          "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMB/6X8l6QAAAAASUVORK5CYII=";
        await fs.promises.writeFile(
          targetPath,
          Buffer.from(transparentPngBase64, "base64"),
        );
      }

      return config;
    },
  ]);
};
