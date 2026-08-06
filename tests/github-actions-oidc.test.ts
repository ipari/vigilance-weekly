import assert from "node:assert/strict";
import test from "node:test";
import { verifyGithubActionsScheduler } from "../worker/github-actions-oidc.ts";

const encoder = new TextEncoder();

test("accepts only the scheduler workflow OIDC token", async () => {
  const keys = await crypto.subtle.generateKey(
    {
      name: "RSASSA-PKCS1-v1_5",
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: "SHA-256",
    },
    true,
    ["sign", "verify"],
  );
  const publicJwk = await crypto.subtle.exportKey("jwk", keys.publicKey);
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    Response.json({ keys: [{ ...publicJwk, kid: "test-key", alg: "RS256" }] });

  try {
    const now = Math.floor(Date.now() / 1000);
    const claims = {
      iss: "https://token.actions.githubusercontent.com",
      aud: "vigilance-weekly-scheduler",
      repository: "ipari/pv-monitor",
      ref: "refs/heads/main",
      workflow_ref:
        "ipari/pv-monitor/.github/workflows/scheduler-heartbeat.yml@refs/heads/main",
      event_name: "schedule",
      iat: now,
      nbf: now,
      exp: now + 300,
    };

    const validToken = await signToken(keys.privateKey, claims);
    assert.equal(
      await verifyGithubActionsScheduler(
        new Request("https://example.test/api/scheduler/heartbeat", {
          headers: { authorization: `Bearer ${validToken}` },
        }),
      ),
      true,
    );

    const wrongWorkflowToken = await signToken(keys.privateKey, {
      ...claims,
      workflow_ref:
        "ipari/pv-monitor/.github/workflows/other.yml@refs/heads/main",
    });
    assert.equal(
      await verifyGithubActionsScheduler(
        new Request("https://example.test/api/scheduler/heartbeat", {
          headers: { authorization: `Bearer ${wrongWorkflowToken}` },
        }),
      ),
      false,
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

async function signToken(
  privateKey: CryptoKey,
  claims: Record<string, unknown>,
) {
  const header = base64Url(JSON.stringify({ alg: "RS256", kid: "test-key" }));
  const payload = base64Url(JSON.stringify(claims));
  const input = `${header}.${payload}`;
  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    privateKey,
    encoder.encode(input),
  );
  return `${input}.${base64Url(new Uint8Array(signature))}`;
}

function base64Url(value: string | Uint8Array) {
  const bytes = typeof value === "string" ? encoder.encode(value) : value;
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}
