// Copyright (c) 2026 Alysson Pinheiro. Todos os direitos reservados.
// Software proprietário e confidencial. Uso não autorizado é proibido.
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import type { SessionService } from '../../application/services/session.service.js';

const loginSchema = z.object({
  username: z.string().trim().min(1, 'Usuário é obrigatório'),
  password: z.string().optional(),
});

export function registerAuthRoutes(server: FastifyInstance, sessionService: SessionService) {
  server.post('/api/auth/login', async (request: FastifyRequest, reply: FastifyReply) => {
    const { username, password } = loginSchema.parse(request.body);

    const session = sessionService.createSession(username, password);

    reply.setCookie('scanner_session_id', session.sessionId, {
      path: '/',
      httpOnly: true,
      sameSite: 'lax',
      secure: false, // Internal network / HTTP allowed
    });

    return reply.send({
      status: 'authenticated',
      sessionId: session.sessionId,
      username: session.username,
    });
  });

  server.post('/api/auth/logout', async (request: FastifyRequest, reply: FastifyReply) => {
    const sessionId = request.cookies.scanner_session_id || (request.headers['x-session-id'] as string);
    if (sessionId) {
      sessionService.removeSession(sessionId);
    }

    reply.clearCookie('scanner_session_id', { path: '/' });
    return reply.send({ status: 'logged_out' });
  });

  server.get('/api/auth/me', async (request: FastifyRequest, reply: FastifyReply) => {
    const sessionId = request.cookies.scanner_session_id || (request.headers['x-session-id'] as string);
    if (!sessionId) {
      return reply.code(401).send({ error: 'Não autenticado' });
    }

    const session = sessionService.getSession(sessionId);
    if (!session) {
      return reply.code(401).send({ error: 'Sessão expirada' });
    }

    return reply.send({
      sessionId: session.sessionId,
      username: session.username,
    });
  });
}
