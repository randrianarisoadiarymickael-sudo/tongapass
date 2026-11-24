#!/usr/bin/env node
// Génère le fichier .env local à partir de .env.example avec des secrets aléatoires forts.
// Usage : node scripts/init-env.mjs [--force]
import { randomBytes, randomInt } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const examplePath = resolve(root, '.env.example');
const envPath = resolve(root, '.env');
const force = process.argv.includes('--force');

if (existsSync(envPath) && !force) {
  console.log('.env existe déjà : rien à faire (utilisez --force pour le régénérer).');
  process.exit(0);
}

/** Secret machine : 32 octets aléatoires en base64url (≈ 256 bits). */
const machineSecret = () => randomBytes(32).toString('base64url');

/**
 * Mot de passe humain lisible, conforme à la politique Keycloak du royaume
 * (≥ 12 caractères, majuscule, minuscule, chiffre).
 */
function humanPassword() {
  const words = ['Baobab', 'Ravinala', 'Lemur', 'Vanille', 'Tsingy', 'Zebu', 'Lagon', 'Ylang'];
  const word = () => words[randomInt(words.length)];
  return `${word()}-${word()}-${randomInt(1000, 9999)}`;
}

const output = readFileSync(examplePath, 'utf8')
  .replace(/__GENERATE_DEMO__/g, () => humanPassword())
  .replace(/__GENERATE__/g, () => machineSecret());

writeFileSync(envPath, output, { mode: 0o600 });

const demo = output.match(/^TP_DEMO_PASSWORD=(.*)$/m)?.[1];
console.log('.env généré avec des secrets aléatoires (fichier ignoré par Git).');
console.log(`Comptes de démonstration (admin.it, rh.manager, auditeur) — mot de passe : ${demo}`);
