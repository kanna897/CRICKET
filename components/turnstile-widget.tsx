"use client";

import Script from "next/script";
import { useCallback, useRef } from "react";

declare global {
  interface Window {
    turnstile?: {
      render: (element: HTMLElement, options: {
        sitekey: string;
        action: string;
        callback: (token: string) => void;
        "expired-callback": () => void;
        "error-callback": () => void;
      }) => string;
    };
  }
}

export function TurnstileWidget({ onToken }: { onToken: (token: string) => void }) {
  const container = useRef<HTMLDivElement>(null);
  const rendered = useRef(false);
  const sitekey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY
    ?? (process.env.NODE_ENV === "production" ? "" : "1x00000000000000000000AA");
  const render = useCallback(() => {
    if (!sitekey || rendered.current || !container.current || !window.turnstile) return;
    rendered.current = true;
    window.turnstile.render(container.current, {
      sitekey,
      action: "player_registration_upload",
      callback: onToken,
      "expired-callback": () => onToken(""),
      "error-callback": () => onToken(""),
    });
  }, [onToken, sitekey]);

  if (!sitekey) return <p role="alert" className="text-sm font-bold text-red-700">Secure upload CAPTCHA is not configured.</p>;
  return (
    <>
      <Script src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit" strategy="afterInteractive" onLoad={render} />
      <div ref={container} aria-label="Security verification" />
    </>
  );
}
