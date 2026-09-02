import { verifySession } from "../_shared/montasite-auth.js";

export async function onRequest(context) {
  const pathname = new URL(context.request.url).pathname;
  if (pathname.startsWith("/montasite/login") || pathname.startsWith("/montasite/assets/")) return context.next();
  const session = await verifySession(context.request, context.env);
  if (session) return context.next();
  const target = new URL("/montasite/login/", context.request.url);
  target.searchParams.set("next", pathname);
  return Response.redirect(target.toString(), 302);
}

