import { clearChallengeCookie, createSession, getChallengeId, hashOtp, isSameOrigin, json, sessionCookie } from "../../_shared/montasite-auth.js";

export async function onRequestPost({ request, env }) {
  if (!isSameOrigin(request)) return json({ ok: false, error: "Origem não autorizada." }, 403);
  if (!env.MONTASITE_AUTH || !env.MONTASITE_OTP_SECRET || !env.MONTASITE_SESSION_SECRET) {
    return json({ ok: false, error: "Autenticação ainda não configurada." }, 503);
  }
  let body;
  try { body = await request.json(); } catch { return json({ ok: false, error: "Código inválido." }, 400); }
  const code = String(body.code || "").replace(/\D/g, "");
  const challengeId = getChallengeId(request);
  if (!/^\d{6}$/.test(code) || !challengeId) return json({ ok: false, error: "Código inválido ou expirado." }, 401);

  const key = `challenge:${challengeId}`;
  const challenge = await env.MONTASITE_AUTH.get(key, "json");
  if (!challenge || challenge.expiresAt <= Date.now()) return json({ ok: false, error: "Código expirado. Solicite outro." }, 401, { "set-cookie": clearChallengeCookie() });
  if (challenge.attempts >= 5) {
    await env.MONTASITE_AUTH.delete(key);
    return json({ ok: false, error: "Limite de tentativas atingido. Solicite outro código." }, 429, { "set-cookie": clearChallengeCookie() });
  }

  const expected = await hashOtp(code, challengeId, env.MONTASITE_OTP_SECRET);
  if (expected !== challenge.codeHash) {
    challenge.attempts += 1;
    await env.MONTASITE_AUTH.put(key, JSON.stringify(challenge), { expirationTtl: Math.max(60, Math.ceil((challenge.expiresAt - Date.now()) / 1000)) });
    return json({ ok: false, error: `Código incorreto. Restam ${Math.max(0, 5 - challenge.attempts)} tentativas.` }, 401);
  }

  await env.MONTASITE_AUTH.delete(key);
  const session = await createSession(challenge.email, env.MONTASITE_SESSION_SECRET);
  const headers = new Headers({ "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
  headers.append("set-cookie", sessionCookie(session));
  headers.append("set-cookie", clearChallengeCookie());
  return new Response(JSON.stringify({ ok: true, redirect: "/montasite/" }), { status: 200, headers });
}
