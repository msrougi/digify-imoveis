import { authConfig, json, verifySession } from "../../_shared/montasite-auth.js";

export async function onRequestGet({ request, env }) {
  const config = authConfig(env);
  const session = await verifySession(request, env);
  return json({ ok: true, configured: config.ready, missing: config.missing, authenticated: Boolean(session), email: session?.email || null });
}

