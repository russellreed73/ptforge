import { Body, Container, Head, Hr, Html, Preview, Section, Text } from "react-email";
import type { ReactNode } from "react";

const styles = {
  body: {
    backgroundColor: "#f1f5f9",
    fontFamily: "Segoe UI, Roboto, Helvetica, Arial, sans-serif",
  },
  container: {
    backgroundColor: "#ffffff",
    borderRadius: "8px",
    margin: "32px auto",
    maxWidth: "520px",
    padding: "32px",
  },
  brand: {
    color: "#0f172a",
    fontSize: "14px",
    fontWeight: 700,
    letterSpacing: "0.04em",
    margin: 0,
  },
  footer: { color: "#64748b", fontSize: "12px", lineHeight: "18px" },
};

/** Shared frame for every PTForge email. */
export function EmailLayout({
  preview,
  footer = "You received this email because of activity on your PTForge account at ptforge.app. If this wasn't you, you can ignore it.",
  children,
}: {
  preview: string;
  footer?: string;
  children: ReactNode;
}) {
  return (
    <Html lang="en">
      <Head />
      <Preview>{preview}</Preview>
      <Body style={styles.body}>
        <Container style={styles.container}>
          <Text style={styles.brand}>PTFORGE</Text>
          <Section>{children}</Section>
          <Hr style={{ borderColor: "#e2e8f0", margin: "24px 0" }} />
          <Text style={styles.footer}>{footer}</Text>
        </Container>
      </Body>
    </Html>
  );
}

export const text = {
  heading: { color: "#0f172a", fontSize: "22px", fontWeight: 700, margin: "16px 0 8px" },
  body: { color: "#334155", fontSize: "15px", lineHeight: "24px" },
  small: {
    color: "#64748b",
    fontSize: "13px",
    lineHeight: "20px",
    wordBreak: "break-all" as const,
  },
};

export const button = {
  backgroundColor: "#0f172a",
  borderRadius: "6px",
  color: "#ffffff",
  display: "inline-block",
  fontSize: "15px",
  fontWeight: 600,
  padding: "12px 20px",
  textDecoration: "none",
};
