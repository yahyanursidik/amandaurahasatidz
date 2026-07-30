import { beforeAll } from "vitest";

beforeAll(() => {
  process.env.APP_ENV = "test";
});
