const encoder = new TextEncoder();
const MAX_PBKDF2_ITERATIONS = 100000;
const COOKIE_SESSION = "digify_montasite_session";
const COOKIE_CHALLENGE = "digify_montasite_challenge";

const bytesToBase64Url = bytes => {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
};

const base64UrlToBytes = value => {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((value.length + 3) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, character => character.charCodeAt(0));
};

const timingSafeEqual = (left, right) => {
  const a = typeof left === "string" ? encoder.encode(left) : left;
  const b = typeof right === "string" ? encoder.encode(right) : right;
  if (a.length !== b.length) return false;
  let difference = 0;
  for (let index = 0; index < a.length; index += 1) difference |= a[index] ^ b[index];
  return difference === 0;
};

const hmac = async (secret, value) => {
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return bytesToBase64Url(new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(value))));
};

export const json = (body, status = 200, headers = {}) => new Response(JSON.stringify(body), {
  status,
  headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...headers }
});

export const isSameOrigin = request => {
  const origin = request.headers.get("origin");
  return !origin || origin === new URL(request.url).origin;
};

export const readCookies = request => Object.fromEntries(
  (request.headers.get("cookie") || "").split(";").map(part => part.trim()).filter(Boolean).map(part => {
    const separator = part.indexOf("=");
    return separator < 0 ? [part, ""] : [part.slice(0, separator), decodeURIComponent(part.slice(separator + 1))];
  })
);

export const sessionCookie = (value, maxAge = 8 * 60 * 60) =>
  `${COOKIE_SESSION}=${encodeURIComponent(value)}; Path=/; Max-Age=${maxAge}; HttpOnly; Secure; SameSite=Strict`;

export const challengeCookie = (value, maxAge = 10 * 60) =>
  `${COOKIE_CHALLENGE}=${encodeURIComponent(value)}; Path=/api/montasite-auth; Max-Age=${maxAge}; HttpOnly; Secure; SameSite=Strict`;

export const clearSessionCookie = () => `${COOKIE_SESSION}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Strict`;
export const clearChallengeCookie = () => `${COOKIE_CHALLENGE}=; Path=/api/montasite-auth; Max-Age=0; HttpOnly; Secure; SameSite=Strict`;

export const getChallengeId = request => readCookies(request)[COOKIE_CHALLENGE] || "";

export const createSession = async (email, secret) => {
  const payload = bytesToBase64Url(encoder.encode(JSON.stringify({
    email,
    issuedAt: Date.now(),
    expiresAt: Date.now() + 8 * 60 * 60 * 1000,
    nonce: crypto.randomUUID()
  })));
  return `${payload}.${await hmac(secret, payload)}`;
};

export const verifySession = async (request, env) => {
  const secret = env.MONTASITE_SESSION_SECRET;
  if (!secret) return null;
  const token = readCookies(request)[COOKIE_SESSION];
  if (!token) return null;
  const [payload, signature, extra] = token.split(".");
  if (!payload || !signature || extra) return null;
  const expected = await hmac(secret, payload);
  if (!timingSafeEqual(signature, expected)) return null;
  try {
    const data = JSON.parse(new TextDecoder().decode(base64UrlToBytes(payload)));
    if (!data.email || !data.expiresAt || data.expiresAt <= Date.now()) return null;
    return data;
  } catch {
    return null;
  }
};

export const requireSession = async (context) => {
  const session = await verifySession(context.request, context.env);
  return session || null;
};

export const verifyPassword = async (password, storedHash) => {
  const [algorithm, iterationsText, saltEncoded, hashEncoded, extra] = String(storedHash || "").split("$");
  const iterations = Number(iterationsText);
  if (algorithm !== "pbkdf2" || !Number.isInteger(iterations) || iterations < 100000 || iterations > MAX_PBKDF2_ITERATIONS || !saltEncoded || !hashEncoded || extra) return false;
  try {
    const key = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveBits"]);
    const derived = new Uint8Array(await crypto.subtle.deriveBits({
      name: "PBKDF2",
      salt: base64UrlToBytes(saltEncoded),
      iterations,
      hash: "SHA-256"
    }, key, base64UrlToBytes(hashEncoded).length * 8));
    return timingSafeEqual(derived, base64UrlToBytes(hashEncoded));
  } catch {
    return false;
  }
};

export const hashOtp = (code, challengeId, secret) => hmac(secret, `${challengeId}:${code}`);

export const maskEmail = email => {
  const [name, domain] = String(email).split("@");
  if (!name || !domain) return email;
  return `${name.slice(0, 2)}${"*".repeat(Math.max(2, name.length - 2))}@${domain}`;
};

export const authConfig = env => {
  const hasNativeEmail = Boolean(env.MONTASITE_EMAIL && typeof env.MONTASITE_EMAIL.send === "function");
  const hasEmailWorker = Boolean(env.MONTASITE_EMAIL_WORKER && typeof env.MONTASITE_EMAIL_WORKER.fetch === "function");
  const hasResendFallback = Boolean(env.RESEND_API_KEY && env.MONTASITE_EMAIL_FROM);
  return {
    ready: Boolean(env.MONTASITE_AUTH && env.MONTASITE_ADMIN_EMAIL && env.MONTASITE_PASSWORD_HASH && env.MONTASITE_SESSION_SECRET && env.MONTASITE_OTP_SECRET && (hasNativeEmail || hasEmailWorker || hasResendFallback)),
    missing: [
    ["MONTASITE_AUTH", env.MONTASITE_AUTH],
    ["MONTASITE_ADMIN_EMAIL", env.MONTASITE_ADMIN_EMAIL],
    ["MONTASITE_PASSWORD_HASH", env.MONTASITE_PASSWORD_HASH],
    ["MONTASITE_SESSION_SECRET", env.MONTASITE_SESSION_SECRET],
    ["MONTASITE_OTP_SECRET", env.MONTASITE_OTP_SECRET],
    ["MONTASITE_EMAIL_WORKER", hasNativeEmail || hasEmailWorker || hasResendFallback]
  ].filter(([, value]) => !value).map(([name]) => name)
  };
};
