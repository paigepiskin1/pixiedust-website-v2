/**
 * Branded email-verification template, sent from our own Mailgun domain.
 * Variable: {{link}} (the verification URL), {{email}}.
 */
export const VERIFY_EMAIL_SUBJECT = "Verify your email for PixieDust ✨";

export const VERIFY_EMAIL_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<meta http-equiv="X-UA-Compatible" content="IE=edge"/>
<title>Verify your email</title>
</head>
<body style="margin:0;padding:0;background:#0d0d12;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#0d0d12;">
<tr><td align="center" style="padding:40px 16px 60px;">
<table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;border-radius:20px;overflow:hidden;background:#16161f;border:1px solid rgba(255,255,255,0.07);">

  <tr>
    <td style="background:linear-gradient(135deg,#7c3aed 0%,#a855f7 50%,#ec4899 100%);padding:48px 40px 40px;text-align:center;">
      <table cellpadding="0" cellspacing="0" border="0" style="margin:0 auto 20px;">
        <tr>
          <td style="vertical-align:middle;padding-right:10px;">
            <img src="https://pixiecdn.b-cdn.net/brand/logo-icon-256.png" alt="" width="40" height="40" style="display:block;width:40px;height:40px;border-radius:11px;" />
          </td>
          <td style="vertical-align:middle;">
            <span style="font-size:26px;font-weight:800;color:#ffffff;letter-spacing:-0.5px;">PixieDust</span>
          </td>
        </tr>
      </table>
      <p style="margin:0;color:rgba(255,255,255,0.85);font-size:15px;">Confirm your email to start creating</p>
    </td>
  </tr>

  <tr>
    <td style="padding:40px 40px 32px;">
      <h2 style="margin:0 0 16px;color:#ffffff;font-size:22px;font-weight:600;letter-spacing:-0.3px;line-height:1.4;">
        One quick step — verify your email
      </h2>
      <p style="margin:0 0 32px;color:rgba(255,255,255,0.55);font-size:15px;line-height:1.7;">
        Tap the button below to confirm this is your address. Then you can sign in and your 5 free credits are ready to go.
      </p>

      <table cellpadding="0" cellspacing="0" border="0" style="margin:0 0 28px;">
        <tr>
          <td style="background:linear-gradient(135deg,#7c3aed,#a855f7);border-radius:12px;">
            <a href="{{link}}" style="display:inline-block;padding:15px 38px;color:#ffffff;font-size:16px;font-weight:700;text-decoration:none;letter-spacing:-0.2px;">Verify my email →</a>
          </td>
        </tr>
      </table>

      <p style="margin:0 0 8px;color:rgba(255,255,255,0.4);font-size:12px;line-height:1.6;">
        Or paste this link into your browser:
      </p>
      <p style="margin:0 0 8px;word-break:break-all;">
        <a href="{{link}}" style="color:rgba(168,85,247,0.9);font-size:12px;text-decoration:none;">{{link}}</a>
      </p>
      <p style="margin:24px 0 0;color:rgba(255,255,255,0.35);font-size:12px;line-height:1.6;">
        This link expires in 24 hours. If you didn't create a PixieDust account, you can safely ignore this email.
      </p>
    </td>
  </tr>

  <tr>
    <td style="padding:24px 40px 32px;border-top:1px solid rgba(255,255,255,0.07);">
      <p style="margin:0 0 8px;color:rgba(255,255,255,0.25);font-size:12px;line-height:1.6;text-align:center;">
        Sent to {{email}} from
        <a href="https://pixydust.com" style="color:rgba(168,85,247,0.8);text-decoration:none;">pixydust.com</a>.
      </p>
      <p style="margin:0;color:rgba(255,255,255,0.15);font-size:11px;text-align:center;">© PixieDust. All rights reserved.</p>
    </td>
  </tr>

</table>
</td></tr>
</table>
</body>
</html>`;

export function renderVerifyEmail(link: string, email: string): string {
  const safeLink = link.replace(/"/g, "&quot;");
  const safeEmail = email.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return VERIFY_EMAIL_HTML.replace(/\{\{link\}\}/g, safeLink).replace(/\{\{email\}\}/g, safeEmail);
}
