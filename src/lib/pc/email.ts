// Transactional email through Resend (same sender the Private Circle app uses). No SDK: one POST.
const FROM = () => process.env.EMAIL_FROM || "Renaissance Commerce <admin@renaissancecommerce.com>";
const ADMIN = () => process.env.ADMIN_EMAIL || "admin@renaissancecommerce.com";

async function send({ to, subject, html, replyTo }: { to: string; subject: string; html: string; replyTo?: string }) {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error("RESEND_API_KEY is not configured.");
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
    body: JSON.stringify({ from: FROM(), to, subject, html, reply_to: replyTo }),
    signal: AbortSignal.timeout(15000),
  });
  const j = (await r.json().catch(() => ({}))) as { id?: string; message?: string };
  if (!r.ok) throw new Error(`Resend: ${j.message ?? r.status}`);
  return j.id;
}

const shell = (body: string) => `
  <div style="font-family:Helvetica,Arial,sans-serif;max-width:560px;margin:0 auto;color:#111">
    <p style="letter-spacing:.18em;font-size:11px;color:#9a7b2f;font-weight:700">RENAISSANCE COMMERCE · PRIVATE CIRCLE</p>
    ${body}
    <p>Questions any time: reply to this email or write to <a href="mailto:${ADMIN()}">${ADMIN()}</a>.</p>
  </div>`;

export function sendWelcome({ firstName, email, intakeUrl, bookingUrl }: { firstName: string; email: string; intakeUrl: string; bookingUrl: string | null }) {
  return send({
    to: email,
    subject: "Welcome to the Private Circle — your next steps",
    html: shell(`
      <h2 style="margin:0 0 12px">You're in, ${firstName}.</h2>
      <p>Your membership is active. Three things to do now so your first call is useful from minute one:</p>
      <ol style="line-height:1.7">
        <li><b>Complete your intake</b> (about 10 minutes, 6 short sections). This is how your coaches get your numbers, funnel and goals before you talk:<br><a href="${intakeUrl}" style="color:#9a7b2f">${intakeUrl}</a></li>
        ${bookingUrl ? `<li><b>Book your first call</b> using your personal link (one 45-minute call per week):<br><a href="${bookingUrl}" style="color:#9a7b2f">${bookingUrl}</a></li>` : "<li><b>Book your first call</b> — your booking link follows in a separate message.</li>"}
        <li><b>Watch WhatsApp</b> — we'll add you to your private group with the founders within one business day.</li>
      </ol>`),
  });
}

export function sendCheckin({ firstName, email, url }: { firstName: string; email: string; url: string }) {
  return send({
    to: email,
    subject: "Your monthly numbers check-in (2 min)",
    html: shell(`
      <h2 style="margin:0 0 12px">Quick numbers check-in, ${firstName}</h2>
      <p>Two minutes: your current revenue, spend, margins and cash. It keeps your progress tracking accurate between calls.</p>
      <p><a href="${url}" style="display:inline-block;background:#B8943F;color:#0F0D0A;padding:12px 20px;border-radius:6px;text-decoration:none;font-weight:700">Update my numbers</a></p>
      <p style="color:#777;font-size:12px">${url}</p>`),
  });
}

/** Sent once the brand has been created in the platform: the student sets a password and lands in their workspace. */
export function sendPlatformAccess({ firstName, email, brandName, setPasswordUrl, appUrl }: { firstName: string; email: string; brandName: string; setPasswordUrl: string; appUrl: string }) {
  return send({
    to: email,
    subject: "Your Renaissance Commerce platform is ready",
    html: shell(`
      <h2 style="margin:0 0 12px">${brandName} is set up, ${firstName}.</h2>
      <p>Your workspace on the Renaissance Commerce platform is ready: unit economics, the cash-flow forecast, inventory planning, the weekly business review, the creative dashboard, the course and the resource vaults — plus your coaching progress, call notes and action items from the Private Circle.</p>
      <p><a href="${setPasswordUrl}" style="display:inline-block;background:#B8943F;color:#0F0D0A;padding:12px 20px;border-radius:6px;text-decoration:none;font-weight:700">Choose your password</a></p>
      <p>After that, sign in any time at <a href="${appUrl}" style="color:#9a7b2f">${appUrl}</a> with this email address. Your first step inside is to connect Shopify so your numbers fill in automatically.</p>
      <p style="color:#777;font-size:12px">This link is personal to you. If it has expired, ask your coach for a new one.</p>`),
  });
}
