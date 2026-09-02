import { authConfig, challengeCookie, hashOtp, isSameOrigin, json, maskEmail, verifyPassword } from "../../_shared/montasite-auth.js";

const genericFailure = () => json({ ok: false, error: "E-mail ou senha inválidos." }, 401);

export async function onRequestPost({ request, env }) {
  if (!isSameOrigin(request)) return json({ ok: false, error: "Origem não autorizada." }, 403);
  const config = authConfig(env);
  if (!config.ready) return json({ ok: false, error: "Autenticação ainda não configurada no Cloudflare.", missing: config.missing }, 503);

  let body;
  try { body = await request.json(); } catch { return json({ ok: false, error: "Dados inválidos." }, 400); }
  const email = String(body.email || "").trim().toLowerCase();
  const password = String(body.password || "");
  const adminEmail = String(env.MONTASITE_ADMIN_EMAIL).trim().toLowerCase();
  const ip = request.headers.get("CF-Connecting-IP") || "unknown";
  const rateKey = `login-rate:${ip}`;
  const rate = Number(await env.MONTASITE_AUTH.get(rateKey) || 0);
  if (rate >= 8) return json({ ok: false, error: "Muitas tentativas. Aguarde 15 minutos." }, 429);

  if (email !== adminEmail || !(await verifyPassword(password, env.MONTASITE_PASSWORD_HASH))) {
    await env.MONTASITE_AUTH.put(rateKey, String(rate + 1), { expirationTtl: 15 * 60 });
    return genericFailure();
  }

  const challengeId = crypto.randomUUID();
  const random = new Uint32Array(1);
  crypto.getRandomValues(random);
  const code = String(100000 + (random[0] % 900000));
  await env.MONTASITE_AUTH.put(`challenge:${challengeId}`, JSON.stringify({
    email: adminEmail,
    codeHash: await hashOtp(code, challengeId, env.MONTASITE_OTP_SECRET),
    attempts: 0,
    createdAt: Date.now(),
    expiresAt: Date.now() + 10 * 60 * 1000
  }), { expirationTtl: 10 * 60 });

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { authorization: `Bearer ${env.RESEND_API_KEY}`, "content-type": "application/json" },
    body: JSON.stringify({
      from: env.MONTASITE_EMAIL_FROM,
      to: [adminEmail],
      subject: `${code} é seu código do Digify MontaSite`,
      html: `<div style="font-family:Arial,sans-serif;background:#080b12;color:#fff;padding:32px"><p style="color:#94a3b8">DIGIFY MONTASITE</p><h1 style="font-size:42px;letter-spacing:8px;margin:18px 0;color:#b8ff3d">${code}</h1><p>Use este código para entrar. Ele expira em 10 minutos e só pode ser usado uma vez.</p><p style="color:#94a3b8;font-size:12px">Se você não iniciou este acesso, ignore este e-mail.</p></div>`
    })
  });

  if (!response.ok) {
    await env.MONTASITE_AUTH.delete(`challenge:${challengeId}`);
    return json({ ok: false, error: "Não foi possível enviar o código. Confira a configuração do e-mail." }, 502);
  }

  await env.MONTASITE_AUTH.delete(rateKey);
  return json({ ok: true, email: maskEmail(adminEmail), expiresIn: 600 }, 200, { "set-cookie": challengeCookie(challengeId) });
}
