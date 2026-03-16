type VoidFn = () => void;

let cancelUpdatesCheck: VoidFn | null = null;
let toggleDownloadsPaused: VoidFn | null = null;

export const BackgroundTaskControls = {
  registerCancelUpdatesCheck(fn: VoidFn | null) {
    cancelUpdatesCheck = fn;
  },
  registerToggleDownloadsPaused(fn: VoidFn | null) {
    toggleDownloadsPaused = fn;
  },
  cancelUpdatesCheck() {
    try {
      cancelUpdatesCheck?.();
    } catch (e) {
      console.warn("Failed to cancel updates check:", e);
    }
  },
  toggleDownloadsPaused() {
    try {
      toggleDownloadsPaused?.();
    } catch (e) {
      console.warn("Failed to toggle downloads pause:", e);
    }
  },
};

