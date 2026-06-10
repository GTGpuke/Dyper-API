// Fixe les variables d'environnement requises AVANT le chargement de env.service.
// Exécuté par Jest via `setupFiles` (jest.config.ts) avant l'import des modules de test.
process.env.NODE_ENV = 'test';
process.env.CORS_ORIGIN = 'http://localhost:5173';
process.env.APP_KEY = 'test-app-key';
process.env.JWT_SECRET = 'test-jwt-secret';
process.env.AI_SERVICE_URL = 'http://localhost:8000';
process.env.AI_INTERNAL_KEY = 'test-internal-key';
// Base SQLite en mémoire, isolée par processus de test.
process.env.DB_STORAGE = ':memory:';
// Dossier média temporaire, isolé par processus de test (nettoyé par les suites concernées).
process.env.MEDIA_DIR = `${require('node:os').tmpdir()}/dyper-media-${process.pid}`;
process.env.GROQ_API_KEY = '';
process.env.LOG_LEVEL = 'error';
