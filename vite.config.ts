/* Hallmark · pre-emit critique: P5 H5 E5 S5 R5 V5
 * Hallmark · macrostructure: Narrative Workflow · tone: utilitarian · anchor hue: emerald
 */
import { defineConfig, loadEnv, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import type { IncomingMessage, ServerResponse } from "node:http";

const readRequestBody = async (request: IncomingMessage) => {
  if (request.method === "GET" || request.method === "HEAD") return null;
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return chunks.length > 0 ? Buffer.concat(chunks).toString("utf8") : null;
};

const writeFunctionResponse = (
  response: ServerResponse,
  functionResponse: {
    statusCode: number;
    headers?: Record<string, string>;
    multiValueHeaders?: Record<string, string[]>;
    body?: string;
  },
) => {
  response.statusCode = functionResponse.statusCode;
  Object.entries(functionResponse.headers || {}).forEach(([name, value]) => response.setHeader(name, value));
  Object.entries(functionResponse.multiValueHeaders || {}).forEach(([name, value]) => response.setHeader(name, value));
  response.end(functionResponse.body || "");
};

const localNetlifyApi = (): Plugin => ({
  name: "yts-local-netlify-api",
  apply: "serve",
  configureServer(server) {
    server.middlewares.use(async (request, response, next) => {
      if (!request.url?.startsWith("/api/v1")) {
        next();
        return;
      }

      try {
        const requestUrl = new URL(request.url, "http://127.0.0.1");
        if (requestUrl.pathname === "/api/v1/dev/bootstrap" && request.method === "POST") {
          const seedModule = await server.ssrLoadModule("/netlify/functions/lib/db/seed.ts");
          const result = await seedModule.seedDatabase();
          response.statusCode = 200;
          response.setHeader("Content-Type", "application/json");
          response.end(JSON.stringify({ data: result, error: null }));
          return;
        }
        const queryStringParameters = Object.fromEntries(requestUrl.searchParams.entries());
        const headers = Object.fromEntries(
          Object.entries(request.headers).map(([name, value]) => [
            name,
            Array.isArray(value) ? value.join(",") : value || "",
          ]),
        );
        const module = await server.ssrLoadModule("/netlify/functions/api.ts");
        const functionResponse = await module.handler(
          {
            path: requestUrl.pathname,
            rawUrl: requestUrl.toString(),
            rawQuery: requestUrl.search.slice(1),
            httpMethod: request.method || "GET",
            headers,
            multiValueHeaders: {},
            queryStringParameters,
            multiValueQueryStringParameters: {},
            body: await readRequestBody(request),
            isBase64Encoded: false,
          },
          {},
        );

        if (!functionResponse) {
          response.statusCode = 500;
          response.end(JSON.stringify({ error: { message: "API lokal tidak mengembalikan respons." } }));
          return;
        }
        writeFunctionResponse(response, functionResponse);
      } catch (error) {
        server.config.logger.error(error instanceof Error ? error.stack || error.message : String(error));
        response.statusCode = 500;
        response.setHeader("Content-Type", "application/json");
        response.end(JSON.stringify({ error: { message: "API lokal gagal memproses permintaan." } }));
      }
    });
  },
});

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const runtimeEnvironment = loadEnv(mode, import.meta.dirname, "");
  for (const [key, value] of Object.entries(runtimeEnvironment)) {
    if (!process.env[key]) process.env[key] = value;
  }

  return {
    plugins: [react(), localNetlifyApi()],
    resolve: {
      alias: {
        "@": path.resolve(import.meta.dirname, "./src"),
        "@netlify": path.resolve(import.meta.dirname, "./netlify"),
      },
    },
    server: {
      port: 3000,
    },
  };
});
