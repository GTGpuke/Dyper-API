// Service d'authentification : hachage de mot de passe (bcryptjs) et options du cookie de session.

import type { CookieSerializeOptions } from '@fastify/cookie';
import bcrypt from 'bcryptjs';
import type User from '../../models/User';
import { env } from '../env.service';

// Nom du cookie httpOnly portant le JWT.
export const TOKEN_COOKIE = 'dyper_token';

// Durée de vie de la session (7 jours).
export const TOKEN_TTL_SECONDS = 60 * 60 * 24 * 7;
export const TOKEN_TTL = '7d';

const SALT_ROUNDS = 12;

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, SALT_ROUNDS);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

// Charge utile signée dans le JWT (inclut token_version pour la révocation globale).
export function tokenPayload(user: User): { sub: string; email: string; tv: number } {
  return { sub: user.id, email: user.email, tv: user.token_version };
}

// Options du cookie : httpOnly, sécurisé en production, SameSite lax (compatible proxy Vite en dev).
export function cookieOptions(): CookieSerializeOptions {
  return {
    httpOnly: true,
    secure: env.isProd,
    sameSite: 'lax',
    path: '/',
    maxAge: TOKEN_TTL_SECONDS,
  };
}

// Options de suppression du cookie : doivent matcher path/sameSite/secure de la pose.
export function clearCookieOptions(): CookieSerializeOptions {
  return { httpOnly: true, secure: env.isProd, sameSite: 'lax', path: '/' };
}

// Normalise un e-mail (minuscules + trim) pour garantir l'unicité.
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}
