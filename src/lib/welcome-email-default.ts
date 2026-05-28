/**
 * Default welcome email HTML template.
 * Variables: {{name}}, {{email}}, {{credits}}
 * Falls back gracefully when variables are missing.
 */
export const DEFAULT_WELCOME_SUBJECT = "Welcome to PixieDust ✨ — Your AI creative studio is ready";

export const DEFAULT_WELCOME_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<meta http-equiv="X-UA-Compatible" content="IE=edge"/>
<title>Welcome to PixieDust</title>
</head>
<body style="margin:0;padding:0;background:#0d0d12;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">

<!-- Wrapper -->
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#0d0d12;min-height:100vh;">
<tr><td align="center" style="padding:40px 16px 60px;">

<!-- Card -->
<table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;border-radius:20px;overflow:hidden;background:#16161f;border:1px solid rgba(255,255,255,0.07);">

  <!-- Header gradient -->
  <tr>
    <td style="background:linear-gradient(135deg,#7c3aed 0%,#a855f7 50%,#ec4899 100%);padding:48px 40px 40px;text-align:center;">
      <!-- Logo mark -->
      <div style="display:inline-block;width:56px;height:56px;background:rgba(255,255,255,0.15);border-radius:16px;line-height:56px;font-size:28px;margin-bottom:20px;">✨</div>
      <h1 style="margin:0;color:#ffffff;font-size:32px;font-weight:700;letter-spacing:-0.5px;line-height:1.2;">PixieDust</h1>
      <p style="margin:8px 0 0;color:rgba(255,255,255,0.8);font-size:15px;font-weight:400;">Your AI creative studio is ready</p>
    </td>
  </tr>

  <!-- Body -->
  <tr>
    <td style="padding:40px 40px 32px;">

      <!-- Greeting -->
      <p style="margin:0 0 8px;color:rgba(255,255,255,0.5);font-size:12px;font-weight:600;letter-spacing:1px;text-transform:uppercase;">Hey {{name}} 👋</p>
      <h2 style="margin:0 0 20px;color:#ffffff;font-size:22px;font-weight:600;letter-spacing:-0.3px;line-height:1.4;">
        Welcome aboard — you've got <span style="color:#a855f7;">{{credits}} free credits</span> to start creating.
      </h2>
      <p style="margin:0 0 32px;color:rgba(255,255,255,0.55);font-size:15px;line-height:1.7;">
        PixieDust gives you instant access to 150+ AI templates for images, videos, beauty edits, fashion try-ons, and more. No design skills required — just pick a template and go.
      </p>

      <!-- CTA Button -->
      <table cellpadding="0" cellspacing="0" border="0" style="margin:0 0 40px;">
        <tr>
          <td style="background:linear-gradient(135deg,#7c3aed,#a855f7);border-radius:12px;">
            <a href="https://pixiedustapp.com" style="display:inline-block;padding:14px 32px;color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;letter-spacing:-0.2px;">Start creating →</a>
          </td>
        </tr>
      </table>

      <!-- Divider -->
      <hr style="border:none;border-top:1px solid rgba(255,255,255,0.07);margin:0 0 36px;"/>

      <!-- Feature list -->
      <p style="margin:0 0 20px;color:rgba(255,255,255,0.4);font-size:11px;font-weight:600;letter-spacing:1px;text-transform:uppercase;">What you can do</p>
      <table cellpadding="0" cellspacing="0" border="0" width="100%">
        <tr>
          <td width="50%" style="padding:0 8px 16px 0;vertical-align:top;">
            <table cellpadding="0" cellspacing="0" border="0" style="background:rgba(124,58,237,0.1);border:1px solid rgba(124,58,237,0.2);border-radius:12px;padding:16px;width:100%;">
              <tr><td>
                <div style="font-size:20px;margin-bottom:8px;">🖼️</div>
                <div style="color:#ffffff;font-size:13px;font-weight:600;margin-bottom:4px;">AI Images</div>
                <div style="color:rgba(255,255,255,0.45);font-size:12px;line-height:1.5;">86+ photo styles from cinematic to artistic</div>
              </td></tr>
            </table>
          </td>
          <td width="50%" style="padding:0 0 16px 8px;vertical-align:top;">
            <table cellpadding="0" cellspacing="0" border="0" style="background:rgba(168,85,247,0.1);border:1px solid rgba(168,85,247,0.2);border-radius:12px;padding:16px;width:100%;">
              <tr><td>
                <div style="font-size:20px;margin-bottom:8px;">🎬</div>
                <div style="color:#ffffff;font-size:13px;font-weight:600;margin-bottom:4px;">AI Videos</div>
                <div style="color:rgba(255,255,255,0.45);font-size:12px;line-height:1.5;">Animate photos, create clips, apply motion</div>
              </td></tr>
            </table>
          </td>
        </tr>
        <tr>
          <td width="50%" style="padding:0 8px 0 0;vertical-align:top;">
            <table cellpadding="0" cellspacing="0" border="0" style="background:rgba(236,72,153,0.1);border:1px solid rgba(236,72,153,0.2);border-radius:12px;padding:16px;width:100%;">
              <tr><td>
                <div style="font-size:20px;margin-bottom:8px;">💄</div>
                <div style="color:#ffffff;font-size:13px;font-weight:600;margin-bottom:4px;">Beauty & Fashion</div>
                <div style="color:rgba(255,255,255,0.45);font-size:12px;line-height:1.5;">Virtual try-ons, makeovers, hair styles</div>
              </td></tr>
            </table>
          </td>
          <td width="50%" style="padding:0 0 0 8px;vertical-align:top;">
            <table cellpadding="0" cellspacing="0" border="0" style="background:rgba(20,184,166,0.1);border:1px solid rgba(20,184,166,0.2);border-radius:12px;padding:16px;width:100%;">
              <tr><td>
                <div style="font-size:20px;margin-bottom:8px;">🧑‍🎨</div>
                <div style="color:#ffffff;font-size:13px;font-weight:600;margin-bottom:4px;">Avatars & Portraits</div>
                <div style="color:rgba(255,255,255,0.45);font-size:12px;line-height:1.5;">50+ styles from selfie to studio shot</div>
              </td></tr>
            </table>
          </td>
        </tr>
      </table>

    </td>
  </tr>

  <!-- Footer -->
  <tr>
    <td style="padding:24px 40px 32px;border-top:1px solid rgba(255,255,255,0.07);">
      <p style="margin:0 0 8px;color:rgba(255,255,255,0.25);font-size:12px;line-height:1.6;text-align:center;">
        You're receiving this because you created an account at
        <a href="https://pixiedustapp.com" style="color:rgba(168,85,247,0.8);text-decoration:none;">pixiedustapp.com</a>
        with {{email}}.
      </p>
      <p style="margin:0;color:rgba(255,255,255,0.15);font-size:11px;text-align:center;">
        © 2025 PixieDust. All rights reserved.
      </p>
    </td>
  </tr>

</table>
<!-- /Card -->

</td></tr>
</table>
<!-- /Wrapper -->

</body>
</html>`;

/** Replace {{name}}, {{email}}, {{credits}} with actual values. */
export function renderWelcomeEmail(
  html: string,
  vars: { name?: string | null; email?: string | null; credits?: number }
): string {
  const name = vars.name || (vars.email ? vars.email.split("@")[0] : "there");
  return html
    .replace(/\{\{name\}\}/g, escHtml(name))
    .replace(/\{\{email\}\}/g, escHtml(vars.email || ""))
    .replace(/\{\{credits\}\}/g, String(vars.credits ?? 0));
}

function escHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
