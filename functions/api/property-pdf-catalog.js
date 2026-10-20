import { json, requireSession } from "../_shared/montasite-auth.js";

const clean = (value, length = 180) => String(value || "").replace(/\s+/g, " ").trim().slice(0, length);
const normalize = value => clean(value, 500).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
const safeUrl = value => {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:") return "";
    return url.toString();
  } catch {
    return "";
  }
};

const publicItem = item => ({
  id: clean(item.id, 100),
  name: clean(item.name || "Material imobiliário", 180),
  bairro: clean(item.bairro || "São Paulo", 100),
  pdf: clean(item.pdf || "material.pdf", 180),
  pdfUrl: safeUrl(item.pdfUrl),
  sourceHost: clean(item.sourceHost, 120),
  phase: clean(item.phase || "A confirmar", 40),
  delivery: clean(item.delivery || "prazo a confirmar", 100),
  types: Array.isArray(item.types) ? item.types.map(value => clean(value, 60)).slice(0, 3) : [],
  heat: Number.isFinite(Number(item.heat)) ? Math.min(100, Math.max(0, Number(item.heat))) : 50,
  searches: clean(item.searches || "a medir", 40),
  competition: clean(item.competition || "a medir", 40),
  verifiedPdf: item.verifiedPdf === true,
  summary: clean(item.summary || "PDF validado pelo monitor diário.", 420),
  firstSeenAt: clean(item.firstSeenAt, 40),
  verifiedAt: clean(item.verifiedAt, 40)
});

export async function onRequestGet({ request, env }) {
  if (!(await requireSession({ request, env }))) return json({ ok: false, error: "Sessão expirada." }, 401);
  const params = new URL(request.url).searchParams;
  const limit = Math.min(20, Math.max(1, Number(params.get("limit")) || 20));
  const bairro = normalize(params.get("bairro"));
  const tipologia = clean(params.get("tipologia"), 60);
  const fase = clean(params.get("fase"), 40);
  const [stored, status] = await Promise.all([
    env.MONTASITE_AUTH?.get("pdf:catalog", "json").catch(() => []) || [],
    env.MONTASITE_AUTH?.get("pdf:discovery:status", "json").catch(() => null) || null
  ]);
  const items = (Array.isArray(stored) ? stored : [])
    .filter(item => item?.verifiedPdf && safeUrl(item.pdfUrl))
    .filter(item => !bairro || normalize(item.bairro).includes(bairro) || bairro.includes(normalize(item.bairro)))
    .filter(item => !tipologia || !item.types?.length || item.types.includes(tipologia))
    .filter(item => !fase || !item.phase || item.phase === fase || item.phase === "A confirmar")
    .sort((a, b) => new Date(b.firstSeenAt || 0) - new Date(a.firstSeenAt || 0) || Number(b.score || 0) - Number(a.score || 0))
    .slice(0, limit)
    .map(publicItem);
  return json({
    ok: true,
    items,
    totalCatalogued: Array.isArray(stored) ? stored.filter(item => item?.verifiedPdf).length : 0,
    monitor: status ? {
      lastRunAt: clean(status.lastRunAt, 40),
      lastCompletedCycleAt: clean(status.lastCompletedCycleAt, 40),
      currentDistrict: clean(status.currentDistrict, 100),
      nextDistrict: clean(status.nextDistrict, 100),
      districtIndex: Number(status.districtIndex || 0),
      districtCount: Number(status.districtCount || 96),
      foundInLastRun: Number(status.foundInLastRun || 0),
      provider: clean(status.provider || "busca pública", 60)
    } : null
  });
}
