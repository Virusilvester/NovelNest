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
 *   android/app/src/main/res/drawable/notification_icon.xml
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

      const targetPath = path.join(drawableDir, "notification_icon.xml");

      // Simple "book" icon path (24x24 viewport). Fill is white; Android tints it as needed.
      const xml = `<?xml version="1.0" encoding="utf-8"?>
<vector xmlns:android="http://schemas.android.com/apk/res/android"
  android:width="24dp"
  android:height="24dp"
  android:viewportWidth="24"
  android:viewportHeight="24">
  <path
    android:fillColor="#FFFFFFFF"
    android:pathData="M18,2H6C4.9,2 4,2.9 4,4v16c0,1.1 0.9,2 2,2h12v-2H6V4h12v16h2V4C20,2.9 19.1,2 18,2zM8,6h8v2H8V6zM8,10h8v2H8V10zM8,14h6v2H8v-2z" />
</vector>
`;

      await fs.promises.writeFile(targetPath, xml, "utf8");

      return config;
    },
  ]);
};

