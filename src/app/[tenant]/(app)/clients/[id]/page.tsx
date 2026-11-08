import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Card, Pill, SectionTitle, TextLink } from "@/components/ui";
import { Weight } from "@/components/unit";
import {
  SEX_LABELS,
  SOURCE_LABELS,
  STATUS_LABELS,
  formatHeight,
  statusTone,
  type ClientStatus,
} from "@/lib/clients";
import { isUnit } from "@/lib/units";
import { getSession, requireTenant } from "@/server/auth/session";
import { getBusinessBranding } from "@/server/brand/queries";
import { clientPermissions, getClient, listCoaches } from "@/server/clients/queries";
import { ApplicationEditor, ClientActions, IntakeEditor, TrainerManager } from "./client-detail";

export const metadata: Metadata = { title: "Client" };

const dateFmt = new Intl.DateTimeFormat("en-CA", {
  year: "numeric",
  month: "long",
  day: "numeric",
});

function Answer({ label, children }: { label: string; children: React.ReactNode }) {
  const empty = children === null || children === undefined || children === "";
  return (
    <div className="flex flex-col gap-1">
      <dt className="font-heading text-muted text-xs font-semibold tracking-[0.15em] uppercase">
        {label}
      </dt>
      <dd className={`whitespace-pre-line ${empty ? "text-muted" : ""}`}>
        {empty ? "—" : children}
      </dd>
    </div>
  );
}

function ageFrom(dob: string | null) {
  if (!dob) return null;
  const d = new Date(`${dob}T00:00:00`);
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  if (now < new Date(now.getFullYear(), d.getMonth(), d.getDate())) age -= 1;
  return age;
}

