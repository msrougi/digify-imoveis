import { json, requireSession } from "../_shared/montasite-auth.js";

const MAX_RESULTS = 24;
const MAX_PROBES = 32;
const GENERIC_PDF_HOSTS = /(?:^|\.)(?:workspace\.google\.com|smallpdf\.com|ilovepdf\.com|adobe\.com|canva\.com)$/i;

const clean = (value, length = 180) => String(value || "").replace(/\s+/g, " ").trim().slice(0, length);
const normalize = value => clean(value, 500).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

const safeHttpsUrl = value => {
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();
    const blockedIp = /^(?:127\.|10\.|192\.168\.|169\.254\.|172\.(?:1[6-9]|2\d|3[01])\.)/.test(host);
    if (url.protocol !== "https:" || host === "localhost" || host === "::1" || blockedIp) return null;
    url.hash = "";
    for (const key of [...url.searchParams.keys()]) {
      if (/^(utm_|gclid|fbclid)/i.test(key)) url.searchParams.delete(key);
    }
    return url;
  } catch {
    return null;
  }
};

const buildQueries = (bairro, tipologia, fase) => {
  const type = tipologia === "Studio / 1 dormitório"
    ? '("studio" OR "studios" OR "1 dormitório" OR "1 dorm" OR "1 suíte")'
    : tipologia === "2 dormitórios"
      ? '("2 dormitórios" OR "2 dorm" OR "2 quartos" OR "2 suítes")'
      : '("3 dormitórios" OR "4 dormitórios" OR "3 dorm" OR "4 dorm" OR "3 quartos" OR "4 quartos" OR "3 suítes" OR "4 suítes")';
  const phase = fase === "Pronta entrega"
    ? '("pronto para morar" OR "pronta entrega" OR "entrega imediata" OR "habite-se" OR entregue)'
    : '(lançamento OR "breve lançamento" OR "na planta" OR "em construção" OR obras)';
  return [
    `filetype:pdf "${bairro}" ${type} ${phase} (empreendimento OR residencial) "São Paulo"`,
    `filetype:pdf "${bairro}" ${type} ${phase} (book OR "book digital" OR apresentação OR catálogo) imóvel`,
    `filetype:pdf "${bairro}" ${type} ${phase} (incorporadora OR construtora) (planta OR lazer OR "ficha técnica")`,
    `filetype:pdf "${bairro}" ${type} ${phase} (memorial OR "ficha técnica" OR implantação) residencial`,
    fase === "Pronta entrega"
      ? `filetype:pdf "${bairro}" ${type} ${phase} (concluído OR entregue OR decorado)`
      : `filetype:pdf "${bairro}" ${type} ${phase} (2027 OR 2028 OR 2029) (entrega OR previsão)`
  ];
};

const candidateFrom = (item, queryIndex) => {
  const url = safeHttpsUrl(item.link);
  if (!url) return null;
  return {
    url,
    link: url.toString(),
    title: clean(item.title || "Material imobiliário", 220),
    snippet: clean(item.snippet || item.description || "", 500),
    mime: clean(item.mime || item.fileFormat || "", 80),
    queryIndex
  };
};

const looksLikePdf = item => {
  const path = item.url.pathname.toLowerCase();
  return path.endsWith(".pdf") || path.includes(".pdf/") || /application\/pdf/i.test(item.mime);
};

