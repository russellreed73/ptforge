import { Button, Heading, Link, Text } from "react-email";
import { button, EmailLayout, text } from "./_shared/layout";

export type InvitationProps = {
  inviterName: string;
  businessName: string;
  /** e.g. "trainer" or "manager and trainer" */
  roleLabel: string;
  url: string;
};

export default function Invitation({ inviterName, businessName, roleLabel, url }: InvitationProps) {
  const isAthlete = roleLabel === "athlete";
  return (
    <EmailLayout
      preview={`${inviterName} invited you to ${businessName} on PTForge`}
      footer={`You received this because ${inviterName} invited this email address to ${businessName} on ptforge.app. Not expecting it? You can ignore this email.`}
    >
      <Heading style={text.heading}>You&apos;re invited to {businessName}</Heading>
      <Text style={text.body}>
        {inviterName} invited you to join {businessName} on PTForge as {articleFor(roleLabel)}{" "}
        {roleLabel}.
      </Text>
      <Text style={text.body}>
        {isAthlete
          ? "You'll see your workouts, log your sets and message your coach from your phone."
          : "You'll manage clients, programs and progress from the PTForge web app."}
      </Text>
      <Button href={url} style={button}>
        Accept invitation
      </Button>
      <Text style={text.small}>
        This invitation expires in 7 days. Link: <Link href={url}>{url}</Link>
      </Text>
    </EmailLayout>
  );
}

function articleFor(word: string) {
  return /^[aeiou]/i.test(word) ? "an" : "a";
}

Invitation.PreviewProps = {
  inviterName: "Jacob",
  businessName: "Jacob Strength",
  roleLabel: "trainer",
  url: "https://ptforge.app/accept-invite/example",
} satisfies InvitationProps;
