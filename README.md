# Digify Imóveis — imoveis.digify.live

Site estático da corretora digital da Digify. Home institucional + páginas de imóvel + blog com geração assistida por IA e revisão humana obrigatória.

---

## Estrutura

```
public/            arquivos servidos como estão (home, css, imagens, _headers)
content/posts/     matérias em markdown com front matter — fonte da verdade
content/pautas.json  fila editorial usada pela automação
scripts/build.mjs    gera dist/ (blog, sitemap, rss, robots)
scripts/gerar-pauta.mjs  gera o rascunho de uma matéria via API
.github/workflows/   agendamento 3x por semana + abertura de PR
dist/              saída do build (não versionar)
```

## Rodar localmente

```bash
node scripts/build.mjs
npx serve dist        # ou qualquer servidor estático
```

Sem dependências de runtime. Precisa de Node 18+ (usa `fetch` nativo).

---

## Deploy no Cloudflare Pages

Conecte o repositório e use:

| Campo | Valor |
|---|---|
| Framework preset | None |
| Build command | `node scripts/build.mjs` |
| Build output directory | `dist` |
| Node version | `22` (variável `NODE_VERSION`) |

Em **Custom domains**, adicione `imoveis.digify.live`. Como o `digify.live` já está na Cloudflare, o CNAME é criado automaticamente.

`_headers` e `_redirects` ficam em `public/` e são copiados para `dist/` — o Pages os lê de lá.

---

## Blog: como funciona a automação

Segunda, quarta e sexta às 9h de Brasília, o workflow:

1. pega a próxima pauta não publicada de `content/pautas.json`;
2. chama a API da Anthropic com as regras da casa (voz, proibição de inventar número, proibição de prometer ranking);
3. grava o `.md` em `content/posts/`;
4. roda o build para garantir que não quebrou nada;
5. **abre um Pull Request** — não faz merge.

Publicar é um merge seu. É esse passo que separa conteúdo editado de conteúdo escalado — e é o que sustenta o "IA com gente atrás" que está escrito na home.

### Configuração necessária

Em **Settings → Secrets and variables → Actions**, crie o secret `ANTHROPIC_API_KEY`.

Em **Settings → Actions → General**, marque *Allow GitHub Actions to create and approve pull requests*.

### Rodar na mão

```bash
export ANTHROPIC_API_KEY=sk-ant-...
node scripts/gerar-pauta.mjs                      # próxima pauta da fila
node scripts/gerar-pauta.mjs "tema que eu quiser"  # tema livre
```

### Antes de dar merge

O template do PR já traz o checklist. O item que mais importa: qualquer trecho marcado com `[CONFERIR: ...]` é um dado que a IA não teve certeza. Confira ou apague — nunca publique o marcador.

---

## Escrever uma matéria na mão

Crie `content/posts/AAAA-MM-DD-slug.md`:

```markdown
---
titulo: "Título de até 60 caracteres"
descricao: "Meta description entre 140 e 158 caracteres."
slug: "slug-sem-acento"
data: "2026-07-24"
categoria: "Bairros"
imagem: "/img/blog/slug-sem-acento.jpg"
imagemAlt: "Descrição da imagem"
imovelUrl: "https://imoveis.digify.live/coliseu-funchal"   # opcional
imovelNome: "Coliseu Funchal"                              # opcional
revisadoPor: "Marcelo Srougi"
---

Texto em markdown.
```

Markdown suportado: `##`, `###`, parágrafos, listas com `-`, `**negrito**`, `[link](url)`, `>` citação e `---`.

---

## Imagens — pendência aberta

O build referencia arquivos que ainda não existem. Coloque em `public/img/`:

| Arquivo | Uso | Tamanho sugerido |
|---|---|---|
| `img/coliseu-funchal.jpg` | card da vitrine na home | 900×563 |
| `img/og-digify-imoveis.jpg` | cartão de compartilhamento | 1200×630 |
| `img/blog/<slug>.jpg` | capa de cada matéria | 1200×630 |

Salve em WebP quando possível e comprima antes de subir. Sem a `og-*.jpg`, link compartilhado no WhatsApp sai sem prévia.

---

## Pendências de SEO fora do código

1. **Search Console** — cadastre como *Domain property* (`digify.live`, sem prefixo). Cobre todos os subdomínios de uma vez e ajuda o Google a tratar o subdomínio como parte da mesma propriedade.
2. **Enviar o sitemap** — `https://imoveis.digify.live/sitemap.xml`.
3. **Link no menu do digify.live** — item "Imóveis" na navegação principal, não no rodapé. Link de navegação global consolida muito mais que link solto.
4. **Página `/coliseu-funchal`** — hoje a home aponta para ela; suba o HTML existente nessa rota com o mesmo padrão de head (canonical, OG, JSON-LD `Residence`/`Apartment`).
5. **Corrigir "metrô" na landing do Coliseu** — a estação Vila Olímpia é trem, Linha 9-Esmeralda. Errado no anúncio é risco de credibilidade e de reclamação.

---

## Aviso

Conteúdo do blog não é aconselhamento jurídico nem recomendação de investimento. Matérias sobre documentação e financiamento devem recomendar assessoria profissional.