const candidateContext = (item, bairro, tipologia, fase) => {
  const copy = normalize(`${item.title} ${item.snippet} ${item.url.hostname} ${item.url.pathname}`);
  const bairroTokens = normalize(bairro).split(/\s+/).filter(token => token.length > 2);
  const hasBairro = bairroTokens.length > 0 && bairroTokens.every(token => copy.includes(token));
  const hasRealEstate = /lancamento|empreendimento|residencial|apartamento|studio|incorporadora|construtora|planta|dormitorio|suite|imovel|edificio|unidade|lazer/.test(copy);
  const hasType = tipologia === "Studio / 1 dormitório"
    ? /studio|studios|1 dormitorio|1 dorm\b|1 quarto|1 suite/.test(copy)
    : tipologia === "2 dormitórios"
      ? /2 dormitorios|2 dorm\b|2 quartos|2 suites/.test(copy)
      : /[34] dormitorios|[34] dorm\b|[34] quartos|[34] suites/.test(copy);
  const hasPhase = fase === "Pronta entrega"
    ? /pronto para morar|pronta entrega|entrega imediata|habite.?se|\bentregue\b|\bconcluido\b/.test(copy)
    : /lancamento|breve lancamento|na planta|em construcao|\bem obras\b|\b202[7-9]\b/.test(copy);
  return { copy, hasBairro, hasRealEstate, hasType, hasPhase };
};

const isRelevantCandidate = (item, bairro, tipologia, fase) => {
  if (GENERIC_PDF_HOSTS.test(item.url.hostname)) return false;
  const context = candidateContext(item, bairro, tipologia, fase);
  // Títulos e snippets dos buscadores raramente repetem toda a ficha do book.
  // A tipologia e a fase são usadas para ordenar, mas só o PDF é a fonte final.
  return context.hasBairro && (context.hasRealEstate || looksLikePdf(item));
};

const probePdf = async item => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    let response = await fetch(item.link, { method: "HEAD", redirect: "follow", signal: controller.signal });
    let contentType = response.headers.get("content-type") || "";
    response = await fetch(item.link, { method: "GET", redirect: "follow", signal: controller.signal, headers: { Range: "bytes=0-15", Accept: "application/pdf" } });
    contentType = response.headers.get("content-type") || contentType;
    const signature = new TextDecoder().decode((await response.arrayBuffer()).slice(0, 5));
    if (!response.ok || (!/application\/pdf/i.test(contentType) && signature !== "%PDF-")) return null;
    const finalUrl = safeHttpsUrl(response.url) || item.url;
    return { ...item, url: finalUrl, link: finalUrl.toString(), verifiedPdf: true };
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
};

const relevance = (item, bairro, tipologia, fase) => {
  const { copy, hasBairro, hasRealEstate, hasType, hasPhase } = candidateContext(item, bairro, tipologia, fase);
  let score = hasBairro ? 20 : 0;
  if (hasRealEstate) score += 14;
  if (hasType) score += 14;
  if (hasPhase) score += 14;
  if (/lancamento|empreendimento|residencial|apartamento|studio/.test(copy)) score += 8;
  if (/book|apresentacao|ficha tecnica|memorial/.test(copy)) score += 5;
  if (/2027|2028|2029/.test(copy)) score += 5;
  const typeTerms = tipologia === "Studio / 1 dormitório" ? ["studio", "1 dormitorio"] : tipologia === "2 dormitórios" ? ["2 dormitorios"] : ["3 dormitorios", "4 dormitorios"];
  if (typeTerms.some(term => copy.includes(term))) score += 8;
  if (item.url.pathname.toLowerCase().endsWith(".pdf")) score += 4;
  score += Math.max(0, 5 - item.queryIndex);
  return score;
};

const resultName = title => clean(title, 160)
  .replace(/\s*[|–—-]\s*(?:pdf|book|download).*$/i, "")
  .replace(/\.(?:pdf)\b.*$/i, "")
  .trim() || "Material imobiliário";

