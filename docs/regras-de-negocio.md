# Regras de negócio: Tickets

Papéis: `CUSTOMER` (cliente que abre tickets), `SUPPORT` (atendente) e `ADMIN`.

- RN01: Todo ticket é criado com status OPEN, sem atendente, pelo CUSTOMER autenticado.
- RN02: Fluxo de status: OPEN > IN_PROGRESS > RESOLVED > CLOSED. Desvios permitidos: IN_PROGRESS > WAITING_CUSTOMER > RESOLVED, RESOLVED > IN_PROGRESS e OPEN > CLOSED (tabela abaixo).
- RN03: Ticket CLOSED não aceita alteração de título, descrição ou prioridade.
- RN04: Só usuários com papel SUPPORT podem ser atribuídos a um ticket. Atribuir um ticket OPEN o move para IN_PROGRESS.
- RN05: CUSTOMER vê apenas os próprios tickets. SUPPORT e ADMIN veem todos.
- RN06: A listagem é paginada com page (começa em 1) e limit (padrão 10). Um limit acima de 50 é reduzido para 50. A ordenação é por createdAt decrescente.
- RN07: Ticket CLOSED não pode ser reaberto. Apenas o CUSTOMER dono pode reabrir um ticket RESOLVED (volta para IN_PROGRESS).

## Transições de status (RN02)

| De | Para | Quem pode | Rota |
| --- | --- | --- | --- |
| OPEN | IN_PROGRESS | SUPPORT (assume da fila) ou ADMIN (informa o atendente) | `PATCH /tickets/:id/assign` |
| IN_PROGRESS | WAITING_CUSTOMER | atendente atribuído ou ADMIN | `PATCH /tickets/:id/status` |
| IN_PROGRESS | RESOLVED | atendente atribuído ou ADMIN | `PATCH /tickets/:id/status` |
| WAITING_CUSTOMER | RESOLVED | atendente atribuído ou ADMIN | `PATCH /tickets/:id/status` |
| WAITING_CUSTOMER | IN_PROGRESS | automático, quando o CUSTOMER dono comenta | `POST /tickets/:id/comments` |
| RESOLVED | IN_PROGRESS | CUSTOMER dono | `PATCH /tickets/:id/status` |
| RESOLVED | CLOSED | CUSTOMER dono ou ADMIN | `PATCH /tickets/:id/status` |
| OPEN | CLOSED | CUSTOMER dono ou ADMIN | `PATCH /tickets/:id/status` |

Qualquer outra transição é recusada.
