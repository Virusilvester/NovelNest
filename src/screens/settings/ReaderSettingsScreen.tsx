// src/screens/settings/ReaderSettingsScreen.tsx
import { useNavigation } from "@react-navigation/native";
import React from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { Header } from "../../components/common/Header";
import { ImprovedSwitch } from "../../components/common/ImprovedSwitch";
import { useSettings } from "../../context/SettingsContext";
import { useTheme } from "../../context/ThemeContext";

interface SettingsItemProps {
  title: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
}

const SettingsItem: React.FC<SettingsItemProps> = ({
  title,
  value,
  onValueChange,
}) => {
  const { theme } = useTheme();
  return (
    <View style={[styles.item, { borderBottomColor: theme.colors.divider }]}>
      <Text style={[styles.itemTitle, { color: theme.colors.text }]}>
        {title}
      </Text>
      <ImprovedSwitch
        value={value}
        onValueChange={onValueChange}
      />
    </View>
  );
};

export const ReaderSettingsScreen: React.FC = () => {
  const navigation = useNavigation();
  const { theme } = useTheme();
  const { settings, updateReaderSettings } = useSettings();

  return (
    <View
      style={[styles.container, { backgroundColor: theme.colors.background }]}
    >
      <Header title="Reader Settings" onBackPress={() => navigation.goBack()} />

      <ScrollView style={styles.content}>
        <View
          style={[styles.section, { backgroundColor: theme.colors.surface }]}
        >
          <Text
            style={[styles.sectionTitle, { color: theme.colors.textSecondary }]}
          >
            General
          </Text>
          <SettingsItem
            title="Keep screen on"
            value={settings.reader.general.keepScreenOn}
            onValueChange={(v) =>
              updateReaderSettings("general", "keepScreenOn", v)
            }
          />
          <SettingsItem
            title="Volume buttons scroll"
            value={settings.reader.general.volumeButtonsScroll}
            onValueChange={(v) =>
              updateReaderSettings("general", "volumeButtonsScroll", v)
            }
          />
          <SettingsItem
            title="Swipe left or right to navigate"
            value={settings.reader.general.swipeToNavigate}
            onValueChange={(v) =>
              updateReaderSettings("general", "swipeToNavigate", v)
            }
          />
          <SettingsItem
            title="Tap to scroll"
            value={settings.reader.general.tapToScroll}
            onValueChange={(v) =>
              updateReaderSettings("general", "tapToScroll", v)
            }
          />
          <SettingsItem
            title="AutoScroll"
            value={settings.reader.general.autoScroll}
            onValueChange={(v) =>
              updateReaderSettings("general", "autoScroll", v)
            }
          />
        </View>

        <View
          style={[styles.section, { backgroundColor: theme.colors.surface }]}
        >
          <Text
            style={[styles.sectionTitle, { color: theme.colors.textSecondary }]}
          >
            Display
          </Text>
          <SettingsItem
            title="Fullscreen"
            value={settings.reader.display.fullscreen}
            onValueChange={(v) =>
              updateReaderSettings("display", "fullscreen", v)
            }
          />
          <SettingsItem
            title="Show progress percentage"
            value={settings.reader.display.showProgressPercentage}
            onValueChange={(v) =>
              updateReaderSettings("display", "showProgressPercentage", v)
            }
          />
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  section: {
    borderRadius: 8,
    marginBottom: 16,
    overflow: "hidden",
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: "600",
    textTransform: "uppercase",
    padding: 16,
    paddingBottom: 8,
  },
  item: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
    borderBottomWidth: 1,
  },
  itemTitle: {
    fontSize: 16,
  },
});
