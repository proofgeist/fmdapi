import nock, { cleanAll } from "nock";
import { fmDAPI, FileMakerError } from "../src";

const client = fmDAPI({
  server: "http://example.com",
  db: "db",
  auth: { username: "user", password: "pass" },
});

test("my function", () => {
  expect(1 + 2).toBe(3);
});
