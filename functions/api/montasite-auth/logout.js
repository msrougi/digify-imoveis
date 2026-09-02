import { clearSessionCookie, isSameOrigin, json } from "../../_shared/montasite-auth.js";

export function onRequestPost({ request }) {
  if (!isSameOrigin(request)) return json({ ok: false, error: "Origem não autorizada." }, 403);
  return json({ ok: true }, 200, { "set-cookie": clearSessionCookie() });
}
