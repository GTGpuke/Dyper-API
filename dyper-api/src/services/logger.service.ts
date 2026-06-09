// Service de journalisation de l'application via Winston.
// En développement : sortie console colorisée avec timestamp court.
// En production : sortie console JSON et fichiers (error.log, combined.log).
// En environnement de test : tous les transports sont silencieux pour ne pas polluer Jest.
import fs from 'node:fs';
import path from 'node:path';
import winston from 'winston';

const LOG_DIR = process.env.LOG_DIR ?? 'logs';
const LOG_LEVEL = process.env.LOG_LEVEL ?? 'info';
const NODE_ENV = process.env.NODE_ENV ?? 'development';
const IS_DEV = NODE_ENV === 'development';
const IS_TEST = NODE_ENV === 'test';

// Crée le répertoire de logs s'il n'existe pas encore (ignoré en test).
if (!IS_TEST) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

// Format lisible pour la console en développement.
const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'HH:mm:ss' }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
    return `[${timestamp}] ${level}: ${message}${metaStr}`;
  })
);

// Format JSON structuré pour les fichiers de logs en production.
const fileFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

const logger = winston.createLogger({
  level: LOG_LEVEL,
  transports: [
    new winston.transports.Console({
      format: IS_DEV ? consoleFormat : fileFormat,
      silent: IS_TEST,
    }),
    // Fichiers de logs désactivés en environnement de test.
    ...(!IS_TEST
      ? [
          new winston.transports.File({
            filename: path.join(LOG_DIR, 'error.log'),
            level: 'error',
            format: fileFormat,
          }),
          new winston.transports.File({
            filename: path.join(LOG_DIR, 'combined.log'),
            format: fileFormat,
          }),
        ]
      : []),
  ],
});

export default logger;
