/* eslint-disable @typescript-eslint/no-empty-object-type */
import type { RootStackParamList } from "../navigation/types";

declare global {
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}

export {};
