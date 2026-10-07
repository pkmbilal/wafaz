"use client";

import { useEffect, useImperativeHandle, useRef, type Ref } from "react";
import Script from "next/script";
import { publicEnv } from "@/lib/env";

// Cloudflare Turnstile, loaded from Cloudflare's script (no npm dependency).
// Tokens are single-use: call reset() after each Supabase request that consumed one.

type TurnstileApi = {
  render: (el: HTMLElement, options: Record<string, unknown>) => string;
  reset: (widgetId: string) => void;
  remove: (widgetId: string) => void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

export type TurnstileHandle = { reset: () => void };

const SCRIPT_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

export function Turnstile({
  onToken,
  ref,
  action,
}: {
  onToken: (token: string | null) => void;
  ref?: Ref<TurnstileHandle>;
  action?: string;
}) {
  const container = useRef<HTMLDivElement>(null);
  const widgetId = useRef<string | null>(null);
  const onTokenRef = useRef(onToken);

  useEffect(() => {
    onTokenRef.current = onToken;
  }, [onToken]);

  function renderWidget() {
    const el = container.current;
    if (!el || !window.turnstile || widgetId.current) return;
    widgetId.current = window.turnstile.render(el, {
      sitekey: publicEnv.NEXT_PUBLIC_TURNSTILE_SITE_KEY,
      action,
      appearance: "interaction-only",
      callback: (token: string) => onTokenRef.current(token),
      "expired-callback": () => onTokenRef.current(null),
      "error-callback": () => onTokenRef.current(null),
    });
  }

  useEffect(() => {
    renderWidget();
    return () => {
      if (widgetId.current) window.turnstile?.remove(widgetId.current);
      widgetId.current = null;
    };
    // renderWidget only reads refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useImperativeHandle(ref, () => ({
    reset() {
      onTokenRef.current(null);
      if (widgetId.current) window.turnstile?.reset(widgetId.current);
    },
  }));

  return (
    <>
      <Script src={SCRIPT_SRC} strategy="afterInteractive" onReady={renderWidget} />
      {/* Zero height unless Cloudflare needs an interactive challenge. */}
      <div ref={container} className="[&_iframe]:mb-4" />
    </>
  );
}
