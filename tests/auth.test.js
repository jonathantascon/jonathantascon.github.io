import test from "node:test";
import assert from "node:assert/strict";
import { passwordHash, passwordsEqual, randomToken, validEmail, validPassword } from "../functions/_lib/auth.js";

test("password hashes are salted and never equal the source password", async () => {
  const one = await passwordHash("correct horse battery staple", "salt-a");
  const two = await passwordHash("correct horse battery staple", "salt-b");
  assert.notEqual(one, "correct horse battery staple");
  assert.notEqual(one, two);
  assert.equal(passwordsEqual(one, await passwordHash("correct horse battery staple", "salt-a")), true);
});

test("session tokens use URL-safe random characters", () => {
  const token = randomToken();
  assert.match(token, /^[A-Za-z0-9_-]+$/);
  assert.ok(token.length >= 40);
});

test("account validation applies email and password requirements", () => {
  assert.equal(validEmail("jonathan@example.com"), true);
  assert.equal(validEmail("invalid"), false);
  assert.equal(validPassword("long-enough-password"), true);
  assert.equal(validPassword("short"), false);
});
