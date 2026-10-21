import {
  PrismaClient,
  Role,
  TicketPriority,
  TicketStatus,
} from '../src/generated/prisma/client.js';
import { PasswordHasher } from '../src/users/password-hasher.js';

// Dados previsíveis para desenvolvimento local e para o curso de testes.
// Nunca rodam com NODE_ENV=production (ver prisma/seed.ts). Ids e datas são
// fixos: rodar de novo apaga tudo e recria exatamente o mesmo estado.

export const DEV_PASSWORD = 'senha123';

const users = [
  {
    id: 'a0000000-0000-4000-8000-000000000001',
    name: 'Ana',
    email: 'ana@treinadesk.dev',
    role: Role.CUSTOMER,
  },
  {
    id: 'a0000000-0000-4000-8000-000000000002',
    name: 'Bruno',
    email: 'bruno@treinadesk.dev',
    role: Role.CUSTOMER,
  },
  {
    id: 'a0000000-0000-4000-8000-000000000003',
    name: 'Carla',
    email: 'carla@treinadesk.dev',
    role: Role.SUPPORT,
  },
  {
    id: 'a0000000-0000-4000-8000-000000000004',
    name: 'Administrador',
    email: 'admin@treinadesk.dev',
    role: Role.ADMIN,
  },
] as const;

const [ana, bruno, carla] = users;

const categories = [
  { id: 'c0000000-0000-4000-8000-000000000001', name: 'Acesso' },
  { id: 'c0000000-0000-4000-8000-000000000002', name: 'Financeiro' },
  { id: 'c0000000-0000-4000-8000-000000000003', name: 'Suporte Técnico' },
];

const PRIORITIES = [
  TicketPriority.LOW,
  TicketPriority.MEDIUM,
  TicketPriority.HIGH,
  TicketPriority.URGENT,
];

// Ticket 01 é o mais antigo; cada ticket seguinte nasce 1 minuto depois.
const BASE_DATE = new Date('2026-10-01T09:00:00.000Z');
const MINUTE = 60_000;

const ANA_CLOSED = [5, 18];

function anaTicketStatus(n: number): TicketStatus {
  if (ANA_CLOSED.includes(n)) return TicketStatus.CLOSED;
  return n % 3 === 0 ? TicketStatus.IN_PROGRESS : TicketStatus.OPEN;
}

function ticketId(owner: number, n: number): string {
  return `d000000${owner}-0000-4000-8000-${String(n).padStart(12, '0')}`;
}

function buildTickets() {
  const anaTickets = Array.from({ length: 25 }, (_, i) => {
    const n = i + 1;
    const status = anaTicketStatus(n);
    const createdAt = new Date(BASE_DATE.getTime() + i * MINUTE);
    return {
      id: ticketId(1, n),
      title: `Ticket ${String(n).padStart(2, '0')}`,
      description: `Descrição do ticket ${String(n).padStart(2, '0')} da Ana.`,
      status,
      priority: PRIORITIES[i % PRIORITIES.length],
      categoryId: categories[i % categories.length].id,
      customerId: ana.id,
      assigneeId: status === TicketStatus.OPEN ? null : carla.id,
      createdAt,
      closedAt: status === TicketStatus.CLOSED ? createdAt : null,
    };
  });

  const brunoTickets = [
    { title: 'Bruno 01: boleto não chegou', priority: TicketPriority.HIGH },
    { title: 'Bruno 02: troca de e-mail', priority: TicketPriority.LOW },
    { title: 'Bruno 03: erro no relatório', priority: TicketPriority.MEDIUM },
  ].map((ticket, i) => ({
    id: ticketId(2, i + 1),
    title: ticket.title,
    description: `Descrição do ticket ${String(i + 1).padStart(2, '0')} do Bruno.`,
    status: TicketStatus.OPEN,
    priority: ticket.priority,
    categoryId: categories[i % categories.length].id,
    customerId: bruno.id,
    assigneeId: null,
    createdAt: new Date(BASE_DATE.getTime() + (30 + i) * MINUTE),
    closedAt: null,
  }));

  return [...anaTickets, ...brunoTickets];
}

export async function seedDevData(
  prisma: PrismaClient,
  passwordHasher = new PasswordHasher(),
) {
  const passwordHash = await passwordHasher.hash(DEV_PASSWORD);
  const tickets = buildTickets();

  // As FKs de tickets são Restrict: tickets antes de categorias e usuários.
  // comments e refresh_tokens saem em cascata.
  await prisma.$transaction([
    prisma.ticket.deleteMany(),
    prisma.category.deleteMany(),
    prisma.user.deleteMany(),
    prisma.user.createMany({
      data: users.map((user) => ({ ...user, passwordHash })),
    }),
    prisma.category.createMany({ data: categories }),
    prisma.ticket.createMany({ data: tickets }),
  ]);

  return {
    users: users.length,
    categories: categories.length,
    tickets: tickets.length,
  };
}
