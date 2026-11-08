"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type ReactNode } from "react";
import {
  ApplicationFields,
  asApplicationInput,
  type ApplicationValues,
} from "@/components/clients/application-fields";
import {
  Button,
  ErrorText,
  Field,
  inputClass,
  SelectField,
  SuccessText,
  TextAreaField,
  TextButton,
} from "@/components/ui";
import { useUnit } from "@/components/unit";
import {
  CLIENT_STATUSES,
  cmToFeetInches,
  feetInchesToCm,
  POWERLIFTING_EXPERIENCE,
  STATUS_LABELS,
  type IntakeInput,
} from "@/lib/clients";
import { fromKg, parseWeight, type Unit } from "@/lib/units";
import {
  assignTrainer,
  inviteClientToApp,
  saveIntake,
  setClientArchived,
  setClientStatus,
  unassignTrainer,
  updateApplication,
  type ClientActionResult,
} from "../actions";

function useAction() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [result, setResult] = useState<ClientActionResult | null>(null);
  const run = (fn: () => Promise<ClientActionResult>, after?: () => void) =>
    start(async () => {
      const r = await fn();
      setResult(r);
      if (r.ok) {
        after?.();
        router.refresh();
      }
    });
  return { pending, result, run, setResult };
}

function Feedback({ result }: { result: ClientActionResult | null }) {
  if (!result) return null;
  return result.ok ? (
    <SuccessText>{result.message}</SuccessText>
  ) : (
    <ErrorText>{result.error}</ErrorText>
  );
}

/** Status, invite to app and archive, at the top of the profile. */
export function ClientActions({
  slug,
  clientId,
  status,
  archived,
  canArchive,
  invite,
}: {
  slug: string;
  clientId: string;
  status: string;
  archived: boolean;
  canArchive: boolean;
  invite: { email: string | null; pending: boolean } | null;
}) {
  const { pending, result, run } = useAction();
  return (
    <div className="flex max-w-md flex-col items-start gap-3 sm:items-end">
      <div className="flex flex-wrap items-center gap-3">
        {!archived && (
          <select
            aria-label="Status"
            value={status}
            disabled={pending}
            onChange={(e) => run(() => setClientStatus(slug, clientId, e.target.value))}
            className={`${inputClass} py-2 text-sm`}
          >
            {CLIENT_STATUSES.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABELS[s]}
              </option>
            ))}
          </select>
        )}
        {invite && !archived && (
          <Button
            variant={status === "lead" ? "secondary" : "primary"}
            disabled={pending || !invite.email}
            title={invite.email ? undefined : "Add their email address first"}
            onClick={() => run(() => inviteClientToApp(slug, clientId))}
          >
            {invite.pending ? "Resend app invite" : "Invite to app"}
          </Button>
        )}
        {canArchive && (
          <Button
            variant="secondary"
            disabled={pending}
            onClick={() => {
              if (!archived && !confirm("Archive this client? They'll be hidden from your lists."))
                return;
              run(() => setClientArchived(slug, clientId, !archived));
            }}
          >
            {archived ? "Restore" : "Archive"}
          </Button>
        )}
      </div>
      {invite && !invite.email && !archived && (
        <p className="text-muted text-xs">Add an email address to invite them to the app.</p>
      )}
      <Feedback result={result} />
    </div>
  );
}

/** Shows the answers; Edit switches to the form. */
export function ApplicationEditor({
  slug,
  clientId,
  initial,
  services,
  coaches,
  children,
}: {
  slug: string;
  clientId: string;
  initial: ApplicationValues;
  services: string[];
  coaches: { userId: string; name: string }[];
  children: ReactNode;
}) {
  const [editing, setEditing] = useState(false);
  const [values, setValues] = useState(initial);
  const { pending, result, run, setResult } = useAction();

  if (!editing) {
    return (
      <div>
        <div className="mb-4 flex items-center justify-between">
          <p className="font-heading text-sm font-semibold tracking-[0.15em] uppercase">
            Step 1 — Application
          </p>
          <TextButton
            onClick={() => {
              setValues(initial);
              setResult(null);
              setEditing(true);
            }}
          >
            Edit
          </TextButton>
        </div>
        <Feedback result={result} />
        {children}
      </div>
    );
  }
  return (
    <form
      className="flex flex-col gap-6"
      onSubmit={(e) => {
        e.preventDefault();
        run(
          () => updateApplication(slug, clientId, asApplicationInput(values)),
          () => setEditing(false),
        );
      }}
    >
      <ApplicationFields
        values={values}
        onChange={setValues}
        services={services}
        coaches={coaches}
        mode="coach"
      />
      <div className="flex flex-wrap items-center gap-4">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save"}
        </Button>
        <Button type="button" variant="secondary" onClick={() => setEditing(false)}>
          Cancel
        </Button>
        <Feedback result={result} />
      </div>
    </form>
  );
}

