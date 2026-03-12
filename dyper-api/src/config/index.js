// Configuration centrale de l'application — regroupe toutes les variables d'environnement avec leurs valeurs par défaut.
'use strict'

require('dotenv').config()

module.exports = {
  // Port d'écoute du serveur Express.
  port: process.env.PORT || 3000,

  // URL de base du service d'inférence dyper-ai.
  aiServiceUrl: process.env.AI_SERVICE_URL || 'http://localhost:8000',

  // Clé secrète partagée entre dyper-api et dyper-ai.
  aiInternalKey: process.env.AI_INTERNAL_KEY || '',

  // Liste des origines autorisées pour CORS.
  allowedOrigins: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:5173'],

  // Taille maximale acceptée pour un fichier uploadé (en Mo).
  maxFileSizeMb: parseInt(process.env.MAX_FILE_SIZE_MB || '10'),

  // Types MIME autorisés pour les uploads.
  allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/mp4'],

  // Délai maximum d'attente pour un appel vers dyper-ai (en millisecondes).
  requestTimeoutMs: parseInt(process.env.REQUEST_TIMEOUT_MS || '30000'),

  // Clé API Groq pour le service de chat (Llama 3).
  groqApiKey: process.env.GROQ_API_KEY || '',
}
