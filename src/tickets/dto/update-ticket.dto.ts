import { PartialType, PickType } from '@nestjs/swagger';
import { CreateTicketDto } from './create-ticket.dto.js';

// Mesmas validações da criação; status e categoria não mudam por aqui.
export class UpdateTicketDto extends PartialType(
  PickType(CreateTicketDto, ['title', 'description', 'priority'] as const),
) {}
