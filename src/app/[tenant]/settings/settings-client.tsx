"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { Button, ErrorText, Field, SuccessText } from "@/components/ui";
import { UNITS, type Unit } from "@/lib/units";
import { removeLogo, saveBusinessDetails, uploadLogo, type SettingsResult } from "./actions";

type ThemeOption = {
  id: string;
  name: string;
  description: string;
  background: string;
  surface: string;
  primary: string;
  accent: string;
  foreground: string;
};

const labelClass = "font-heading text-subtle text-xs font-semibold tracking-[0.15em] uppercase";

function Feedback({ result }: { result: SettingsResult | null }) {
  if (!result) return null;
  if (!result.ok) return <ErrorText>{result.error}</ErrorText>;
  return (
    <div className="space-y-1">
      <SuccessText>{result.message}</SuccessText>
      {result.warnings?.map((w) => (
        <p key={w} className="text-muted text-sm">
          {w}
        </p>
      ))}
    </div>
  );
}

export function BusinessDetailsForm({
  slug,
  initial,
  themes,
}: {
  slug: string;
  initial: { name: string; theme: string; defaultUnit: Unit };
  themes: ThemeOption[];
}) {
  const router = useRouter();
  const [name, setName] = useState(initial.name);
  const [theme, setTheme] = useState(initial.theme);
  const [defaultUnit, setDefaultUnit] = useState<Unit>(initial.defaultUnit);
  const [result, setResult] = useState<SettingsResult | null>(null);
  const [pending, start] = useTransition();

  return (
    <form
      className="flex flex-col gap-8"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const r = await saveBusinessDetails(slug, {
            name,
            theme: theme as never,
            defaultUnit,
          });
          setResult(r);
          if (r.ok) router.refresh();
        });
      }}
    >
      <Field
        label="Business name"
        name="name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        required
        maxLength={80}
        hint={`Your web address stays ptforge.app/${slug}.`}
      />

      <fieldset>
        <legend className={`${labelClass} mb-3`}>Theme</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          {themes.map((t) => (
            <label
              key={t.id}
              className={`block cursor-pointer border p-1 transition-colors ${
                theme === t.id ? "border-primary" : "border-border hover:border-subtle"
              }`}
            >
              <input
                type="radio"
                name="theme"
                value={t.id}
                checked={theme === t.id}
                onChange={() => setTheme(t.id)}
                className="sr-only"
              />
              {/* A tiny preview drawn in the theme's own colours. */}
              <div
                className="p-4"
                style={{ background: t.background, color: t.foreground }}
                aria-hidden
              >
                <div className="mb-3 flex gap-1.5">
                  <span className="h-2 w-10" style={{ background: t.primary }} />
                  <span className="h-2 w-6" style={{ background: t.accent }} />
                </div>
                <div className="p-3" style={{ background: t.surface }}>
                  <div className="mb-2 h-2 w-3/4 opacity-80" style={{ background: t.foreground }} />
                  <div className="h-2 w-1/2 opacity-40" style={{ background: t.foreground }} />
                </div>
              </div>
              <div className="px-3 py-2.5">
                <p className="font-heading text-sm font-semibold tracking-[0.12em] uppercase">
                  {t.name}
                  {theme === t.id && <span className="text-primary"> · Selected</span>}
                </p>
                <p className="text-muted text-sm">{t.description}</p>
              </div>
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className={`${labelClass} mb-1`}>Default weight unit for new clients</legend>
        <p className="text-muted mb-3 text-sm">
          Everyone can still switch between kg and lb themselves at any time.
        </p>
        <div className="flex gap-3">
          {UNITS.map((u) => (
            <label
              key={u}
              className={`font-heading cursor-pointer border px-5 py-2 text-sm font-semibold tracking-[0.15em] uppercase ${
                defaultUnit === u ? "border-primary text-primary" : "border-border text-subtle"
              }`}
            >
              <input
                type="radio"
                name="defaultUnit"
                value={u}
                checked={defaultUnit === u}
                onChange={() => setDefaultUnit(u)}
                className="sr-only"
              />
              {u}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="flex flex-wrap items-center gap-4">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save settings"}
        </Button>
        <Feedback result={result} />
      </div>
    </form>
  );
}

export function LogoForm({
  slug,
  name,
  logo,
}: {
  slug: string;
  name: string;
  logo: { header: string; icon: string; apple: string } | null;
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [result, setResult] = useState<SettingsResult | null>(null);
  const [pending, start] = useTransition();

  return (
    <div className="flex flex-col gap-6">
      {logo ? (
        <div className="flex flex-wrap items-end gap-8">
          <div>
            <p className={`${labelClass} mb-2`}>Header</p>
            <div className="border-border bg-background flex h-20 items-center border px-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={logo.header} alt={`${name} logo`} className="h-10 w-auto" />
            </div>
          </div>
          <div>
            <p className={`${labelClass} mb-2`}>Android</p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={logo.icon} alt="Android icon" className="size-20 rounded-full" />
          </div>
          <div>
            <p className={`${labelClass} mb-2`}>iPhone</p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={logo.apple} alt="iPhone icon" className="size-20 rounded-[22%]" />
          </div>
        </div>
      ) : (
        <p className="text-subtle">
          No logo yet, so your business name is shown instead. Upload one to use it at the top of
          the app and as the icon when clients add PTForge to their phone&apos;s home screen.
        </p>
      )}

      <form
        className="flex flex-wrap items-end gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          const data = new FormData(e.currentTarget);
          start(async () => {
            const r = await uploadLogo(slug, data);
            setResult(r);
            if (r.ok) {
              if (fileRef.current) fileRef.current.value = "";
              router.refresh();
            }
          });
        }}
      >
        <label className="flex flex-col gap-1.5 text-sm">
          <span className={labelClass}>{logo ? "Replace logo" : "Upload logo"}</span>
          <input
            ref={fileRef}
            type="file"
            name="logo"
            required
            accept="image/png,image/jpeg,image/webp,image/svg+xml"
            className="text-subtle file:border-border file:bg-surface file:text-foreground file:font-heading file:mr-3 file:border file:px-3 file:py-2 file:text-xs file:font-semibold file:tracking-[0.12em] file:uppercase"
          />
          <span className="text-muted text-xs">
            PNG, JPG, WebP or SVG, up to 4 MB. A square logo at least 1024 px wide looks best.
          </span>
        </label>
        <Button type="submit" disabled={pending}>
          {pending ? "Uploading…" : "Upload"}
        </Button>
        {logo && (
          <Button
            type="button"
            variant="secondary"
            disabled={pending}
            onClick={() => {
              if (!confirm("Remove the logo? Your business name will be shown instead.")) return;
              start(async () => {
                const r = await removeLogo(slug);
                setResult(r);
                if (r.ok) router.refresh();
              });
            }}
          >
            Remove
          </Button>
        )}
      </form>
      <Feedback result={result} />
    </div>
  );
}
