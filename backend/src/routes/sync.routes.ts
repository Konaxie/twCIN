import type { DatabaseSync } from "node:sqlite";
import type { FastifyInstance } from "fastify";
import { syncBatchSchema } from "../schemas/index.js";
import { buildSyncSnapshot, processSyncBatch } from "../services/sync.service.js";

export function registerSyncRoutes(
  app: FastifyInstance,
  db: DatabaseSync,
  requireAuth: (req: any, reply: any) => Promise<void>
): void {
  app.get("/api/sync/snapshot", { preHandler: [requireAuth] }, async () => {
    return buildSyncSnapshot(db);
  });

  app.post("/api/sync", { preHandler: [requireAuth] }, async (request) => {
    const parsed = syncBatchSchema.parse(request.body);
    const results = processSyncBatch(db, parsed.operations, request.currentUser!, request.ip);
    const snapshot = buildSyncSnapshot(db);
    return { results, snapshot };
  });
}
