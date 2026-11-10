import assert from "node:assert/strict";
import crypto from "node:crypto";
import { afterEach, describe, it } from "node:test";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../src/app.js";
import type { EnvConfig } from "../src/config/env.js";

function createTestEnv(overrides?: Partial<EnvConfig>): EnvConfig {
  return {
    port: 0,
    host: "127.0.0.1",
    corsOrigin: "http://localhost:5173",
    cookieSecure: false,
    jwtSecret: crypto.randomBytes(32).toString("hex"),
    dbPath: ":memory:",
    seedAdminName: "Técnico Um",
    seedAdminUsername: "tecnico1",
    seedAdminPassword: "test-password-123",
    ...overrides
  };
}

function extractCookie(setCookieHeader: string | string[] | undefined): string {
  assert.ok(setCookieHeader, "Cookie de sessão deve ser definido");
  const raw = Array.isArray(setCookieHeader) ? setCookieHeader[0] : setCookieHeader;
  return raw.split(";")[0];
}

async function loginAndCompleteFirstPassword(
  app: FastifyInstance,
  username: string,
  currentPassword: string,
  newPassword: string
): Promise<string> {
  const loginRes = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { username, password: currentPassword }
  });
  assert.equal(loginRes.statusCode, 200);
  const firstCookie = extractCookie(loginRes.headers["set-cookie"]);

  if (loginRes.json().user.must_change_password) {
    const changeRes = await app.inject({
      method: "POST",
      url: "/api/auth/change-password",
      headers: { cookie: firstCookie },
      payload: { current_password: currentPassword, new_password: newPassword }
    });
    assert.equal(changeRes.statusCode, 200);
    assert.equal(changeRes.json().user.must_change_password, false);
    return extractCookie(changeRes.headers["set-cookie"]);
  }

  return firstCookie;
}

