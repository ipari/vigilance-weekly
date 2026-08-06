const GITHUB_OIDC_ISSUER = "https://token.actions.githubusercontent.com";
const GITHUB_JWKS_URL = `${GITHUB_OIDC_ISSUER}/.well-known/jwks`;
const EXPECTED_AUDIENCE = "vigilance-weekly-scheduler";
const EXPECTED_REPOSITORY = "ipari/pv-monitor";
const EXPECTED_REF = "refs/heads/main";
const EXPECTED_WORKFLOW_REF =
  `${EXPECTED_REPOSITORY}/.github/workflows/scheduler-heartbeat.yml@${EXPECTED_REF}`;
const ALLOWED_EVENTS = new Set(["schedule", "workflow_dispatch"]);
const CLOCK_TOLERANCE_SECONDS = 60;
const JWKS_CACHE_MS = 6 * 60 * 60 * 1000;

type GithubJwk = JsonWebKey & {
  alg?: string;
  kid?: string;
  use?: string;
};

type GithubOidcClaims = {
  aud?: unknown;
  event_name?: unknown;
  exp?: unknown;
  iat?: unknown;
  iss?: unknown;
  nbf?: unknown;
  ref?: unknown;
  repository?: unknown;
  workflow_ref?: unknown;
};

let cachedKeys: GithubJwk[] = [];
let cachedKeysUntil = 0;

export async function verifyGithubActionsScheduler(request: Request) {
  const authorization = request.headers.get("authorization") ?? "";
  if (!authorization.startsWith("Bearer ")) return false;

  const token = authorization.slice("Bearer ".length).trim();
  if (!token || token.length > 16_384) return false;
  const parts = token.split(".");
  if (parts.length !== 3) return false;

  try {
    const header = decodeJson<{ alg?: unknown; kid?: unknown }>(parts[0]);
    const claims = decodeJson<GithubOidcClaims>(parts[1]);
    if (header.alg !== "RS256" || typeof header.kid !== "string") return false;

    const key = (await githubJwks()).find(
      (candidate) => candidate.kid === header.kid && candidate.kty === "RSA",
    );
    if (!key) return false;

    const cryptoKey = await crypto.subtle.importKey(
      "jwk",
      key,
      { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
      false,
      ["verify"],
    );
    const verified = await crypto.subtle.verify(
      "RSASSA-PKCS1-v1_5",
      cryptoKey,
      decodeBase64Url(parts[2]),
      new TextEncoder().encode(`${parts[0]}.${parts[1]}`),
    );
    if (!verified) return false;

    return validClaims(claims, Math.floor(Date.now() / 1000));
  } catch {
    return false;
  }
}

function validClaims(claims: GithubOidcClaims, now: number) {
  if (
    claims.iss !== GITHUB_OIDC_ISSUER ||
    claims.aud !== EXPECTED_AUDIENCE ||
    claims.repository !== EXPECTED_REPOSITORY ||
    claims.ref !== EXPECTED_REF ||
    claims.workflow_ref !== EXPECTED_WORKFLOW_REF ||
    typeof claims.event_name !== "string" ||
    !ALLOWED_EVENTS.has(claims.event_name) ||
    typeof claims.exp !== "number" ||
    typeof claims.iat !== "number"
  ) {
    return false;
  }
  if (claims.exp < now - CLOCK_TOLERANCE_SECONDS) return false;
  if (claims.iat > now + CLOCK_TOLERANCE_SECONDS) return false;
  if (
    typeof claims.nbf === "number" &&
    claims.nbf > now + CLOCK_TOLERANCE_SECONDS
  ) {
    return false;
  }
  return true;
}

async function githubJwks() {
  if (cachedKeys.length > 0 && Date.now() < cachedKeysUntil) {
    return cachedKeys;
  }
  const response = await fetch(GITHUB_JWKS_URL, {
    headers: { accept: "application/json" },
  });
  if (!response.ok) throw new Error("GitHub OIDC 키를 불러오지 못했습니다.");
  const body = (await response.json()) as { keys?: GithubJwk[] };
  if (!Array.isArray(body.keys) || body.keys.length === 0) {
    throw new Error("GitHub OIDC 키가 비어 있습니다.");
  }
  cachedKeys = body.keys;
  cachedKeysUntil = Date.now() + JWKS_CACHE_MS;
  return cachedKeys;
}

function decodeJson<T>(value: string) {
  return JSON.parse(new TextDecoder().decode(decodeBase64Url(value))) as T;
}

function decodeBase64Url(value: string) {
  const base64 = value.replaceAll("-", "+").replaceAll("_", "/");
  const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
  const decoded = atob(padded);
  return Uint8Array.from(decoded, (character) => character.charCodeAt(0));
}
