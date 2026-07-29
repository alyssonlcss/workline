## Backend

API responsável por orquestrar a automação do Spotfire e expor endpoints para o frontend Angular.

### Stack

- Node.js + TypeScript
- Fastify (`@fastify/cookie`, `@fastify/rate-limit`)
- Puppeteer (RPA para automação do Spotfire)
- Zod para validação de esquemas e contratos
- `p-limit` para gerenciamento de concorrência

### Arquitetura

- `application/`: serviços de casos de uso (`SessionService`)
- `domain/`: entidades e portas (`ScannerRunRequest`, `UserCredentials`)
- `infrastructure/`:
  - `cache/`: cache de extração em memória (`ExtractionCacheService`)
  - `runtime/`: gerenciador de fila de tarefas (`ExtractionQueueManager`) e armazenamento de jobs (`InMemoryJobStore`)
  - `storage/`: isolamento de diretórios de sessão (`TempStorageService`) e limpeza periódica (`FileGarbageCollector`)
  - `spotfire/`: automação do navegador Puppeteer (`PuppeteerSpotfireAutomation`)
- `presentation/`: rotas HTTP e controladores Fastify (`AuthController`, `registerAuthRoutes`)

### Regras atendidas

- Nenhuma URL do Spotfire é hardcoded.
- Suporte a credenciais por requisição (autenticação per-user vinda do frontend).
- Fila concorrente com limite de workers e notificação de progresso via SSE.
- Isolamento por sessão e garbage collection de arquivos temporários a cada 30 minutos.
- Cache de consultas por hash SHA-256 (respostas instantâneas para filtros repetidos).

### Endpoints

- `GET /api/health`
- `POST /api/auth/login` (criação de sessão e cookie HTTP-only)
- `POST /api/auth/logout` (encerramento de sessão)
- `GET /api/auth/me` (consulta de sessão ativa)
- `POST /api/scanner/executions` (disparo de extração com credenciais e SSE)
- `GET /api/scanner/executions/:jobId` (status do job de extração)
- `GET /api/scanner/filters/:jobId` (leitura dos filtros coletados)