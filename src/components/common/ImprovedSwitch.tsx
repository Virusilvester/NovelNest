// src/components/common/ImprovedSwitch.tsx
import React, { useState, useRef, useEffect, useCallback } from "react";
import { Switch, View } from "react-native";
import { useTheme } from "../../context/ThemeContext";

interface ImprovedSwitchProps {
  value: boolean;
  onValueChange: (value: boolean) => void;
  disabled?: boolean;
}

export const ImprovedSwitch: React.FC<ImprovedSwitchProps> = ({
  value,
  onValueChange,
  disabled = false,
}) => {
  const { theme } = useTheme();
  const [localValue, setLocalValue] = useState(value);
  const timeoutRef = useRef<number | null>(null);

  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  const handleValueChange = useCallback((newValue: boolean) => {
    if (disabled) return;
    
    // Clear any pending timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    
    // Update local state immediately for responsive UI
    setLocalValue(newValue);
    
    // Debounce the onChange call to prevent rapid toggling
    timeoutRef.current = setTimeout(() => {
      onValueChange(newValue);
    }, 100);
  }, [onValueChange, disabled]);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return (
    <View>
      <Switch
        value={localValue}
        onValueChange={handleValueChange}
        disabled={disabled}
        trackColor={{
          false: disabled ? theme.colors.border + "80" : theme.colors.border,
          true: disabled ? theme.colors.primary + "80" : theme.colors.primary,
        }}
        thumbColor={localValue ? "#FFF" : "#f4f3f4"}
        ios_backgroundColor={disabled ? theme.colors.border + "80" : theme.colors.border}
      />
    </View>
  );
};
