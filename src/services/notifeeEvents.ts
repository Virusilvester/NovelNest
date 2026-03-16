import { Platform } from "react-native";
import { BackgroundTaskControls } from "./backgroundTaskControls";

const isAndroid = Platform.OS === "android";

// Register Notifee action handlers at module load.
// This file is imported from the app entrypoint (`index.ts`) so it runs early.
if (isAndroid) {
  const handlePressAction = async (pressActionId?: string) => {
    switch (pressActionId) {
      case "updates_cancel":
        BackgroundTaskControls.cancelUpdatesCheck();
        break;
      case "downloads_toggle_pause":
        BackgroundTaskControls.toggleDownloadsPaused();
        break;
    }
  };

  import("@notifee/react-native")
    .then((mod) => {
      const notifee = mod?.default as any;
      if (typeof notifee?.onForegroundEvent === "function") {
        notifee.onForegroundEvent(async ({ detail }: any) => {
          await handlePressAction(detail?.pressAction?.id);
        });
      }
      if (typeof notifee?.onBackgroundEvent === "function") {
        notifee.onBackgroundEvent(async ({ detail }: any) => {
          await handlePressAction(detail?.pressAction?.id);
        });
      }
    })
    .catch(() => {
      // Notifee isn't available in Expo Go; ignore.
    });
}
