import { randomBytes } from 'node:crypto';
import bcrypt from 'bcrypt';
import createError from 'http-errors';
import { OAuth2Client } from 'google-auth-library';
import { prisma } from '../lib/prisma.js';
import { isTrustedOrigin, issueRefreshSession, setRefreshCookie } from '../security/refresh-session.js';
import { createToken } from '../utilities/jwt.js';
import { googleLoginSchema } from '../validations/schema.js';

const googleClient = new OAuth2Client();

async function getOrCreateGoogleUser({ sub, email, name }) {
  const linked = await prisma.user.findUnique({ where: { googleSub: sub } });
  if (linked) return linked;

  const existing = await prisma.user.findFirst({
    where: { email: { equals: email, mode: 'insensitive' } },
  });
  if (existing) {
    if (existing.googleSub && existing.googleSub !== sub) throw createError(409, 'Google account cannot be linked');
    return prisma.user.update({ where: { id: existing.id }, data: { googleSub: sub } });
  }

  const displayName = String(name || '').trim().replace(/\s+/g, ' ').slice(0, 50);
  const username = displayName.length >= 4 ? displayName : `Google ${sub.slice(-8)}`;
  // Keep the existing password column non-null; the unguessable value is never returned or used.
  const unusablePassword = await bcrypt.hash(randomBytes(48).toString('hex'), 12);
  try {
    return await prisma.user.create({ data: { email, username, password: unusablePassword, googleSub: sub } });
  } catch (error) {
    // Handle two first-time sign-ins for the same Google identity racing on the unique index.
    if (error.code !== 'P2002') throw error;
    const raced = await prisma.user.findUnique({ where: { googleSub: sub } });
    if (raced) return raced;
    const sameEmail = await prisma.user.findFirst({ where: { email: { equals: email, mode: 'insensitive' } } });
    if (sameEmail && !sameEmail.googleSub) return prisma.user.update({ where: { id: sameEmail.id }, data: { googleSub: sub } });
    throw createError(409, 'Google account cannot be linked');
  }
}

export async function googleLogin(req, res, next) {
  try {
    if (!isTrustedOrigin(req)) return next(createError(403, 'Untrusted origin'));
    const { credential } = googleLoginSchema.parse(req.body);
    const clientId = process.env.GOOGLE_CLIENT_ID;
    if (!clientId) return next(createError(503, 'Google sign-in is not configured'));

    let ticket;
    try {
      ticket = await googleClient.verifyIdToken({ idToken: credential, audience: clientId });
    } catch {
      return next(createError(401, 'Invalid Google credential'));
    }
    const payload = ticket.getPayload();
    if (!payload?.sub || !payload.email || payload.email_verified !== true) {
      return next(createError(401, 'Invalid Google credential'));
    }

    const user = await getOrCreateGoogleUser({
      sub: payload.sub,
      email: payload.email.trim().toLowerCase(),
      name: payload.name,
    });
    const token = await createToken(user);
    const session = await issueRefreshSession(user);
    setRefreshCookie(res, session.token, session.expiresAt);
    res.json({ message: 'Login successfully', token, user: { id: user.id, username: user.username, email: user.email } });
  } catch (error) { next(error); }
}
