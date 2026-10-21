import { ApiProperty } from '@nestjs/swagger';
import { CommentResponse } from './comment.response.js';
import { TicketResponse } from './ticket.response.js';
import { PublicUserResponse } from './user.response.js';

// Espelham Paginated<T> (src/common/dto/paginated.ts). O Swagger não lê
// genéricos, então cada listagem tem a sua classe.

export class PaginatedUsersResponse {
  @ApiProperty({ type: [PublicUserResponse] })
  data: PublicUserResponse[];

  @ApiProperty({ example: 1 })
  page: number;

  @ApiProperty({ example: 20 })
  limit: number;

  @ApiProperty({ example: 6 })
  total: number;
}

// Espelha TicketPage (src/tickets/ticket-select.ts).
export class TicketPageResponse {
  @ApiProperty({ type: [TicketResponse] })
  items: TicketResponse[];

  @ApiProperty({ example: 1 })
  page: number;

  @ApiProperty({ example: 10 })
  limit: number;
}

export class PaginatedCommentsResponse {
  @ApiProperty({ type: [CommentResponse] })
  data: CommentResponse[];

  @ApiProperty({ example: 1 })
  page: number;

  @ApiProperty({ example: 20 })
  limit: number;

  @ApiProperty({
    example: 2,
    description: 'Para CUSTOMER, não conta notas internas.',
  })
  total: number;
}
