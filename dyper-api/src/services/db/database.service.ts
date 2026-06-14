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

// Ajoute une colonne si elle est absente (SQLite ne supporte que ADD COLUMN ; idempotent par
// PRAGMA). No-op si la table n'existe pas encore : sync() la créera avec le schéma complet.
// Contrairement à sync({ alter: true }), un simple ADD COLUMN ne déclenche pas le cycle de
// reconstruction « _backup » de SQLite — sûr sous un watcher de développement.
export async function ensureColumn(table: string, column: string, ddl: string): Promise<void> {
  const [rows] = await sequelize.query(`PRAGMA table_info(\`${table}\`)`);
  const cols = rows as Array<{ name: string }>;
  if (cols.length === 0) return;
  if (cols.some((c) => c.name === column)) return;
  await sequelize.query(`ALTER TABLE \`${table}\` ADD COLUMN \`${column}\` ${ddl}`);
  logger.info(`Colonne ajoutée à la base : ${table}.${column}.`);
}

// Mises à niveau additives du schéma, exécutées à chaque démarrage (y compris en production) :
// uniquement des ADD COLUMN nullables et des CREATE TABLE IF NOT EXISTS — jamais destructif.
async function ensureSchemaUpgrades(): Promise<void> {
  await ensureColumn('analysis', 'thumbnail_path', 'VARCHAR(255) DEFAULT NULL');
  await ensureColumn('analysis', 'timeline', 'JSON DEFAULT NULL');
  await ensureColumn('analysis', 'objects', 'JSON DEFAULT NULL');
  await ensureColumn('analysis', 'source_width', 'INTEGER DEFAULT NULL');
  await ensureColumn('analysis', 'source_height', 'INTEGER DEFAULT NULL');
  await ensureColumn('analysis', 'audio_transcript', 'TEXT DEFAULT NULL');
  await ensureColumn('analysis', 'video_path', 'VARCHAR(255) DEFAULT NULL');
  await ensureColumn('analysis', 'frame_detections', 'JSON DEFAULT NULL');
  await ensureColumn('analysis', 'music', 'JSON DEFAULT NULL');
  await ensureColumn('analysis', 'transcript_segments', 'JSON DEFAULT NULL');

  // Tables créées même en production (sync sans alter = CREATE TABLE IF NOT EXISTS) :
  // conversations/messages et feed public « Global » (publications, votes, commentaires, signalements).
  const {
    Conversation,
    Message,
    Publication,
    PublicationVote,
    PublicationComment,
    PublicationReport,
  } = await import('../../models');
  await Conversation.sync();
  await Message.sync();
  await Publication.sync();
  await PublicationVote.sync();
  await PublicationComment.sync();
  await PublicationReport.sync();
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
  }
  await ensureSchemaUpgrades();
  logger.info('Modèles synchronisés avec la base de données.');
}

export default sequelize;