describe("twCIN API", () => {
  let app: FastifyInstance | null = null;

  afterEach(async () => {
    if (app) {
      await app.close();
      app = null;
    }
  });

  it("permite setup inicial único quando não há usuários e bloqueia segundo setup", async () => {
    const built = await buildApp({
      env: createTestEnv({
        seedAdminName: undefined,
        seedAdminUsername: undefined,
        seedAdminPassword: undefined
      })
    });
    app = built.app;

    const statusBefore = await app.inject({ method: "GET", url: "/api/auth/status" });
    assert.equal(statusBefore.statusCode, 200);
    assert.equal(statusBefore.json().needs_setup, true);

    const setupRes = await app.inject({
      method: "POST",
      url: "/api/auth/setup",
      payload: {
        full_name: "Admin TI",
        username: "adminti",
        password: "senha-forte-setup-99",
        app_name: "TechBench",
        org_name: "Empresa Exemplo"
      }
    });
    assert.equal(setupRes.statusCode, 201);
    assert.equal(setupRes.json().user.must_change_password, false);

    const statusAfter = await app.inject({ method: "GET", url: "/api/auth/status" });
    assert.equal(statusAfter.json().needs_setup, false);

    const secondSetup = await app.inject({
      method: "POST",
      url: "/api/auth/setup",
      payload: {
        full_name: "Outro",
        username: "outro",
        password: "outra-senha-99"
      }
    });
    assert.equal(secondSetup.statusCode, 409);

    const pubSettings = await app.inject({ method: "GET", url: "/api/settings/public" });
    assert.equal(pubSettings.json().settings.app_name, "TechBench");
    assert.equal(pubSettings.json().settings.org_name, "Empresa Exemplo");
  });

  it("exige troca de senha no primeiro login, invalida token antigo, bloqueia rota sem troca e aplica rate limit", async () => {
    const built = await buildApp({
      env: createTestEnv(),
      loginRateLimitMax: 3,
      globalRateLimitMax: 100
    });
    app = built.app;

    const unauthRes = await app.inject({ method: "GET", url: "/api/catalogs/equipments" });
    assert.equal(unauthRes.statusCode, 401);

    const loginRes = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { username: "tecnico1", password: "test-password-123" }
    });
    assert.equal(loginRes.statusCode, 200);
    assert.equal(loginRes.json().user.must_change_password, true);
    assert.ok(loginRes.json().user.last_login_at);
    const initialCookie = extractCookie(loginRes.headers["set-cookie"]);

    const blockedEquip = await app.inject({
      method: "GET",
      url: "/api/catalogs/equipments",
      headers: { cookie: initialCookie }
    });
    assert.equal(blockedEquip.statusCode, 403);
    assert.equal(blockedEquip.json().code, "PASSWORD_CHANGE_REQUIRED");

    const samePassRes = await app.inject({
      method: "POST",
      url: "/api/auth/change-password",
      headers: { cookie: initialCookie },
      payload: { current_password: "test-password-123", new_password: "test-password-123" }
    });
    assert.equal(samePassRes.statusCode, 400);

    const changeRes = await app.inject({
      method: "POST",
      url: "/api/auth/change-password",
      headers: { cookie: initialCookie },
      payload: { current_password: "test-password-123", new_password: "nova-senha-segura-99" }
    });
    assert.equal(changeRes.statusCode, 200);
    assert.equal(changeRes.json().user.must_change_password, false);
    const freshCookie = extractCookie(changeRes.headers["set-cookie"]);

    const staleRes = await app.inject({
      method: "GET",
      url: "/api/auth/me",
      headers: { cookie: initialCookie }
    });
    assert.equal(staleRes.statusCode, 401);

    const allowedEquip = await app.inject({
      method: "GET",
      url: "/api/catalogs/equipments",
      headers: { cookie: freshCookie }
    });
    assert.equal(allowedEquip.statusCode, 200);

    await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { username: "tecnico1", password: "wrong" }
    });
    await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { username: "tecnico1", password: "wrong" }
    });
    const rateLimited = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { username: "tecnico1", password: "wrong" }
    });
    assert.equal(rateLimited.statusCode, 429);
  });

  it("cadastra equipamentos com origem, propriedade e situação, consulta detalhes com movimentações e grava audit_logs", async () => {
    const built = await buildApp({ env: createTestEnv() });
    app = built.app;

    const cookie = await loginAndCompleteFirstPassword(
      app,
      "tecnico1",
      "test-password-123",
      "tecnico1-nova-senha-2026"
    );

    const createEqRes = await app.inject({
      method: "POST",
      url: "/api/catalogs/equipments",
      headers: { cookie },
      payload: {
        name: "Notebook Recepção 02",
        ownership_type: "terceiro",
        condition_status: "manutencao",
        origin: "Recepção",
        received_from: "Ana",
        reason: "Tela piscando e bateria viciada"
      }
    });
    assert.equal(createEqRes.statusCode, 201);
    const eq = createEqRes.json().item;
    assert.equal(eq.patrimony, null);
    assert.equal(eq.ownership_type, "terceiro");
    assert.equal(eq.condition_status, "manutencao");
    assert.equal(eq.received_from, "Ana");
    assert.equal(eq.created_by_name, "Técnico Um");

    // Cria movimentação vinculada ao equipamento (exigindo install_location)
    const missingLocRes = await app.inject({
      method: "POST",
      url: "/api/movements",
      headers: { cookie },
      payload: {
        equipment_id: eq.id,
        equipment_name: eq.name,
        sector_name: "Recepção",
        install_location: ""
      }
    });
    assert.equal(missingLocRes.statusCode, 400);

    const movRes = await app.inject({
      method: "POST",
      url: "/api/movements",
      headers: { cookie },
      payload: {
        equipment_id: eq.id,
        equipment_name: eq.name,
        sector_name: "Recepção",
        install_location: "Balcão Principal"
      }
    });
    assert.equal(movRes.statusCode, 201);

    // Atualiza situação do equipamento
    const patchEqRes = await app.inject({
      method: "PATCH",
      url: `/api/catalogs/equipments/${eq.id}`,
      headers: { cookie },
      payload: {
        condition_status: "disponivel",
        expected_version: eq.version
      }
    });
    assert.equal(patchEqRes.statusCode, 200);
    assert.equal(patchEqRes.json().item.version, 2);

    // Consulta detalhes do equipamento com movimentações vinculadas
    const detailsRes = await app.inject({
      method: "GET",
      url: `/api/catalogs/equipments/${eq.id}`,
      headers: { cookie }
    });
    assert.equal(detailsRes.statusCode, 200);
    assert.equal(detailsRes.json().item.condition_status, "disponivel");
    assert.equal(detailsRes.json().movements.length, 1);

    const auditRes = await app.inject({
      method: "GET",
      url: `/api/audit?entity=catalog_equipment&entity_id=${eq.id}`,
      headers: { cookie }
    });
    assert.equal(auditRes.statusCode, 200);
    assert.equal(auditRes.json().items.length, 2);
  });

  it("cria movimentação, registra devolução e garante idempotência e conflito no /api/sync", async () => {
    const built = await buildApp({ env: createTestEnv() });
    app = built.app;

    const cookie = await loginAndCompleteFirstPassword(
      app,
      "tecnico1",
      "test-password-123",
      "tecnico1-nova-senha-2026"
    );

    const offlineUuid = crypto.randomUUID();
    const syncRes1 = await app.inject({
      method: "POST",
      url: "/api/sync",
      headers: { cookie },
      payload: {
        operations: [
          {
            op_id: "op-1",
            type: "movement.create",
            payload: {
              client_uuid: offlineUuid,
              movement_type: "emprestimo",
              equipment_name: "Projetor Epson S41+",
              patrimony: "PAT-0205",
              sector_name: "Setor Audiovisual",
              install_location: "Sala 102"
            }
          }
        ]
      }
    });
    assert.equal(syncRes1.statusCode, 200);
    const createdMov = syncRes1.json().results[0].record;
    assert.equal(createdMov.document_code, "MOV-0001");
    assert.equal(createdMov.registered_by_name, "Técnico Um");
    assert.equal(createdMov.received_by, "");

    const syncResDup = await app.inject({
      method: "POST",
      url: "/api/sync",
      headers: { cookie },
      payload: {
        operations: [
          {
            op_id: "op-1",
            type: "movement.create",
            payload: {
              client_uuid: offlineUuid,
              movement_type: "emprestimo",
              equipment_name: "Projetor Epson S41+",
              patrimony: "PAT-0205",
              sector_name: "Setor Audiovisual",
              install_location: "Sala 102"
            }
          }
        ]
      }
    });
    assert.equal(syncResDup.json().snapshot.movements.length, 1);

    const retRes = await app.inject({
      method: "POST",
      url: `/api/movements/${createdMov.id}/return`,
      headers: { cookie },
      payload: {}
    });
    assert.equal(retRes.statusCode, 200);
    assert.equal(retRes.json().item.status, "devolvido");
    assert.equal(retRes.json().item.version, 2);

    const syncConflictRes = await app.inject({
      method: "POST",
      url: "/api/sync",
      headers: { cookie },
      payload: {
        operations: [
          {
            op_id: "op-stale",
            type: "movement.update",
            entity_id: createdMov.id,
            payload: {
              install_location: "Auditório",
              expected_version: 1
            }
          }
        ]
      }
    });
    assert.equal(syncConflictRes.statusCode, 200);
    assert.equal(syncConflictRes.json().results[0].status, "conflict");

    const syncSectorRes = await app.inject({
      method: "POST",
      url: "/api/sync",
      headers: { cookie },
      payload: {
        operations: [
          {
            op_id: "op-sec-1",
            type: "sector.create",
            payload: {
              name: "Almoxarifado Central",
              is_default: false
            }
          },
          {
            op_id: "op-sec-2",
            type: "sector.create",
            payload: {
              name: "almoxarifado central",
              is_default: false
            }
          }
        ]
      }
    });
    assert.equal(syncSectorRes.statusCode, 200);
    assert.equal(syncSectorRes.json().results[0].status, "applied");
    assert.equal(syncSectorRes.json().results[1].status, "applied");
    assert.equal(syncSectorRes.json().results[0].record.id, syncSectorRes.json().results[1].record.id);
    assert.ok(
      syncSectorRes
        .json()
        .snapshot.catalog_sectors.some((s: { name: string }) => s.name === "Almoxarifado Central")
    );
  });

  it("cria usuários, valida configurações de organização e bloqueia SVG inseguro", async () => {
    const built = await buildApp({ env: createTestEnv() });
    app = built.app;

    const cookie = await loginAndCompleteFirstPassword(
      app,
      "tecnico1",
      "test-password-123",
      "tecnico1-nova-senha-2026"
    );

    const createNoForceRes = await app.inject({
      method: "POST",
      url: "/api/users",
      headers: { cookie },
      payload: {
        full_name: "Técnico Dois",
        username: "tecnico2",
        password: "secret-user-1",
        must_change_password: false
      }
    });
    assert.equal(createNoForceRes.statusCode, 201);
    const user2Id = createNoForceRes.json().item.id;
    assert.equal(createNoForceRes.json().item.must_change_password, 0);

    const login2 = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { username: "tecnico2", password: "secret-user-1" }
    });
    assert.equal(login2.statusCode, 200);
    const cookie2 = extractCookie(login2.headers["set-cookie"]);

    const revokeRes = await app.inject({
      method: "POST",
      url: `/api/users/${user2Id}/revoke-sessions`,
      headers: { cookie },
      payload: {}
    });
    assert.equal(revokeRes.statusCode, 200);

    const afterRevoke = await app.inject({
      method: "GET",
      url: "/api/catalogs/equipments",
      headers: { cookie: cookie2 }
    });
    assert.equal(afterRevoke.statusCode, 401);

    const disableRes = await app.inject({
      method: "PATCH",
      url: `/api/users/${user2Id}`,
      headers: { cookie },
      payload: { active: false }
    });
    assert.equal(disableRes.statusCode, 200);

    const loginDisabled = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { username: "tecnico2", password: "secret-user-1" }
    });
    assert.equal(loginDisabled.statusCode, 401);

    const svgReject = await app.inject({
      method: "PATCH",
      url: "/api/settings",
      headers: { cookie },
      payload: {
        logo_data_url: "data:image/svg+xml;base64,PHN2Zz48c2NyaXB0PmFsZXJ0KDEpPC9zY3JpcHQ+PC9zdmc+"
      }
    });
    assert.equal(svgReject.statusCode, 400);

    const pngValid = await app.inject({
      method: "PATCH",
      url: "/api/settings",
      headers: { cookie },
      payload: {
        app_name: "twCIN Custom",
        org_name: "Minha Organização"
      }
    });
    assert.equal(pngValid.statusCode, 200);
    assert.equal(pngValid.json().settings.org_name, "Minha Organização");
  });
});
