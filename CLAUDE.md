# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Projeto

TreinaDesk: API REST de helpdesk (tickets de suporte) em **NestJS 12 + Prisma 7 + PostgreSQL**, TypeScript 6. As regras de negócio dos tickets estão em `docs/regras-de-negocio.md` (RN01 a RN07).

## Comandos

```bash
npm run start:dev        # servidor em watch (porta via PORT, padrão 3000)
npm run build            # nest build -> dist/ (apaga dist antes)
npm run lint             # oxlint src/ test/  (não é ESLint)
npm run format           # prettier (singleQuote, trailingComma: all)

npx prisma generate                   # regenera o client em src/generated/prisma
npx prisma migrate dev --name <nome>  # cria/aplica migration em prisma/migrations
npm run seed                          # ADMIN inicial (ADMIN_EMAIL/ADMIN_PASSWORD) + dados de teste; idempotente
```

- **Node >= 24.9 obrigatório** (há `.nvmrc`/`engines`).
- **O pacote é ESM (`"type": "module"`)**: imports relativos precisam da extensão `.js` (`'./app.module.js'`, `'./dto/index.js'`). É isso que permite rodar na Vercel, cujo runtime não carrega o NestJS 12 (ESM-only) via `require`.
- Após `prisma migrate dev`, rode `npx prisma generate`: no Prisma 7 o migrate não regenera o client.

## Arquitetura e particularidades

