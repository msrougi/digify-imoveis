export async function onRequest({ request, env }) {
  if (!env.JABAQUARA_LEADS) return Response.json({ success: false }, { status: 503 });
  return env.JABAQUARA_LEADS.fetch(request);
}
