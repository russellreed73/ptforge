import { Button, Heading, Link, Text } from "react-email";
import { button, EmailLayout, text } from "./_shared/layout";

export type VerifyEmailProps = { name: string; url: string };

export default function VerifyEmail({ name, url }: VerifyEmailProps) {
  return (
    <EmailLayout preview="Confirm your email to finish setting up PTForge">
      <Heading style={text.heading}>Confirm your email</Heading>
      <Text style={text.body}>Hi {name}, thanks for signing up for PTForge.</Text>
      <Text style={text.body}>
        Confirm this is your email address to finish setting up your account.
      </Text>
      <Button href={url} style={button}>
        Confirm email
      </Button>
      <Text style={text.small}>
        This link expires in 1 hour. If the button doesn&apos;t work, paste this into your browser:{" "}
        <Link href={url}>{url}</Link>
      </Text>
    </EmailLayout>
  );
}

VerifyEmail.PreviewProps = {
  name: "Jacob",
  url: "https://ptforge.app/api/auth/verify-email?token=example",
} satisfies VerifyEmailProps;
