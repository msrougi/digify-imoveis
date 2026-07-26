/**
 * Build estático da Digify Imóveis.
 * Sem dependências: roda com `node scripts/build.mjs`.
 *
 * Lê  : public/ (arquivos estáticos) + content/posts/*.md
 * Gera: dist/ pronto para o Cloudflare Pages
 */
import fs from 'node:fs';
import path from 'node:path';

const RAIZ = path.resolve(import.meta.dirname, '..');
const DIST = path.join(RAIZ, 'dist');
const SITE = 'https://imoveis.digify.live';
const NOME = 'Digify Imóveis';
const HOJE = new Date().toISOString().slice(0, 10);

/* ---------------------------------------------------------------- utilidades */

const escapar = (s) =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const dataBR = (iso) =>
  new Date(iso + 'T12:00:00Z').toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });

function copiarPasta(origem, destino) {
  fs.mkdirSync(destino, { recursive: true });
  for (const item of fs.readdirSync(origem, { withFileTypes: true })) {
    const de = path.join(origem, item.name);
    const para = path.join(destino, item.name);
    item.isDirectory() ? copiarPasta(de, para) : fs.copyFileSync(de, para);
  }
}

/* ------------------------------------------------------- front matter + markdown */

function lerFrontMatter(bruto) {
  const m = bruto.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!m) throw new Error('Front matter ausente ou malformado.');
  const meta = {};
  for (const linha of m[1].split('\n')) {
    const par = linha.match(/^([a-zA-ZÀ-ú0-9_]+):\s*(.*)$/);
    if (par) meta[par[1]] = par[2].trim().replace(/^["'](.*)["']$/, '$1');
  }
  return { meta, corpo: m[2].trim() };
}

/** Subconjunto de markdown suficiente para os posts: h2/h3, p, ul, blockquote, hr, bold, link. */
function markdown(texto) {
  const inline = (s) =>
    escapar(s)
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, t, u) => {
        const externo = /^https?:\/\//.test(u) && !u.startsWith(SITE);
        return `<a href="${u}"${externo ? ' target="_blank" rel="noopener"' : ''}>${t}</a>`;
      });

  const blocos = texto.split(/\n{2,}/);
  const saida = [];

  for (const bruto of blocos) {
    const bloco = bruto.trim();
    if (!bloco) continue;

    if (/^###\s+/.test(bloco)) { saida.push(`<h3>${inline(bloco.replace(/^###\s+/, ''))}</h3>`); continue; }
    if (/^##\s+/.test(bloco))  { saida.push(`<h2>${inline(bloco.replace(/^##\s+/, ''))}</h2>`);  continue; }
    if (/^---+$/.test(bloco))  { saida.push('<hr>'); continue; }

    if (/^>\s?/.test(bloco)) {
      const t = bloco.split('\n').map((l) => l.replace(/^>\s?/, '')).join(' ');
      saida.push(`<blockquote>${inline(t)}</blockquote>`);
      continue;
    }
    if (/^[-*]\s+/.test(bloco)) {
      const itens = bloco.split('\n').map((l) => `<li>${inline(l.replace(/^[-*]\s+/, ''))}</li>`).join('');
      saida.push(`<ul>${itens}</ul>`);
      continue;
    }
    saida.push(`<p>${inline(bloco.replace(/\n/g, ' '))}</p>`);
  }
  return saida.join('\n');
}

/* -------------------------------------------------------------------- templates */

const FONTES =
  'https://fonts.googleapis.com/css2?family=Montserrat:wght@600;700;800&family=Inter+Tight:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap';

const cabeca = ({ titulo, descricao, url, imagem, tipo = 'website', jsonld = '' }) => `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<!-- Google Analytics 4 -->
<script async src="https://www.googletagmanager.com/gtag/js?id=G-M4C9KB9G9M"></script>
<script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','G-M4C9KB9G9M');</script>
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapar(titulo)}</title>
<meta name="description" content="${escapar(descricao)}">
<meta name="robots" content="index, follow, max-image-preview:large">
<link rel="canonical" href="${url}">
<meta property="og:type" content="${tipo}">
<meta property="og:site_name" content="${NOME}">
<meta property="og:locale" content="pt_BR">
<meta property="og:url" content="${url}">
<meta property="og:title" content="${escapar(titulo)}">
<meta property="og:description" content="${escapar(descricao)}">
<meta property="og:image" content="${SITE}${imagem}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${escapar(titulo)}">
<meta name="twitter:description" content="${escapar(descricao)}">
<meta name="twitter:image" content="${SITE}${imagem}">
<meta name="theme-color" content="#08172B">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32.png">
<link rel="alternate icon" href="/favicon.ico">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="alternate" type="application/rss+xml" title="${NOME} — Blog" href="${SITE}/blog/rss.xml">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="preload" as="style" href="${FONTES}">
<link rel="stylesheet" href="${FONTES}" media="print" onload="this.media='all'">
<noscript><link rel="stylesheet" href="${FONTES}"></noscript>
<link rel="stylesheet" href="/assets/site.css">
${jsonld}
</head>
<body>`;

const NAV = `
<div class="topbar"><div class="wrap">
  <span>imoveis.digify.live</span>
  <span>Anuncie seu imóvel com página própria — <strong>vagas abertas para 2026</strong></span>
</div></div>
<header class="nav"><div class="wrap">
  <div class="brand">
    <a class="logo" href="/" aria-label="${NOME} — página inicial">
      <svg class="logo-mark" viewBox="0 0 40 40" fill="none" aria-hidden="true">
        <rect width="40" height="40" rx="9" fill="#08172B"/>
        <path d="M12 22.5 20 15l8 7.5V29a1 1 0 0 1-1 1h-5v-6h-4v6h-5a1 1 0 0 1-1-1v-6.5Z" fill="#F0A92B"/>
        <path d="M9.5 22.8 20 13l10.5 9.8" stroke="#F0A92B" stroke-width="2.2" stroke-linecap="round" opacity=".45"/>
      </svg>
      <span class="logo-text"><span class="logo-word">digify<span>.</span></span><span class="logo-sub">Imóveis</span></span>
    </a>
    <p class="slogan"><span><b>IA que rankeia.</b></span><span>Página que vende.</span></p>
  </div>
  <button class="nav-toggle" aria-expanded="false" aria-controls="menu">MENU</button>
  <nav class="menu" id="menu">
    <a href="/#vitrine">Imóveis</a>
    <a href="/#como-funciona">Como funciona</a>
    <a href="/#ia">IA</a>
    <a href="/blog/">Blog</a>
    <a class="btn btn-amber btn-sm" href="https://wa.me/5511989911000?text=Ol%C3%A1!%20Quero%20anunciar%20um%20im%C3%B3vel%20na%20Digify%20Im%C3%B3veis." target="_blank" rel="noopener">Falar no WhatsApp</a>
  </nav>
</div></header>`;

const RODAPE = `
<footer><div class="wrap">
  <div class="foot-grid">
    <div>
      <span class="logo-text"><span class="logo-word">digify<span style="color:var(--amber)">.</span></span><span class="logo-sub">Imóveis</span></span>
      <p class="slogan-foot">IA que rankeia.<br>Página que vende.</p>
      <p>Corretora digital da <a href="https://digify.live" style="color:var(--white);text-decoration:underline;text-underline-offset:3px">Digify</a>, agência de desenvolvimento web e SEO. Publicamos, otimizamos e mantemos a página de cada imóvel anunciado.</p>
    </div>
    <div>
      <p class="foot-h">Navegar</p>
      <ul>
        <li><a href="/#vitrine">Imóveis</a></li>
        <li><a href="/#como-funciona">Como funciona</a></li>
        <li><a href="/#ia">Inteligência artificial</a></li>
        <li><a href="/#seo">Diferencial de SEO</a></li>
        <li><a href="/blog/">Blog</a></li>
        <li><a href="/#anunciar">Anuncie conosco</a></li>
      </ul>
    </div>
    <div>
      <p class="foot-h">Contato</p>
      <ul>
        <li><a href="https://wa.me/5511989911000" target="_blank" rel="noopener">+55 11 98991-1000</a></li>
        <li><a href="mailto:msrougi@gmail.com">msrougi@gmail.com</a></li>
        <li><a href="https://digify.live" target="_blank" rel="noopener">digify.live</a></li>
        <li>São Paulo · SP</li>
      </ul>
    </div>
  </div>
  <div class="foot-bot"><span>© ${new Date().getFullYear()} DIGIFY IMÓVEIS</span><span>IMOVEIS.DIGIFY.LIVE</span></div>
</div></footer>
<script>
(function(){
  var t=document.querySelector('.nav-toggle'),m=document.getElementById('menu');
  t.addEventListener('click',function(){var on=m.classList.toggle('on');t.setAttribute('aria-expanded',on);t.textContent=on?'FECHAR':'MENU';});
})();
</script>
</body>
</html>`;

/* ------------------------------------------------------------------ páginas */

function paginaPost(post, relacionados) {
  const url = `${SITE}/blog/${post.meta.slug}`;
  const jsonld = `<script type="application/ld+json">${JSON.stringify({
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'BlogPosting',
        '@id': `${url}#post`,
        headline: post.meta.titulo,
        description: post.meta.descricao,
        image: SITE + post.meta.imagem,
        datePublished: post.meta.data,
        dateModified: post.meta.data,
        inLanguage: 'pt-BR',
        articleSection: post.meta.categoria,
        author: { '@type': 'Organization', name: NOME, url: SITE },
        publisher: { '@type': 'Organization', name: NOME, url: SITE },
        mainEntityOfPage: url,
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Início', item: SITE + '/' },
          { '@type': 'ListItem', position: 2, name: 'Blog', item: SITE + '/blog/' },
          { '@type': 'ListItem', position: 3, name: post.meta.titulo, item: url },
        ],
      },
    ],
  })}</script>`;

  const cta = post.meta.imovelUrl
    ? `<aside class="post-cta">
         <p class="eyebrow">Imóvel citado</p>
         <h3>${escapar(post.meta.imovelNome || 'Ver imóvel')}</h3>
         <p>Galeria, localização, diferenciais e agendamento de visita direto com o corretor.</p>
         <a class="btn btn-amber" href="${post.meta.imovelUrl}">Ver página do imóvel</a>
       </aside>`
    : `<aside class="post-cta">
         <p class="eyebrow">Anuncie conosco</p>
         <h3>Seu imóvel com página própria</h3>
         <p>Construímos, publicamos e otimizamos a página do seu imóvel — com lead exclusivo no seu WhatsApp.</p>
         <a class="btn btn-amber" href="/#anunciar">Reservar vaga na vitrine</a>
       </aside>`;

  const lista = relacionados
    .map(
      (r) => `<a class="rel-item" href="/blog/${r.meta.slug}">
        <span class="card-loc">${escapar(r.meta.categoria)}</span>
        <h3>${escapar(r.meta.titulo)}</h3>
      </a>`
    )
    .join('');

  return `${cabeca({
    titulo: `${post.meta.titulo} | ${NOME}`,
    descricao: post.meta.descricao,
    url,
    imagem: post.meta.imagem,
    tipo: 'article',
    jsonld,
  })}
