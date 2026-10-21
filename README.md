# TreinaDesk API: Testando e Corrigindo Bugs com IA

API REST de helpdesk (tickets de suporte) em NestJS 12, Prisma 7 e PostgreSQL, usada no Direto ao Ponto "Testando e Corrigindo Bugs com IA" da TreinaWeb. Ela é derivada do projeto prático "TreinaDesk - API de Helpdesk com SDD".

As regras de negócio que os testes verificam estão em [`docs/regras-de-negocio.md`](docs/regras-de-negocio.md).

## Rodando localmente

Pré-requisitos:

- **Node.js 24.9 ou superior** (há um `.nvmrc`: `nvm use`).
- **Docker** (para o PostgreSQL) ou um PostgreSQL já instalado.

```bash
npm install
cp .env.example .env          # com Docker, os valores padrão já funcionam
docker compose up -d          # sobe db (5432) e db-test (5433)
npx prisma generate           # gera o client do Prisma em src/generated/prisma
npx prisma migrate deploy     # cria as tabelas
npx prisma db seed            # usuários e tickets do curso (apaga os dados antes)
npm run start:dev             # API em http://localhost:3000
```

- Documentação interativa (Swagger): http://localhost:3000/docs
- Contrato OpenAPI em JSON: http://localhost:3000/docs-json

Sem Docker: aponte o `DATABASE_URL` do `.env` para o seu PostgreSQL e crie um `.env.test.local` com o `DATABASE_URL` do banco de testes (ele sobrescreve o `.env.test`).

## Usuários do seed

Todos com a senha `senha123`.

| Usuário | Papel | Dados |
| --- | --- | --- |
| `ana@treinadesk.dev` | CUSTOMER | 25 tickets ("Ticket 01" a "Ticket 25", 1 minuto entre cada), 2 deles CLOSED (05 e 18) |
| `bruno@treinadesk.dev` | CUSTOMER | 3 tickets |
| `carla@treinadesk.dev` | SUPPORT | atendente dos tickets IN_PROGRESS e CLOSED da Ana |
| `admin@treinadesk.dev` | ADMIN | |

Os ids são fixos: usuários `a0000000-0000-4000-8000-00000000000N` (Ana 1, Bruno 2, Carla 3, admin 4) e tickets `d0000001-0000-4000-8000-0000000000NN` (Ana, NN de 01 a 25) e `d0000002-...` (Bruno).

## Testes

```bash
npm test               # unitários (src/**/*.spec.ts)
npm run test:e2e       # integração (test/*.e2e-spec.ts), contra o banco do .env.test
```

O `test:e2e` aplica as migrations no banco de testes e roda o Jest com `--runInBand`. Cada suíte limpa as tabelas que usa, então o banco de testes não deve ser o mesmo do desenvolvimento.
