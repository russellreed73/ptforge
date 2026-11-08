"use client";

import Script from "next/script";
import { useEffect, useRef, useState, useTransition } from "react";
import {
  ApplicationFields,
  asApplicationInput,
  EMPTY_APPLICATION,
  type ApplicationValues,
} from "@/components/clients/application-fields";
import { Button, ErrorText } from "@/components/ui";
import type { OptionalApplyQuestion } from "@/lib/clients";
import { applyAction } from "@/server/clients/apply-action";

declare global {
  interface Window {
    turnstile?: {
      render: (el: HTMLElement, opts: Record<string, unknown>) => string;
      reset: (id?: string) => void;
    };
  }
}

const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

/** The public "Step 1 - Apply" form. */
export function ApplyForm({
  slug,
  businessName,
  services,
  coaches,
  hidden,
  embedded = false,
}: {
  slug: string;
  businessName: string;
  services: string[];
  coaches: { userId: string; name: string }[];
  hidden: OptionalApplyQuestion[];
  embedded?: boolean;
}) {
  const [values, setValues] = useState<ApplicationValues>(EMPTY_APPLICATION);
  const [honeypot, setHoneypot] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [pending, start] = useTransition();
  const [startedAt] = useState(() => Date.now());
  const token = useRef<string | null>(null);
  const widget = useRef<HTMLDivElement>(null);
  const widgetId = useRef<string | undefined>(undefined);

  const renderTurnstile = () => {
    if (!SITE_KEY || !widget.current || !window.turnstile || widgetId.current) return;
    widgetId.current = window.turnstile.render(widget.current, {
      sitekey: SITE_KEY,
      callback: (t: string) => (token.current = t),
      "expired-callback": () => (token.current = null),
    });
  };
  useEffect(renderTurnstile, []);

  // In an iframe, tell the parent page how tall the form is (see the embed snippet in Settings).
  useEffect(() => {
    if (!embedded || window.parent === window) return;
    const post = () =>
      window.parent.postMessage(
        { type: "ptforge:height", height: document.documentElement.scrollHeight },
        "*",
      );
    post();
    const ro = new ResizeObserver(post);
    ro.observe(document.body);
    return () => ro.disconnect();
  }, [embedded, done]);

  if (done) {
    return (
      <div role="status" className="flex flex-col gap-3 py-6">
        <p className="display text-4xl">Thanks, {values.firstName || "you're in"}!</p>
        <p className="text-subtle">
          Your application is with {businessName}. A coach will be in touch soon to set up a call.
        </p>
      </div>
    );
  }

  return (
    <form
      className="flex flex-col gap-8"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        start(async () => {
          const r = await applyAction(slug, asApplicationInput(values), {
            turnstileToken: token.current,
            honeypot,
            elapsedMs: Date.now() - startedAt,
          });
          if (r.ok) {
            setDone(true);
            if (!embedded) window.scrollTo({ top: 0, behavior: "smooth" });
          } else {
            setError(r.error);
            window.turnstile?.reset(widgetId.current);
            token.current = null;
          }
        });
      }}
    >
      {SITE_KEY && (
        <Script
          src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
          strategy="afterInteractive"
          onLoad={renderTurnstile}
        />
      )}
      <ApplicationFields
        values={values}
        onChange={setValues}
        services={services}
        coaches={coaches}
        mode="public"
        hidden={hidden}
      />
      {/* Hidden from people; bots that fill every field are ignored. */}
      <div aria-hidden className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
        <label>
          Website
          <input
            name="website"
            tabIndex={-1}
            autoComplete="off"
            value={honeypot}
            onChange={(e) => setHoneypot(e.target.value)}
          />
        </label>
      </div>
      {SITE_KEY && <div ref={widget} />}
      <div className="flex flex-col gap-3">
        <p className="text-muted text-xs">
          By applying, you agree that {businessName} can store your answers and contact you about
          coaching. Fields marked <span className="text-primary">*</span> are required.
        </p>
        <div className="flex flex-wrap items-center gap-4">
          <Button type="submit" disabled={pending}>
            {pending ? "Sending…" : "Apply"}
          </Button>
          <ErrorText>{error}</ErrorText>
        </div>
      </div>
    </form>
  );
}