${NAV}
<article class="post">
  <div class="wrap wrap-post">
    <nav class="breadcrumb" aria-label="Você está em">
      <a href="/">Início</a> <span aria-hidden="true">›</span> <a href="/blog/">Blog</a> <span aria-hidden="true">›</span> <span>${escapar(post.meta.categoria)}</span>
    </nav>
    <p class="eyebrow">${escapar(post.meta.categoria)}</p>
    <h1>${escapar(post.meta.titulo)}</h1>
    <p class="post-meta">
      <time datetime="${post.meta.data}">${dataBR(post.meta.data)}</time>
      ${post.meta.revisadoPor ? `<span>·</span><span>Revisado por ${escapar(post.meta.revisadoPor)}</span>` : ''}
    </p>
    <div class="post-body">
${markdown(post.corpo)}
    </div>
    ${cta}
    ${lista ? `<section class="rel"><p class="eyebrow">Continue lendo</p><div class="rel-grid">${lista}</div></section>` : ''}
  </div>
</article>
${RODAPE}`;
}

function paginaIndice(posts) {
  const url = `${SITE}/blog/`;
  const jsonld = `<script type="application/ld+json">${JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'Blog',
    '@id': url + '#blog',
    name: `Blog — ${NOME}`,
    url,
    inLanguage: 'pt-BR',
    publisher: { '@type': 'Organization', name: NOME, url: SITE },
    blogPost: posts.map((p) => ({
      '@type': 'BlogPosting',
      headline: p.meta.titulo,
      url: `${SITE}/blog/${p.meta.slug}`,
      datePublished: p.meta.data,
    })),
  })}</script>`;

  const cards = posts
    .map(
      (p) => `<a class="card" href="/blog/${p.meta.slug}">
        <div class="card-body">
          <p class="card-loc">${escapar(p.meta.categoria)} · <time datetime="${p.meta.data}">${dataBR(p.meta.data)}</time></p>
          <h3>${escapar(p.meta.titulo)}</h3>
          <p>${escapar(p.meta.descricao)}</p>
          <span class="card-link">Ler matéria <span aria-hidden="true">→</span></span>
        </div>
      </a>`
    )
    .join('');

  return `${cabeca({
    titulo: `Blog — imóveis, bairros e marketing imobiliário | ${NOME}`,
    descricao:
      'Guias de bairro, análises de empreendimentos e conteúdo sobre marketing imobiliário. Publicado pela Digify Imóveis, corretora digital em São Paulo.',
    url,
    imagem: '/img/og-digify-imoveis.jpg',
    jsonld,
  })}
