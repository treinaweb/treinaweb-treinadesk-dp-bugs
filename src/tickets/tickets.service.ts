import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import type { AuthenticatedUser } from '../auth/authenticated-user.js';
import { Prisma, Role, TicketStatus } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { AssignTicketDto } from './dto/assign-ticket.dto.js';
import { CreateTicketDto } from './dto/create-ticket.dto.js';
import { ListTicketsQueryDto } from './dto/list-tickets-query.dto.js';
import { UpdateStatusDto } from './dto/update-status.dto.js';
import { UpdateTicketDto } from './dto/update-ticket.dto.js';
import { ticketSelect, TicketView } from './ticket-select.js';
import { canTransition } from './ticket-transitions.js';

const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 50;

const ASSIGNABLE_STATUSES: TicketStatus[] = [
  TicketStatus.OPEN,
  TicketStatus.IN_PROGRESS,
  TicketStatus.WAITING_CUSTOMER,
];

@Injectable()
export class TicketsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    dto: CreateTicketDto,
    user: AuthenticatedUser,
  ): Promise<TicketView> {
    // Inexistente e inativa com a mesma resposta.
    const category = await this.prisma.category.findFirst({
      where: { id: dto.categoryId, active: true },
      select: { id: true },
    });
    if (!category) {
      throw new UnprocessableEntityException(
        'Categoria inexistente ou inativa',
      );
    }

    return this.prisma.ticket.create({
      data: { ...dto, customerId: user.id },
      select: ticketSelect,
    });
  }

  async findAll(query: ListTicketsQueryDto, user: AuthenticatedUser) {
    const page = query.page ?? 1;
    const limit = Math.min(query.limit ?? DEFAULT_LIMIT, MAX_LIMIT);
    const where: Prisma.TicketWhereInput = {
      status: query.status,
      priority: query.priority,
    };
    if (user.role === Role.CUSTOMER) {
      where.customerId = user.id;
    }

    const items = await this.prisma.ticket.findMany({
      where,
      select: ticketSelect,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return { items, page, limit };
  }

  // Toda rota com :id passa por aqui antes de qualquer regra ou escrita.
  async findOne(id: string, user: AuthenticatedUser): Promise<TicketView> {
    const ticket = await this.prisma.ticket.findUnique({
      where: { id },
      select: ticketSelect,
    });
    if (!ticket) {
      throw new NotFoundException('Ticket não encontrado');
    }
    if (user.role === Role.CUSTOMER && ticket.customer.id !== user.id) {
      throw new NotFoundException('Ticket não encontrado');
    }
    return ticket;
  }

  async update(
    id: string,
    dto: UpdateTicketDto,
    user: AuthenticatedUser,
  ): Promise<TicketView> {
    await this.findOne(id, user);
    return this.prisma.ticket.update({
      where: { id },
      data: dto,
      select: ticketSelect,
    });
  }

  async assign(
    id: string,
    dto: AssignTicketDto,
    user: AuthenticatedUser,
  ): Promise<TicketView> {
    if (user.role === Role.SUPPORT && dto.assigneeId !== undefined) {
      throw new BadRequestException(
        'assigneeId não é permitido: o atendente assume o ticket para si',
      );
    }
    if (user.role === Role.ADMIN && dto.assigneeId === undefined) {
      throw new BadRequestException('assigneeId é obrigatório');
    }

    const ticket = await this.findOne(id, user);

    if (user.role === Role.SUPPORT) {
      if (ticket.assignee?.id === user.id) {
        throw new UnprocessableEntityException(
          'O ticket já está atribuído a você',
        );
      }
      if (ticket.status !== TicketStatus.OPEN || ticket.assignee !== null) {
        throw new UnprocessableEntityException(
          'Só é possível assumir tickets da fila (OPEN sem atendente)',
        );
      }
      return this.writeIfUnchanged(
        { id, status: TicketStatus.OPEN, assigneeId: null },
        { assigneeId: user.id, status: TicketStatus.IN_PROGRESS },
      );
    }

    if (!ASSIGNABLE_STATUSES.includes(ticket.status)) {
      throw new UnprocessableEntityException(
        'O status do ticket não permite atribuição',
      );
    }
    const assignee = await this.prisma.user.findUnique({
      where: { id: dto.assigneeId },
      select: { id: true, role: true },
    });
    if (!assignee || assignee.role !== Role.SUPPORT) {
      throw new UnprocessableEntityException(
        'O destinatário deve ser um atendente (SUPPORT)',
      );
    }

    return this.writeIfUnchanged(
      { id, status: ticket.status, assigneeId: ticket.assignee?.id ?? null },
      {
        assigneeId: assignee.id,
        status:
          ticket.status === TicketStatus.OPEN
            ? TicketStatus.IN_PROGRESS
            : ticket.status,
      },
    );
  }

  async changeStatus(
    id: string,
    dto: UpdateStatusDto,
    user: AuthenticatedUser,
  ): Promise<TicketView> {
    const ticket = await this.findOne(id, user);

    const allowed = canTransition({
      from: ticket.status,
      to: dto.status,
      role: user.role,
      isOwner: ticket.customer.id === user.id,
      isAssignee: ticket.assignee?.id === user.id,
    });
    if (!allowed) {
      throw new UnprocessableEntityException(
        `Transição de ${ticket.status} para ${dto.status} não permitida`,
      );
    }

    // assigneeId na condição: um atendente substituído entre a leitura e a
    // escrita não altera o status com a permissão antiga.
    return this.writeIfUnchanged(
      { id, status: ticket.status, assigneeId: ticket.assignee?.id ?? null },
      dto.status === TicketStatus.CLOSED
        ? { status: dto.status, closedAt: new Date() }
        : { status: dto.status },
    );
  }

  // Compare-and-set: grava só se o ticket ainda está no estado lido.
  private async writeIfUnchanged(
    where: Prisma.TicketWhereInput & { id: string },
    data: Prisma.TicketUncheckedUpdateManyInput,
  ): Promise<TicketView> {
    const { count } = await this.prisma.ticket.updateMany({ where, data });
    if (count === 0) {
      throw new ConflictException('O ticket foi alterado por outra requisição');
    }
    return this.prisma.ticket.findUniqueOrThrow({
      where: { id: where.id },
      select: ticketSelect,
    });
  }
}
