"use client";

import { Field, SelectField, TextAreaField } from "@/components/ui";
import {
  SEX_LABELS,
  SEXES,
  type ApplicationInput,
  type OptionalApplyQuestion,
} from "@/lib/clients";

export type ApplicationValues = Required<{
  [K in keyof ApplicationInput]: string;
}>;

/** Form strings → the action's input (the server validates every field). */
export const asApplicationInput = (v: ApplicationValues) => v as unknown as ApplicationInput;

export const EMPTY_APPLICATION: ApplicationValues = {
  firstName: "",
  lastName: "",
  email: "",
  pronouns: "",
  sex: "",
  country: "",
  region: "",
  city: "",
  instagram: "",
  serviceType: "",
  coachPreference: "",
  coachQualities: "",
  goals: "",
  heardAbout: "",
  funFact: "",
};

/**
 * The "Step 1 - Apply" questions, worded as in Jacob's prototype. Used by the
 * public Apply form (mode "public": everything shown is required except
 * Instagram) and by coaches adding or editing a client (mode "coach": only
 * the name is required).
 */
export function ApplicationFields({
  values,
  onChange,
  services,
  coaches,
  mode,
  hidden = [],
}: {
  values: ApplicationValues;
  onChange: (next: ApplicationValues) => void;
  services: string[];
  coaches: { userId: string; name: string }[];
  mode: "public" | "coach";
  hidden?: readonly OptionalApplyQuestion[];
}) {
  const pub = mode === "public";
  const shown = (q: OptionalApplyQuestion) => !pub || !hidden.includes(q);
  const bind = (key: keyof ApplicationValues) => ({
    name: key,
    value: values[key],
    onChange: (e: { target: { value: string } }) => onChange({ ...values, [key]: e.target.value }),
  });
  const you = (publicText: string, coachText: string) => (pub ? publicText : coachText);
  // Services kept from before a rename still show on the client.
  const serviceOptions =
    values.serviceType && !services.includes(values.serviceType)
      ? [...services, values.serviceType]
      : services;
  const askCoach = coaches.length > 1 || !pub;

  return (
    <div className="grid gap-5 sm:grid-cols-2">
      <Field
        label="First name"
        required
        autoComplete={pub ? "given-name" : "off"}
        maxLength={60}
        {...bind("firstName")}
      />
      <Field
        label="Last name"
        required
        autoComplete={pub ? "family-name" : "off"}
        maxLength={60}
        {...bind("lastName")}
      />
      {shown("pronouns") && (
        <Field
          label="Pronouns"
          required={pub}
          placeholder="e.g. she / her"
          maxLength={40}
          {...bind("pronouns")}
        />
      )}
      {shown("sex") && (
        <SelectField
          label="Sex"
          required={pub}
          options={SEXES.map((s) => ({ value: s, label: SEX_LABELS[s] }))}
          {...bind("sex")}
        />
      )}
      {shown("location") && (
        <fieldset className="grid gap-3 sm:col-span-2 sm:grid-cols-3">
          <legend className="font-heading text-subtle mb-1.5 text-xs font-semibold tracking-[0.15em] uppercase">
            {you("Where are you based out of?", "Where they're based")}
            {pub && (
              <span className="text-primary" aria-hidden>
                {" "}
                *
              </span>
            )}
          </legend>
          <Field
            label="Country"
            required={pub}
            autoComplete={pub ? "country-name" : "off"}
            maxLength={80}
            {...bind("country")}
          />
          <Field
            label="Province / state"
            required={pub}
            autoComplete={pub ? "address-level1" : "off"}
            maxLength={80}
            {...bind("region")}
          />
          <Field
            label="City"
            required={pub}
            autoComplete={pub ? "address-level2" : "off"}
            maxLength={80}
            {...bind("city")}
          />
        </fieldset>
      )}
      <Field
        label="Email"
        type="email"
        required={pub}
        autoComplete={pub ? "email" : "off"}
        maxLength={200}
        hint={pub ? undefined : "Needed to invite them to the app."}
        {...bind("email")}
      />
      {shown("instagram") && (
        <Field
          label={you("Instagram handle (if you have Instagram)", "Instagram handle")}
          placeholder="@yourname"
          maxLength={80}
          {...bind("instagram")}
        />
      )}
      <SelectField
        className="sm:col-span-2"
        label={you("What services are you interested in?", "Service")}
        required={pub}
        options={serviceOptions}
        {...bind("serviceType")}
      />
      {shown("coachPreference") && askCoach && (
        <SelectField
          className="sm:col-span-2"
          label={you("Who are you interested in coaching with?", "Coach they asked for")}
          required={pub}
          options={[
            ...coaches.map((c) => ({
              value: c.userId,
              label: c.name.split(" ")[0] + (pub ? "" : ` (${c.name})`),
            })),
            { value: "unsure", label: "Unsure" },
            { value: "none", label: "No preference" },
          ]}
          {...bind("coachPreference")}
        />
      )}
      {shown("coachQualities") && (
        <TextAreaField
          className="sm:col-span-2"
          label={you(
            "What qualities and characteristics do you value most in a coach?",
            "Qualities they value in a coach",
          )}
          required={pub}
          maxLength={2000}
          {...bind("coachQualities")}
        />
      )}
      <TextAreaField
        className="sm:col-span-2"
        label={you("What are your main training goals?", "Main training goals")}
        required={pub}
        maxLength={2000}
        {...bind("goals")}
      />
      {shown("heardAbout") && (
        <Field
          className="sm:col-span-2"
          label={you("How did you hear about us?", "How they heard about the business")}
          required={pub}
          maxLength={200}
          {...bind("heardAbout")}
        />
      )}
      {shown("funFact") && (
        <Field
          className="sm:col-span-2"
          label={you("Tell us one unrelated fun fact about yourself!", "Fun fact")}
          required={pub}
          maxLength={500}
          {...bind("funFact")}
        />
      )}
    </div>
  );
}
