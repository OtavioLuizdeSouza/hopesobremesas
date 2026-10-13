import { authService } from '../services/auth.service.js';
import { userRepository } from '../repositories/user.repository.js';

export async function requireAuth(request, response, next) {
  try {
    const token = request.cookies.hope_token;
    if (!token) return response.status(401).json({ error: 'Autenticação necessária.' });
    const payload = authService.verifyToken(token);
    const user = await userRepository.findPublicById(payload.sub);
    if (!user) return response.status(401).json({ error: 'Autenticação necessária.' });
    request.user = user;
    next();
  } catch {
    return response.status(401).json({ error: 'Autenticação necessária.' });
  }
}