${NAV}
<section class="blog-head">
  <div class="wrap">
    <p class="eyebrow">Blog</p>
    <h1>Bairro, imóvel e mercado — sem enrolação</h1>
    <p class="lede">Escrevemos sobre o que realmente muda a decisão de compra: como é a rotina do bairro, o que olhar antes de fechar negócio e como um imóvel ganha visibilidade de verdade na busca.</p>
  </div>
</section>
<section class="blog-lista">
  <div class="wrap"><div class="vitrine-grid">${cards}</div></div>
</section>
${RODAPE}`;
}

/* ------------------------------------------------------------ sitemap / rss */

function sitemap(posts) {
  const urls = [
    { loc: `${SITE}/`, pri: '1.0', freq: 'weekly' },
    { loc: `${SITE}/coliseu-funchal/`, pri: '0.9', freq: 'monthly' },
    { loc: `${SITE}/blog/`, pri: '0.8', freq: 'weekly' },
    ...posts.map((p) => ({ loc: `${SITE}/blog/${p.meta.slug}`, pri: '0.7', freq: 'monthly', mod: p.meta.data })),
  ];
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
  .map(
    (u) =>
      `  <url>\n    <loc>${u.loc}</loc>\n    <lastmod>${u.mod || HOJE}</lastmod>\n    <changefreq>${u.freq}</changefreq>\n    <priority>${u.pri}</priority>\n  </url>`
  )
  .join('\n')}
</urlset>
`;
}