const shapeItems = (items, bairro, tipologia, fase) => items
  .map(item => ({ ...item, score: relevance(item, bairro, tipologia, fase) }))
  .sort((a, b) => b.score - a.score)
  .slice(0, MAX_RESULTS)
  .map((item, index) => {
    const copy = `${item.title} ${item.snippet}`;
    const year = copy.match(/\b(202[7-9])\b/)?.[1];
    return {
      id: item.id || `search-${index}-${item.url.hostname.replace(/[^a-z0-9]/gi, "-")}`,
      name: resultName(item.title),
      bairro,
      pdf: decodeURIComponent(item.url.pathname.split("/").pop() || `material-${index + 1}.pdf`).slice(0, 180),
      pdfUrl: item.link,
      sourceHost: item.url.hostname.replace(/^www\./, ""),
      phase: item.phase || fase,
      delivery: item.delivery || (year ? `previsão citada: ${year}` : fase === "Pronta entrega" ? "pronta entrega — confirmar no PDF" : "prazo a confirmar"),
      types: item.types?.length ? item.types : [tipologia],
      heat: item.heat ?? 50,
      searches: item.searches || "a medir",
      competition: item.competition || "a medir",
      verifiedPdf: true,
      firstSeenAt: item.firstSeenAt || null,
      summary: item.summary || item.snippet || `PDF localizado em ${item.url.hostname}. Os dados serão confirmados durante a leitura do material.`
    };
  });

const fetchSerper = async (query, apiKey, queryIndex) => {
  const response = await fetch("https://google.serper.dev/search", {
    method: "POST",
    headers: { "X-API-KEY": apiKey, "content-type": "application/json" },
    body: JSON.stringify({ q: query, gl: "br", hl: "pt-br", num: 20 })
  });
  if (!response.ok) throw new Error(`Serper ${response.status}`);
  const data = await response.json();
  return (data.organic || []).map(item => candidateFrom(item, queryIndex)).filter(Boolean);
};

const fetchGoogle = async (query, env, queryIndex) => {
  const url = new URL("https://customsearch.googleapis.com/customsearch/v1");
  url.searchParams.set("key", env.GOOGLE_SEARCH_API_KEY);
  url.searchParams.set("cx", env.GOOGLE_SEARCH_ENGINE_ID);
  url.searchParams.set("q", query);
  url.searchParams.set("num", "10");
  url.searchParams.set("safe", "active");
  const response = await fetch(url.toString());
  if (!response.ok) throw new Error(`Google Search ${response.status}`);
  const data = await response.json();
  return (data.items || []).map(item => candidateFrom(item, queryIndex)).filter(Boolean);
};

