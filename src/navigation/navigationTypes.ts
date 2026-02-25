import type { DrawerNavigationProp } from "@react-navigation/drawer";
import type { CompositeNavigationProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { MainDrawerParamList, RootStackParamList } from "./types";

export type RootStackNavigationProp =
  NativeStackNavigationProp<RootStackParamList>;

export type MainDrawerNavigationProp = CompositeNavigationProp<
  DrawerNavigationProp<MainDrawerParamList>,
  RootStackNavigationProp
>;

