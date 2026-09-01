(() => {
  "use strict";

  const catalog = [
    { id:"peak", name:"Peak Vila Olímpia", bairro:"Vila Olímpia", pdf:"Peak-Vila-Olimpia.pdf", delivery:"out/2027", heat:96, searches:"alto", competition:"Alta", summary:"Nome curto, bairro de forte intenção e produto com apelo para moradia e investimento." },
    { id:"conceicao", name:"Mundo Apto Estação Conceição", bairro:"Vila Guarani / Conceição", pdf:"Mundo-Apto-Estacao-Conceicao.pdf", delivery:"ago/2028", heat:88, searches:"alto", competition:"Alta", summary:"Metrô, faixa acessível e combinação forte de nome do produto com intenção regional." },
    { id:"ipiranga", name:"Mundo Apto Alto do Ipiranga", bairro:"Ipiranga", pdf:"Mundo-Apto-Alto-do-Ipiranga.pdf", delivery:"jul/2028", heat:84, searches:"médio/alto", competition:"Alta", summary:"Bairro consolidado, metrô e procura equilibrada entre moradia e investimento." },
    { id:"artstone", name:"Art’Stone Itaim", bairro:"Itaim Bibi", pdf:"ArtStone-Itaim.pdf", delivery:"jul/2027", heat:81, searches:"médio", competition:"Alta", summary:"Menor volume absoluto, mas intenção premium e alto valor comercial por lead." },
    { id:"campo-belo", name:"MAC Campo Belo", bairro:"Campo Belo", pdf:"MAC-Campo-Belo.pdf", delivery:"mai/2027", heat:79, searches:"médio/alto", competition:"Média/alta", summary:"Produto familiar em bairro consolidado com busca qualificada por plantas maiores." },
    { id:"moema", name:"Autoral Moema", bairro:"Moema", pdf:"Autoral-Moema.pdf", delivery:"fev/2027", heat:83, searches:"médio/alto", competition:"Alta", summary:"Moema eleva a intenção regional e atrai público familiar de maior poder aquisitivo." },
    { id:"mooca", name:"Vibra Mooca", bairro:"Mooca", pdf:"Vibra-Mooca-Book.pdf", delivery:"a confirmar", heat:76, searches:"médio/alto", competition:"Média", summary:"Bairro tradicional e faixa de entrada ampla; prazo precisa ser confirmado antes da publicação." },
    { id:"lapa", name:"Mundo Apto Estação Lapa", bairro:"Lapa de Baixo", pdf:"Mundo-Apto-Estacao-Lapa.pdf", delivery:"set/2027", heat:75, searches:"médio", competition:"Média", summary:"Mobilidade ferroviária e produto comercial para busca por preço e localização." },
    { id:"anima", name:"Ânima Vila Matilde", bairro:"Vila Matilde", pdf:"Anima-Vila-Matilde.pdf", delivery:"set/2028", heat:71, searches:"médio", competition:"Média", summary:"Faixa de entrada competitiva e bairro com público de primeira compra." },
    { id:"pin", name:"Pin Estação Vila Sônia", bairro:"Vila Sônia", pdf:"Pin-Estacao-Vila-Sonia.pdf", delivery:"jan/2029", heat:73, searches:"médio", competition:"Média", summary:"Metrô e ciclo longo de campanha favorecem conteúdo contínuo de descoberta." },
    { id:"livus", name:"Livus Vila Sônia", bairro:"Vila Sônia", pdf:"Livus-Vila-Sonia.pdf", delivery:"jan/2028", heat:67, searches:"médio/baixo", competition:"Média", summary:"Produto compacto de entrada com intenção de investidor e primeira compra." }
  ];
  const labels = ["Gelado", "Frio", "Morno", "Quente", "Fervendo"];
  const colors = ["#62a8ff", "#78c6e9", "#efc44d", "#ff8948", "#ff4d3d"];
  const $ = selector => document.querySelector(selector);
  const bairro = $("#bairro"), pdf = $("#pdf"), slug = $("#slug"), upload = $("#pdf-upload");
  const form = $("#site-form"), output = $("#output"), promptEl = $("#prompt");
  let current = null, uploadedName = "";

  const normalize = value => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
  const slugify = value => normalize(value).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const heatIndex = score => score >= 85 ? 4 : score >= 70 ? 3 : score >= 50 ? 2 : score >= 30 ? 1 : 0;
  const formatNumber = n => typeof n === "number" ? new Intl.NumberFormat("pt-BR").format(n) : n;

  [...new Set(catalog.map(item => item.bairro))].sort().forEach(name => {
    const option = document.createElement("option"); option.value = name; $("#bairros").append(option);
  });

  function filterPdfs() {
    const term = normalize(bairro.value);
    const matches = catalog.filter(item => normalize(item.bairro).includes(term) || term.includes(normalize(item.bairro)) || normalize(item.name).includes(term));
    pdf.innerHTML = matches.length ? '<option value="">Selecione o PDF</option>' : '<option value="">Nenhum PDF catalogado — envie outro abaixo</option>';
    matches.forEach(item => { const option = document.createElement("option"); option.value = item.id; option.textContent = `${item.name} · entrega ${item.delivery}`; pdf.append(option); });
    pdf.disabled = !matches.length;
    current = null; renderHeat(null);
  }

  bairro.addEventListener("input", filterPdfs);
  bairro.addEventListener("change", filterPdfs);
  pdf.addEventListener("change", async () => {
    current = catalog.find(item => item.id === pdf.value) || null;
    uploadedName = "";
    upload.value = ""; upload.closest(".upload").classList.remove("has-file");
    if (current) { slug.value = slugify(current.name); renderHeat(current); await requestLiveInsights(current); }
  });
  upload.addEventListener("change", () => {
    const file = upload.files[0]; if (!file) return;
    uploadedName = file.name; current = { name:file.name.replace(/\.pdf$/i,""), bairro:bairro.value || "A definir", pdf:file.name, delivery:"a confirmar", heat:50, searches:"a medir", competition:"a medir", summary:"PDF enviado manualmente; análise real depende da conexão com o Google." };
    upload.closest(".upload").classList.add("has-file"); upload.nextElementSibling.textContent = `✓ ${file.name}`;
    slug.value = slugify(current.name); renderHeat(current);
  });

  function renderHeat(item, live) {
    const card = $("#heat-card"), scale = document.querySelectorAll(".heat-scale span");
    if (!item) {
      card.className = "heat-card is-empty"; $("#heat-label").textContent="—"; $("#heat-score").textContent="0"; $("#heat-summary").textContent="Selecione um PDF para analisar nome, região e intenção de busca.";
      $(".thermometer i").style.height="0"; scale.forEach(x=>x.classList.remove("active")); ["#m-searches","#m-competition","#m-impressions","#m-position"].forEach(id=>$(id).textContent="—"); return;
    }
    const score = live?.score ?? item.heat, index = heatIndex(score);
    card.className = `heat-card heat-${index}`; $("#heat-label").textContent=labels[index]; $("#heat-score").textContent=score; $("#heat-summary").textContent=live?.summary || item.summary;
    $(".thermometer i").style.height=`${Math.max(7,score)}%`; $(".thermometer i").style.background=colors[index]; scale.forEach((x,i)=>x.classList.toggle("active",i===index));
    $("#m-searches").textContent=formatNumber(live?.monthlySearches ?? item.searches); $("#m-competition").textContent=live?.competition ?? item.competition; $("#m-impressions").textContent=formatNumber(live?.impressions ?? "sem dados"); $("#m-position").textContent=live?.position ? Number(live.position).toFixed(1) : "sem dados";
    $("#data-source").textContent = live ? `Google Ads + Search Console · ${new Date(live.collectedAt || Date.now()).toLocaleDateString("pt-BR")}` : "Estimativa estratégica Digify · conectar Google para dados reais";
  }

  async function requestLiveInsights(item) {
    try {
      const response = await fetch(`/api/search-insights?name=${encodeURIComponent(item.name)}&bairro=${encodeURIComponent(item.bairro)}&url=${encodeURIComponent(`https://imoveis.digify.live/${slug.value}/`)}`);
      if (!response.ok) return;
      const data = await response.json(); if (data?.connected) renderHeat(item, data);
    } catch { /* mantém fallback editorial */ }
  }

  const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
  async function runSteps() {
    const steps = [...document.querySelectorAll("#steps li")], idle = $("#idle");
    steps.forEach(x => x.className=""); idle.className="idle running"; idle.querySelector("span").textContent="CRIANDO"; idle.querySelector("p").textContent="Preparando o briefing completo…";
    for (let i=0;i<steps.length;i++) { steps[i].classList.add("active"); await wait(i===1?850:560); steps[i].classList.remove("active"); steps[i].classList.add("done"); }
    idle.querySelector("span").textContent="CONCLUÍDO"; idle.querySelector("p").textContent="Prompt pronto para copiar e usar no Codex.";
  }

  function buildPrompt(data) {
    const item = current;
    const heat = labels[heatIndex(item.heat)];
    return `Crie e publique uma landing page imobiliária completa para o empreendimento abaixo, seguindo integralmente o playbook da Digify Imóveis.

DADOS DE ENTRADA
- Empreendimento: ${item.name}
- Bairro/região: ${data.bairro}
- PDF-fonte: ${item.pdf}${uploadedName ? " (arquivo enviado pelo usuário)" : " (catálogo local de PDFs)"}
- URL canônica obrigatória: https://imoveis.digify.live/${data.slug}/
- Fase: ${data.fase}
- Tipologia prioritária: ${data.tipologia}
- Entrega conhecida: ${item.delivery}
- Temperatura de busca atual: ${heat} (${item.heat}/100)
- Leitura de demanda: ${item.summary}

OBJETIVO
Criar uma página premium, rápida, mobile-first, altamente persuasiva e específica para o público provável deste empreendimento. Ela deve manter o nível de qualidade e a lógica de conversão do WELL Perdizes e do Peak Vila Olímpia, mas ter direção visual própria, coerente com o imóvel, o bairro, o tíquete, as plantas e a incorporadora. Não fazer uma cópia visual genérica.

PESQUISA E VERACIDADE
1. Leia o PDF integralmente e extraia dele a ficha técnica, endereço, metragens, tipologias, vagas, lazer, diferenciais, incorporadora, arquitetura, paisagismo, decoração, registro, prazo e observações legais.
2. Pesquise muito em fontes oficiais e atuais: incorporadora, página oficial, book, memorial, mapa e documentação disponível. Confirme fatos instáveis antes de publicar.
3. Não invente endereço, metragem, prazo, unidade disponível, condição comercial, distância, registro ou amenidade. Se houver divergência, explique e peça confirmação antes da publicação.
4. Nunca prometa valorização, renda, liquidez ou ocupação. Use linguagem de potencial e inclua aviso de que resultados dependem do mercado.
5. Valores, disponibilidade, condições e prazo devem ter aviso de atualização e confirmação contratual.
6. Para preços, use sempre “valores”, “valores atualizados” ou “condições comerciais”. Não empregue outro termo comercial.

IMAGENS E PDF
1. Extraia do PDF as melhores imagens oficiais: fachada, áreas comuns, localização, implantação e todas as plantas relevantes.
2. Recorte corretamente, remova margens editoriais quando necessário, preserve proporção e não deixe textos do book cortados de forma ruim.
3. Converta para WebP, comprima sem perda visual importante, use nomes SEO e mantenha fallback quando necessário.
4. Priorize imagens oficiais no hero, galeria, localização, plantas e CTA final. Inclua uma nota discreta informando que perspectivas e plantas vêm do material de divulgação.
5. Crie lightbox funcional para galeria e plantas.

PÚBLICO, COPY E ESTRATÉGIA
1. Defina o público-alvo antes de escrever: moradia, investidor, família, primeira compra, estudante, executivo ou combinação coerente.
2. Alinhe headline, benefícios, ordem das seções e CTAs à intenção de busca por nome do imóvel e por bairro.
3. Destaque diferenciais concretos do entorno e do produto, evitando clichês sem prova.
4. Inclua argumentos separados para morar e investir quando ambos fizerem sentido.
5. Use urgência apenas de forma verificável. Não invente “últimas unidades”.

ESTRUTURA MÍNIMA DA PÁGINA
- Barra de condições e cabeçalho enxuto.
- Hero cinematográfico com nome, fase, localização, proposta e CTAs.
- Seção de oportunidade/endereço.
- Números principais do empreendimento.
- Imagem de impacto em largura total.
- Galeria oficial e lista completa de lazer/diferenciais.
- Localização com endereço, pontos relevantes e link para o Google Maps.
- Seção “para quem faz sentido” ou tese de decisão.
- Exatamente 3 depoimentos em cards, nunca 2.
- Depoimentos provisórios e editáveis, coerentes com três perfis reais de público; não apresentá-los como relatos reais até serem substituídos por depoimentos autorizados.
- Usar fotos de pessoas reais da Unsplash como background, sem links de referência visíveis na interface.
- Seção de plantas oficiais com todas as opções pertinentes.
- Formulário completo.
- FAQ com pelo menos cinco perguntas específicas.
- CTA final e rodapé legal.

FORMULÁRIO E CONTATO — OBRIGATÓRIO
1. Campos: nome, WhatsApp, e-mail, interesse/tipologia e consentimento.
2. Enviar o lead por POST para https://formsubmit.co/ajax/msrougi@gmail.com.
3. Assunto identificando claramente o empreendimento e origem da landing page.
4. Após o envio por e-mail, abrir WhatsApp para 5511989911000 com mensagem preenchida contendo nome, telefone, e-mail, empreendimento e interesse.
5. Exibir estados de enviando, sucesso e erro. Se o e-mail falhar, manter CTA direto para WhatsApp.
6. Todos os CTAs devem levar ao formulário ou ao WhatsApp correto.

CONVERSÃO E EXPERIÊNCIA
- CTA flutuante do WhatsApp e CTA fixo no mobile.
- Barra de progresso de leitura.
- Navegação por âncoras internas clara, sem chamar isso de “âncora” na copy do usuário.
- Popup de engajamento/saída com frequência controlada, fácil de fechar e sem bloquear acessibilidade.
- Feedback visual nos botões, carregamento lazy e interações suaves.
- Respeitar prefers-reduced-motion, foco visível, labels, contraste, alt text e navegação por teclado.
- Não deixar imagens, overlays, títulos ou botões se sobreporem no mobile.

SEO E DESCOBERTA
1. Title, meta description, canonical exata, Open Graph e Twitter Card com imagem oficial absoluta.
2. Um H1 forte; headings semânticos; texto útil sobre o nome do imóvel, bairro, tipologias e intenção do público.
3. JSON-LD adequado (ApartmentComplex/RealEstateListing), PostalAddress, imagem e URL, somente com dados confirmados.
4. Incluir a URL no sitemap e criar redirect sem barra para a versão canônica com barra.
5. Atualizar a Home de https://imoveis.digify.live/ com card destacado do novo empreendimento, imagem oficial, descrição, metragens e link.
6. Atualizar o JSON-LD ItemList da Home, posições e quantidade sem remover os imóveis existentes.
7. Não alterar artigos ou páginas que não façam parte do projeto.

GOOGLE ADS E SEARCH CONSOLE
- Se a integração estiver conectada, consultar Google Ads Keyword Planner para: nome exato, nome + bairro, apartamentos + bairro, lançamento + bairro, tipologia + bairro e variações de alta intenção.
- Coletar média mensal dos últimos 12 meses, tendência mensal, concorrência, índice de concorrência e faixas de lance.
- Consultar Search Console para a URL e consultas relacionadas: impressões, cliques, CTR e posição média.
- Registrar a fonte e data da coleta. Não chamar estimativa de dado real.
- Usar os dados para priorizar title, H1, FAQ, textos, links internos e próxima campanha, sem keyword stuffing.

IMPLEMENTAÇÃO NO REPOSITÓRIO
- Repositório: msrougi/digify-imoveis, branch main.
- Criar em public/${data.slug}/ com assets locais e caminhos absolutos consistentes.
- Preservar o build estático e o deploy do Cloudflare Pages.
- Formulários e segredos devem ser seguros; nunca colocar client secret, refresh token ou developer token no JavaScript público.
- Não desfazer alterações do usuário nem sobrescrever trabalho não relacionado.

VALIDAÇÃO ANTES DE PUBLICAR
1. Rodar o build completo.
2. Validar JavaScript, links, imagens, favicon, redirects, sitemap, canonical, Schema e ausência da palavra proibida para preços.
3. Testar desktop e mobile, formulário, WhatsApp, lightbox, popup, FAQ, navegação e estados de erro/sucesso.
4. Confirmar exatamente 3 depoimentos.
5. Verificar que não há assets quebrados, conteúdo cortado, scroll horizontal ou texto ilegível.
6. Só então publicar no main e verificar a URL ao vivo.

ENTREGA
Faça o trabalho completo agora: pesquisa, tratamento das imagens do PDF, implementação, integração na Home, testes e publicação. Ao final, informe a URL publicada, os principais fatos confirmados, o que foi extraído do PDF, os testes executados e qualquer dado que ainda dependa de confirmação comercial.`;
  }

  form.addEventListener("submit", async event => {
    event.preventDefault();
    if (!current) { alert("Selecione um PDF do catálogo ou envie outro arquivo."); return; }
    const button = form.querySelector(".create"), data = Object.fromEntries(new FormData(form));
    button.disabled=true; button.querySelector("span").textContent="Criando briefing…"; await runSteps();
    const text = buildPrompt(data); promptEl.textContent=text; output.hidden=false; button.disabled=false; button.querySelector("span").textContent="Criar novamente"; output.scrollIntoView({behavior:"smooth",block:"start"});
  });

  $("#copy").addEventListener("click", async event => { await navigator.clipboard.writeText(promptEl.textContent); const old=event.target.textContent; event.target.textContent="Copiado ✓"; setTimeout(()=>event.target.textContent=old,1800); });
  $("#download").addEventListener("click", () => { const blob=new Blob([promptEl.textContent],{type:"text/plain;charset=utf-8"}), link=document.createElement("a"); link.href=URL.createObjectURL(blob); link.download=`prompt-${slug.value || "imovel"}.txt`; link.click(); URL.revokeObjectURL(link.href); });
  const dialog=$("#google-dialog"); $("#connect-google").addEventListener("click",()=>dialog.showModal()); dialog.querySelectorAll(".dialog-close,.dialog-action").forEach(button=>button.addEventListener("click",()=>dialog.close()));
})();
