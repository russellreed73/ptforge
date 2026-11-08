"use client";

import { useState, useTransition } from "react";
import { Button, ErrorText, Field, SuccessText, TextButton } from "@/components/ui";
import { ROLE_LABELS, validateRoleSet, type RoleKey } from "@/lib/roles";
import {
  cancelInvitationAction,
  inviteAction,
  removeMemberAction,
  resendInvitationAction,
  updateRolesAction,
  type ActionResult,
} from "./actions";

function RolePicker({
  allowed,
  value,
  onChange,
}: {
  allowed: readonly RoleKey[];
  value: RoleKey[];
  onChange: (roles: RoleKey[]) => void;
}) {
  return (
    <fieldset className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
      <legend className="font-heading text-subtle mb-2 text-xs font-semibold tracking-[0.15em] uppercase">
        Role
      </legend>
      {allowed.map((role) => (
        <label key={role} className="flex cursor-pointer items-center gap-2">
          <input
            type="checkbox"
            className="size-4 accent-[var(--primary)]"
            checked={value.includes(role)}
            onChange={(e) =>
              onChange(e.target.checked ? [...value, role] : value.filter((r) => r !== role))
            }
          />
          {ROLE_LABELS[role]}
        </label>
      ))}
    </fieldset>
  );
}

export function InviteForm({ slug, allowedRoles }: { slug: string; allowedRoles: RoleKey[] }) {
  const [email, setEmail] = useState("");
  const [roles, setRoles] = useState<RoleKey[]>(allowedRoles.length === 1 ? [...allowedRoles] : []);
  const [result, setResult] = useState<ActionResult | null>(null);
  const [pending, start] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const problem = validateRoleSet(roles);
    if (problem) return setResult({ ok: false, error: problem });
    start(async () => {
      const res = await inviteAction(slug, { email, roles });
      setResult(res);
      if (res.ok) {
        setEmail("");
        setRoles(allowedRoles.length === 1 ? [...allowedRoles] : []);
      }
    });
  }

  return (
    <form onSubmit={submit} className="border-border bg-surface flex flex-col gap-4 border p-5">
      <Field
        label="Email"
        type="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="name@example.com"
      />
      {allowedRoles.length > 1 ? (
        <RolePicker allowed={allowedRoles} value={roles} onChange={setRoles} />
      ) : (
        <p className="text-muted text-sm">
          They&apos;ll join as {ROLE_LABELS[allowedRoles[0]].toLowerCase()}.
        </p>
      )}
      {result?.ok === false && <ErrorText>{result.error}</ErrorText>}
      {result?.ok && <SuccessText>{result.message ?? null}</SuccessText>}
      <div>
        <Button type="submit" disabled={pending}>
          {pending ? "Sending…" : "Send invitation"}
        </Button>
      </div>
    </form>
  );
}

export function InvitationActions({
  slug,
  invitationId,
  canCancel,
}: {
  slug: string;
  invitationId: string;
  canCancel: boolean;
}) {
  const [pending, start] = useTransition();
  const [note, setNote] = useState<string | null>(null);
  const run = (fn: () => Promise<ActionResult>) =>
    start(async () => {
      const res = await fn();
      setNote(res.ok ? (res.message ?? null) : res.error);
    });
  return (
    <span className="inline-flex items-center gap-1">
      {note && <span className="text-muted text-xs">{note}</span>}
      <TextButton
        disabled={pending}
        onClick={() => run(() => resendInvitationAction(slug, invitationId))}
      >
        Resend
      </TextButton>
      {canCancel && (
        <TextButton
          disabled={pending}
          onClick={() => run(() => cancelInvitationAction(slug, invitationId))}
        >
          Cancel
        </TextButton>
      )}
    </span>
  );
}

export function MemberActions({
  slug,
  memberId,
  name,
  roles,
}: {
  slug: string;
  memberId: string;
  name: string;
  roles: RoleKey[];
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<RoleKey[]>(roles);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const save = () =>
    start(async () => {
      const res = await updateRolesAction(slug, memberId, draft);
      if (res.ok) setEditing(false);
      setError(res.ok ? null : res.error);
    });

  const remove = () => {
    if (
      !window.confirm(
        `Remove ${name} from this business? Their login stays, but they lose access here.`,
      )
    )
      return;
    start(async () => {
      const res = await removeMemberAction(slug, memberId);
      setError(res.ok ? null : res.error);
    });
  };

  if (editing) {
    return (
      <div className="flex flex-col items-end gap-2">
        <RolePicker
          allowed={Object.keys(ROLE_LABELS) as RoleKey[]}
          value={draft}
          onChange={setDraft}
        />
        {error && <ErrorText>{error}</ErrorText>}
        <span>
          <TextButton disabled={pending} onClick={save}>
            Save
          </TextButton>
          <TextButton
            disabled={pending}
            onClick={() => {
              setDraft(roles);
              setEditing(false);
              setError(null);
            }}
          >
            Cancel
          </TextButton>
        </span>
      </div>
    );
  }
  return (
    <span className="inline-flex flex-col items-end">
      <span>
        <TextButton disabled={pending} onClick={() => setEditing(true)}>
          Change role
        </TextButton>
        <TextButton disabled={pending} onClick={remove}>
          Remove
        </TextButton>
      </span>
      {error && <ErrorText>{error}</ErrorText>}
    </span>
  );
}
