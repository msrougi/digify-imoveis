import { json } from "../_shared/montasite-auth.js";

const validSteps = new Set(["validate", "pdf", "research", "build", "publish", "article"]);
const validStatuses = new Set(["queued", "running", "waiting_review", "scheduled", "completed", "failed"]);

export async function onRequestPost({ request, env }) {
  if (!env.MONTASITE_AUTH || !env.MONTASITE_PIPELINE_SECRET) return json({ ok: false, error: "Pipeline não configurado." }, 503);
  if (request.headers.get("authorization") !== `Bearer ${env.MONTASITE_PIPELINE_SECRET}`) return json({ ok: false, error: "Não autorizado." }, 401);
  let event;
  try { event = await request.json(); } catch { return json({ ok: false, error: "Evento inválido." }, 400); }
  if (!event.jobId || !validSteps.has(event.step) || !Number.isFinite(event.percent) || event.percent < 0 || event.percent > 100 || !event.message) return json({ ok: false, error: "Evento incompleto." }, 422);
  if (event.status && !validStatuses.has(event.status)) return json({ ok: false, error: "Status inválido." }, 422);
  const key = `job:${event.jobId}`, job = await env.MONTASITE_AUTH.get(key, "json");
  if (!job) return json({ ok: false, error: "Job não encontrado." }, 404);

  const record = { at: new Date().toISOString(), step: event.step, percent: Math.round(event.percent), message: String(event.message).slice(0, 300) };
  job.events.push(record); job.events = job.events.slice(-80); job.percent = record.percent; job.currentStep = event.step; job.updatedAt = record.at;
  if (event.status) job.status = event.status;
  if (event.siteUrl) job.siteUrl = event.siteUrl;
  if (event.articleUrl) job.articleUrl = event.articleUrl;

  if (event.type === "article_published" && event.articleUrl && !job.articleNotificationSent) {
    const article = new URL(event.articleUrl);
    if (article.protocol !== "https:" || article.hostname !== "imoveis.digify.live") return json({ ok: false, error: "URL da matéria não autorizada." }, 422);
    const live = await fetch(article.toString(), { redirect: "follow" });
    if (!live.ok) return json({ ok: false, error: "A matéria ainda não responde publicamente." }, 409);
    if (!env.RESEND_API_KEY || !env.MONTASITE_EMAIL_FROM || !env.MONTASITE_ADMIN_EMAIL) return json({ ok: false, error: "E-mail de publicação não configurado." }, 503);
    const mail = await fetch("https://api.resend.com/emails", { method:"POST", headers:{authorization:`Bearer ${env.RESEND_API_KEY}`,"content-type":"application/json"}, body:JSON.stringify({ from:env.MONTASITE_EMAIL_FROM, to:[env.MONTASITE_ADMIN_EMAIL], subject:`Matéria publicada: ${job.payload.article.title}`, html:`<div style="font-family:Arial,sans-serif"><h1>A matéria está no ar</h1><p><strong>${job.payload.article.title}</strong></p><p><a href="${article.toString()}">${article.toString()}</a></p><p>Empreendimento: ${job.payload.property.name}</p></div>` }) });
    if (!mail.ok) return json({ ok: false, error: "A matéria está no ar, mas o e-mail falhou." }, 502);
    job.articleNotificationSent = new Date().toISOString();
  }
  await env.MONTASITE_AUTH.put(key, JSON.stringify(job), { expirationTtl: 60 * 60 * 24 * 30 });
  return json({ ok: true });
}
