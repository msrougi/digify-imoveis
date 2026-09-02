const SITE_ORIGIN = "https://imoveis.digify.live";
const htmlHeaders = (extra = {}) => ({ "content-type": "text/html; charset=utf-8", "cache-control": "public, max-age=300", ...extra });
const escapeHtml = value => String(value ?? "").replace(/[&<>"']/g, character => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
}[character]));
const safeSlug = value => /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(String(value || ""));
const dynamicJson = async (kv, key, fallback) => {
  try { return await kv.get(key, "json") || fallback; } catch { return fallback; }
};
const htmlResponse = (html, headers = {}) => new Response(html, { status: 200, headers: htmlHeaders(headers) });
const withInjectedHtml = (response, html, extraHeaders = {}) => {
  const headers = new Headers(response.headers);
  headers.set("content-type", extraHeaders["content-type"] || "text/html; charset=utf-8");
  headers.set("cache-control", "public, max-age=60, must-revalidate");
  return new Response(html, { status: response.status, statusText: response.statusText, headers });
};
const siteCard = site => "<a class='card' href='/" + escapeHtml(site.slug) + "/'><div class='card-media dynamic-card-media' style='background:linear-gradient(135deg,#171044,#0b665f)'><span class='badge'>" + escapeHtml(site.fase || "Novo") + "</span></div><div class='card-body'><p class='card-loc'>" + escapeHtml(site.bairro || "São Paulo") + " · São Paulo</p><h3>" + escapeHtml(site.name || "Novo empreendimento") + "</h3><p>" + escapeHtml(site.description || "Página exclusiva com informações, valores e atendimento direto.") + "</p><div class='card-specs'><span>" + escapeHtml(site.tipologia || "Imóvel") + "</span><span>Entrega: " + escapeHtml(site.delivery || "a confirmar") + "</span></div><span class='card-link'>Ver página do imóvel <span aria-hidden='true'>→</span></span></div></a>";
const articleCard = article => "<a class='card' href='/blog/" + escapeHtml(article.slug) + "/'><div class='card-body'><p class='card-loc'>MontaSite · " + escapeHtml(article.bairro || "São Paulo") + "</p><h3>" + escapeHtml(article.title || "Nova matéria") + "</h3><p>" + escapeHtml(article.description || "Leia a matéria completa no blog da Digify Imóveis.") + "</p><span class='card-link'>Ler matéria <span aria-hidden='true'>→</span></span></div></a>";

async function serveAsset(pathname, env) {
  if (!env.MONTASITE_UPLOADS) return null;
  const parts = pathname.split("/").filter(Boolean);
  if (parts.length !== 3 || parts[0] !== "__montasite-assets") return null;
  const jobId = decodeURIComponent(parts[1] || "");
  const filename = decodeURIComponent(parts[2] || "");
  if (!/^[0-9a-f-]{20,80}$/i.test(jobId) || !/^(depoimento-[1-3]\.(?:jpg|png|webp)|material\.pdf)$/i.test(filename)) return new Response("Not found", { status: 404 });
  const object = await env.MONTASITE_UPLOADS.get(jobId + "/" + filename);
  if (!object) return new Response("Not found", { status: 404 });
  const headers = new Headers();
  headers.set("content-type", object.httpMetadata?.contentType || (filename.endsWith(".pdf") ? "application/pdf" : "image/jpeg"));
  headers.set("cache-control", "public, max-age=31536000, immutable");
  return new Response(object.body, { headers });
}

async function injectHome(response, env) {
  if (!env.MONTASITE_AUTH || !response.ok) return response;
  const sites = await dynamicJson(env.MONTASITE_AUTH, "site:index", []);
  if (!Array.isArray(sites) || !sites.length) return response;
  const body = await response.text();
  if (!body.includes("MONTASITE_DYNAMIC_CARDS")) return response;
  return withInjectedHtml(response, body.replace("<!-- MONTASITE_DYNAMIC_CARDS -->", sites.slice(0, 24).map(siteCard).join("")));
}