- **Prisma 7 com driver adapter**: o client é gerado pelo provider `prisma-client` em `src/generated/prisma` (ignorado pelo git — rode `npx prisma generate` após clonar ou alterar o schema). Importe de `../generated/prisma/client`, não de `@prisma/client`.
- A configuração do CLI do Prisma fica em `prisma7.config.ts` (schema, pasta de migrations e `DATABASE_URL`); o `datasource` do `schema.prisma` não tem `url`.
- `PrismaService` (`src/prisma/`) estende o `PrismaClient` usando `@prisma/adapter-pg` com `process.env.DATABASE_URL`. `PrismaModule` é `@Global()` e importado só no `AppModule`; módulos de feature injetam `PrismaService` sem importá-lo.
- Validação global: `ValidationPipe` (`whitelist`, `forbidNonWhitelisted`, `transform`) registrado como `APP_PIPE` no `AppModule`. Propriedades não declaradas no DTO retornam 400.
- **Autenticação obrigatória por padrão**: `JwtAuthGuard` é `APP_GUARD` (registrado no `AuthModule`). Toda rota nova exige `Authorization: Bearer <accessToken>`; só rotas marcadas com `@Public()` (`src/auth/public.decorator.ts`) ficam abertas — hoje `POST /users`, `POST /auth/login` e `POST /auth/refresh`. Use `@CurrentUser()` para obter `{ id, email, role }` do token.
- **Autorização por papel**: `@Roles(Role.ADMIN, ...)` (`src/auth/roles.decorator.ts`) restringe a rota; o `RolesGuard` é um segundo `APP_GUARD`, registrado no `AuthModule` **depois** do `JwtAuthGuard` (a ordem garante `401` sem token antes de `403` por papel — não inverta). Rota sem `@Roles` = qualquer autenticado. O papel vem do access token, não do banco.
- Paginação de users e comments: `PaginationQueryDto` (`page` padrão 1, `limit` padrão 20, máx. 100) e `Paginated<T>` de `src/common/dto/`, com `$transaction([findMany, count])`. A listagem de tickets segue a RN06: `ListTicketsQueryDto` e resposta `{ items, page, limit }` (`TicketPage`). `Trim()` (`src/common/dto/trim.ts`) remove espaços nas extremidades antes da validação.
- **Acesso a tickets por registro** (`src/tickets/`): toda rota com `:id` de ticket chama `TicketsService.findOne(id, user)` antes de qualquer regra ou escrita. Ticket que o usuário não pode ver responde `404`, igual a inexistente (nunca `403`).
- Respostas de ticket usam `ticketSelect`/`userSummarySelect` (`src/tickets/ticket-select.ts`); nunca `include: { customer: true }`, que traria `email` e `passwordHash` do `User`.
- Transições de status só em `canTransition` (`src/tickets/ticket-transitions.ts`). Atribuição e mudança de status são condicionais (`updateMany` filtrando o estado lido; `count === 0` → `409`) e relidas com `ticketSelect`.
- As FKs de `tickets` são `Restrict`: apague `tickets` antes de `categories`/`users` (em scripts). `comments` é apagada em cascata com o ticket; `comments.author_id` também é `Restrict`.
- **Comentários** (`src/comments/`, rotas `tickets/:ticketId/comments`): o `CommentsModule` importa o `TicketsModule` (que exporta `TicketsService`) e as duas rotas chamam `TicketsService.findOne` como **primeira operação** — não duplique a checagem de acesso. Quem pode comentar fica só em `commentPolicy` (`src/comments/comment-policy.ts`, pura; `403` nota interna de cliente, `422` atendente não atribuído ou ticket `CLOSED`). Notas internas são filtradas no `where` (`isInternal: false` para `CUSTOMER`), nunca no resultado em memória. A retomada `WAITING_CUSTOMER → IN_PROGRESS` pelo comentário do cliente dono acontece na mesma `$transaction` interativa do `comment.create`, com `updateMany` condicionado a `WAITING_CUSTOMER` (`count === 0` → `409` lançado dentro da transação, desfazendo o comentário). `author` usa `userSummarySelect` via `commentSelect`.
- **Documentação OpenAPI** (`src/openapi/`): `setupOpenApi(app)` publica `GET /docs` (Swagger UI, assets do `swagger-ui-dist` pelo jsDelivr por causa da Vercel) e `GET /docs-json`, em **todos** os ambientes; é chamado no `main.ts`. As duas rotas são registradas no adaptador HTTP, fora dos controllers: os `APP_GUARD` não se aplicam (sem `@Public()`) e elas não entram no documento. Decorators `@ApiProperty` explícitos ao lado dos validadores (sem o plugin da CLI). Toda rota protegida nova recebe `@ApiAuth({ summary, roles })` com os mesmos papéis do `@Roles`; respostas usam as classes de `src/openapi/responses/` só em `@ApiOkResponse`/`@ApiCreatedResponse` — elas espelham os `select`s, então alterar um `select` exige atualizar a classe.
- Access token JWT HS256 (`JWT_ACCESS_SECRET` obrigatória, `JWT_ACCESS_EXPIRES_IN` padrão `15m`); refresh token opaco guardado só como SHA-256 em `refresh_tokens`, com validade de `REFRESH_TOKEN_TTL_DAYS` (padrão 7). A rotação usa compare-and-set (`updateMany` + `count === 0`) em transação e não lança dentro dela, para que a revogação por reutilização seja comitada.
- Seed em `prisma/seed.ts` (executado com `tsx`, configurado em `migrations.seed` do `prisma7.config.ts`); a lógica do ADMIN fica em `src/users/seed-admin.ts`. Em seguida, fora de `NODE_ENV=production`, roda `prisma/dev-data.ts`: dados de teste que cobrem as specs já implementadas (usuários de cada papel com a senha `senhaSegura123` — ex.: `ana@teste.com` CUSTOMER, `bia@teste.com` SUPPORT, `diego@teste.com` ADMIN — e categorias ativas e a inativa `Legado`). É idempotente e restaura papel, senha e status ao estado descrito no arquivo.
- `tsconfig.json` tem `rootDir: "./"`; o build usa `tsconfig.build.json` com `rootDir: "./src"`.
- Variáveis de ambiente vêm de `.env` via `import 'dotenv/config'` em `src/main.ts` (não há `@nestjs/config`).
- TS com `module: nodenext` e `strict: true` (mas `strictPropertyInitialization: false`).

## Regras de domínio

- Papéis: `CUSTOMER`, `SUPPORT`, `ADMIN`. **Nunca use `AGENT`** como papel.
- Status de ticket: `OPEN → IN_PROGRESS → WAITING_CUSTOMER / RESOLVED → CLOSED` (transições restritas por papel em `src/tickets/ticket-transitions.ts`). `OPEN → IN_PROGRESS` só pela rota de atribuição; `WAITING_CUSTOMER → IN_PROGRESS` é automático quando o cliente dono comenta; transições para `CLOSED` preenchem `closedAt`; ticket `CLOSED` não aceita mudança de status nem comentário.
- Convenção de erros HTTP: 401 sem/token inválido; 403 papel sem acesso à rota; **404 para registro que o usuário não pode ver** (não 403); 409 conflito (e-mail duplicado, alteração concorrente); 422 regra de negócio (transição inválida, categoria inativa); 429 rate limit.
- Não funcionais: hash de senha resistente a força bruta; access token de 15 min + refresh token opaco com rotação e detecção de reutilização; rate limit global e nas rotas de auth; nenhuma resposta/log com senha, hash ou tokens; OpenAPI pública em todos os ambientes (a API é backend do curso de Next.js).

