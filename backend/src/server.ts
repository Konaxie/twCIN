import { buildApp } from "./app.js";
import { loadEnv } from "./config/env.js";

async function main() {
  const env = loadEnv();
  const { app } = await buildApp({ env });

  await app.listen({ port: env.port, host: env.host });
  console.log(`twCIN backend rodando em http://localhost:${env.port}`);
}

main().catch((err) => {
  console.error("Falha ao iniciar servidor:", err);
  process.exit(1);
});
