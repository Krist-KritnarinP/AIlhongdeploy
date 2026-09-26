import { createHash, randomBytes } from 'node:crypto';
import bcrypt from 'bcrypt';
import createError from 'http-errors';
import { prisma } from '../lib/prisma.js';
import { clearRefreshCookie } from '../security/refresh-session.js';
import { findUserByEmail } from '../services/user.service.js';
import { isPasswordResetMailConfigured, sendPasswordResetEmail } from '../services/password-reset-mailer.js';
import { forgotPasswordSchema, resetPasswordSchema } from '../validations/schema.js';

const TOKEN_LIFETIME_MS = 30 * 60 * 1000;
const hashToken = token => createHash('sha256').update(token).digest('hex');
const genericMessage = 'If an account exists for that email, a reset link will be sent.';

export async function forgotPassword(req, res, next) {
  try {
    const { email } = forgotPasswordSchema.parse(req.body);
    if (!isPasswordResetMailConfigured()) return next(createError(503, 'Password reset email is not configured'));

    const user = await findUserByEmail(email);
    if (user) {
      const now = new Date();
      const recent = await prisma.passwordResetToken.findFirst({
        where: { userId: user.id, createdAt: { gt: new Date(now.getTime() - 60_000) } },
        select: { tokenHash: true },
      });
      if (!recent) {
        await prisma.passwordResetToken.deleteMany({ where: { userId: user.id } });
        const rawToken = randomBytes(32).toString('base64url');
        const tokenHash = hashToken(rawToken);
        await prisma.passwordResetToken.create({
          data: { tokenHash, userId: user.id, expiresAt: new Date(now.getTime() + TOKEN_LIFETIME_MS) },
        });
        const resetUrl = new URL('/reset-password', process.env.FRONTEND_URL || 'http://localhost:5173');
        resetUrl.searchParams.set('token', rawToken);
        try {
          await sendPasswordResetEmail({ to: user.email, resetUrl: resetUrl.toString() });
        } catch {
          await prisma.passwordResetToken.deleteMany({ where: { tokenHash } });
          // Do not log addresses, tokens, SMTP responses, or credentials.
          console.warn('Password reset email delivery failed');
        }
      }
    }
    res.status(202).json({ message: genericMessage });
  } catch (error) { next(error); }
}

export async function resetPassword(req, res, next) {
  try {
    const { token, password } = resetPasswordSchema.parse(req.body);
    const tokenHash = hashToken(token);
    const now = new Date();
    const passwordHash = await bcrypt.hash(password, 12);
    const reset = await prisma.$transaction(async tx => {
      const candidate = await tx.passwordResetToken.findUnique({ where: { tokenHash } });
      if (!candidate || candidate.usedAt || candidate.expiresAt <= now) return false;
      const claimed = await tx.passwordResetToken.updateMany({
        where: { tokenHash, usedAt: null, expiresAt: { gt: now } },
        data: { usedAt: now },
      });
      if (claimed.count !== 1) return false;
      const changed = await tx.user.updateMany({
        where: { id: candidate.userId },
        data: { password: passwordHash, tokenVersion: { increment: 1 } },
      });
      if (changed.count !== 1) return false;
      await tx.passwordResetToken.deleteMany({ where: { userId: candidate.userId } });
      await tx.refreshSession.deleteMany({ where: { userId: candidate.userId } });
      return true;
    });
    if (!reset) return next(createError(400, 'Reset link is invalid or expired'));
    clearRefreshCookie(res);
    res.json({ message: 'Password reset successfully. Please sign in again.' });
  } catch (error) { next(error); }
}