const decodeXml = value => clean(String(value || "")
  .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
  .replace(/&amp;/g, "&")
  .replace(/&lt;/g, "<")
  .replace(/&gt;/g, ">")
  .replace(/&quot;/g, '"')
  .replace(/&#39;|&apos;/g, "'")
  .replace(/<[^>]*>/g, " "), 1000);

const xmlValue = (block, tag) => decodeXml(block.match(new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`, "i"))?.[1] || "");

const fetchBingRss = async (query, queryIndex) => {
  const url = new URL("https://www.bing.com/search");
  url.searchParams.set("format", "rss");
  url.searchParams.set("setlang", "pt-BR");
  url.searchParams.set("cc", "br");
  url.searchParams.set("q", query);
  const response = await fetch(url.toString(), { headers: { "user-agent": "DigifyMontaSite/1.0 (+https://imoveis.digify.live/)" } });
  if (!response.ok) throw new Error(`Busca pública ${response.status}`);
  const xml = await response.text();
  return [...xml.matchAll(/<item>([\s\S]*?)<\/item>/gi)].map(match => candidateFrom({
    title: xmlValue(match[1], "title"),
    link: xmlValue(match[1], "link"),
    snippet: xmlValue(match[1], "description")
  }, queryIndex)).filter(Boolean);
};

const collectSearchGroups = async tasks => {
  const settled = await Promise.allSettled(tasks);
  const groups = settled.filter(result => result.status === "fulfilled" && result.value?.length).map(result => result.value);
  if (groups.length) return groups;
  const firstFailure = settled.find(result => result.status === "rejected");
  throw firstFailure?.reason instanceof Error ? firstFailure.reason : new Error("Nenhuma fonte de busca respondeu.");
};

const catalogMatches = async (env, bairro, tipologia, fase) => {
  if (!env.MONTASITE_AUTH) return [];
  const catalog = await env.MONTASITE_AUTH.get("pdf:catalog", "json").catch(() => []);
  const bairroTerm = normalize(bairro);
  return (Array.isArray(catalog) ? catalog : []).filter(item => {
    const itemBairro = normalize(item.bairro);
    const bairroMatches = itemBairro.includes(bairroTerm) || bairroTerm.includes(itemBairro);
    const typeMatches = !item.types?.length || item.types.includes(tipologia);
    const phaseMatches = !item.phase || item.phase === fase || item.phase === "A confirmar";
    return item.verifiedPdf && bairroMatches && typeMatches && phaseMatches;
  }).map(item => {
    const url = safeHttpsUrl(item.pdfUrl);
    if (!url) return null;
    return { ...item, url, link: url.toString(), title: item.name, snippet: item.summary || "PDF já validado pelo monitor diário.", queryIndex: -1, verifiedPdf: true };
  }).filter(Boolean);
};

const liveSearch = async (queries, env) => {
  const providers = [];
  if (env.SERPER_API_KEY) providers.push({ name: "serper", run: () => collectSearchGroups(queries.map((query, index) => fetchSerper(query, env.SERPER_API_KEY, index))) });
  if (env.GOOGLE_SEARCH_API_KEY && env.GOOGLE_SEARCH_ENGINE_ID) providers.push({ name: "google-cse", run: () => collectSearchGroups(queries.slice(0, 4).map((query, index) => fetchGoogle(query, env, index))) });
  providers.push({ name: "bing-rss", run: () => collectSearchGroups(queries.map((query, index) => fetchBingRss(query, index))) });
  const failures = [];
  for (const provider of providers) {
    try {
      const groups = await provider.run();
      if (groups.flat().length) return { provider: provider.name, groups };
    } catch (error) {
      failures.push(`${provider.name}: ${error instanceof Error ? error.message : "falhou"}`);
    }
  }
  return { provider: "catálogo", groups: [], failures };
};

export async function onRequestGet({ request, env }) {
  if (!(await requireSession({ request, env }))) return json({ ok: false, error: "Sessão expirada." }, 401);
  const params = new URL(request.url).searchParams;
  const bairro = clean(params.get("bairro"), 80);
  const tipologia = clean(params.get("tipologia"), 80);
  const fase = clean(params.get("fase"), 40);
  if (!bairro || !tipologia || !fase) return json({ ok: false, error: "Bairro, tipologia e fase são obrigatórios." }, 400);
  if (!["Lançamento", "Pronta entrega"].includes(fase)) return json({ ok: false, error: "Fase inválida." }, 400);

  const queries = buildQueries(bairro, tipologia, fase);
  try {
    const stored = await catalogMatches(env, bairro, tipologia, fase);
    const { provider, groups, failures = [] } = await liveSearch(queries, env);

    const unique = new Map();
    for (const item of groups.flat()) {
      const key = item.link.replace(/\/$/, "").toLowerCase();
      if (!unique.has(key)) unique.set(key, item);
    }
    const candidates = [...unique.values()].filter(item => isRelevantCandidate(item, bairro, tipologia, fase)).slice(0, MAX_PROBES);
    const verified = (await Promise.all(candidates.map(probePdf))).filter(Boolean);
    const merged = new Map(stored.map(item => [item.link.replace(/\/$/, "").toLowerCase(), item]));
    for (const item of verified) if (!merged.has(item.link.replace(/\/$/, "").toLowerCase())) merged.set(item.link.replace(/\/$/, "").toLowerCase(), item);
    return json({
      ok: true,
      connected: true,
      provider,
      queriesRun: groups.length,
      candidatesChecked: candidates.length,
      catalogMatches: stored.length,
      liveMatches: verified.length,
      providerWarnings: failures,
      items: shapeItems([...merged.values()], bairro, tipologia, fase)
    });
  } catch (error) {
    return json({ ok: false, connected: true, error: error instanceof Error ? error.message : "Falha na busca.", items: [] }, 502);
  }
}

