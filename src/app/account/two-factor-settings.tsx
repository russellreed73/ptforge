"use client";

import { useRouter } from "next/navigation";
import QRCode from "qrcode";
import { useState } from "react";
import { Button, ErrorText, Field, SuccessText } from "@/components/ui";
import { authClient } from "@/lib/auth-client";

type Stage =
  | { kind: "idle" }
  | { kind: "scan"; qr: string; secret: string; backupCodes: string[] }
  | { kind: "codes"; backupCodes: string[] };

/** Turn two-step login on or off, and manage backup codes. */
export function TwoFactorSettings({ enabled }: { enabled: boolean }) {
  const router = useRouter();
  const [stage, setStage] = useState<Stage>({ kind: "idle" });
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function run(fn: () => Promise<void>) {
    setError(null);
    setMessage(null);
    setPending(true);
    try {
      await fn();
    } finally {
      setPending(false);
    }
  }

  // 1. Password → secret + backup codes (not active until a code is confirmed)
  const start = (password: string) =>
    run(async () => {
      const { data, error } = await authClient.twoFactor.enable({ password });
      if (error || !data || data.method !== "totp") {
        return setError(error?.message ?? "Couldn't start setup. Check your password.");
      }
      const secret = new URL(data.totpURI).searchParams.get("secret") ?? "";
      const qr = await QRCode.toDataURL(data.totpURI, { margin: 1, width: 220 });
      setStage({ kind: "scan", qr, secret, backupCodes: data.backupCodes });
    });

  // 2. First code from the app → two-step login is on
  const confirm = (code: string) =>
    run(async () => {
      if (stage.kind !== "scan") return;
      const { error } = await authClient.twoFactor.verifyTotp({ code: code.replace(/\s+/g, "") });
      if (error) return setError("That code isn't right. Try the newest code in your app.");
      setStage({ kind: "codes", backupCodes: stage.backupCodes });
    });

  const disable = (password: string) =>
    run(async () => {
      const { error } = await authClient.twoFactor.disable({ password });
      if (error) return setError(error.message ?? "Couldn't turn it off. Check your password.");
      setMessage("Two-step login is off.");
      router.refresh();
    });

  const regenerate = (password: string) =>
    run(async () => {
      const { data, error } = await authClient.twoFactor.generateBackupCodes({ password });
      if (error || !data) return setError(error?.message ?? "Check your password.");
      setStage({ kind: "codes", backupCodes: data.backupCodes });
    });

  const heading = (
    <div className="mb-4">
      <h2 className="font-heading text-lg font-bold tracking-[0.12em] uppercase">
        Two-step login{" "}
        <span className={enabled ? "text-accent" : "text-muted"}>({enabled ? "on" : "off"})</span>
      </h2>
      <p className="text-subtle mt-1 text-sm">
        After your password, PTForge asks for a 6-digit code from an authenticator app (Google
        Authenticator, Microsoft Authenticator, 1Password…). Strongly recommended for coaches: you
        can see your clients&apos; health information.
      </p>
    </div>
  );

  if (stage.kind === "scan") {
    return (
      <div>
        {heading}
        <ol className="text-subtle mb-4 list-decimal space-y-1 pl-5 text-sm">
          <li>Open your authenticator app and add an account.</li>
          <li>Scan this code, or type the key below.</li>
          <li>Enter the 6-digit code the app shows.</li>
        </ol>
        <div className="mb-4 flex flex-wrap items-center gap-6">
          {/* eslint-disable-next-line @next/next/no-img-element -- generated data URL */}
          <img
            src={stage.qr}
            alt="QR code for your authenticator app"
            width={220}
            height={220}
            className="bg-white p-2"
          />
          <p className="text-subtle font-mono text-sm break-all">
            Key: <span className="text-foreground">{stage.secret}</span>
          </p>
        </div>
        <CodeForm
          label="6-digit code"
          button="Turn on"
          pending={pending}
          onSubmit={confirm}
          numeric
        />
        <ErrorText>{error}</ErrorText>
      </div>
    );
  }

  if (stage.kind === "codes") {
    const text = stage.backupCodes.join("\n");
    return (
      <div>
        {heading}
        <SuccessText>Two-step login is on.</SuccessText>
        <p className="text-subtle mt-3 text-sm">
          Save these backup codes somewhere safe (a password manager is ideal). Each one signs you
          in once if you lose your phone. They won&apos;t be shown again.
        </p>
        <pre className="border-border bg-background my-4 grid grid-cols-2 gap-2 border p-4 font-mono text-sm">
          {stage.backupCodes.map((c) => (
            <span key={c}>{c}</span>
          ))}
        </pre>
        <div className="flex flex-wrap gap-3">
          <Button
            variant="secondary"
            type="button"
            onClick={() => navigator.clipboard.writeText(text)}
          >
            Copy
          </Button>
          <Button
            variant="secondary"
            type="button"
            onClick={() => {
              const url = URL.createObjectURL(new Blob([text + "\n"], { type: "text/plain" }));
              const a = Object.assign(document.createElement("a"), {
                href: url,
                download: "ptforge-backup-codes.txt",
              });
              a.click();
              URL.revokeObjectURL(url);
            }}
          >
            Download
          </Button>
          <Button
            type="button"
            onClick={() => {
              setStage({ kind: "idle" });
              router.refresh();
            }}
          >
            I&apos;ve saved them
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div>
      {heading}
      {enabled ? (
        <div className="flex flex-col gap-6">
          <PasswordForm
            button="New backup codes"
            pending={pending}
            onSubmit={regenerate}
            variant="secondary"
          />
          <PasswordForm
            button="Turn off"
            pending={pending}
            onSubmit={disable}
            variant="secondary"
          />
        </div>
      ) : (
        <PasswordForm button="Set up" pending={pending} onSubmit={start} />
      )}
      <div className="mt-3">
        <ErrorText>{error}</ErrorText>
        <SuccessText>{message}</SuccessText>
      </div>
    </div>
  );
}

function PasswordForm({
  button,
  pending,
  onSubmit,
  variant = "primary",
}: {
  button: string;
  pending: boolean;
  onSubmit: (password: string) => void;
  variant?: "primary" | "secondary";
}) {
  return (
    <form
      className="flex flex-col gap-3 sm:flex-row sm:items-end"
      onSubmit={(e) => {
        e.preventDefault();
        const input = e.currentTarget.elements.namedItem("password") as HTMLInputElement;
        onSubmit(input.value);
        input.value = "";
      }}
    >
      <div className="flex-1">
        <Field
          label="Your password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
        />
      </div>
      <Button type="submit" variant={variant} disabled={pending}>
        {button}
      </Button>
    </form>
  );
}

function CodeForm({
  label,
  button,
  pending,
  onSubmit,
  numeric,
}: {
  label: string;
  button: string;
  pending: boolean;
  onSubmit: (code: string) => void;
  numeric?: boolean;
}) {
  return (
    <form
      className="flex flex-col gap-3 sm:flex-row sm:items-end"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit((e.currentTarget.elements.namedItem("code") as HTMLInputElement).value);
      }}
    >
      <div className="flex-1">
        <Field
          label={label}
          name="code"
          autoComplete="one-time-code"
          inputMode={numeric ? "numeric" : "text"}
          required
          autoFocus
        />
      </div>
      <Button type="submit" disabled={pending}>
        {button}
      </Button>
    </form>
  );
}
