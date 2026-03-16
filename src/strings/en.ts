const en = {
  common: {
    ok: "OK",
    cancel: "Cancel",
    close: "Close",
    done: "Done",
    preparing: "Preparing…",
    unknown: "Unknown",
  },
  screens: {
    library: { title: "Library" },
    updates: { title: "Updates" },
    history: { title: "History" },
    extensions: { title: "Extensions" },
    downloadQueue: { title: "Download Queue", pausedTitle: "Queue (Paused)" },
    reader: { title: "Reader" },
    sources: { title: "Sources" },
    dataManagement: { title: "Data Management" },
    categories: { title: "Categories" },
    readerSettings: { title: "Reader Settings" },
    readerTheme: { title: "Reader Theme" },
    legacyBackup: { title: "Legacy Backup" },
    remoteBackup: { title: "Remote Backup" },
    trackingServices: { title: "Tracking Services" },
    ttsSettings: { title: "Text to Speech" },
  },
  epub: {
    importingTitle: "Importing EPUB",
    importCompleteTitle: "Import Complete",
    importAddedToLibrary: "\"{title}\" was added to your library.",
    exportTitle: "Exporting EPUB",
  },
  library: {
    actions: { open: "Open" },
    import: {
      failedTitle: "Import Failed",
      failedBody: "Could not import EPUB.",
    },
    update: {
      title: "Library updated",
      foundNew: "Found {count} new chapter(s).",
      viewUpdates: "View updates",
      noneFound: "No new chapters found.",
      nothingToUpdate: "Nothing to update.",
      errors: "Errors: {count}.",
    },
  },
  downloads: {
    title: "Downloads",
    noneToDownload: "No chapters to download.",
    queuedChapters: "Queued {count} chapter(s) for download.",
  },
  downloadQueue: {
    alerts: {
      cancelTitle: "Cancel download",
      cancelMessage: "Cancel this chapter or all downloads for this novel?",
      keep: "Keep",
      cancelChapter: "Cancel chapter",
      cancelNovel: "Cancel novel",
      clearTitle: "Clear completed",
      clearMessage: "Remove all completed downloads from the queue?",
      clear: "Clear",
    },
    summary: {
      active: "{count} active",
      queued: "{count} queued",
      failed: "{count} failed",
      done: "{count} done",
    },
    empty: {
      title: "No downloads",
      subtitle: "Downloaded chapters will appear here",
    },
  },
  categories: {
    delete: {
      title: "Delete category",
      body: "Remove \"{name}\" from your library? Novels in this category will become uncategorised.",
      action: "Delete",
    },
  },
  backup: {
    sectionTitle: "Backups",
    footer: "Backups are stored as JSON files.",
    shareTitle: "Share NovelNest backup",
    exportedTitle: "Backup Exported",
    savedTo: "Saved to:\n{uri}",
    exportFailedTitle: "Export Failed",
    exportFailedBody: "Could not export backup.",
    confirmImportTitle: "Confirm Import",
    confirmImportBodyReplace:
      "You are about to replace your library with this backup:\n\n{summary}\n\nProceed?",
    confirmImportBodyMerge:
      "You are about to merge your library with this backup:\n\n{summary}\n\nProceed?",
    actions: {
      merge: "Merge",
      replace: "Replace",
    },
    settingsNote:
      "Note: Settings from this backup have also been applied and will fully take effect after restarting the app.",
    importCompleteTitle: "Import Complete",
    importCompleteReplaced: "Your library database was replaced with the backup.",
    importCompleteMerged: "Backup was merged into your library database.",
    importFailedTitle: "Import Failed",
    importFailedBody: "Could not import backup.",
    importPickerFailedBody: "Could not open file picker.",
    importPickTitle: "Import Backup",
    importPickBody: "How do you want to import this backup?",
    export: {
      title: "Export backup",
      description: "Save your library, history, and settings to a JSON file",
    },
    import: {
      title: "Import backup",
      description: "Restore a previously exported JSON backup",
    },
  },
  extensions: {
    alerts: {
      invalidUrlTitle: "Invalid URL",
      invalidUrlBody: "Repository URL must start with http(s)://",
      removeRepoTitle: "Remove repository?",
      remove: "Remove",
      installedTitle: "Installed",
      installedBody:
        "Plugin metadata saved, but file download is not supported on this platform.",
      errorTitle: "Error",
      errorBody: "Failed to install/uninstall plugin.",
    },
    filters: {
      sortAz: "Sort: A-Z",
      sortZa: "Sort: Z-A",
      language: "Language",
      languageAny: "Language: Any",
      allLanguages: "All languages",
    },
  },
  history: {
    remove: {
      title: "Remove from History",
      body: "Remove \"{title}\" from your reading history?",
      action: "Remove",
    },
  },
  updates: {
    clear: {
      title: "Clear updates",
      body: "Remove all update entries?",
      action: "Clear",
    },
    download: {
      noneNew: "No new chapters to download.",
    },
    notFound: {
      title: "Not found",
      body: "This novel is no longer in your library.",
    },
    lastChecked: "Last checked: {date}",
  },
  reader: {
    errors: {
      novelNotFound: "Novel not found.",
      noSource: "This novel has no source and cannot be read.",
    },
  },
  settings: {
    title: "Settings",
    sections: {
      general: "General",
      appearance: "Appearance",
      reader: "Reader",
      tracking: "Tracking",
      backup: "Backup",
      advanced: "Advanced",
      about: "About",
    },
    general: {
      startScreen: "Start screen",
      language: "Language",
      downloadLocation: "Download location",
    },
    appearance: {
      title: "Appearance",
      themeMode: "Theme",
      themeSystem: "System",
      themeLight: "Light",
      themeDark: "Dark",
      appLanguage: "App language",
      appLanguageDefault: "Default",
    },
  },
} as const;

export default en;
