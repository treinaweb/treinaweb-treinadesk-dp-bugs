# Projeto Prático: Construindo APIs com NestJS e IA

Esse repositório contem o código-fonte produzido durante as aulas do projeto prático "TreinaDesk - API de Helpdesk com SDD" da TreinaWeb.

A API também é o backend do curso de Next.js que consome APIs: rode-a localmente e construa o frontend em um projeto separado.

- Repositório da API: https://github.com/treinaweb/treinaweb-treinadesk
- Coleção de endpoints para o Insomnia: [`endpoints-treinadesk-api.yaml`](endpoints-treinadesk-api.yaml) (importe em *Insomnia → Import*)

## Rodando localmente

Pré-requisitos:

- **Node.js 24.9 ou superior** (há um `.nvmrc`: `nvm use`).
- **PostgreSQL** rodando e um banco vazio (ex.: `treinadesk`).

```bash
npm install
cp .env.example .env          # ajuste DATABASE_URL, JWT_ACCESS_SECRET e o ADMIN
npx prisma migrate deploy     # cria as tabelas
npx prisma generate           # gera o client do Prisma em src/generated/prisma
npm run seed                  # ADMIN do .env + usuários, categorias e tickets de teste
npm run start:dev             # API em http://localhost:3000
```

- Documentação interativa (Swagger): http://localhost:3000/docs
- Contrato OpenAPI em JSON: http://localhost:3000/docs-json

Usuários de teste (senha `senhaSegura123`): `ana@teste.com` (CUSTOMER), `bia@teste.com` (SUPPORT), `diego@teste.com` (ADMIN) — a lista completa está no guia.

Testes: `npm test` (unitários) e `npm run test:e2e` (e2e — **apagam os dados do banco do `.env`**; rode `npm run seed` depois).

