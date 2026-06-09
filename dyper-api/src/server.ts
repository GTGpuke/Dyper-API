// Point d'entrée du serveur dyper-api : initialise les modèles, connecte la base,
// construit l'application Fastify et gère l'arrêt gracieux.
import './models/index';
import type { FastifyInstance } from 'fastify';
import { buildApp } from './app';
import { connectDatabase } from './services/db/database.service';
import { env } from './services/env.service';
import logger from './services/logger.service';

let server: FastifyInstance | undefined;

function exitGracefully(signal: string, code: number): void {
  logger.warn(`Signal ${signal} reçu — arrêt gracieux en cours.`);
  if (server) {
    server.close(() => process.exit(code));
  } else {
    process.exit(code);
  }
}

process.on('uncaughtException', (err) => {
  logger.error('Exception non capturée.', { error: err });
  exitGracefully('uncaughtException', 1);
});

process.on('unhandledRejection', (reason) => {
  logger.error('Promesse rejetée non gérée.', { reason });
  exitGracefully('unhandledRejection', 1);
});

process.on('SIGTERM', () => exitGracefully('SIGTERM', 0));
process.on('SIGINT', () => exitGracefully('SIGINT', 0));

async function start(): Promise<void> {
  try {
    await connectDatabase();

    server = await buildApp();

    await server.listen({ port: env.PORT, host: env.HOST });

    logger.info(`Serveur dyper-api démarré sur http://${env.HOST}:${env.PORT}.`);
  } catch (err) {
    logger.error('Échec du démarrage du serveur.', { error: err });
    process.exit(1);
  }
}

start();
