import type { ThemePreference } from "../types";

const STORAGE_KEY = "color-scheme";

export function getStoredThemePreference(): ThemePreference {
  try {
    const val = localStorage.getItem(STORAGE_KEY);
    if (val === "light" || val === "dark") {
      return val;
    }
  } catch {
    // Ignore storage read failure
  }
  return "system";
}

export function getSystemTheme(): "light" | "dark" {
  if (typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches) {
    return "dark";
  }
  return "light";
}

export function applyThemePreference(pref: ThemePreference): void {
  try {
    if (pref === "system") {
      localStorage.removeItem(STORAGE_KEY);
    } else {
      localStorage.setItem(STORAGE_KEY, pref);
    }
  } catch {
    // Ignore storage write failure
  }

  const metaContent = pref === "system" ? "light dark" : pref;
  const meta = document.querySelector('meta[name="color-scheme"]');
  if (meta) {
    meta.setAttribute("content", metaContent);
  }

  const resolved = pref === "system" ? getSystemTheme() : pref;
  const themeColorMeta = document.querySelector('meta[name="theme-color"]');
  if (themeColorMeta) {
    themeColorMeta.setAttribute("content", resolved === "dark" ? "#090e1a" : "#002d6b");
  }
}
