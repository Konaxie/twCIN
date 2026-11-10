# Referência da API

Todas as rotas — exceto `/api/health`, `/api/settings/public`, `/api/auth/status`, `/api/auth/setup` e `/api/auth/login` — exigem um cookie de sessão `HttpOnly` válido (`twcin_session`).

## Saúde e configurações da organização

- `GET /api/health` — Retorna `{ ok: true }`.
- `GET /api/settings/public` — Retorna `{ settings: { app_name, org_name, logo_data_url } }`.
- `PATCH /api/settings` — Atualiza a identidade visual da organização (`app_name`, `org_name`, `logo_data_url` em PNG, JPEG ou WebP).

## Autenticação

- `GET /api/auth/status` — Verifica se o setup inicial ainda é necessário (`{ needs_setup: boolean }`).
- `POST /api/auth/setup` — Cria o primeiro usuário quando não há contas cadastradas (com rate limit).
- `POST /api/auth/login` — Autentica o usuário e define o cookie de sessão `HttpOnly` (com rate limit rigoroso).
- `POST /api/auth/change-password` — Atualiza a senha do usuário autenticado, rotaciona `token_version` e emite novo cookie.
- `POST /api/auth/logout` — Remove o cookie de sessão.
- `GET /api/auth/me` — Retorna os dados do usuário autenticado atualmente.

## Equipamentos (custódia e inventário de TI)

- `GET /api/catalogs/equipments` — Lista equipamentos (`?includeInactive=true`).
- `GET /api/catalogs/equipments/:id` — Retorna os detalhes do equipamento e o histórico de movimentações vinculadas.
- `POST /api/catalogs/equipments` — Cadastra um equipamento (`ownership_type`, `condition_status`, além dos campos opcionais `patrimony`, `origin`, `received_from`, `reason` e `notes`).
- `PATCH /api/catalogs/equipments/:id` — Edita campos e situação do equipamento com validação de concorrência via `expected_version`.

## Movimentações e empréstimos

- `GET /api/movements` — Lista movimentações (`?includeFinished=true&status=...&sector=...&search=...`).
- `GET /api/movements/:id` — Consulta uma movimentação pelo ID.
- `POST /api/movements` — Registra saída ou empréstimo (`install_location` obrigatório; `patrimony` e `received_by` opcionais) e gera código sequencial `document_code` (`MOV-XXXX`).
- `PATCH /api/movements/:id` — Edita um registro de movimentação com controle otimista de versão.
- `POST /api/movements/:id/return` — Registra a devolução automática com carimbo de data/hora e técnico recebedor.

## Setores, locais e autocomplete

- `GET /api/catalogs/suggestions` — Sugestões combinadas de equipamentos, setores, locais e pessoas para autocomplete.
- `GET /api/catalogs/sectors`, `POST /api/catalogs/sectors`, `PATCH /api/catalogs/sectors/:id`
- `GET /api/catalogs/locations`, `POST /api/catalogs/locations`, `PATCH /api/catalogs/locations/:id`

## Usuários e logs de auditoria

- `GET /api/users`, `POST /api/users`, `PATCH /api/users/:id` — Gestão de usuários da equipe de TI com acesso igualitário (`must_change_password` e ativação/desativação).
- `POST /api/users/:id/revoke-sessions` — Incrementa `token_version` para invalidar sessões ativas imediatamente.
- `GET /api/audit` — Consulta registros imutáveis de auditoria (`?entity=...&entity_id=...&action=...&user_id=...&limit=...`).

## Sincronização offline

- `GET /api/sync/snapshot` — Snapshot completo para hidratação do cache local em `IndexedDB`.
- `POST /api/sync` — Processa operações enfileiradas em ordem cronológica (`equipment.*`, `movement.*`, `sector.create`) com idempotência por `client_uuid` e detecção de conflitos via `version`.
