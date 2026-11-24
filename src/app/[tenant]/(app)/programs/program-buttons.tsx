"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button, ErrorText, inputClass, SuccessText, TextButton } from "@/components/ui";
import { createProgram, setProgramStatus, type ProgramActionResult } from "./actions";

export function NewTemplateButton({ slug }: { slug: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="mb-8 flex flex-col items-end gap-2">
      <Button
        disabled={pending}
        onClick={() =>
          start(async () => {
            const r = await createProgram(slug, { athleteProfileId: null, sourceId: null });
            if (!r.ok) return setError(r.error);
            router.push(`/${slug}/programs/${r.id}`);
          })
        }
      >
        New template
      </Button>
      <ErrorText>{error}</ErrorText>
    </div>
  );
}

/** "New block" on a client's Program tab: blank, from a template, or a copy of one of their blocks. */
export function NewBlockForm({
  slug,
  clientId,
  templates,
  previous,
}: {
  slug: string;
  clientId: string;
  templates: { id: string; name: string }[];
  previous: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [source, setSource] = useState("");
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <form
      className="flex flex-wrap items-end gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const r = await createProgram(slug, {
            athleteProfileId: clientId,
            sourceId: source || null,
          });
          if (!r.ok) return setError(r.error);
          router.push(`/${slug}/programs/${r.id}`);
        });
      }}
    >
      <label className="flex min-w-64 flex-1 flex-col gap-1.5 text-sm">
        <span className="font-heading text-subtle text-xs font-semibold tracking-[0.15em] uppercase">
          Start from
        </span>
        <select className={inputClass} value={source} onChange={(e) => setSource(e.target.value)}>
          <option value="">A blank block</option>
          {templates.length > 0 && (
            <optgroup label="Templates">
              {templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </optgroup>
          )}
          {previous.length > 0 && (
            <optgroup label="A copy of their block">
              {previous.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </optgroup>
          )}
        </select>
      </label>
      <Button type="submit" disabled={pending}>
        {pending ? "Creating…" : "New block"}
      </Button>
      <ErrorText>{error}</ErrorText>
    </form>
  );
}

/** Finish / archive / restore links on a block or template. */
export function ProgramStatusButtons({
  slug,
  id,
  status,
}: {
  slug: string;
  id: string;
  status: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [result, setResult] = useState<ProgramActionResult | null>(null);
  const run = (s: "draft" | "completed" | "archived") =>
    start(async () => {
      const r = await setProgramStatus(slug, id, s);
      setResult(r);
      if (r.ok) router.refresh();
    });
  return (
    <span className="flex flex-wrap items-center gap-1">
      {status === "active" && (
        <TextButton
          disabled={pending}
          onClick={() =>
            confirm("Mark this block finished? The client will no longer see it as current.") &&
            run("completed")
          }
        >
          Finish
        </TextButton>
      )}
      {status !== "archived" && status !== "active" && (
        <TextButton disabled={pending} onClick={() => run("archived")}>
          Archive
        </TextButton>
      )}
      {(status === "archived" || status === "completed") && (
        <TextButton disabled={pending} onClick={() => run("draft")}>
          Back to drafts
        </TextButton>
      )}
      {result && !result.ok && <ErrorText>{result.error}</ErrorText>}
      {result && result.ok && <SuccessText>{result.message}</SuccessText>}
    </span>
  );
}
