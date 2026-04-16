// src/navigation/types.ts
import { NavigatorScreenParams } from "@react-navigation/native";

export type RootStackParamList = {
  Main: NavigatorScreenParams<MainDrawerParamList>;
  NovelDetail: { novelId: string };
  SourceDetail: { sourceId?: string; sourceName?: string; genre?: string };
  WebView: { url: string };
  Reader: { novelId: string; chapterId: string };
  PluginNovelDetail: {
    pluginId: string;
    novelPath: string;
    novelName?: string;
    coverUrl?: string;
  };
  PluginReader: {
    pluginId: string;
    novelId?: string;
    novelPath?: string;
    chapterPath: string;
    chapterTitle?: string;
  };
  Settings: undefined;
  SettingsGeneral: undefined;
  SettingsReader: undefined;
  SettingsTracking: undefined;
  SettingsBackup: undefined;
  SettingsAdvanced: undefined;
  SettingsAbout: undefined;
  Appearance: undefined;
  EditCategories: undefined;
  ReaderSettings: undefined;
  ReaderTheme: undefined;
  TTSSettings: undefined;
  TrackingServices: undefined;
  RemoteBackup: undefined;
  LegacyBackup: undefined;
  DataManagement: undefined;
  DownloadQueue: undefined;
};

export type MainDrawerParamList = {
  Library: undefined;
  Updates: undefined;
  History: undefined;
  Sources: undefined;
  Extensions: undefined;
  DownloadQueue: undefined;
  Settings: undefined;
};
