import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiParam,
  ApiTags,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import type { AuthenticatedUser } from '../auth/authenticated-user.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { Roles } from '../auth/roles.decorator.js';
import { Role } from '../generated/prisma/client.js';
import { ApiAuth } from '../openapi/api-auth.decorator.js';
import { ErrorResponse } from '../openapi/responses/error.response.js';
import { TicketPageResponse } from '../openapi/responses/paginated.response.js';
import { TicketResponse } from '../openapi/responses/ticket.response.js';
import { AssignTicketDto } from './dto/assign-ticket.dto.js';
import { CreateTicketDto } from './dto/create-ticket.dto.js';
import { ListTicketsQueryDto } from './dto/list-tickets-query.dto.js';
import { UpdateStatusDto } from './dto/update-status.dto.js';
import { UpdateTicketDto } from './dto/update-ticket.dto.js';
import { TicketPage, TicketView } from './ticket-select.js';
import { TicketsService } from './tickets.service.js';

// Autorização em duas camadas: @Roles por rota (403) e acesso ao registro no
// service (404).
const NOT_VISIBLE =
  'Ticket inexistente ou de outro cliente (mesma resposta nos dois casos).';
const CONCURRENT =
  'O ticket foi alterado por outra requisição; recarregue e tente de novo.';

@ApiTags('tickets')
@Controller('tickets')
export class TicketsController {
  constructor(private readonly ticketsService: TicketsService) {}

  @Roles(Role.CUSTOMER)
  @ApiAuth({
    summary: 'Abre ticket',
    description: 'O ticket nasce OPEN, sem atendente, com o cliente do token.',
    roles: [Role.CUSTOMER],
  })
  @ApiCreatedResponse({ type: TicketResponse })
  @ApiBadRequestResponse({
    type: ErrorResponse,
    description: 'Corpo inválido.',
  })
  @ApiUnprocessableEntityResponse({
    type: ErrorResponse,
    description: 'Categoria inexistente ou inativa.',
  })
  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(
    @Body() dto: CreateTicketDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<TicketView> {
    return this.ticketsService.create(dto, user);
  }

  @ApiAuth({
    summary: 'Lista tickets visíveis (paginada)',
    description:
      'CUSTOMER vê os próprios; SUPPORT e ADMIN veem todos. Mais recentes ' +
      'primeiro; limit padrão 10, reduzido para 50 se maior.',
  })
  @ApiOkResponse({ type: TicketPageResponse })
  @ApiBadRequestResponse({
    type: ErrorResponse,
    description: 'Filtros inválidos.',
  })
  @Get()
  findAll(
    @Query() query: ListTicketsQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<TicketPage> {
    return this.ticketsService.findAll(query, user);
  }

  @ApiAuth({ summary: 'Detalhe do ticket' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: TicketResponse })
  @ApiBadRequestResponse({ type: ErrorResponse, description: 'id inválido.' })
  @ApiNotFoundResponse({ type: ErrorResponse, description: NOT_VISIBLE })
  @Get(':id')
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<TicketView> {
    return this.ticketsService.findOne(id, user);
  }

  @ApiAuth({
    summary: 'Altera título, descrição ou prioridade',
    description: 'Ticket CLOSED não aceita alteração.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: TicketResponse })
  @ApiBadRequestResponse({
    type: ErrorResponse,
    description: 'id ou corpo inválido.',
  })
  @ApiNotFoundResponse({ type: ErrorResponse, description: NOT_VISIBLE })
  @ApiUnprocessableEntityResponse({
    type: ErrorResponse,
    description: 'Ticket fechado.',
  })
  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTicketDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<TicketView> {
    return this.ticketsService.update(id, dto, user);
  }

  @Roles(Role.SUPPORT, Role.ADMIN)
  @ApiAuth({
    summary: 'Atribui ticket a um atendente',
    description:
      'SUPPORT assume para si um ticket da fila, OPEN sem atendente (sem ' +
      'corpo). ADMIN informa ' +
      'assigneeId (um SUPPORT) e pode reatribuir tickets OPEN, IN_PROGRESS ' +
      'ou WAITING_CUSTOMER. Ticket OPEN passa a IN_PROGRESS.',
    roles: [Role.SUPPORT, Role.ADMIN],
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: TicketResponse })
  @ApiBadRequestResponse({
    type: ErrorResponse,
    description:
      'id inválido, assigneeId enviado por SUPPORT ou ausente para ADMIN.',
  })
  @ApiNotFoundResponse({ type: ErrorResponse, description: NOT_VISIBLE })
  @ApiConflictResponse({ type: ErrorResponse, description: CONCURRENT })
  @ApiUnprocessableEntityResponse({
    type: ErrorResponse,
    description:
      'Ticket já atribuído a você, status que não permite atribuição ou ' +
      'destinatário que não é SUPPORT.',
  })
  @Patch(':id/assign')
  assign(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AssignTicketDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<TicketView> {
    return this.ticketsService.assign(id, dto, user);
  }

  @ApiAuth({
    summary: 'Altera o status do ticket',
    description:
      'Transições permitidas: IN_PROGRESS → WAITING_CUSTOMER e RESOLVED ' +
      '(atendente atribuído ou ADMIN); WAITING_CUSTOMER → RESOLVED (atendente ' +
      'atribuído ou ADMIN); RESOLVED → IN_PROGRESS (cliente dono); RESOLVED → ' +
      'CLOSED e OPEN → CLOSED (cliente dono ou ADMIN). OPEN → IN_PROGRESS só ' +
      'pela atribuição. CLOSED preenche closedAt e não muda mais.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: TicketResponse })
  @ApiBadRequestResponse({
    type: ErrorResponse,
    description: 'id ou status inválido.',
  })
  @ApiNotFoundResponse({ type: ErrorResponse, description: NOT_VISIBLE })
  @ApiConflictResponse({ type: ErrorResponse, description: CONCURRENT })
  @ApiUnprocessableEntityResponse({
    type: ErrorResponse,
    description: 'Transição não permitida para o seu papel ou o status atual.',
  })
  @Patch(':id/status')
  changeStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateStatusDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<TicketView> {
    return this.ticketsService.changeStatus(id, dto, user);
  }
}
