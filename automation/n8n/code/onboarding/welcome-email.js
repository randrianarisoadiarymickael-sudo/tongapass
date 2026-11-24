// Compose l'e-mail de bienvenue (HTML + texte) envoyé à l'adresse personnelle.
const start = new Date(`${employee.startDate}T12:00:00`).toLocaleDateString('fr-FR', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});
const links = ctx.links || {};
const company = ctx.company?.name || 'TongaPass';

const tools = [
  links.account
    ? { name: 'Votre compte d’entreprise', url: links.account, hint: 'Définissez votre mot de passe grâce au lien d’activation reçu sur votre adresse professionnelle.' }
    : null,
  access.giteaTeams?.length && links.gitea
    ? { name: 'Gitea, le code source', url: links.gitea, hint: `Équipes : ${access.giteaTeams.join(', ')}. Mot de passe à définir via « Mot de passe oublié ».` }
    : null,
  access.chatChannels?.length && links.mattermost
    ? { name: 'Mattermost, la messagerie d’équipe', url: links.mattermost, hint: `Canaux : ${access.chatChannels.map((c) => `~${c}`).join(', ')}.` }
    : null,
].filter(Boolean);

const rows = [
  ['Identifiant', employee.username],
  ['Adresse professionnelle', employee.workEmail],
  ['Poste', `${employee.jobTitle} · ${employee.department}`],
  ['Date d’arrivée', start],
  ['Manager', employee.managerName || '—'],
];

const toolsHtml = tools
  .map(
    (t) =>
      `<p style="margin:0 0 14px;font-size:14px;line-height:1.55"><a href="${escape(t.url)}" style="color:#3d5c78;font-weight:600;text-decoration:none">${escape(t.name)}</a><br><span style="color:#126756">${escape(t.hint)}</span></p>`,
  )
  .join('');

const html = emailLayout({
  kicker: `Arrivée le ${start}`,
  title: `Bienvenue chez ${company}, ${employee.firstName}`,
  intro: 'Votre identité numérique est prête. Voici l’essentiel pour votre premier jour.',
  body: `${emailRows(rows)}
  <div style="font-size:15px;font-weight:600;margin:26px 0 12px">Vos outils</div>
  ${toolsHtml}
  <p style="margin:20px 0 0;padding:12px 14px;border-left:3px solid #126756;background:#f3f7f6;font-size:13px;line-height:1.55;color:#3d575c">
    Aucun mot de passe ne vous est transmis par e-mail. Un lien d’activation valable 48 heures a été envoyé à ${escape(employee.workEmail)}.
  </p>`,
});

const text = [
  `Bienvenue chez ${company}, ${employee.firstName}.`,
  'Votre identité numérique est prête.',
  '',
  ...rows.map(([k, v]) => `${k} : ${v}`),
  '',
  'Vos outils :',
  ...tools.map((t) => `- ${t.name} : ${t.url} (${t.hint})`),
  '',
  `Aucun mot de passe n'est transmis par e-mail : un lien d'activation valable 48 heures a été envoyé à ${employee.workEmail}.`,
].join('\n');

return [
  {
    json: {
      skip: options.sendWelcomeEmail === false,
      to: employee.personalEmail,
      subject: `Bienvenue chez ${company} : vos accès sont prêts`,
      html,
      text,
    },
  },
];
