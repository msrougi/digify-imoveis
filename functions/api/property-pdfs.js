import { json, requireSession } from "../_shared/montasite-auth.js";

const MAX_RESULTS = 18;
const MAX_PROBES = 24;

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

const buildQueries = (bairro, tipologia) => {
  const type = tipologia === "Studio / 1 dormitório"
    ? '(studio OR "1 dormitório")'
    : tipologia === "2 dormitórios"
      ? '"2 dormitórios"'
      : '("3 dormitórios" OR "4 dormitórios")';
  return [
    `filetype:pdf "${bairro}" (lançamento OR empreendimento) residencial "São Paulo"`,
    `filetype:pdf "${bairro}" (book OR apresentação) apartamento`,
    `filetype:pdf "${bairro}" ${type} (incorporadora OR construtora)`,
    `filetype:pdf "${bairro}" (memorial OR "ficha técnica") residencial`,
    `filetype:pdf "${bairro}" (2027 OR 2028 OR 2029) imóvel`
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
  const copy = normalize(`${item.title} ${item.snippet} ${item.mime}`);
  return path.endsWith(".pdf") || path.includes(".pdf/") || /application\/pdf|adobe acrobat/.test(copy) || /\bpdf\b/.test(copy);
};

const probePdf = async item => {
  if (looksLikePdf(item)) return { ...item, verifiedPdf: true };
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 4500);
  try {
    let response = await fetch(item.link, { method: "HEAD", redirect: "follow", signal: controller.signal });
    let contentType = response.headers.get("content-type") || "";
    if (!response.ok || !/application\/pdf/i.test(contentType)) {
      response = await fetch(item.link, { method: "GET", redirect: "follow", signal: controller.signal, headers: { Range: "bytes=0-7" } });
      contentType = response.headers.get("content-type") || "";
      const signature = new TextDecoder().decode((await response.arrayBuffer()).slice(0, 5));
      if (!response.ok || (!/application\/pdf/i.test(contentType) && signature !== "%PDF-")) return null;
    }
    const finalUrl = safeHttpsUrl(response.url) || item.url;
    return { ...item, url: finalUrl, link: finalUrl.toString(), verifiedPdf: true };
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
};

const relevance = (item, bairro, tipologia) => {
  const copy = normalize(`${item.title} ${item.snippet} ${item.url.hostname} ${item.url.pathname}`);
  const bairroTokens = normalize(bairro).split(/\s+/).filter(token => token.length > 2);
  let score = bairroTokens.reduce((total, token) => total + (copy.includes(token) ? 7 : 0), 0);
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

const shapeItems = (items, bairro, tipologia) => items
  .map(item => ({ ...item, score: relevance(item, bairro, tipologia) }))
  .sort((a, b) => b.score - a.score)
  .slice(0, MAX_RESULTS)
  .map((item, index) => {
    const copy = `${item.title} ${item.snippet}`;
    const year = copy.match(/\b(202[7-9])\b/)?.[1];
    return {
      id: `search-${index}-${item.url.hostname.replace(/[^a-z0-9]/gi, "-")}`,
      name: resultName(item.title),
      bairro,
      pdf: decodeURIComponent(item.url.pathname.split("/").pop() || `material-${index + 1}.pdf`).slice(0, 180),
      pdfUrl: item.link,
      sourceHost: item.url.hostname.replace(/^www\./, ""),
      delivery: year ? `previsão citada: ${year}` : "prazo a confirmar",
      types: [tipologia],
      heat: 50,
      searches: "a medir",
      competition: "a medir",
      verifiedPdf: true,
      summary: item.snippet || `PDF localizado em ${item.url.hostname}. Os dados serão confirmados durante a leitura do material.`
    };
  });

const fetchSerper = async (query, apiKey, queryIndex) => {
  const response = await fetch("https://google.serper.dev/search", {
    method: "POST",
    headers: { "X-API-KEY": apiKey, "content-type": "application/json" },
    body: JSON.stringify({ q: query, gl: "br", hl: "pt-br", num: 10 })
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
  const groups = settled.filter(result => result.status === "fulfilled").map(result => result.value);
  if (groups.length) return groups;
  const firstFailure = settled.find(result => result.status === "rejected");
  throw firstFailure?.reason instanceof Error ? firstFailure.reason : new Error("Nenhuma fonte de busca respondeu.");
};

export async function onRequestGet({ request, env }) {
  if (!(await requireSession({ request, env }))) return json({ ok: false, error: "Sessão expirada." }, 401);
  const params = new URL(request.url).searchParams;
  const bairro = clean(params.get("bairro"), 80);
  const tipologia = clean(params.get("tipologia"), 80);
  if (!bairro || !tipologia) return json({ ok: false, error: "Bairro e tipologia são obrigatórios." }, 400);

  const queries = buildQueries(bairro, tipologia);
  try {
    let provider = "";
    let groups = [];
    if (env.SERPER_API_KEY) {
      provider = "serper-multibusca";
      groups = await collectSearchGroups(queries.map((query, index) => fetchSerper(query, env.SERPER_API_KEY, index)));
    } else if (env.GOOGLE_SEARCH_API_KEY && env.GOOGLE_SEARCH_ENGINE_ID) {
      provider = "google-cse-multibusca";
      groups = await collectSearchGroups(queries.slice(0, 4).map((query, index) => fetchGoogle(query, env, index)));
    } else {
      provider = "busca-publica-multibusca";
      groups = await collectSearchGroups(queries.map((query, index) => fetchBingRss(query, index)));
    }

    const unique = new Map();
    for (const item of groups.flat()) {
      const key = item.link.replace(/\/$/, "").toLowerCase();
      if (!unique.has(key)) unique.set(key, item);
    }
    const candidates = [...unique.values()].slice(0, MAX_PROBES);
    const verified = (await Promise.all(candidates.map(probePdf))).filter(Boolean);
    return json({
      ok: true,
      connected: true,
      provider,
      queriesRun: groups.length,
      candidatesChecked: candidates.length,
      items: shapeItems(verified, bairro, tipologia)
    });
  } catch (error) {
    return json({ ok: false, connected: true, error: error instanceof Error ? error.message : "Falha na busca.", items: [] }, 502);
  }
}
