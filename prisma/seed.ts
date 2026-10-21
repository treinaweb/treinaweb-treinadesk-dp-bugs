import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client.js';
import { seedAdmin } from '../src/users/seed-admin.js';
import { DEV_PASSWORD, seedDevData } from './dev-data.js';

async function main() {
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
  });

  try {
    // Em produção só garante o ADMIN inicial; os dados de teste apagam tudo.
    if (process.env.NODE_ENV === 'production') {
      const admin = await seedAdmin(prisma, process.env);
      console.log(`Administrador disponível: ${admin.email} (${admin.role})`);
      return;
    }
    const dev = await seedDevData(prisma);
    console.log(
      `Dados de teste: ${dev.users} usuários (senha ${DEV_PASSWORD}), ${dev.categories} categorias e ${dev.tickets} tickets`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
