import { Module } from '@nestjs/common';
import { TicketsController } from './tickets.controller.js';
import { TicketsService } from './tickets.service.js';

@Module({
  controllers: [TicketsController],
  providers: [TicketsService],
  // Comentários reutilizam findOne em vez de duplicar a checagem de acesso.
  exports: [TicketsService],
})
export class TicketsModule {}
