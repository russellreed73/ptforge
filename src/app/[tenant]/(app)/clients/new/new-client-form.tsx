"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  ApplicationFields,
  asApplicationInput,
  EMPTY_APPLICATION,
  type ApplicationValues,
} from "@/components/clients/application-fields";
import { Button, ErrorText, SelectField } from "@/components/ui";
import { CLIENT_STATUSES, STATUS_LABELS } from "@/lib/clients";
import { createClient } from "../actions";

export function NewClientForm({
  slug,
  services,
  coaches,
  canAssign,
  defaultTrainer,
}: {
  slug: string;
  services: string[];
  coaches: { userId: string; name: string }[];
  canAssign: boolean;
  defaultTrainer: string;
}) {
  const router = useRouter();
  const [values, setValues] = useState<ApplicationValues>(EMPTY_APPLICATION);
  const [status, setStatus] = useState("active");
  const [trainer, setTrainer] = useState(defaultTrainer);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  return (
    <form
      className="flex flex-col gap-8"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        start(async () => {
          const r = await createClient(slug, {
            application: asApplicationInput(values),
            status,
            trainerUserId: canAssign ? trainer : undefined,
          });
          if (!r.ok) return setError(r.error);
          router.push(`/${slug}/clients/${r.id}`);
        });
      }}
    >
      <div className="grid gap-5 sm:grid-cols-2">
        <SelectField
          label="Status"
          placeholder={null}
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          options={CLIENT_STATUSES.map((s) => ({ value: s, label: STATUS_LABELS[s] }))}
        />
        {canAssign && (
          <SelectField
            label="Trainer"
            placeholder="No trainer yet"
            value={trainer}
            onChange={(e) => setTrainer(e.target.value)}
            options={coaches.map((c) => ({ value: c.userId, label: c.name }))}
          />
        )}
      </div>
      <ApplicationFields
        values={values}
        onChange={setValues}
        services={services}
        coaches={coaches}
        mode="coach"
      />
      <div className="flex flex-wrap items-center gap-4">
        <Button type="submit" disabled={pending}>
          {pending ? "Adding…" : "Add client"}
        </Button>
        <ErrorText>{error}</ErrorText>
      </div>
    </form>
  );
}
