/**
 * Gera o RASCUNHO de uma matéria a partir da próxima pauta da fila.
 * Não publica: escreve o .md e o workflow abre um Pull Request para revisão humana.
 *
 * Uso:  node scripts/gerar-pauta.mjs                  (pega a próxima pauta da fila)
 *       node scripts/gerar-pauta.mjs "tema livre"     (tema informado na mão)
 *
 * Requer a variável de ambiente ANTHROPIC_API_KEY.
 */
import fs from 'node:fs';
import path from 'node:path';

const RAIZ = path.resolve(import.meta.dirname, '..');
const DIR_POSTS = path.join(RAIZ, 'content/posts');
const ARQ_PAUTAS = path.join(RAIZ, 'content/pautas.json');
const MODELO = 'claude-sonnet-4-6';

const chave = process.env.ANTHROPIC_API_KEY;
if (!chave) {
  console.error('Falta ANTHROPIC_API_KEY. Configure em Settings → Secrets → Actions.');
  process.exit(1);
}

/* --------------------------------------------------- escolher a pauta do dia */

const publicados = fs.existsSync(DIR_POSTS) ? fs.readdirSync(DIR_POSTS).filter((f) => f.endsWith('.md')) : [];
const slugsExistentes = publicados.map((f) => {
  const t = fs.readFileSync(path.join(DIR_POSTS, f), 'utf-8').match(/^slug:\s*"?(.+?)"?$/m);
  return t ? t[1] : '';
});
const titulosExistentes = publicados.map((f) => {
  const t = fs.readFileSync(path.join(DIR_POSTS, f), 'utf-8').match(/^titulo:\s*"?(.+?)"?$/m);
  return t ? t[1] : '';
});

let pauta = process.argv[2];
if (!pauta) {
  const fila = JSON.parse(fs.readFileSync(ARQ_PAUTAS, 'utf-8'));
  const pendente = fila.find((p) => !slugsExistentes.includes(p.slug));
  if (!pendente) {
    console.log('Fila de pautas vazia. Adicione temas em content/pautas.json.');
    process.exit(0);
  }
  pauta = pendente;
} else {
  pauta = { tema: pauta, categoria: 'Mercado imobiliário', slug: '' };
}

const hoje = new Date().toISOString().slice(0, 10);

/* ------------------------------------------------------------------- prompt */

const INSTRUCOES = `Você escreve para o blog da Digify Imóveis, corretora digital de São Paulo (imoveis.digify.live).

VOZ DA CASA
- Português do Brasil, direto, adulto, sem jargão de marketing e sem entusiasmo forçado.
- Nada de "descubra", "imperdível", "o sonho da casa própria", "não perca tempo".
- Frases curtas alternadas com frases longas. Parágrafos de 2 a 4 linhas.
- Pode discordar do senso comum e apontar quando algo não vale a pena. Honestidade vende mais que superlativo.

REGRAS INEGOCIÁVEIS
1. NÃO invente números. Nada de preço por m², percentual de valorização, quantidade de moradores, estatística de mercado ou pesquisa — a menos que você tenha certeza absoluta do dado e ele seja estável e verificável. Na dúvida, escreva de forma qualitativa.
2. NÃO prometa primeira posição no Google nem resultado garantido de qualquer espécie.
3. NÃO invente características de imóveis, empreendimentos ou condomínios específicos.
4. A estação Vila Olímpia é TREM (Linha 9-Esmeralda, ViaMobilidade), não metrô. Nunca escreva "metrô Vila Olímpia".
5. Se citar um dado que precisa de conferência, escreva-o entre colchetes assim: [CONFERIR: ...]. O revisor humano confirma antes de publicar.

FORMATO DE SAÍDA
Responda SOMENTE com o arquivo markdown, começando em --- e sem nenhum texto antes ou depois, sem blocos de código.

---
titulo: "..."            (até 60 caracteres, sem clickbait)
descricao: "..."         (140 a 158 caracteres, é a meta description)
slug: "..."              (minúsculas, sem acento, separado por hífen)
data: "${hoje}"
categoria: "..."
imagem: "/img/blog/SLUG.jpg"
imagemAlt: "..."
revisadoPor: "Marcelo Srougi"
---

Texto em markdown: 700 a 1000 palavras, com 3 a 5 subtítulos em "## ", listas com "- " quando fizer sentido, **negrito** com moderação.
Termine com um parágrafo curto ligando ao serviço da Digify Imóveis e um link em markdown, escolhendo o mais adequado:
- página de anúncio: https://imoveis.digify.live/#anunciar
- imóvel Coliseu Funchal (2 dormitórios, Vila Olímpia, Rua Funchal, a 100 metros da estação): https://imoveis.digify.live/coliseu-funchal
- imóvel WELL Perdizes (studios e apartamentos em Perdizes): https://imoveis.digify.live/well-perdizes/
- imóvel Peak Vila Olímpia (studios e 2 dormitórios, Rua Quatá, em frente ao Insper): https://imoveis.digify.live/peak-vilaolimpia/

Se o tema tiver relação com Vila Olímpia, Itaim Bibi, imóvel compacto, Insper ou Rua Quatá, escolha entre Peak Vila Olímpia e Coliseu Funchal conforme a intenção da matéria. Não force os dois links quando apenas um for realmente pertinente.`;

