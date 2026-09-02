import { isSameOrigin, json, requireSession } from "../_shared/montasite-auth.js";
import { buildMontaSitePrompt } from "../_shared/montasite-prompt.js";

const allowedImageTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
const allowedSteps = new Set(["validate", "pdf", "research", "build", "publish", "article"]);

const randomInt = (min, max) => {
  const value = new Uint32Array(1);
  crypto.getRandomValues(value);
  return min + (value[0] % (max - min + 1));
};

const articleSchedule = () => {
  const delayDays = randomInt(1, 4);
  const formatter = new Intl.DateTimeFormat("en", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" });
  const parts = Object.fromEntries(formatter.formatToParts(new Date()).filter(part => part.type !== "literal").map(part => [part.type, part.value]));
  const year = Number(parts.year), month = Number(parts.month), day = Number(parts.day);
  const calendar = new Date(Date.UTC(year, month - 1, day + delayDays));
  const date = `${calendar.getUTCFullYear()}-${String(calendar.getUTCMonth() + 1).padStart(2, "0")}-${String(calendar.getUTCDate()).padStart(2, "0")}`;
  const hour = randomInt(9, 20), minute = randomInt(0, 11) * 5;
  return { delayDays, local: `${date}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00-03:00`, timeZone: "America/Sao_Paulo" };
};

const validatePayload = payload => {
  const errors = [];
  if (!payload?.bairro?.trim()) errors.push("Bairro ausente.");
  if (!payload?.property?.name || !payload?.property?.pdf) errors.push("Empreendimento ou PDF ausente.");
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(payload?.slug || "")) errors.push("URL inválida.");
  if (!["Studio / 1 dormitório", "2 dormitórios", "3 dormitórios ou mais"].includes(payload?.tipologia)) errors.push("Tipologia inválida.");
  if (!["Lançamento", "Pronta entrega"].includes(payload?.fase)) errors.push("Fase inválida.");
  if (!payload?.article?.title || !payload?.article?.slug) errors.push("Escolha exatamente uma pauta.");
  if (!Array.isArray(payload?.testimonials) || payload.testimonials.length !== 3) errors.push("São necessários exatamente três depoimentos.");
  for (const [index, testimonial] of (payload?.testimonials || []).entries()) {
    if (!testimonial?.name?.trim() || !testimonial?.text?.trim()) errors.push(`Complete o depoimento ${index + 1}.`);
  }
  return errors;
};

const jobResponse = job => ({
  id: job.id,
  status: job.status,
  percent: job.percent,
  currentStep: job.currentStep,
  events: job.events,
  articleSchedule: job.articleSchedule,
  // The prompt is an internal executor instruction. Returning it to the
  // authenticated operator keeps the panel's preview and the executor in
  // sync, while the executor receives the same value server-side.
  prompt: job.prompt || null,
  siteUrl: job.siteUrl || null,
  articleUrl: job.articleUrl || null,
  configuration: job.configuration || null,
  updatedAt: job.updatedAt
});

