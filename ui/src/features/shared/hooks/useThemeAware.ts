/**
 * Theme-aware utilities for Radix primitives
 * Works with existing ThemeContext
 */

import { useTheme } from "../../../contexts/ThemeContext";

export function useThemeAware() {
  const { theme, setTheme } = useTheme();
  const isDark = theme === "dark";
  const isLight = theme === "light";

  // Get theme-specific values
  const getThemeValue = <T>(lightValue: T, darkValue: T): T => {
    return isDark ? darkValue : lightValue;
  };

  const glowColors = {
    cyan: "transparent",
    blue: "transparent",
    purple: "transparent",
  };

  const blurIntensity = "";

  return {
    theme,
    setTheme,
    isDark,
    isLight,
    getThemeValue,
    glowColors,
    blurIntensity,
  };
}

// Theme-aware style presets for consistent look
export const themeStyles = {
  // Card styles that adapt to theme
  card: {
    light: "bg-card border-border",
    dark: "bg-card border-border",
    both: "bg-card border border-border",
  },

  // Panel styles (dropdowns, modals, etc.)
  panel: {
    light: "bg-popover border-border",
    dark: "bg-popover border-border",
    both: "bg-popover border border-border",
  },

  // Text colors
  text: {
    primary: "text-foreground",
    secondary: "text-muted-foreground",
    muted: "text-muted-foreground",
  },

  // Glow effects for Tron aesthetic
  glow: {
    cyan: "",
    blue: "",
    purple: "",
  },
};