function rss(posts) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
<channel>
  <title>${NOME} — Blog</title>
  <link>${SITE}/blog/</link>
  <description>Guias de bairro, empreendimentos e marketing imobiliário.</description>
  <language>pt-BR</language>
  <atom:link href="${SITE}/blog/rss.xml" rel="self" type="application/rss+xml"/>
${posts
  .map(
    (p) => `  <item>
    <title>${escapar(p.meta.titulo)}</title>
    <link>${SITE}/blog/${p.meta.slug}</link>
    <guid isPermaLink="true">${SITE}/blog/${p.meta.slug}</guid>
    <description>${escapar(p.meta.descricao)}</description>
    <pubDate>${new Date(p.meta.data + 'T12:00:00Z').toUTCString()}</pubDate>
    <category>${escapar(p.meta.categoria)}</category>
  </item>`
  )
  .join('\n')}
</channel>
</rss>
`;
}

/* ---------------------------------------------------------------------- build */

fs.rmSync(DIST, { recursive: true, force: true });
copiarPasta(path.join(RAIZ, 'public'), DIST);

const dirPosts = path.join(RAIZ, 'content/posts');
const posts = fs
  .readdirSync(dirPosts)
  .filter((f) => f.endsWith('.md'))
  .map((f) => lerFrontMatter(fs.readFileSync(path.join(dirPosts, f), 'utf-8')))
  .sort((a, b) => (a.meta.data < b.meta.data ? 1 : -1));

for (const post of posts) {
  const outros = posts.filter((p) => p.meta.slug !== post.meta.slug).slice(0, 2);
  const dir = path.join(DIST, 'blog', post.meta.slug);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'index.html'), paginaPost(post, outros));
}

fs.mkdirSync(path.join(DIST, 'blog'), { recursive: true });
fs.writeFileSync(path.join(DIST, 'blog/index.html'), paginaIndice(posts));
fs.writeFileSync(path.join(DIST, 'blog/rss.xml'), rss(posts));
fs.writeFileSync(path.join(DIST, 'sitemap.xml'), sitemap(posts));
fs.writeFileSync(
  path.join(DIST, 'robots.txt'),
  `User-agent: *\nAllow: /\n\nSitemap: ${SITE}/sitemap.xml\n`
);

console.log(`✓ build concluído — ${posts.length} matérias em dist/`);