const PEDIDO = `Escreva a matéria de hoje.

TEMA: ${pauta.tema}
CATEGORIA: ${pauta.categoria}
${pauta.slug ? `SLUG OBRIGATÓRIO: ${pauta.slug}` : ''}
${pauta.angulo ? `ÂNGULO: ${pauta.angulo}` : ''}

Já publicamos as matérias abaixo. Não repita o assunto e, quando fizer sentido, linke para uma delas:
${titulosExistentes.map((t, i) => `- ${t} → https://imoveis.digify.live/blog/${slugsExistentes[i]}`).join('\n')}`;

/* --------------------------------------------------------------------- chamada */

const resposta = await fetch('https://api.anthropic.com/v1/messages', {
  method: 'POST',
  headers: {
    'content-type': 'application/json',
    'x-api-key': chave,
    'anthropic-version': '2023-06-01',
  },
  body: JSON.stringify({
    model: MODELO,
    max_tokens: 4000,
    system: INSTRUCOES,
    messages: [{ role: 'user', content: PEDIDO }],
  }),
});

if (!resposta.ok) {
  console.error('Falha na API:', resposta.status, await resposta.text());
  process.exit(1);
}

const dados = await resposta.json();
let texto = dados.content
  .filter((b) => b.type === 'text')
  .map((b) => b.text)
  .join('\n')
  .trim()
  .replace(/^```(?:markdown|md)?\n?/, '')
  .replace(/\n?```$/, '');

if (!texto.startsWith('---')) {
  console.error('A resposta não começou com front matter. Nada foi gravado.');
  process.exit(1);
}

const slug = (texto.match(/^slug:\s*"?(.+?)"?$/m) || [])[1];
if (!slug) {
  console.error('Não consegui ler o slug do front matter.');
  process.exit(1);
}
if (slugsExistentes.includes(slug)) {
  console.error(`O slug "${slug}" já existe. Nada foi gravado.`);
  process.exit(1);
}

texto = texto.replace(/\/img\/blog\/SLUG\.jpg/g, `/img/blog/${slug}.jpg`);

const arquivo = path.join(DIR_POSTS, `${hoje}-${slug}.md`);
fs.writeFileSync(arquivo, texto + '\n');

const pendencias = (texto.match(/\[CONFERIR:[^\]]*\]/g) || []).length;

fs.appendFileSync(
  process.env.GITHUB_OUTPUT || '/dev/null',
  `slug=${slug}\narquivo=${path.relative(RAIZ, arquivo)}\npendencias=${pendencias}\n`
);

console.log(`✓ rascunho gravado: ${path.relative(RAIZ, arquivo)}`);
console.log(pendencias ? `⚠ ${pendencias} item(ns) marcado(s) com [CONFERIR:] para revisão.` : '✓ sem pendências marcadas.');
