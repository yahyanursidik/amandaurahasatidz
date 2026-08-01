import { createServer } from "vite";

const server = await createServer({
  server: { middlewareMode: true },
  appType: "custom",
});

try {
  const seedModule = await server.ssrLoadModule("/netlify/functions/lib/db/seed.ts");
  const result = await seedModule.seedDatabase();
  console.log(JSON.stringify(result, null, 2));
} finally {
  await server.close();
}