type IntakeInitial = {
  phone: string | null;
  dateOfBirth: string | null;
  [key: string]: unknown;
};

const KG_FIELDS = [
  "compSquatKg",
  "compBenchKg",
  "compDeadliftKg",
  "gymSquatKg",
  "gymBenchKg",
  "gymDeadliftKg",
] as const;
const TEXT_FIELDS = [
  "phone",
  "dateOfBirth",
  "exerciseHistory",
  "signupReason",
  "occupation",
  "sleep",
  "diet",
  "injuries",
  "powerliftingExperience",
  "otherInfo",
] as const;
const INT_FIELDS = [
  "stressLevel",
  "trainingDaysPerWeek",
  "weeklySetsSquat",
  "weeklySetsBench",
  "weeklySetsDeadlift",
  "weeklySetsVerticalPull",
  "weeklySetsCore",
] as const;

function shown(kg: unknown, unit: Unit) {
  if (typeof kg !== "number") return "";
  return String(Math.round(fromKg(kg, unit) * 10) / 10);
}

/** The detailed intake. Loads are typed in the coach's own units and saved as kg. */
export function IntakeEditor({
  slug,
  clientId,
  initial,
  updatedAt,
  children,
}: {
  slug: string;
  clientId: string;
  initial: IntakeInitial;
  updatedAt: string | null;
  children: ReactNode;
}) {
  const sbd = useUnit("sbd");
  const general = useUnit("general");
  const [editing, setEditing] = useState(false);
  const { pending, result, run, setResult } = useAction();

  const start = () => {
    const v: Record<string, string> = {};
    for (const k of TEXT_FIELDS) v[k] = (initial[k] as string | null) ?? "";
    for (const k of INT_FIELDS) v[k] = initial[k] == null ? "" : String(initial[k]);
    for (const k of KG_FIELDS) v[k] = shown(initial[k], sbd);
    v.bodyWeight = shown(initial.bodyWeightKg, general);
    const cm = typeof initial.heightCm === "number" ? initial.heightCm : null;
    v.heightCm = cm == null ? "" : String(cm);
    const fi = cm == null ? null : cmToFeetInches(cm);
    v.heightFt = fi ? String(fi.feet) : "";
    v.heightIn = fi ? String(fi.inches) : "";
    return v;
  };
  const [v, setV] = useState<Record<string, string>>(start);
  const bind = (k: string) => ({
    name: k,
    value: v[k] ?? "",
    onChange: (e: { target: { value: string } }) => setV({ ...v, [k]: e.target.value }),
  });

  if (!editing) {
    return (
      <div>
        <div className="mb-4 flex items-center justify-between gap-4">
          <div>
            <p className="font-heading text-sm font-semibold tracking-[0.15em] uppercase">
              Step 2 — Detailed intake
            </p>
            {updatedAt && <p className="text-muted text-xs">Last updated {updatedAt}</p>}
          </div>
          <TextButton
            onClick={() => {
              setV(start());
              setResult(null);
              setEditing(true);
            }}
          >
            {updatedAt ? "Edit" : "Fill in"}
          </TextButton>
        </div>
        <Feedback result={result} />
        {children}
      </div>
    );
  }

  const submit = () => {
    const weight = (key: string, unit: Unit, label: string): number | null | string => {
      const raw = v[key]?.trim();
      if (!raw) return null;
      const kg = parseWeight(raw, unit);
      return kg === null ? `${label}: enter a number.` : kg;
    };
    const out: Record<string, unknown> = {};
    for (const k of TEXT_FIELDS) out[k] = v[k];
    for (const k of INT_FIELDS) out[k] = v[k];
    const labels: Record<(typeof KG_FIELDS)[number], string> = {
      compSquatKg: "Competition squat",
      compBenchKg: "Competition bench",
      compDeadliftKg: "Competition deadlift",
      gymSquatKg: "Gym squat",
      gymBenchKg: "Gym bench",
      gymDeadliftKg: "Gym deadlift",
    };
    for (const k of KG_FIELDS) {
      const r = weight(k, sbd, labels[k]);
      if (typeof r === "string")
        return Promise.resolve<ClientActionResult>({ ok: false, error: r });
      out[k] = r;
    }
    const bw = weight("bodyWeight", general, "Body weight");
    if (typeof bw === "string")
      return Promise.resolve<ClientActionResult>({ ok: false, error: bw });
    out.bodyWeightKg = bw;
    if (general === "kg") {
      out.heightCm = v.heightCm.trim() ? Number(v.heightCm.replace(",", ".")) : null;
    } else {
      const ft = Number(v.heightFt || 0);
      const inch = Number((v.heightIn || "0").replace(",", "."));
      out.heightCm = v.heightFt.trim() || v.heightIn.trim() ? feetInchesToCm(ft, inch) : null;
    }
    if (typeof out.heightCm === "number" && Number.isNaN(out.heightCm))
      return Promise.resolve<ClientActionResult>({ ok: false, error: "Height: enter a number." });
    return saveIntake(slug, clientId, out as IntakeInput);
  };

  const num = { inputMode: "decimal" as const, className: "tabular-nums" };
  const scale = (n: number) => Array.from({ length: n }, (_, i) => String(i + 1));

  return (
    <form
      className="flex flex-col gap-8"
      onSubmit={(e) => {
        e.preventDefault();
        run(submit, () => setEditing(false));
      }}
    >
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Date of birth" type="date" {...bind("dateOfBirth")} />
        <Field label="Phone number" type="tel" maxLength={40} {...bind("phone")} />
        <TextAreaField
          className="sm:col-span-2"
          label="Exercise history (past 6 months)"
          maxLength={4000}
          {...bind("exerciseHistory")}
        />
        <TextAreaField
          className="sm:col-span-2"
          label="Why they decided to sign up / goals"
          maxLength={4000}
          {...bind("signupReason")}
        />
        {general === "kg" ? (
          <Field label="Height (cm)" {...num} {...bind("heightCm")} />
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <Field label="Height (ft)" {...num} inputMode="numeric" {...bind("heightFt")} />
            <Field label="(in)" {...num} {...bind("heightIn")} />
          </div>
        )}
        <Field label={`Body weight (${general})`} {...num} {...bind("bodyWeight")} />
        <TextAreaField
          className="sm:col-span-2"
          label="Occupation and typical daily/weekly schedule"
          maxLength={4000}
          {...bind("occupation")}
        />
        <SelectField label="Stress level (1–10)" options={scale(10)} {...bind("stressLevel")} />
        <SelectField
          label="Days per week they'd like to train (1–7)"
          options={scale(7)}
          {...bind("trainingDaysPerWeek")}
        />
        <TextAreaField label="Sleep" rows={2} maxLength={4000} {...bind("sleep")} />
        <TextAreaField label="Diet" rows={2} maxLength={4000} {...bind("diet")} />
        <TextAreaField
          className="sm:col-span-2"
          label="Injuries"
          maxLength={4000}
          {...bind("injuries")}
        />
      </div>

      <fieldset>
        <legend className="font-heading mb-3 text-sm font-semibold tracking-[0.15em] uppercase">
          Current 1RMs ({sbd})
        </legend>
        <div className="grid gap-5 sm:grid-cols-2">
          <div className="border-border flex flex-col gap-3 border p-4">
            <p className="font-heading text-muted text-xs font-semibold tracking-[0.15em] uppercase">
              Competition maxes
            </p>
            <Field label="Squat" {...num} {...bind("compSquatKg")} />
            <Field label="Bench" {...num} {...bind("compBenchKg")} />
            <Field label="Deadlift" {...num} {...bind("compDeadliftKg")} />
          </div>
          <div className="border-border flex flex-col gap-3 border p-4">
            <p className="font-heading text-muted text-xs font-semibold tracking-[0.15em] uppercase">
              Gym maxes
            </p>
            <Field label="Squat" {...num} {...bind("gymSquatKg")} />
            <Field label="Bench" {...num} {...bind("gymBenchKg")} />
            <Field label="Deadlift" {...num} {...bind("gymDeadliftKg")} />
          </div>
        </div>
      </fieldset>

      <fieldset>
        <legend className="font-heading mb-3 text-sm font-semibold tracking-[0.15em] uppercase">
          Weekly sets estimate
        </legend>
        <div className="grid grid-cols-2 gap-5 sm:grid-cols-5">
          <Field label="Squat" inputMode="numeric" {...bind("weeklySetsSquat")} />
          <Field label="Bench" inputMode="numeric" {...bind("weeklySetsBench")} />
          <Field label="Deadlift" inputMode="numeric" {...bind("weeklySetsDeadlift")} />
          <Field label="Vertical pull" inputMode="numeric" {...bind("weeklySetsVerticalPull")} />
          <Field label="Core" inputMode="numeric" {...bind("weeklySetsCore")} />
        </div>
      </fieldset>

      <div className="grid gap-5">
        <SelectField
          label="Powerlifting experience"
          options={POWERLIFTING_EXPERIENCE}
          {...bind("powerliftingExperience")}
        />
        <TextAreaField
          label="Other information / questions"
          maxLength={4000}
          {...bind("otherInfo")}
        />
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save intake"}
        </Button>
        <Button type="button" variant="secondary" onClick={() => setEditing(false)}>
          Cancel
        </Button>
        <Feedback result={result} />
      </div>
    </form>
  );
}

