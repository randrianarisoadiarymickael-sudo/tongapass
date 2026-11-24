// Produit (sur la sortie standard) les identifiants n8n à importer, à partir des variables d'environnement.
// Rien n'est stocké en clair dans le dépôt : n8n chiffre ces valeurs avec N8N_ENCRYPTION_KEY à l'import.
const env = process.env;

if (!env.N8N_WEBHOOK_TOKEN || env.N8N_WEBHOOK_TOKEN.length < 24) {
  console.error('N8N_WEBHOOK_TOKEN manquant ou trop court');
  process.exit(1);
}

const credentials = [
  {
    id: 'tpSmtpMailpit001',
    name: 'TongaPass SMTP (Mailpit)',
    type: 'smtp',
    data: {
      user: env.SMTP_USER ?? '',
      password: env.SMTP_PASSWORD ?? '',
      host: env.SMTP_HOST ?? 'mailpit',
      port: Number(env.SMTP_PORT ?? 1025),
      secure: env.SMTP_SECURE === 'true',
      disableStartTls: env.SMTP_SECURE !== 'true',
    },
  },
  {
    id: 'tpWebhookAuth001',
    name: 'TongaPass — jeton webhook',
    type: 'httpHeaderAuth',
    data: { name: 'X-TongaPass-Token', value: env.N8N_WEBHOOK_TOKEN },
  },
];

process.stdout.write(JSON.stringify(credentials));
