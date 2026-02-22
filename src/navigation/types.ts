// src/navigation/types.ts
import { NavigatorScreenParams } from "@react-navigation/native";

export type RootStackParamList = {
  Main: NavigatorScreenParams<MainDrawerParamList>;
  NovelDetail: { novelId: string };
  SourceDetail: { sourceId: string; sourceName: string };
  WebView: { url: string };
  Reader: { novelId: string; chapterId: string };
  Settings: undefined;
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
