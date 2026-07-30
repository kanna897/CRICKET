"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Download, RefreshCw, Share, Smartphone, WifiOff, X } from "lucide-react";

type InstallPrompt = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };

export function PwaInstallBanner() {
  const [prompt, setPrompt] = useState<InstallPrompt | null>(null);
  const [online, setOnline] = useState(true);
  const [hidden, setHidden] = useState(true);
  const [installed, setInstalled] = useState(false);
  const [iosHelp, setIosHelp] = useState(false);
  const [updateWorker, setUpdateWorker] = useState<ServiceWorker | null>(null);

  useEffect(() => {
    const initialize = window.setTimeout(() => {
      setOnline(navigator.onLine);
      const standalone = window.matchMedia("(display-mode: standalone)").matches || Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
      setInstalled(standalone);
      setHidden(sessionStorage.getItem("crickpulse-install-dismissed") === "1");
    }, 0);

    const install = (event: Event) => { event.preventDefault(); setPrompt(event as InstallPrompt); setHidden(false); };
    const onInstalled = () => { setInstalled(true); setPrompt(null); setHidden(true); };
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("beforeinstallprompt", install);
    window.addEventListener("appinstalled", onInstalled);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);

    if ("serviceWorker" in navigator) {
      void navigator.serviceWorker.register("/sw.js").then((registration) => {
        if (registration.waiting) setUpdateWorker(registration.waiting);
        registration.addEventListener("updatefound", () => {
          const worker = registration.installing;
          worker?.addEventListener("statechange", () => {
            if (worker.state === "installed" && navigator.serviceWorker.controller) setUpdateWorker(worker);
          });
        });
      });
      let refreshing = false;
      navigator.serviceWorker.addEventListener("controllerchange", () => {
        if (refreshing) return;
        refreshing = true;
        window.location.reload();
      });
    }
    return () => {
      window.clearTimeout(initialize);
      window.removeEventListener("beforeinstallprompt", install);
      window.removeEventListener("appinstalled", onInstalled);
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  const dismiss = () => { setHidden(true); setIosHelp(false); sessionStorage.setItem("crickpulse-install-dismissed", "1"); };
  const install = async () => {
    if (prompt) { await prompt.prompt(); const choice = await prompt.userChoice; if (choice.outcome === "accepted") setHidden(true); return; }
    const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);
    if (isIos) setIosHelp(true);
  };
  if (!online) return <div role="status" className="pwa-status-toast"><WifiOff className="h-4 w-4" /><span><strong>Offline mode</strong><small>Saved public pages are available. Scoring events stay safely queued.</small></span></div>;
  if (updateWorker) return <div role="status" className="pwa-action-card"><span className="pwa-action-icon"><RefreshCw /></span><div><strong>CrickPulse update ready</strong><small>Refresh once to use the latest version.</small></div><button onClick={() => updateWorker.postMessage({ type: "SKIP_WAITING" })}>Update</button></div>;
  if (installed || hidden) return null;
  return <div className="pwa-action-card">
    <span className="pwa-action-icon"><Smartphone /></span>
    <div><strong>{iosHelp ? "Add CrickPulse to Home Screen" : "Install CrickPulse"}</strong><small>{iosHelp ? "Tap Share, then choose “Add to Home Screen”." : "Full-screen access, shortcuts and offline-ready public pages."}</small></div>
    {iosHelp ? <span className="pwa-share-hint"><Share /> Share</span> : <button onClick={() => void install()}><Download />Install</button>}
    <button className="pwa-dismiss" onClick={dismiss} aria-label="Dismiss install prompt"><X /></button>
  </div>;
}

export function PwaInstalledBadge() {
  const [standalone, setStandalone] = useState(false);
  useEffect(() => {
    const timer = window.setTimeout(() => setStandalone(window.matchMedia("(display-mode: standalone)").matches), 0);
    return () => window.clearTimeout(timer);
  }, []);
  return standalone ? <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-500"><CheckCircle2 className="h-4 w-4" />App mode</span> : null;
}
