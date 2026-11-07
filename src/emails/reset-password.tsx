import { Button, Heading, Link, Text } from "react-email";
import { button, EmailLayout, text } from "./_shared/layout";

export type ResetPasswordProps = { name: string; url: string };

export default function ResetPassword({ name, url }: ResetPasswordProps) {
  return (
    <EmailLayout preview="Reset your PTForge password">
      <Heading style={text.heading}>Reset your password</Heading>
      <Text style={text.body}>
        Hi {name}, someone asked to reset the password for your PTForge account. If that was you,
        choose a new password below.
      </Text>
      <Button href={url} style={button}>
        Choose a new password
      </Button>
      <Text style={text.small}>
        This link expires in 1 hour and works once. If you didn&apos;t ask for this, ignore this
        email and your password stays the same. Link: <Link href={url}>{url}</Link>
      </Text>
    </EmailLayout>
  );
}

ResetPassword.PreviewProps = {
  name: "Jacob",
  url: "https://ptforge.app/api/auth/reset-password/example?callbackURL=%2Freset-password",
} satisfies ResetPasswordProps;
