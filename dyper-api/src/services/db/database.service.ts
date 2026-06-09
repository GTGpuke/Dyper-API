// Service de connexion à la base de données via Sequelize (dialecte SQLite).
// Dyper persiste l'historique des analyses et des échanges de chat dans un fichier SQLite local
// (aucune base externe à déployer). La fonction connectDatabase() est appelée au démarrage.
import fs from 'node:fs';
import path from 'node:path';
import { Sequelize } from 'sequelize';
import { env } from '../env.service';
import logger from '../logger.service';

// Crée le dossier parent du fichier SQLite si nécessaire (sauf pour la base en mémoire « :memory: »).
if (env.DB_STORAGE !== ':memory:') {
  fs.mkdirSync(path.dirname(env.DB_STORAGE), { recursive: true });
}

const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: env.DB_STORAGE,
  // Les requêtes SQL sont loggées en niveau debug uniquement.
  logging: (sql) => logger.debug(sql),
  define: {
    timestamps: false,
    underscored: false,
  },
});

// Supprime les tables résiduelles « *_backup » qu'un sync({ alter }) interrompu peut laisser
// (ex. redémarrage du watcher en plein milieu). Sans ce nettoyage, le sync suivant échoue avec
// SQLITE_ERROR. Rend le démarrage en développement auto-réparant.
async function dropOrphanBackupTables(): Promise<void> {
  if (env.DB_STORAGE === ':memory:') return;
  const [rows] = await sequelize.query(
    "SELECT name FROM sqlite_master WHERE type='table' AND name LIKE '%_backup'"
  );
  for (const row of rows as Array<{ name: string }>) {
    await sequelize.query(`DROP TABLE IF EXISTS \`${row.name}\``);
    logger.warn(`Table résiduelle supprimée avant synchronisation : ${row.name}`);
  }
}

// Vérifie que la connexion à la base de données est opérationnelle.
// En dehors de la production, crée les tables manquantes (sync sans alter : idempotent et sans
// réécriture — évite le coûteux cycle de reconstruction SQLite qui, sous un watcher de dev,
// déclenche des redémarrages en boucle. En cas de changement de schéma, réinitialiser la base de dev).
export async function connectDatabase(): Promise<void> {
  await sequelize.authenticate();
  logger.info('Connexion à la base de données SQLite établie.');

  if (!env.isProd) {
    await dropOrphanBackupTables();
    await sequelize.sync();
    logger.info('Modèles synchronisés avec la base de données.');
  }
}

export default sequelize;
