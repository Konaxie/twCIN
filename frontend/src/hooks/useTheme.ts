import { useEffect, useState } from "react";
import { applyThemePreference, getStoredThemePreference, getSystemTheme } from "../theme/theme";
import type { ThemePreference } from "../types";

export function useTheme() {
  const [preference, setPreferenceState] = useState<ThemePreference>(() => getStoredThemePreference());
  const [systemTheme, setSystemTheme] = useState<"light" | "dark">(() => getSystemTheme());

  useEffect(() => {
    applyThemePreference(preference);
  }, [preference]);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handleMediaChange = () => {
      const nextSystem = mq.matches ? "dark" : "light";
      setSystemTheme(nextSystem);
      if (getStoredThemePreference() === "system") {
        applyThemePreference("system");
      }
    };
    const handleStorage = (e: StorageEvent) => {
      if (e.key === "color-scheme") {
        setPreferenceState(getStoredThemePreference());
      }
    };

    mq.addEventListener("change", handleMediaChange);
    window.addEventListener("storage", handleStorage);
    return () => {
      mq.removeEventListener("change", handleMediaChange);
      window.removeEventListener("storage", handleStorage);
    };
  }, []);

  const setPreference = (next: ThemePreference) => {
    setPreferenceState(next);
    applyThemePreference(next);
  };

  return { preference, systemTheme, setPreference };
}