/** Who coaches this client. Administrators and managers can change it. */
export function TrainerManager({
  slug,
  clientId,
  trainers,
  coaches,
  canAssign,
  suggested,
}: {
  slug: string;
  clientId: string;
  trainers: { userId: string; name: string }[];
  coaches: { userId: string; name: string }[];
  canAssign: boolean;
  suggested: string | null;
}) {
  const { pending, result, run } = useAction();
  const available = coaches.filter((c) => !trainers.some((t) => t.userId === c.userId));
  const suggestion = suggested ? available.find((c) => c.userId === suggested) : undefined;
  const [pick, setPick] = useState("");

  return (
    <div className="flex flex-col gap-4">
      {trainers.length === 0 ? (
        <p className="text-muted text-sm">No trainer yet.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {trainers.map((t) => (
            <li key={t.userId} className="flex items-center justify-between gap-2">
              <span>{t.name}</span>
              {canAssign && (
                <TextButton
                  disabled={pending}
                  onClick={() => run(() => unassignTrainer(slug, clientId, t.userId))}
                >
                  Remove
                </TextButton>
              )}
            </li>
          ))}
        </ul>
      )}
      {canAssign && suggestion && (
        <Button
          variant="secondary"
          disabled={pending}
          onClick={() => run(() => assignTrainer(slug, clientId, suggestion.userId))}
        >
          Assign {suggestion.name.split(" ")[0]} (requested)
        </Button>
      )}
      {canAssign && available.length > 0 && (
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (pick)
              run(
                () => assignTrainer(slug, clientId, pick),
                () => setPick(""),
              );
          }}
        >
          <select
            aria-label="Trainer to assign"
            value={pick}
            onChange={(e) => setPick(e.target.value)}
            className={`${inputClass} min-w-0 flex-1 py-2 text-sm`}
          >
            <option value="">Add a trainer…</option>
            {available.map((c) => (
              <option key={c.userId} value={c.userId}>
                {c.name}
              </option>
            ))}
          </select>
          <Button type="submit" disabled={pending || !pick} className="px-4">
            Add
          </Button>
        </form>
      )}
      <Feedback result={result} />
    </div>
  );
}
