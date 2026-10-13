import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { authService } from '../services/auth.service.js';

const credentialsSchema = z.object({
  email: z.string().trim().email().max(254).transform((value) => value.toLowerCase()),
  password: z.string().min(10).max(128),
});
const registerSchema = credentialsSchema.extend({
  phone: z.string().trim().regex(/^[0-9+() .-]{10,20}$/),
  name: z.string().trim().min(1).max(120),
  address: z.string().trim().min(1).max(300),
});

const cookieOptions = {
  httpOnly: true,
  sameSite: 'strict',
  secure: process.env.NODE_ENV === 'production',
  maxAge: 7 * 24 * 60 * 60 * 1000,
};

export const authController = {
  async register(request, response) {
    const input = registerSchema.parse(request.body);
    try {
      const result = await authService.register(input);
      response.cookie('hope_token', result.token, cookieOptions);
      return response.status(201).json({ user: result.user });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        return response.status(409).json({ error: 'Não foi possível concluir o cadastro com esses dados.' });
      }
      throw error;
    }
  },
  async login(request, response) {
    const { email, password } = credentialsSchema.parse(request.body);
    const result = await authService.login(email, password);
    if (!result) return response.status(401).json({ error: 'Email ou senha inválidos.' });
    response.cookie('hope_token', result.token, cookieOptions);
    return response.json({ user: result.user });
  },
  me(request, response) {
    return response.json({ user: request.user });
  },
  logout(request, response) {
    response.clearCookie('hope_token', cookieOptions);
    return response.json({ ok: true });
  },
};

export function validationError(error, request, response, next) {
  if (error instanceof z.ZodError) return response.status(400).json({ error: 'Confira os dados informados.' });
  return next(error);
}
