// Gabarit e-mail commun « lagon » : fond clair, carte blanche à bordure fine, mot-symbole bicolore. Aucun émoji.
const escape = (value) =>
  String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

const emailLayout = ({ kicker, title, intro, body, footer }) => `<!doctype html>
<html lang="fr"><body style="margin:0;background:#f3f7f6;font-family:'Plus Jakarta Sans','Segoe UI',Arial,sans-serif;color:#112e32">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 12px">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border:1px solid #d8e4e0;border-radius:10px;overflow:hidden">
<tr><td style="height:4px;line-height:4px;font-size:0;background:#126756">&nbsp;</td></tr>
<tr><td style="padding:24px 32px 0">
  <div style="font-size:17px;font-weight:700;letter-spacing:-.01em;color:#112e32">Tonga<span style="color:#126756">Pass</span></div>
</td></tr>
<tr><td style="padding:24px 32px 8px">
  <div style="font-size:12px;color:#126756;letter-spacing:.02em">${escape(kicker)}</div>
  <div style="font-size:22px;font-weight:600;margin-top:6px;line-height:1.3">${escape(title)}</div>
  <p style="font-size:14px;line-height:1.6;color:#3d575c;margin:12px 0 0">${escape(intro)}</p>
</td></tr>
<tr><td style="padding:16px 32px 28px">${body}</td></tr>
<tr><td style="padding:16px 32px;border-top:1px solid #d8e4e0;color:#126756;font-size:12px;line-height:1.5">${escape(footer || 'Message envoyé automatiquement par TongaPass. Merci de ne pas y répondre.')}</td></tr>
</table></td></tr></table></body></html>`;

const emailRows = (rows) =>
  `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:14px;border-collapse:collapse">${rows
    .map(
      ([key, value]) =>
        `<tr><td style="padding:9px 0;color:#126756;width:40%;border-bottom:1px solid #f3e8d6;vertical-align:top">${escape(key)}</td><td style="padding:9px 0;font-weight:500;border-bottom:1px solid #f3e8d6">${escape(value)}</td></tr>`,
    )
    .join('')}</table>`;
