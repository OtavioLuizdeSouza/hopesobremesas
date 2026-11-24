import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { userRepository } from '../repositories/user.repository.js';

const BCRYPT_ROUNDS = 10;
const TOKEN_TTL = '7d';

function publicUser(user) {
  const { passwordHash, ...safeUser } = user;
  return safeUser;
}

function tokenFor(userId) {
  return jwt.sign({ sub: userId }, env.JWT_SECRET, { expiresIn: TOKEN_TTL, algorithm: 'HS256' });
}

export const authService = {
  async register(input) {
    const passwordHash = await bcrypt.hash(input.password, BCRYPT_ROUNDS);
    const { password, ...profile } = input;
    const user = await userRepository.create({ ...profile, passwordHash });
    return { user: publicUser(user), token: tokenFor(user.id) };
  },
  async login(email, password) {
    const user = await userRepository.findByEmail(email);
    const valid = user ? await bcrypt.compare(password, user.passwordHash) : false;
    if (!valid) return null;
    return { user: publicUser(user), token: tokenFor(user.id) };
  },
  verifyToken(token) {
    return jwt.verify(token, env.JWT_SECRET, { algorithms: ['HS256'] });
  },
};