async function injectBlogIndex(response, env) {
  if (!env.MONTASITE_AUTH || !response.ok) return response;
  const articles = await dynamicJson(env.MONTASITE_AUTH, "article:index", []);
  if (!Array.isArray(articles) || !articles.length) return response;
  const body = await response.text();
  if (!body.includes("MONTASITE_DYNAMIC_ARTICLES")) return response;
  return withInjectedHtml(response, body.replace("<!-- MONTASITE_DYNAMIC_ARTICLES -->", articles.slice(0, 50).map(articleCard).join("")));
}

async function injectSitemap(response, env) {
  if (!env.MONTASITE_AUTH || !response.ok) return response;
  const sites = await dynamicJson(env.MONTASITE_AUTH, "site:index", []);
  const articles = await dynamicJson(env.MONTASITE_AUTH, "article:index", []);
  const urls = [
    ...(Array.isArray(sites) ? sites.map(site => "<url><loc>" + SITE_ORIGIN + "/" + escapeHtml(site.slug) + "/</loc><changefreq>monthly</changefreq><priority>0.9</priority></url>") : []),
    ...(Array.isArray(articles) ? articles.map(article => "<url><loc>" + SITE_ORIGIN + "/blog/" + escapeHtml(article.slug) + "/</loc><changefreq>monthly</changefreq><priority>0.7</priority></url>") : [])
  ];
  if (!urls.length) return response;
  const body = await response.text();
  return withInjectedHtml(response, body.replace("</urlset>", urls.join("") + "</urlset>"), { "content-type": "application/xml; charset=utf-8" });
}

async function injectRss(response, env) {
  if (!env.MONTASITE_AUTH || !response.ok) return response;
  const articles = await dynamicJson(env.MONTASITE_AUTH, "article:index", []);
  if (!Array.isArray(articles) || !articles.length) return response;
  const items = articles.slice(0, 50).map(article => "<item><title>" + escapeHtml(article.title) + "</title><link>" + SITE_ORIGIN + "/blog/" + escapeHtml(article.slug) + "/</link><guid isPermaLink='true'>" + SITE_ORIGIN + "/blog/" + escapeHtml(article.slug) + "/</guid><description>" + escapeHtml(article.description || "") + "</description><pubDate>" + new Date(article.publishedAt || Date.now()).toUTCString() + "</pubDate><category>MontaSite</category></item>").join("");
  const body = await response.text();
  return withInjectedHtml(response, body.replace("</channel>", items + "</channel>"), { "content-type": "application/rss+xml; charset=utf-8" });
}

export async function onRequest(context) {
  const url = new URL(context.request.url);
  const pathname = url.pathname;
  if (pathname.startsWith("/montasite") || pathname.startsWith("/api/")) return context.next();
  const asset = await serveAsset(pathname, context.env);
  if (asset) return asset;
  if (!context.env.MONTASITE_AUTH) return context.next();
  if (pathname === "/") return injectHome(await context.next(), context.env);
  if (pathname === "/blog/") return injectBlogIndex(await context.next(), context.env);
  if (pathname === "/sitemap.xml") return injectSitemap(await context.next(), context.env);
  if (pathname === "/blog/rss.xml") return injectRss(await context.next(), context.env);
  const parts = pathname.split("/").filter(Boolean);
  if (parts.length === 2 && parts[0] === "blog" && safeSlug(parts[1])) {
    const article = await dynamicJson(context.env.MONTASITE_AUTH, "article:" + parts[1], null);
    if (article?.html) return htmlResponse(article.html);
  }
  if (parts.length === 1 && safeSlug(parts[0])) {
    const site = await dynamicJson(context.env.MONTASITE_AUTH, "site:" + parts[0], null);
    if (site?.html) return htmlResponse(site.html);
  }
  return context.next();
}
