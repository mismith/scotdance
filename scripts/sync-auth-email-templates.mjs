// Render with the existing Postmark layout, then update only Firebase's two
// editable security-email templates. Firebase owns recipients, codes and limits.
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
const root = new URL('../', import.meta.url);
const project = 'firebase-scotdance';
const apply = process.argv.includes('--apply');
const config = JSON.parse(execFileSync('gcloud', ['secrets', 'versions', 'access', 'latest', '--secret=RUNTIME_CONFIG', `--project=${project}`], { encoding: 'utf8' }));
const templates = [
  ['resetPasswordTemplate', 'reset-password', 'Reset your ScotDance password'],
  ['changeEmailTemplate', 'change-email', 'Your ScotDance email has changed'],
];
const sendEmail = {};
for (const [field, name, subject] of templates) {
  const body = readFileSync(new URL(`auth-email/${name}.html`, root), 'utf8');
  const response = await fetch('https://api.postmarkapp.com/templates/validate', {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Postmark-Server-Token': config.postmark.server_api_token },
    body: JSON.stringify({ Subject: subject, HtmlBody: body, TextBody: body, TemplateType: 'Standard', LayoutTemplate: 'scotdance', TestRenderModel: { app: { name: 'ScotDance.app', url: 'https://next.scotdance.app', preview: null } } }),
  });
  const result = await response.json();
  if (!response.ok || !result.AllContentIsValid) throw new Error(`Could not render ${name}`);
  const html = result.HtmlBody.RenderedContent;
  if (!html.includes('%LINK%') || !html.includes('Built by a Highland dance family, for Highland dance families.')) throw new Error(`Invalid ${name} rendering`);
  sendEmail[field] = { senderLocalPart: 'admin', senderDisplayName: 'ScotDance.app', replyTo: 'admin@scotdance.app', subject, body: html, bodyFormat: 'HTML' };
  if (!apply) writeFileSync(`/private/tmp/scotdance-${name}-email.html`, html.replaceAll('%EMAIL%', 'parent@example.test').replaceAll('%NEW_EMAIL%', 'new-parent@example.test').replaceAll('%LINK%', 'https://scotdance.firebaseapp.com/__/auth/action?mode=example'), { mode: 0o600 });
}
if (apply) {
  const token = execFileSync('gcloud', ['auth', 'print-access-token'], { encoding: 'utf8' }).trim();
  const mask = templates.map(([field]) => `notification.sendEmail.${field}`).join(',');
  const endpoint = `https://identitytoolkit.googleapis.com/admin/v2/projects/${project}/config`;
  const headers = { Authorization: `Bearer ${token}`, 'x-goog-user-project': project, 'Content-Type': 'application/json' };
  const response = await fetch(`${endpoint}?updateMask=${mask}`, { method: 'PATCH', headers, body: JSON.stringify({ notification: { sendEmail } }) });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error?.message || 'Could not update Firebase templates');
  for (const [field] of templates) {
    if (result.notification?.sendEmail?.[field]?.subject !== sendEmail[field].subject) throw new Error(`Template readback mismatch: ${field}`);
  }
  console.log('Published branded Firebase password-reset and email-change templates.');
} else console.log('Rendered both emails in /private/tmp; use --apply to publish.');
