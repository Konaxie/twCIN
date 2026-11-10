import { useCallback, useEffect, useState } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

export interface PwaInstallState {
  canInstall: boolean;
  isInstalled: boolean;
  isSecureContext: boolean;
  hasServiceWorkerSupport: boolean;
  swActive: boolean;
  isIos: boolean;
  triggerInstall: () => Promise<"accepted" | "dismissed" | "unavailable">;
}

function detectStandalone(): boolean {
  if (typeof window === "undefined") return false;
  const nav = window.navigator as Navigator & { standalone?: boolean };
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    nav.standalone === true
  );
}

function detectIos(): boolean {
  if (typeof window === "undefined") return false;
  return /iphone|ipad|ipod/i.test(window.navigator.userAgent);
}

export function usePwaInstall(): PwaInstallState {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState<boolean>(() => detectStandalone());
  const [swActive, setSwActive] = useState<boolean>(false);

  const isSecureContext = typeof window !== "undefined" ? window.isSecureContext : false;
  const hasServiceWorkerSupport =
    typeof navigator !== "undefined" && "serviceWorker" in navigator;
  const isIos = detectIos();

  useEffect(() => {
    const onBeforeInstall = (event: Event) => {
      // Prevent unsolicited browser mini-infobar/popup; allow manual install from Settings
      event.preventDefault();
      setDeferredPrompt(event as BeforeInstallPromptEvent);
    };

    const onInstalled = () => {
      setDeferredPrompt(null);
      setIsInstalled(true);
    };

    const mediaQuery = window.matchMedia("(display-mode: standalone)");
    const onDisplayChange = () => {
      setIsInstalled(detectStandalone());
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onInstalled);
    mediaQuery.addEventListener("change", onDisplayChange);

    if (hasServiceWorkerSupport) {
      navigator.serviceWorker
        .getRegistration()
        .then((reg) => {
          if (reg) {
            setSwActive(Boolean(reg.active || reg.installing || reg.waiting));
          }
        })
        .catch(() => {
          // Ignore when insecure or blocked
        });
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
      mediaQuery.removeEventListener("change", onDisplayChange);
    };
  }, [hasServiceWorkerSupport]);

  const triggerInstall = useCallback(async (): Promise<
    "accepted" | "dismissed" | "unavailable"
  > => {
    if (!deferredPrompt) return "unavailable";
    await deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;
    if (choice.outcome === "accepted") {
      setDeferredPrompt(null);
    }
    return choice.outcome;
  }, [deferredPrompt]);

  return {
    canInstall: Boolean(deferredPrompt),
    isInstalled,
    isSecureContext,
    hasServiceWorkerSupport,
    swActive,
    isIos,
    triggerInstall
  };
}
