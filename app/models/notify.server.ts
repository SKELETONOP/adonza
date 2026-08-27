import nodemailer from "nodemailer";

// SMTP is configured entirely via environment variables - see README for
// setup instructions. If they're not set, we skip sending silently (the
// feedback is still saved to the database either way).
function getTransport() {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;

  if (!SMTP_HOST || !SMTP_PORT || !SMTP_USER || !SMTP_PASS) {
    return null;
  }

  return nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT),
    secure: process.env.SMTP_SECURE === "true",
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });
}

export async function sendFeedbackEmail({
  shop,
  message,
}: {
  shop: string;
  message: string;
}) {
  const transport = getTransport();
  if (!transport) {
    console.warn(
      "[notify] SMTP not configured (SMTP_HOST/SMTP_PORT/SMTP_USER/SMTP_PASS) - skipping feedback email",
    );
    return;
  }

  const to = process.env.FEEDBACK_NOTIFICATION_EMAIL || "nareshgouttam@gmail.com";
  const from = process.env.SMTP_FROM || process.env.SMTP_USER!;

  try {
    await transport.sendMail({
      from,
      to,
      subject: `New feedback from ${shop}`,
      text: `Shop: ${shop}\n\n${message}`,
    });
  } catch (err) {
    // Never let a failed notification email block the feedback submission
    // itself - it's already saved in the database regardless.
    console.error("[notify] failed to send feedback email", err);
  }
}
