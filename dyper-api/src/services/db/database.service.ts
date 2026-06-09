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

// Vérifie que la connexion à la base de données est opérationnelle.
// En dehors de la production, synchronise les modèles avec la base (alter: true).
export async function connectDatabase(): Promise<void> {
  await sequelize.authenticate();
  logger.info('Connexion à la base de données SQLite établie.');

  if (!env.isProd) {
    await sequelize.sync({ alter: true });
    logger.info('Modèles synchronisés avec la base de données.');
  }
}

export default sequelize;
