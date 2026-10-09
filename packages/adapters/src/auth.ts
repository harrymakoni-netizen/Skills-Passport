import argon2 from 'argon2';
import { authenticator } from 'otplib';

authenticator.options = { window: 1, step: 30 };

export const hashPassword = (password: string) => argon2.hash(password, { type: argon2.argon2id });
export const verifyPassword = (hash: string, password: string) => argon2.verify(hash, password).catch(() => false);

export const generateTotpSecret = () => authenticator.generateSecret(20);
export const verifyTotp = (secret: string, token: string) => authenticator.check(token.replace(/\s/g, ''), secret);
export const currentTotp = (secret: string) => authenticator.generate(secret);
export const totpUri = (account: string, secret: string) => authenticator.keyuri(account, 'Skills Passport', secret);
