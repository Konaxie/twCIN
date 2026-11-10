import type { DatabaseSync } from "node:sqlite";
import type { FastifyInstance } from "fastify";

export function registerAuditRoutes(
  app: FastifyInstance,
  db: DatabaseSync,
  requireAuth: (req: any, reply: any) => Promise<void>
): void {
  app.get("/api/audit", { preHandler: [requireAuth] }, async (request) => {
    const query = request.query as {
      entity?: string;
      entity_id?: string;
      action?: string;
      user_id?: string;
      limit?: string;
    };

    const conditions: string[] = [];
    const params: Array<string | number> = [];

    if (query.entity?.trim()) {
      conditions.push("entity = ?");
      params.push(query.entity.trim());
    }
    if (query.entity_id) {
      const entityId = Number(query.entity_id);
      if (Number.isInteger(entityId) && entityId > 0) {
        conditions.push("entity_id = ?");
        params.push(entityId);
      }
    }
    if (query.action?.trim()) {
      conditions.push("action = ?");
      params.push(query.action.trim());
    }
    if (query.user_id) {
      const userId = Number(query.user_id);
      if (Number.isInteger(userId) && userId > 0) {
        conditions.push("user_id = ?");
        params.push(userId);
      }
    }

    const parsedLimit = Number(query.limit || 150);
    const limit = Number.isFinite(parsedLimit) ? Math.min(Math.max(parsedLimit, 1), 500) : 150;
    const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    const items = db
      .prepare(`SELECT * FROM audit_logs ${where} ORDER BY created_at DESC, id DESC LIMIT ?`)
      .all(...params, limit);

    return { items };
  });
}
