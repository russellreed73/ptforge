import { Button, Heading, Text } from "react-email";
import { button, EmailLayout, text } from "./_shared/layout";

export type NewLeadProps = {
  businessName: string;
  leadName: string;
  service: string;
  goals: string | null;
  /** e.g. "Jacob" when they asked for a coach */
  requestedCoach: string | null;
  /** True when someone already in the client list applied again. */
  existing: boolean;
  url: string;
};

/** Sent to administrators, managers and the requested coach for each Apply form submission. */
export default function NewLead({
  businessName,
  leadName,
  service,
  goals,
  requestedCoach,
  existing,
  url,
}: NewLeadProps) {
  return (
    <EmailLayout
      preview={`${leadName} applied to ${businessName}`}
      footer={`You received this because you're an administrator, manager or the requested coach at ${businessName} on PTForge.`}
    >
      <Heading style={text.heading}>
        {existing ? `${leadName} applied again` : `New application: ${leadName}`}
      </Heading>
      <Text style={text.body}>
        {existing
          ? `${leadName} is already in your client list and sent the website Apply form again.`
          : `${leadName} filled in the Apply form on your website.`}
      </Text>
      <Text style={text.body}>
        <strong>Service:</strong> {service || "Not chosen"}
        {requestedCoach && (
          <>
            <br />
            <strong>Wants to coach with:</strong> {requestedCoach}
          </>
        )}
        {goals && (
          <>
            <br />
            <strong>Goals:</strong> {goals.length > 280 ? `${goals.slice(0, 280)}…` : goals}
          </>
        )}
      </Text>
      <Button href={url} style={button}>
        View application
      </Button>
    </EmailLayout>
  );
}

NewLead.PreviewProps = {
  businessName: "Jacob Strength",
  leadName: "Morgan Diaz",
  service: "Online 1 on 1 Powerlifting Coaching",
  goals: "Compete at provincials next year.",
  requestedCoach: "Jacob",
  existing: false,
  url: "https://ptforge.app/jacob-strength/clients/example",
} satisfies NewLeadProps;
