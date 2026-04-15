import { onDocumentCreated } from "firebase-functions/v2/firestore";
import { defineSecret } from "firebase-functions/params";
import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import nodemailer from "nodemailer";

initializeApp();

// Secrets stored in Google Cloud Secret Manager
// Set with: firebase functions:secrets:set SMTP_HOST, SMTP_USER, SMTP_PASS
const smtpHost = defineSecret("SMTP_HOST");
const smtpUser = defineSecret("SMTP_USER");
const smtpPass = defineSecret("SMTP_PASS");
const smtpPort = defineSecret("SMTP_PORT");

/**
 * Sends an invite email when a new invite document is created in Firestore.
 *
 * Triggered by: document creation in /invites/{inviteId}
 *
 * The invite doc should have:
 *   - email: recipient email (empty string for link-only invites)
 *   - workspaceName: name of the workspace
 *   - invitedByName: name of the person who invited
 *   - status: "pending"
 */
export const sendInviteEmail = onDocumentCreated(
  {
    document: "invites/{inviteId}",
    secrets: [smtpHost, smtpUser, smtpPass, smtpPort],
  },
  async (event) => {
    const snap = event.data;
    if (!snap) return;

    const data = snap.data();
    const email = data.email;
    const inviteId = event.params.inviteId;

    // Skip link-only invites (no email)
    if (!email) {
      console.log(`Skipping link-only invite ${inviteId} (no email)`);
      return;
    }

    // Skip if already processed
    if (data.emailSent) {
      console.log(`Invite ${inviteId} already emailed`);
      return;
    }

    const workspaceName = data.workspaceName || "a team";
    const invitedByName = data.invitedByName || "Someone";
    const inviteUrl = `https://harbor-7f970.web.app/#/invite/${inviteId}`;

    // Create transporter
    const transporter = nodemailer.createTransport({
      host: smtpHost.value(),
      port: parseInt(smtpPort.value() || "587"),
      secure: smtpPort.value() === "465",
      auth: {
        user: smtpUser.value(),
        pass: smtpPass.value(),
      },
    });

    const htmlBody = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
</head>
<body style="margin:0;padding:0;background:#1a1d21;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#1a1d21;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="480" cellpadding="0" cellspacing="0" style="background:#222529;border-radius:12px;overflow:hidden;">
          <!-- Header -->
          <tr>
            <td style="padding:32px 32px 20px;text-align:center;">
              <div style="font-size:48px;margin-bottom:8px;">⚓</div>
              <h1 style="color:#ffffff;font-size:22px;font-weight:800;margin:0 0 4px;">You're invited to Harbor Chat</h1>
              <p style="color:#ababad;font-size:14px;margin:0;">Encrypted team messaging</p>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:0 32px 24px;">
              <p style="color:#d1d2d3;font-size:15px;line-height:1.5;margin:0 0 16px;">
                <strong style="color:#ffffff;">${invitedByName}</strong> invited you to join
                <strong style="color:#ffffff;">${workspaceName}</strong> on Harbor Chat.
              </p>
              <p style="color:#ababad;font-size:14px;line-height:1.5;margin:0 0 24px;">
                Harbor Chat is a secure, real-time messaging platform built for teams and AI agents.
                Join the conversation with channels, threads, and more.
              </p>
              <!-- CTA Button -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center">
                    <a href="${inviteUrl}"
                       style="display:inline-block;padding:14px 32px;background:#1264a3;color:#ffffff;font-size:16px;font-weight:700;text-decoration:none;border-radius:8px;">
                      Accept Invite
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:16px 32px;border-top:1px solid #383a3e;">
              <p style="color:#6b6f76;font-size:12px;margin:0;text-align:center;">
                Or copy this link: <a href="${inviteUrl}" style="color:#1d9bd1;text-decoration:none;">${inviteUrl}</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

    const textBody = `${invitedByName} invited you to join ${workspaceName} on Harbor Chat.

Accept the invite: ${inviteUrl}

Harbor Chat is a secure, real-time messaging platform built for teams and AI agents.`;

    try {
      await transporter.sendMail({
        from: `"Harbor Chat" <${smtpUser.value()}>`,
        to: email,
        subject: `${invitedByName} invited you to ${workspaceName} on Harbor Chat`,
        text: textBody,
        html: htmlBody,
      });

      // Mark invite as emailed
      const db = getFirestore();
      await db.doc(`invites/${inviteId}`).update({ emailSent: true });

      console.log(`Invite email sent to ${email} for workspace ${workspaceName}`);
    } catch (error) {
      console.error(`Failed to send invite email to ${email}:`, error);
    }
  },
);
