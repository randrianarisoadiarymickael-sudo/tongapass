import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { buildDataSourceOptions, databaseSettingsFromEnv } from './typeorm.options';

/** Applique les migrations en attente (utilisé au démarrage du conteneur). */
async function main(): Promise<void> {
  const dataSource = new DataSource(buildDataSourceOptions(databaseSettingsFromEnv()));
  await dataSource.initialize();
  const applied = await dataSource.runMigrations({ transaction: 'each' });
  console.log(
    applied.length
      ? `Migrations appliquées : ${applied.map((m) => m.name).join(', ')}`
      : 'Schéma à jour, aucune migration en attente.',
  );
  await dataSource.destroy();
}

main().catch((error: unknown) => {
  console.error('Échec des migrations :', error);
  process.exit(1);
});
