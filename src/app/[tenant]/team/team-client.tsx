"use client";

import { useState, useTransition } from "react";
import { Button, ErrorText, Field } from "@/components/ui";
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
    <fieldset className="flex flex-wrap gap-4 text-sm">
      <legend className="mb-1 font-medium">Role</legend>
      {allowed.map((role) => (
        <label key={role} className="flex items-center gap-2">
          <input
            type="checkbox"
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
    <form
      onSubmit={submit}
      className="flex flex-col gap-4 rounded-md border border-slate-200 p-4 dark:border-slate-800"
    >
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
        <p className="text-sm text-slate-500">
          They&apos;ll join as {ROLE_LABELS[allowedRoles[0]].toLowerCase()}.
        </p>
      )}
      {result?.ok === false && <ErrorText>{result.error}</ErrorText>}
      {result?.ok && result.message && (
        <p role="status" className="text-sm text-green-700 dark:text-green-400">
          {result.message}
        </p>
      )}
      <div>
        <Button type="submit" disabled={pending}>
          {pending ? "Sending…" : "Send invitation"}
        </Button>
      </div>
    </form>
  );
}

function SmallButton(props: React.ComponentProps<"button">) {
  return (
    <button
      className="rounded px-2 py-1 text-sm underline-offset-2 hover:underline disabled:opacity-50"
      {...props}
    />
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
      {note && <span className="text-xs text-slate-500">{note}</span>}
      <SmallButton
        disabled={pending}
        onClick={() => run(() => resendInvitationAction(slug, invitationId))}
      >
        Resend
      </SmallButton>
      {canCancel && (
        <SmallButton
          disabled={pending}
          onClick={() => run(() => cancelInvitationAction(slug, invitationId))}
        >
          Cancel
        </SmallButton>
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
          <SmallButton disabled={pending} onClick={save}>
            Save
          </SmallButton>
          <SmallButton
            disabled={pending}
            onClick={() => {
              setDraft(roles);
              setEditing(false);
              setError(null);
            }}
          >
            Cancel
          </SmallButton>
        </span>
      </div>
    );
  }
  return (
    <span className="inline-flex flex-col items-end">
      <span>
        <SmallButton disabled={pending} onClick={() => setEditing(true)}>
          Change role
        </SmallButton>
        <SmallButton disabled={pending} onClick={remove}>
          Remove
        </SmallButton>
      </span>
      {error && <ErrorText>{error}</ErrorText>}
    </span>
  );
}
