import { json } from "../_shared/montasite-auth.js";

const validSteps = new Set(["validate", "pdf", "research", "build", "publish", "article"]);
const validStatuses = new Set(["queued", "running", "waiting_review", "scheduled", "completed", "failed"]);
const escapeHtml = value => String(value ?? "").replace(/[&<>"']/g, character => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
}[character]));

async function sendPublicationEmail(env, job, article) {
  const adminEmail = String(env.MONTASITE_ADMIN_EMAIL || "marcelo@digify.live").trim();
  const title = String(job.payload?.article?.title || "Nova matéria");
  const subject = "Matéria publicada: " + title;
  const text = "A matéria está no ar: " + title + "\n" + article.toString() + "\nEmpreendimento: " + (job.payload?.property?.name || "—");
  const html = "<div style='font-family:Arial,sans-serif'><h1>A matéria está no ar</h1><p><strong>" + escapeHtml(title) + "</strong></p><p><a href='" + article.toString() + "'>" + article.toString() + "</a></p><p>Empreendimento: " + escapeHtml(job.payload?.property?.name || "—") + "</p></div>";
  if (env.MONTASITE_EMAIL && typeof env.MONTASITE_EMAIL.send === "function") {
    await env.MONTASITE_EMAIL.send({ from: { email: "montasite@digify.live", name: "Digify MontaSite" }, to: adminEmail, subject, text, html });
    return;
  }
  if (env.MONTASITE_EMAIL_WORKER && typeof env.MONTASITE_EMAIL_WORKER.fetch === "function") {
    const response = await env.MONTASITE_EMAIL_WORKER.fetch("https://montasite-email.internal/send", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ to: adminEmail, subject, text, html }) });
    if (!response.ok) throw new Error("Worker de e-mail respondeu HTTP " + response.status);
    return;
  }
  if (env.RESEND_API_KEY && env.MONTASITE_EMAIL_FROM) {
    const response = await fetch("https://api.resend.com/emails", { method: "POST", headers: { authorization: "Bearer " + env.RESEND_API_KEY, "content-type": "application/json" }, body: JSON.stringify({ from: env.MONTASITE_EMAIL_FROM, to: [adminEmail], subject, text, html }) });
    if (!response.ok) throw new Error("Resend respondeu HTTP " + response.status);
    return;
  }
  throw new Error("Nenhum canal de e-mail configurado.");
}

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
    try {
      await sendPublicationEmail(env, job, article);
    } catch (error) {
      console.error("MontaSite publication email failed", error instanceof Error ? error.message : String(error));
      return json({ ok: false, error: "A matéria está no ar, mas o e-mail falhou." }, 502);
    }
    job.articleNotificationSent = new Date().toISOString();
  }
  await env.MONTASITE_AUTH.put(key, JSON.stringify(job), { expirationTtl: 60 * 60 * 24 * 30 });
  return json({ ok: true });
}
