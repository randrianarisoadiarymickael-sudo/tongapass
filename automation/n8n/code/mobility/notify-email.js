// Mobilité — informe le collaborateur (adresse professionnelle) et son manager des droits ajustés.
const m = ctx.mobility || {};
const changes = m.changes || { added: {}, removed: {} };
const describeList = (values, prefix = '') => (values && values.length ? values.map((v) => `${prefix}${v}`).join(', ') : 'aucun');

const rows = [
  ['Collaborateur', employee.fullName],
  ['Nouveau poste', `${m.jobTitle || employee.jobTitle} · ${m.department || employee.department}`],
  ['Profil d’accès', `${m.previousProfile?.name ?? '—'} → ${m.targetProfile?.name ?? '—'}`],
  ['Rôles ajoutés', describeList(changes.added.realmRoles)],
  ['Rôles retirés', describeList(changes.removed.realmRoles)],
  ['Équipes Gitea', `+ ${describeList(changes.added.giteaTeams)} / − ${describeList(changes.removed.giteaTeams)}`],
  ['Canaux Mattermost', `+ ${describeList(changes.added.chatChannels, '~')} / − ${describeList(changes.removed.chatChannels, '~')}`],
];

const recipients = [employee.workEmail, options.notifyManager !== false ? employee.managerEmail : null]
  .filter(Boolean)
  .filter((value, index, all) => all.indexOf(value) === index);

const html = emailLayout({
  kicker: 'Mobilité interne',
  title: `Vos accès ont été ajustés à votre nouveau poste`,
  intro: `Bonjour ${employee.firstName}, vos droits ont été mis à jour automatiquement. Les accès qui ne sont plus nécessaires ont été retirés.`,
  body: emailRows(rows),
});
const text = [
  `Bonjour ${employee.firstName},`,
  'Vos accès ont été ajustés à votre nouveau poste :',
  ...rows.map(([key, value]) => `- ${key} : ${value}`),
].join('\n');

return [
  {
    json: {
      skip: recipients.length === 0,
      to: recipients.join(', '),
      subject: `Vos accès TongaPass ont évolué (${m.targetProfile?.name ?? 'nouveau profil'})`,
      html,
      text,
    },
  },
];
