import { useSyncExternalStore } from "react";
import { getLocale, subscribeLocale } from "./translations";

export const useLocale = () =>
  useSyncExternalStore(subscribeLocale, getLocale, getLocale);

