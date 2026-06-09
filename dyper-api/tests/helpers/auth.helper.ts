// Aide aux tests : crée un compte et renvoie le cookie de session réutilisable.
import type { FastifyInstance } from 'fastify';

const APP_KEY = 'test-app-key';

export interface AuthedUser {
  userId: string;
  cookie: string;
  // En-têtes prêts à l'emploi (clé applicative + cookie de session).
  headers: Record<string, string>;
}

export async function registerAndLogin(
  app: FastifyInstance,
  email: string,
  password = 'password123'
): Promise<AuthedUser> {
  const res = await app.inject({
    method: 'POST',
    url: '/api/auth/register',
    headers: { 'x-app-key': APP_KEY },
    payload: { email, password },
  });
  if (res.statusCode !== 201) {
    throw new Error(`Échec de l'inscription de test (${res.statusCode}) : ${res.body}`);
  }
  const tokenCookie = res.cookies.find((c) => c.name === 'dyper_token');
  if (!tokenCookie) throw new Error("Aucun cookie de session posé à l'inscription.");

  const cookie = `dyper_token=${tokenCookie.value}`;
  return {
    userId: res.json().user.id,
    cookie,
    headers: { 'x-app-key': APP_KEY, cookie },
  };
}
