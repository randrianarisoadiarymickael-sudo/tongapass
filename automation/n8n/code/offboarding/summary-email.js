// Compose le récapitulatif de départ pour le manager et les RH (preuve de révocation).
const outcomes = [
  ...$('Keycloak · révocation').all(),
  ...$('Gitea · blocage').all(),
  ...$('Mattermost · désactivation').all(),
].map((item) => item.json);

const LABELS = {
  'keycloak.disable': 'Compte Keycloak désactivé',
  'keycloak.sessions': 'Sessions révoquées',
  'keycloak.roles': 'Rôles et groupes retirés',
  'gitea.revoke': 'Accès Gitea bloqué',
  'chat.deactivate': 'Compte Mattermost désactivé',
};
const STATUS = { SUCCEEDED: 'Fait', FAILED: 'Échec', SKIPPED: 'Non concerné' };
const COLOR = { SUCCEEDED: '#17644d', FAILED: '#a23a2a', SKIPPED: '#126756' };
const failures = outcomes.filter((o) => o.status === 'FAILED');

const recipients = [options.notifyManager !== false ? employee.managerEmail : null, $env.HR_NOTIFICATION_EMAIL]
  .filter(Boolean)
  .filter((value, index, all) => all.indexOf(value) === index);

const table = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:14px;border-collapse:collapse">${outcomes
  .map(
    (o) =>
      `<tr><td style="padding:10px 0;border-bottom:1px solid #f3e8d6;vertical-align:top"><div style="font-weight:600">${escape(LABELS[o.step] || o.step)}</div><div style="color:#126756;font-size:13px;margin-top:2px">${escape(o.detail || '')}</div></td><td style="padding:10px 0;border-bottom:1px solid #f3e8d6;text-align:right;vertical-align:top;font-weight:600;color:${COLOR[o.status] || '#112e32'};white-space:nowrap">${escape(STATUS[o.status] || o.status)}</td></tr>`,
  )
  .join('')}</table>`;

const html = emailLayout({
  kicker: failures.length ? 'Départ — action requise' : 'Départ — accès révoqués',
  title: `${employee.fullName} : récapitulatif de révocation`,
  intro: `${employee.jobTitle} · ${employee.department}. Motif : ${ctx.reason || 'non précisé'}.`,
  body: `${table}${
    failures.length
      ? `<p style="margin:18px 0 0;padding:12px 14px;border-left:3px solid #a23a2a;background:#f8e9e4;font-size:13px;line-height:1.55;color:#3d575c">${failures.length} étape(s) en échec : relancez le workflow depuis TongaPass pour supprimer tout accès résiduel.</p>`
      : ''
  }`,
  footer: 'Récapitulatif généré par TongaPass. La trace complète figure dans le journal d’audit.',
});

const text = [
  `Départ de ${employee.fullName} (${employee.jobTitle}, ${employee.department})`,
  ...outcomes.map((o) => `- ${LABELS[o.step] || o.step} : ${STATUS[o.status] || o.status}. ${o.detail || ''}`),
  failures.length ? `${failures.length} étape(s) en échec : relancez le workflow.` : 'Tous les accès ont été révoqués.',
].join('\n');

return [
  {
    json: {
      skip: recipients.length === 0,
      to: recipients.join(', '),
      subject: `${failures.length ? '[Action requise] ' : ''}Départ de ${employee.fullName} : récapitulatif des accès`,
      html,
      text,
    },
  },
];