export default async function ClientPage({
  params,
  searchParams,
}: PageProps<"/[tenant]/clients/[id]">) {
  const { tenant, id } = await params;
  const ctx = await requireTenant(tenant);
  const perms = clientPermissions(ctx);
  if (!perms.create) notFound();
  const client = await getClient(ctx, id);
  if (!client) notFound();
  const tab = (await searchParams).tab === "intake" ? "intake" : "application";
  const [brand, coaches, session] = await Promise.all([
    getBusinessBranding(ctx.tenantId),
    listCoaches(ctx.tenantId),
    getSession(),
  ]);
  const generalUnit = isUnit(session?.user.preferredUnit) ? session.user.preferredUnit : "kg";

  const { profile: p, intake: i, trainers, pendingInvite } = client;
  const base = `/${ctx.tenantSlug}/clients/${p.id}`;
  const askedFor =
    p.coachPreference === "trainer"
      ? (coaches.find((c) => c.userId === p.preferredTrainerUserId)?.name ?? "A former trainer")
      : p.coachPreference === "unsure"
        ? "Unsure"
        : p.coachPreference === "none"
          ? "No preference"
          : null;
  const location = [p.city, p.region, p.country].filter(Boolean).join(", ");
  const age = ageFrom(p.dateOfBirth);
  const appStatus = p.userId
    ? "Uses the app"
    : pendingInvite
      ? "Invited to the app"
      : "Not in the app yet";

  const applicationValues = {
    firstName: p.firstName,
    lastName: p.lastName,
    email: p.email ?? "",
    pronouns: p.pronouns ?? "",
    sex: p.sex ?? "",
    country: p.country ?? "",
    region: p.region ?? "",
    city: p.city ?? "",
    instagram: p.instagram ?? "",
    serviceType: p.serviceType,
    coachPreference:
      p.coachPreference === "trainer"
        ? (p.preferredTrainerUserId ?? "")
        : (p.coachPreference ?? ""),
    coachQualities: p.coachQualities ?? "",
    goals: p.goals ?? "",
    heardAbout: p.heardAbout ?? "",
    funFact: p.funFact ?? "",
  };

  const tabLink = (t: string, label: string) => (
    <Link
      href={t === "application" ? base : `${base}?tab=${t}`}
      aria-current={tab === t ? "page" : undefined}
      className={`font-heading -mb-px border-b-2 pb-3 text-sm font-semibold tracking-[0.15em] uppercase ${
        tab === t
          ? "border-primary text-foreground"
          : "text-subtle hover:text-foreground border-transparent"
      }`}
    >
      {label}
    </Link>
  );

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-12">
      <TextLink href={`/${ctx.tenantSlug}/clients`}>← Clients</TextLink>

      <header className="mt-6 mb-8 flex flex-wrap items-start justify-between gap-6">
        <div>
          <p className="eyebrow mb-3">{ctx.tenantName}</p>
          <h1 className="display text-5xl">
            {p.firstName} {p.lastName}
          </h1>
          <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
            <Pill tone={p.archivedAt ? "muted" : statusTone(p.status)}>
              {p.archivedAt ? "Archived" : (STATUS_LABELS[p.status as ClientStatus] ?? p.status)}
            </Pill>
            <span className="text-subtle">{appStatus}</span>
            <span className="text-muted">
              · {SOURCE_LABELS[p.source as keyof typeof SOURCE_LABELS] ?? p.source}
              {p.appliedAt ? ` on ${dateFmt.format(p.appliedAt)}` : ""}
            </span>
          </div>
        </div>
        <ClientActions
          slug={ctx.tenantSlug}
          clientId={p.id}
          status={p.status}
          archived={Boolean(p.archivedAt)}
          canArchive={perms.archive}
          invite={
            perms.invite && !p.userId ? { email: p.email, pending: Boolean(pendingInvite) } : null
          }
        />
      </header>

      <div className="grid gap-8 lg:grid-cols-[1fr_300px]">
        <div className="min-w-0">
          <nav className="border-border mb-6 flex gap-6 border-b" aria-label="Client sections">
            {tabLink("application", "Application")}
            {tabLink("intake", "Detailed intake")}
          </nav>

          {tab === "application" ? (
            <Card>
              <ApplicationEditor
                slug={ctx.tenantSlug}
                clientId={p.id}
                initial={applicationValues}
                services={brand?.services ?? []}
                coaches={coaches}
              >
                <dl className="grid gap-5 sm:grid-cols-2">
                  <Answer label="Email">{p.email}</Answer>
                  <Answer label="Instagram">{p.instagram}</Answer>
                  <Answer label="Pronouns">{p.pronouns}</Answer>
                  <Answer label="Sex">
                    {p.sex ? SEX_LABELS[p.sex as keyof typeof SEX_LABELS] : null}
                  </Answer>
                  <Answer label="Based in">{location}</Answer>
                  <Answer label="Service">{p.serviceType}</Answer>
                  <Answer label="Coach they asked for">{askedFor}</Answer>
                  <Answer label="How they heard about us">{p.heardAbout}</Answer>
                  <div className="sm:col-span-2">
                    <Answer label="Main training goals">{p.goals}</Answer>
                  </div>
                  <div className="sm:col-span-2">
                    <Answer label="Qualities they value in a coach">{p.coachQualities}</Answer>
                  </div>
                  <div className="sm:col-span-2">
                    <Answer label="Fun fact">{p.funFact}</Answer>
                  </div>
                </dl>
              </ApplicationEditor>
            </Card>
          ) : (
            <Card>
              <IntakeEditor
                slug={ctx.tenantSlug}
                clientId={p.id}
                initial={{ ...(i ?? {}), phone: p.phone, dateOfBirth: p.dateOfBirth }}
                updatedAt={i?.updatedAt ? dateFmt.format(i.updatedAt) : null}
              >
                {!i && (
                  <p className="text-subtle mb-6">
                    Not filled in yet. Fill in the detailed intake during or after the onboarding
                    call.
                  </p>
                )}
                <dl className="grid gap-5 sm:grid-cols-2">
                  <Answer label="Date of birth">
                    {p.dateOfBirth
                      ? `${p.dateOfBirth}${age !== null ? ` (age ${age})` : ""}`
                      : null}
                  </Answer>
                  <Answer label="Phone">{p.phone}</Answer>
                  <Answer label="Height">
                    {i?.heightCm != null ? formatHeight(i.heightCm, generalUnit) : null}
                  </Answer>
                  <Answer label="Body weight">
                    {i?.bodyWeightKg != null ? <Weight kg={i.bodyWeightKg} /> : null}
                  </Answer>
                  <Answer label="Stress level (1–10)">{i?.stressLevel}</Answer>
                  <Answer label="Days per week they'd like to train">
                    {i?.trainingDaysPerWeek}
                  </Answer>
                  <div className="sm:col-span-2">
                    <Answer label="Exercise history (past 6 months)">{i?.exerciseHistory}</Answer>
                  </div>
                  <div className="sm:col-span-2">
                    <Answer label="Why they signed up / goals">{i?.signupReason}</Answer>
                  </div>
                  <div className="sm:col-span-2">
                    <Answer label="Occupation and weekly schedule">{i?.occupation}</Answer>
                  </div>
                  <Answer label="Sleep">{i?.sleep}</Answer>
                  <Answer label="Diet">{i?.diet}</Answer>
                  <div className="sm:col-span-2">
                    <Answer label="Injuries">{i?.injuries}</Answer>
                  </div>
                </dl>

                <SectionTitle>
                  <span className="mt-8 block">Current 1RMs</span>
                </SectionTitle>
                <div className="border-border overflow-x-auto border">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-muted font-heading text-xs tracking-[0.15em] uppercase">
                        <th className="px-4 py-2 text-left font-semibold"></th>
                        <th className="px-4 py-2 text-right font-semibold">Squat</th>
                        <th className="px-4 py-2 text-right font-semibold">Bench</th>
                        <th className="px-4 py-2 text-right font-semibold">Deadlift</th>
                      </tr>
                    </thead>
                    <tbody className="tabular-nums">
                      <tr className="border-border border-t">
                        <td className="font-heading px-4 py-2 text-xs font-semibold tracking-[0.12em] uppercase">
                          Competition
                        </td>
                        <td className="px-4 py-2 text-right">
                          <Weight sbd kg={i?.compSquatKg} />
                        </td>
                        <td className="px-4 py-2 text-right">
                          <Weight sbd kg={i?.compBenchKg} />
                        </td>
                        <td className="px-4 py-2 text-right">
                          <Weight sbd kg={i?.compDeadliftKg} />
                        </td>
                      </tr>
                      <tr className="border-border border-t">
                        <td className="font-heading px-4 py-2 text-xs font-semibold tracking-[0.12em] uppercase">
                          Gym
                        </td>
                        <td className="px-4 py-2 text-right">
                          <Weight sbd kg={i?.gymSquatKg} />
                        </td>
                        <td className="px-4 py-2 text-right">
                          <Weight sbd kg={i?.gymBenchKg} />
                        </td>
                        <td className="px-4 py-2 text-right">
                          <Weight sbd kg={i?.gymDeadliftKg} />
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                <SectionTitle>
                  <span className="mt-8 block">Weekly sets estimate</span>
                </SectionTitle>
                <dl className="grid grid-cols-2 gap-5 sm:grid-cols-5">
                  <Answer label="Squat">{i?.weeklySetsSquat}</Answer>
                  <Answer label="Bench">{i?.weeklySetsBench}</Answer>
                  <Answer label="Deadlift">{i?.weeklySetsDeadlift}</Answer>
                  <Answer label="Vertical pull">{i?.weeklySetsVerticalPull}</Answer>
                  <Answer label="Core">{i?.weeklySetsCore}</Answer>
                </dl>
                <dl className="mt-6 grid gap-5">
                  <Answer label="Powerlifting experience">{i?.powerliftingExperience}</Answer>
                  <Answer label="Other information / questions">{i?.otherInfo}</Answer>
                </dl>
              </IntakeEditor>
            </Card>
          )}
        </div>

        <aside className="flex flex-col gap-6">
          <Card>
            <SectionTitle>Trainers</SectionTitle>
            <TrainerManager
              slug={ctx.tenantSlug}
              clientId={p.id}
              trainers={trainers}
              coaches={coaches}
              canAssign={perms.assign}
              suggested={p.coachPreference === "trainer" ? p.preferredTrainerUserId : null}
            />
          </Card>
        </aside>
      </div>
    </main>
  );
}