export async function onRequest({ request, env, waitUntil }) {
  const session = await requireSession({ request, env });
  if (!session) return json({ ok: false, error: "Sessão expirada. Entre novamente." }, 401);
  if (!env.MONTASITE_AUTH) return json({ ok: false, error: "Binding MONTASITE_AUTH não configurado." }, 503);

  if (request.method === "GET") {
    const id = new URL(request.url).searchParams.get("id");
    if (!id) return json({ ok: false, error: "ID do job ausente." }, 400);
    const job = await env.MONTASITE_AUTH.get(`job:${id}`, "json");
    return job ? json({ ok: true, job: jobResponse(job) }) : json({ ok: false, error: "Job não encontrado." }, 404);
  }
  if (request.method !== "POST") return json({ ok: false, error: "Método não permitido." }, 405);
  if (!isSameOrigin(request)) return json({ ok: false, error: "Origem não autorizada." }, 403);
  if (!env.MONTASITE_UPLOADS) return json({ ok: false, error: "Binding R2 MONTASITE_UPLOADS não configurado." }, 503);

  let form;
  try { form = await request.formData(); } catch { return json({ ok: false, error: "Envio inválido." }, 400); }
  let payload;
  try { payload = JSON.parse(String(form.get("payload") || "{}")); } catch { return json({ ok: false, error: "Dados do projeto inválidos." }, 400); }
  const errors = validatePayload(payload);
  if (errors.length) return json({ ok: false, error: errors[0], errors }, 422);

  const photos = [1, 2, 3].map(index => form.get(`testimonial_photo_${index}`));
  for (const [index, photo] of photos.entries()) {
    if (!(photo instanceof File) || !allowedImageTypes.has(photo.type) || photo.size <= 0 || photo.size > 2 * 1024 * 1024) {
      return json({ ok: false, error: `A foto ${index + 1} deve ser JPG, PNG ou WebP e ter no máximo 2 MB.` }, 422);
    }
  }
  const uploadedPdf = form.get("uploaded_pdf");
  if (uploadedPdf instanceof File && (uploadedPdf.type !== "application/pdf" || uploadedPdf.size > 25 * 1024 * 1024)) {
    return json({ ok: false, error: "O PDF enviado deve ter no máximo 25 MB." }, 422);
  }

  const id = crypto.randomUUID(), now = new Date().toISOString(), schedule = articleSchedule();
  const prompt = buildMontaSitePrompt(payload, schedule);
  const events = [
    { at: now, step: "validate", percent: 5, message: "Sessão e dados obrigatórios validados." },
    { at: now, step: "validate", percent: 10, message: "Três depoimentos e suas fotos foram conferidos." }
  ];
  const storedFiles = [];
  for (const [index, photo] of photos.entries()) {
    const extension = photo.type === "image/png" ? "png" : photo.type === "image/webp" ? "webp" : "jpg";
    const key = `${id}/depoimento-${index + 1}.${extension}`;
    await env.MONTASITE_UPLOADS.put(key, photo.stream(), { httpMetadata: { contentType: photo.type }, customMetadata: { originalName: photo.name } });
    storedFiles.push(key);
  }
  if (uploadedPdf instanceof File && uploadedPdf.size > 0) {
    const key = `${id}/material.pdf`;
    await env.MONTASITE_UPLOADS.put(key, uploadedPdf.stream(), { httpMetadata: { contentType: "application/pdf" }, customMetadata: { originalName: uploadedPdf.name } });
    storedFiles.push(key);
  }
  events.push({ at: new Date().toISOString(), step: "pdf", percent: 16, message: "Arquivos recebidos e armazenados com segurança." });

  const hasPipelineBinding = Boolean(env.MONTASITE_PIPELINE && typeof env.MONTASITE_PIPELINE.fetch === "function" && env.MONTASITE_PIPELINE_SECRET);
  const hasPipelineWebhook = Boolean(env.MONTASITE_PIPELINE_WEBHOOK && env.MONTASITE_PIPELINE_SECRET);
  const pipelineReady = hasPipelineBinding || hasPipelineWebhook;
  const job = {
    id, owner: session.email, createdAt: now, updatedAt: new Date().toISOString(),
    status: pipelineReady ? "queued" : "waiting_configuration", percent: pipelineReady ? 22 : 18,
    currentStep: "pdf", articleSchedule: schedule, payload, prompt, storedFiles, events,
    configuration: pipelineReady ? null : { missing: ["MONTASITE_PIPELINE", "MONTASITE_PIPELINE_SECRET"], message: "O prompt foi preparado, mas o executor automático ainda não está publicado." }
  };
  job.events.push({ at: job.updatedAt, step: "pdf", percent: job.percent, message: `Janela editorial reservada: ${schedule.delayDays} dia(s) depois, às ${schedule.local.slice(11,16)} (São Paulo).` });
  await env.MONTASITE_AUTH.put(`job:${id}`, JSON.stringify(job), { expirationTtl: 60 * 60 * 24 * 30 });

  if (pipelineReady) {
    const body = JSON.stringify({
      jobId: id,
      payload,
      prompt,
      storedFiles,
      articleSchedule: schedule,
      callbackUrl: "https://imoveis.digify.live/api/montasite-job-event"
    });
    const init = {
      method: "POST",
      headers: {
        authorization: env.MONTASITE_PIPELINE_SECRET ? `Bearer ${env.MONTASITE_PIPELINE_SECRET}` : "",
        "content-type": "application/json"
      },
      body
    };
    // Prefer a private service binding. The webhook remains supported for a
    // separately hosted executor, but the normal path is now self-contained
    // in Cloudflare and no longer depends on a browser-generated prompt.
    const dispatch = hasPipelineBinding
      ? env.MONTASITE_PIPELINE.fetch("https://montasite-pipeline.internal/run", init)
      : fetch(env.MONTASITE_PIPELINE_WEBHOOK, init);
    waitUntil(dispatch.then(response => {
      if (!response?.ok) throw new Error("Executor respondeu HTTP " + response.status);
    }).catch(async error => {
      const current = await env.MONTASITE_AUTH.get(`job:${id}`, "json");
      if (!current) return;
      current.status = "failed";
      current.updatedAt = new Date().toISOString();
      current.configuration = { message: "O executor não respondeu. Tente novamente depois de conferir a publicação do pipeline." };
      current.events = [...(current.events || []), { at: current.updatedAt, step: "validate", percent: 22, message: "Falha ao acionar o executor automático." }].slice(-80);
      await env.MONTASITE_AUTH.put(`job:${id}`, JSON.stringify(current), { expirationTtl: 60 * 60 * 24 * 30 });
      console.error("MontaSite pipeline dispatch failed", error instanceof Error ? error.message : String(error));
    }));
  }
  return json({ ok: true, job: jobResponse(job) }, 201);
}

export { allowedSteps };
