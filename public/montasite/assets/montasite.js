(() => {
  "use strict";
  const catalog = [
    {id:"peak",name:"Peak Vila Olímpia",bairro:"Vila Olímpia",pdf:"Peak-Vila-Olimpia.pdf",delivery:"out/2027",types:["Studio / 1 dormitório","2 dormitórios"],heat:96,searches:"alto",competition:"Alta",summary:"Nome curto, bairro de forte intenção e produto com apelo para moradia e investimento."},
    {id:"conceicao",name:"Mundo Apto Estação Conceição",bairro:"Vila Guarani / Conceição",pdf:"Mundo-Apto-Estacao-Conceicao.pdf",delivery:"ago/2028",types:["Studio / 1 dormitório","2 dormitórios"],heat:88,searches:"alto",competition:"Alta",summary:"Metrô, faixa acessível e combinação forte de nome do produto com intenção regional."},
    {id:"ipiranga",name:"Mundo Apto Alto do Ipiranga",bairro:"Ipiranga",pdf:"Mundo-Apto-Alto-do-Ipiranga.pdf",delivery:"jul/2028",types:["Studio / 1 dormitório","2 dormitórios"],heat:84,searches:"médio/alto",competition:"Alta",summary:"Bairro consolidado, metrô e procura equilibrada entre moradia e investimento."},
    {id:"artstone",name:"Art’Stone Itaim",bairro:"Itaim Bibi",pdf:"ArtStone-Itaim.pdf",delivery:"jul/2027",types:["2 dormitórios","3 dormitórios ou mais"],heat:81,searches:"médio",competition:"Alta",summary:"Menor volume absoluto, mas intenção premium e alto valor comercial por lead."},
    {id:"campo-belo",name:"MAC Campo Belo",bairro:"Campo Belo",pdf:"MAC-Campo-Belo.pdf",delivery:"mai/2027",types:["2 dormitórios","3 dormitórios ou mais"],heat:79,searches:"médio/alto",competition:"Média/alta",summary:"Produto familiar em bairro consolidado com busca qualificada por plantas maiores."},
    {id:"moema",name:"Autoral Moema",bairro:"Moema",pdf:"Autoral-Moema.pdf",delivery:"fev/2027",types:["2 dormitórios","3 dormitórios ou mais"],heat:83,searches:"médio/alto",competition:"Alta",summary:"Moema eleva a intenção regional e atrai público familiar de maior poder aquisitivo."},
    {id:"mooca",name:"Vibra Mooca",bairro:"Mooca",pdf:"Vibra-Mooca-Book.pdf",delivery:"a confirmar",types:["Studio / 1 dormitório","2 dormitórios"],heat:76,searches:"médio/alto",competition:"Média",summary:"Bairro tradicional e faixa de entrada ampla; prazo precisa ser confirmado antes da publicação."},
    {id:"lapa",name:"Mundo Apto Estação Lapa",bairro:"Lapa de Baixo",pdf:"Mundo-Apto-Estacao-Lapa.pdf",delivery:"set/2027",types:["Studio / 1 dormitório","2 dormitórios"],heat:75,searches:"médio",competition:"Média",summary:"Mobilidade ferroviária e produto comercial para busca por valor e localização."},
    {id:"anima",name:"Ânima Vila Matilde",bairro:"Vila Matilde",pdf:"Anima-Vila-Matilde.pdf",delivery:"set/2028",types:["Studio / 1 dormitório","2 dormitórios"],heat:71,searches:"médio",competition:"Média",summary:"Faixa de entrada competitiva e bairro com público de primeira compra."},
    {id:"pin",name:"Pin Estação Vila Sônia",bairro:"Vila Sônia",pdf:"Pin-Estacao-Vila-Sonia.pdf",delivery:"jan/2029",types:["Studio / 1 dormitório","2 dormitórios"],heat:73,searches:"médio",competition:"Média",summary:"Metrô e ciclo longo de campanha favorecem conteúdo contínuo de descoberta."},
    {id:"livus",name:"Livus Vila Sônia",bairro:"Vila Sônia",pdf:"Livus-Vila-Sonia.pdf",delivery:"jan/2028",types:["Studio / 1 dormitório"],heat:67,searches:"médio/baixo",competition:"Média",summary:"Produto compacto de entrada com intenção de investidor e primeira compra."}
  ];
  const labels=["Gelado","Frio","Morno","Quente","Fervendo"], colors=["#5b8cff","#36b9db","#f0c84b","#ff8a45","#ff4f71"];
  const $=selector=>document.querySelector(selector), $$=selector=>[...document.querySelectorAll(selector)];
  const form=$("#site-form"), bairro=$("#bairro"), pdfList=$("#pdf-list"), upload=$("#pdf-upload"), slug=$("#slug"), output=$("#output"), promptEl=$("#prompt");
  let current=null, selectedFile=null, resolvedPdfFile=null, pendingCatalogItem=null, currentIdeas=[], pollTimer=null, renderedEvents=0, pdfJsPromise=null, imageRun=0;
  let propertyImages=[];
  const photoState=[null,null,null];
  const normalize=value=>String(value||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().trim();
  const slugify=value=>normalize(value).replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"");
  const escapeHtml=value=>String(value).replace(/[&<>'"]/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"})[char]);
  const heatIndex=score=>score>=85?4:score>=70?3:score>=50?2:score>=30?1:0;
  const nowTime=()=>new Date().toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit",second:"2-digit"});

  [...new Set(catalog.flatMap(item=>item.bairro.split(" / ")))].sort().forEach(name=>{const option=document.createElement("option");option.value=name;$("#bairros").append(option);});
  $("#testimonial-grid").innerHTML=[1,2,3].map(index=>`<article class="testimonial-card"><label class="testimonial-photo" id="photo-label-${index}"><input id="testimonial-photo-${index}" name="testimonial_photo_${index}" type="file" accept="image/jpeg,image/png,image/webp" required><img id="photo-preview-${index}" alt="Prévia do recorte da foto ${index}" hidden><span>Envie uma foto<br>com o rosto visível</span></label><label class="field"><span>Nome da pessoa</span><input id="testimonial-name-${index}" name="testimonial_name_${index}" maxlength="70" required></label><label class="field"><span>Depoimento</span><textarea id="testimonial-text-${index}" name="testimonial_text_${index}" maxlength="420" required></textarea></label></article>`).join("");

  function addLog(message,type="info"){
    const container=$("#log-lines"); if(container.children.length===1&&container.textContent.includes("Aguardando"))container.replaceChildren();
    const line=document.createElement("p");line.dataset.type=type;line.innerHTML=`<time>${nowTime()}</time><span>${escapeHtml(message)}</span>`;container.append(line);container.scrollTop=container.scrollHeight;
  }
  function setProgress(percent,state="running"){$("#progress-value").textContent=`${percent}%`;$("#progress-bar").style.width=`${percent}%`;$("#job-state").className=state;$("#job-state").textContent=state==="error"?"ATENÇÃO":state==="done"?"CONCLUÍDO":state==="scheduled"?"AGENDADO":"EM EXECUÇÃO";}
  function markStep(key,state){const item=$(`#steps li[data-key="${key}"]`);if(item)item.className=state||"";}
  function resetConsole(){if(pollTimer)clearTimeout(pollTimer);renderedEvents=0;$$('#steps li').forEach(item=>item.className="");$("#log-lines").replaceChildren();$("#output-summary").textContent="";delete $("#output-summary").dataset.linksRendered;setProgress(0);$("#job-state").className="";$("#job-state").textContent="PRONTO";}
  function selectedType(){return form.querySelector('input[name="tipologia"]:checked').value;}
  function selectedPhase(){return form.querySelector('input[name="fase"]:checked').value;}

  function renderPdfCards(results){
    pdfList._results=results;
    pdfList.innerHTML=results.length?results.map((item,index)=>`<button class="pdf-result-card" type="button" role="listitem" data-index="${index}" aria-pressed="false"><span class="pdf-badge">PDF</span><span class="pdf-result-copy"><strong>${escapeHtml(item.name)}</strong><small>${escapeHtml(item.phase||selectedPhase())} · ${escapeHtml(item.delivery||"prazo a confirmar")} · ${escapeHtml(item.sourceHost||"Acervo Digify")}</small><span>${escapeHtml(item.summary||"Os dados serão confirmados durante a leitura.")}</span></span><em>Selecionar ↗</em></button>`).join(""):'<p class="pdf-empty">Nenhum PDF confirmou bairro, tipologia e fase. Você pode enviar o material manualmente abaixo.</p>';
  }

  async function searchPdfs(){
    if(!bairro.value.trim()){bairro.reportValidity();return;}
    $("#search-pdfs").disabled=true;$("#search-pdfs span").textContent="Pesquisando várias fontes…";addLog(`Iniciando multibusca de PDFs em ${bairro.value}, ${selectedType()}, fase ${selectedPhase()}…`);let remote=[];
    try{const response=await fetch(`/api/property-pdfs?bairro=${encodeURIComponent(bairro.value)}&tipologia=${encodeURIComponent(selectedType())}&fase=${encodeURIComponent(selectedPhase())}`);const data=await response.json();if(response.ok){remote=data.items||[];if(data.connected)addLog(`${data.queriesRun||1} buscas concluídas; ${data.candidatesChecked||remote.length} candidatos confirmaram os três critérios.`);}else addLog(data.error||"A busca externa não respondeu.","warning");}
    catch{addLog("A busca externa falhou; exibindo também o acervo Digify.","warning");}
    const term=normalize(bairro.value), local=catalog.filter(item=>selectedPhase()==="Lançamento"&&(normalize(item.bairro).includes(term)||term.includes(normalize(item.bairro)))&&item.types.includes(selectedType())).map(item=>({...item,phase:"Lançamento"}));
    const results=[...local,...remote.filter(item=>!local.some(localItem=>normalize(localItem.name)===normalize(item.name)))];
    renderPdfCards(results);$("#pdf-results").hidden=false;addLog(results.length?`${results.length} material(is) organizado(s) por relevância para você comparar.`:"Nenhum PDF compatível foi confirmado. Você pode enviar o material manualmente.",results.length?"info":"warning");$("#search-pdfs").disabled=false;$("#search-pdfs span").textContent="Buscar PDFs compatíveis";
  }

  function clearPropertyImages(){propertyImages.forEach(item=>URL.revokeObjectURL(item.preview));propertyImages=[];resolvedPdfFile=null;$("#property-image-grid").replaceChildren();}
  function imageStatus(title,detail,state="working"){const box=$("#pdf-image-status");box.className=`pdf-image-status ${state}`;box.querySelector("strong").textContent=title;box.querySelector("small").textContent=detail;}
  function renderPropertyImages(){
    $("#property-image-grid").innerHTML=propertyImages.map((item,index)=>`<figure class="property-image-card"><img src="${item.preview}" alt="Prévia da página ${item.page} do PDF"><figcaption><span>Imagem ${index+1} · página ${item.page}</span><button type="button" data-remove-image="${index}" aria-label="Remover imagem ${index+1}">Remover</button></figcaption></figure>`).join("");
    imageStatus(`${propertyImages.length} imagem(ns) pronta(s).`,"A primeira será usada no hero; todas entrarão na galeria.",propertyImages.length?"ready":"error");
    updateCreateState();
  }
  $("#property-image-grid").addEventListener("click",event=>{const button=event.target.closest("[data-remove-image]");if(!button)return;const index=Number(button.dataset.removeImage);const removed=propertyImages.splice(index,1)[0];if(removed)URL.revokeObjectURL(removed.preview);renderPropertyImages();addLog("Uma imagem do material foi retirada da galeria.","warning");});

  async function loadPdfJs(){
    if(!pdfJsPromise)pdfJsPromise=import("/montasite/vendor/pdfjs/pdf.min.mjs").then(module=>{module.GlobalWorkerOptions.workerSrc="/montasite/vendor/pdfjs/pdf.worker.min.mjs";return module;});
    return pdfJsPromise;
  }
  function visualScore(canvas){
    const context=canvas.getContext("2d",{willReadFrequently:true}),pixels=context.getImageData(0,0,canvas.width,canvas.height).data;
    let samples=0,white=0,saturation=0,luminance=0,luminanceSq=0;
    for(let y=0;y<canvas.height;y+=6){for(let x=0;x<canvas.width;x+=6){const offset=(y*canvas.width+x)*4,r=pixels[offset],g=pixels[offset+1],b=pixels[offset+2],max=Math.max(r,g,b),min=Math.min(r,g,b),light=.2126*r+.7152*g+.0722*b;samples++;if(r>244&&g>244&&b>244)white++;saturation+=(max-min)/255;luminance+=light;luminanceSq+=light*light;}}
    const mean=luminance/samples,variance=Math.max(0,luminanceSq/samples-mean*mean),whiteRatio=white/samples;
    return (1-whiteRatio)*55+Math.min(25,Math.sqrt(variance)/2.2)+(saturation/samples)*24;
  }
  async function pdfBytes(file,item){
    if(file)return file.arrayBuffer();
    if(!item.pdfUrl)throw new Error("Este item do acervo não possui o PDF anexado. Use ‘Enviar outro PDF’ para carregar o book original.");
    const response=await fetch(`/api/property-pdf-file?url=${encodeURIComponent(item.pdfUrl)}`);
    if(!response.ok)throw new Error((await response.text())||`Não foi possível abrir o PDF (${response.status}).`);
    return response.arrayBuffer();
  }
  async function preparePropertyImages(item,file,run){
    clearPropertyImages();$("#property-images-section").hidden=false;imageStatus("Abrindo o PDF…","Baixando o material e preparando a análise visual.");addLog(`Abrindo o PDF de ${item.name} para selecionar imagens reais.`);
    try{
      const [pdfjs,data]=await Promise.all([loadPdfJs(),pdfBytes(file,item)]);if(run!==imageRun)return;
      resolvedPdfFile=file||new File([data],item.pdf||`${slugify(item.name)}.pdf`,{type:"application/pdf"});
      const task=pdfjs.getDocument({data:new Uint8Array(data)}),documentPdf=await task.promise;
      const maxAnalyzed=36,step=Math.max(1,Math.ceil(documentPdf.numPages/maxAnalyzed)),pages=[];
      for(let pageNumber=1;pageNumber<=documentPdf.numPages;pageNumber+=step)pages.push(pageNumber);
      if(pages.at(-1)!==documentPdf.numPages)pages.push(documentPdf.numPages);
      imageStatus(`Analisando ${pages.length} de ${documentPdf.numPages} páginas…`,"Priorizando fachadas, ambientes, lazer, localização e plantas.");addLog(`PDF aberto: ${documentPdf.numPages} páginas; ${pages.length} serão avaliadas visualmente.`);
      const ranked=[];
      for(const [position,pageNumber] of pages.entries()){
        if(run!==imageRun){await documentPdf.destroy();return;}
        const page=await documentPdf.getPage(pageNumber),base=page.getViewport({scale:1}),scale=Math.min(1,420/base.width),viewport=page.getViewport({scale});
        const canvas=document.createElement("canvas");canvas.width=Math.max(1,Math.round(viewport.width));canvas.height=Math.max(1,Math.round(viewport.height));
        await page.render({canvasContext:canvas.getContext("2d",{alpha:false}),viewport}).promise;
        ranked.push({page:pageNumber,score:visualScore(canvas)});
        if(position%5===0)imageStatus(`Analisando páginas… ${position+1}/${pages.length}`,"Separando páginas visuais de páginas predominantemente textuais.");
        page.cleanup();
      }
      const selected=[];
      for(const candidate of ranked.sort((a,b)=>b.score-a.score)){if(selected.length>=7)break;if(selected.some(item=>Math.abs(item.page-candidate.page)<=1)&&selected.length>=3)continue;selected.push(candidate);}
      imageStatus(`Otimizando ${selected.length} imagens…`,"Convertendo o material selecionado para WebP em alta definição; a melhor imagem será o hero.");
      const prepared=[];
      for(const [index,candidate] of selected.entries()){
        const page=await documentPdf.getPage(candidate.page),base=page.getViewport({scale:1}),scale=Math.min(2.4,1400/base.width),viewport=page.getViewport({scale});
        const canvas=document.createElement("canvas");canvas.width=Math.max(1,Math.round(viewport.width));canvas.height=Math.max(1,Math.round(viewport.height));
        await page.render({canvasContext:canvas.getContext("2d",{alpha:false}),viewport}).promise;
        const blob=await canvasBlob(canvas,"image/webp",.84),name=`empreendimento-${index+1}-pagina-${candidate.page}.webp`,fileOut=new File([blob],name,{type:"image/webp"});
        prepared.push({file:fileOut,page:candidate.page,score:candidate.score,preview:URL.createObjectURL(fileOut)});page.cleanup();
      }
      await documentPdf.destroy();if(run!==imageRun){prepared.forEach(value=>URL.revokeObjectURL(value.preview));return;}
      propertyImages=prepared;renderPropertyImages();addLog(`${prepared.length} imagens reais do PDF foram preparadas para hero e galeria.`);
    }catch(error){if(run!==imageRun)return;clearPropertyImages();imageStatus("Não foi possível preparar imagens.",error.message,"error");addLog(error.message,"error");updateCreateState();}
  }
  function selectProperty(item,file=null){current=item;selectedFile=file;slug.value=slugify(item.name);$("#project-section").hidden=false;$("#property-images-section").hidden=false;$("#testimonials-section").hidden=false;$("#articles-section").hidden=false;renderHeat(item);renderIdeas(item);updateCreateState();requestLiveInsights(item);preparePropertyImages(item,file,++imageRun);}
  pdfList.addEventListener("click",event=>{const button=event.target.closest(".pdf-result-card");if(!button)return;const item=(pdfList._results||[])[Number(button.dataset.index)];if(!item)return;$$('.pdf-result-card').forEach(card=>{card.classList.toggle("selected",card===button);card.setAttribute("aria-pressed",card===button?"true":"false");});upload.value="";upload.closest(".upload").classList.remove("has-file");if(!item.pdfUrl){pendingCatalogItem=item;addLog(`${item.name} está no acervo de referência. Selecione agora o PDF original salvo no seu computador.`);upload.click();return;}pendingCatalogItem=null;selectProperty(item);addLog(`${item.name} selecionado para leitura e criação.`);});
  upload.addEventListener("change",()=>{const file=upload.files[0];if(!file)return;if(file.type!=="application/pdf"||file.size>25*1024*1024){alert("Envie um PDF de até 25 MB.");upload.value="";return;}upload.closest(".upload").classList.add("has-file");upload.closest(".upload").querySelector("strong").textContent=`✓ ${file.name}`;const item=pendingCatalogItem?{...pendingCatalogItem,pdf:file.name,pdfUrl:null}:{id:"upload",name:file.name.replace(/\.pdf$/i,""),bairro:bairro.value,pdf:file.name,pdfUrl:null,phase:selectedPhase(),delivery:selectedPhase()==="Pronta entrega"?"pronta entrega — confirmar no PDF":"a confirmar",types:[selectedType()],heat:50,searches:"a medir",competition:"a medir",summary:"Material enviado manualmente; bairro, tipologia e fase serão confirmados durante a leitura."};pendingCatalogItem=null;selectProperty(item,file);});
  $("#search-pdfs").addEventListener("click",searchPdfs);
  form.querySelectorAll('input[name="tipologia"],input[name="fase"]').forEach(input=>input.addEventListener("change",()=>{$("#pdf-results").hidden=true;$("#project-section").hidden=true;$("#property-images-section").hidden=true;$("#testimonials-section").hidden=true;$("#articles-section").hidden=true;current=null;selectedFile=null;imageRun++;clearPropertyImages();updateCreateState();}));

  function renderHeat(item,live){const score=live?.score??item.heat??50,index=heatIndex(score),orb=$("#heat-orb");orb.style.setProperty("--score",score);orb.style.setProperty("--heat",colors[index]);$("#heat-score").textContent=score;$("#heat-label").textContent=labels[index];$("#heat-summary").textContent=live?.summary||item.summary;$$('.heat-scale span').forEach((span,i)=>span.classList.toggle("active",i===index));$("#m-searches").textContent=live?.monthlySearches??item.searches;$("#m-competition").textContent=live?.competition??item.competition;$("#m-impressions").textContent=live?.impressions??"sem dados";$("#m-position").textContent=live?.position?Number(live.position).toFixed(1):"sem dados";$("#data-source").textContent=live?`Google · ${new Date(live.collectedAt||Date.now()).toLocaleDateString("pt-BR")}`:"Estimativa Digify · conectar Google para dados reais";}
  async function requestLiveInsights(item){try{const response=await fetch(`/api/search-insights?name=${encodeURIComponent(item.name)}&bairro=${encodeURIComponent(item.bairro)}&url=${encodeURIComponent(`https://imoveis.digify.live/${slug.value}/`)}`);if(!response.ok)return;const data=await response.json();if(data.connected){renderHeat(item,data);addLog("Dados reais do Google atualizados.");}}catch{/* mantém estimativa identificada */}}
  function createIdeas(item){const region=bairro.value.trim()||item.bairro,type=selectedType();return[{intent:"Bairro e rotina",title:`Como é morar em ${region}: mobilidade, serviços e rotina perto do ${item.name}`,slug:slugify(`morar-em-${region}-perto-do-${item.name}`)},{intent:"Edifício",title:`${item.name}: plantas, lazer, diferenciais e o que confirmar antes de comprar`,slug:slugify(`${item.name}-plantas-lazer-diferenciais`)},{intent:"Decisão",title:`${type} em ${region}: para quem o ${item.name} faz sentido`,slug:slugify(`${type}-${region}-${item.name}`)}];}
  function renderIdeas(item){currentIdeas=createIdeas(item);$("#article-ideas").innerHTML=currentIdeas.map((idea,index)=>`<label class="article-option"><input type="radio" name="article" value="${index}" ${index===0?"checked":""}><span><b>0${index+1}</b><span><strong>${escapeHtml(idea.title)}</strong><small>${escapeHtml(idea.intent)} · /blog/${escapeHtml(idea.slug)}</small></span><em>✓</em></span></label>`).join("");$$('input[name="article"]').forEach(input=>input.addEventListener("change",updateCreateState));}

  const clamp=(value,min,max)=>Math.min(max,Math.max(min,value));
  const canvasBlob=(canvas,type="image/webp",quality=.88)=>new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(new Error("Não foi possível preparar o recorte.")),type,quality));
  async function cropPortrait(file){
    if(file.size>8*1024*1024||!['image/jpeg','image/png','image/webp'].includes(file.type))throw new Error("Envie uma foto JPG, PNG ou WebP de até 8 MB.");
    const bitmap=await createImageBitmap(file),width=bitmap.width,height=bitmap.height;
    if(Math.min(width,height)<480){bitmap.close();throw new Error("A foto precisa ter pelo menos 480 px no menor lado.");}
    const size=Math.min(width,height);let centerX=width/2,centerY=height*.30,faceDetected=false;
    if("FaceDetector" in window){
      try{const faces=await new window.FaceDetector({fastMode:true,maxDetectedFaces:1}).detect(bitmap);if(faces[0]?.boundingBox){const box=faces[0].boundingBox;centerX=box.x+box.width/2;centerY=box.y+box.height/2;faceDetected=true;}}catch{/* navegador usa enquadramento superior central */}
    }
    const sourceX=clamp(centerX-size/2,0,width-size),sourceY=clamp(centerY-size*.36,0,height-size);
    const canvas=document.createElement("canvas");canvas.width=300;canvas.height=300;
    const context=canvas.getContext("2d",{alpha:false});context.drawImage(bitmap,sourceX,sourceY,size,size,0,0,300,300);bitmap.close();
    const blob=await canvasBlob(canvas),base=file.name.replace(/\.[^.]+$/,"").replace(/[^a-z0-9_-]+/gi,"-");
    return{file:new File([blob],`${base||"retrato"}-recorte.webp`,{type:"image/webp"}),faceDetected};
  }

  [1,2,3].forEach(index=>{
    $(`#testimonial-photo-${index}`).addEventListener("change",async event=>{const file=event.target.files[0];if(!file)return;const label=$(`#photo-label-${index}`),preview=$(`#photo-preview-${index}`);label.classList.add("processing");try{const cropped=await cropPortrait(file);photoState[index-1]=cropped.file;preview.src=URL.createObjectURL(cropped.file);preview.hidden=false;label.classList.add("has-image");addLog(`Foto ${index} recortada e enquadrada${cropped.faceDetected?" com detecção do rosto":" pela área superior central"}.`);}catch(error){event.target.value="";photoState[index-1]=null;preview.hidden=true;label.classList.remove("has-image");alert(error.message);}finally{label.classList.remove("processing");}updateCreateState();});
    $(`#testimonial-name-${index}`).addEventListener("input",updateCreateState);$(`#testimonial-text-${index}`).addEventListener("input",updateCreateState);
  });
  function testimonials(){return [1,2,3].map(index=>({name:$(`#testimonial-name-${index}`).value.trim(),text:$(`#testimonial-text-${index}`).value.trim(),photoName:photoState[index-1]?.name||""}));}
  function updateCreateState(){const article=form.querySelector('input[name="article"]:checked');const ready=current&&slug.value&&article&&resolvedPdfFile&&propertyImages.length>0&&photoState.every(Boolean)&&testimonials().every(item=>item.name&&item.text);$("#create-site").disabled=!ready;}
  slug.addEventListener("input",updateCreateState);

  function selectedArticle(){const index=Number(form.querySelector('input[name="article"]:checked')?.value);return currentIdeas[index]||null;}
  function buildPayload(){return{bairro:bairro.value.trim(),slug:slug.value.trim(),tipologia:selectedType(),fase:form.querySelector('input[name="fase"]:checked').value,property:{id:current.id,name:current.name,pdf:current.pdf,pdfUrl:current.pdfUrl||null,delivery:current.delivery,heat:current.heat,summary:current.summary,images:propertyImages.map((item,index)=>({index:index+1,page:item.page,name:item.file.name}))},testimonials:testimonials(),article:selectedArticle(),contacts:{email:"msrougi@gmail.com",whatsapp:"5511989911000"}};}
  function buildBriefing(payload,schedule){return `DIGIFY MONTASITE · BRIEFING DO JOB\n\nEMPREENDIMENTO\nNome: ${payload.property.name}\nBairro: ${payload.bairro}\nPDF: ${payload.property.pdf}\nURL canônica: https://imoveis.digify.live/${payload.slug}/\nFase: ${payload.fase}\nTipologia: ${payload.tipologia}\nEntrega: ${payload.property.delivery}\n\nOBJETIVO\nCriar e publicar uma landing page imobiliária premium, rápida, mobile-first, com identidade visual própria baseada no empreendimento e no público identificado após a leitura integral do PDF. Pesquisar fontes oficiais atuais e nunca inventar endereço, prazo, metragem, amenidade, disponibilidade ou condição comercial. Para preço e condições, usar “valores”; não usar o termo comercial proibido.\n\nPDF E IMAGENS\nLer o PDF integralmente. Extrair ficha técnica, diferenciais e imagens oficiais. Recortar corretamente, otimizar em WebP, preservar proporção, gerar alt text e usar lightbox. Confirmar dados divergentes antes de publicar.\n\nDEPOIMENTOS\nPublicar exatamente estes 3 depoimentos enviados pelo administrador, sem alterar autoria ou associar outra foto:\n${payload.testimonials.map((item,index)=>`${index+1}. ${item.name}: “${item.text}” · arquivo ${item.photoName}`).join("\n")}\nAs imagens originais podem ser verticais ou horizontais. Usar o recorte quadrado preparado pelo MontaSite, manter o rosto inteiro e bem enquadrado e conferir cabelo, testa, olhos, queixo e laterais em 1440 px e 390 px. Exibir os depoimentos em cards compactos, discretos e modernos, com retratos pequenos. Nunca reutilizar essas fotos em outro site.\n\nPÁGINA\nIncluir hero, dados principais, galeria, lazer/diferenciais, localização, público e argumentos de decisão, plantas, os 3 depoimentos, FAQ específica, formulário, CTA final, rodapé legal, WhatsApp flutuante e CTA fixo mobile. A navegação interna deve usar rótulos naturais. Garantir acessibilidade, foco, contraste, reduced motion e ausência de sobreposição ou scroll horizontal.\n\nCONTATO\nO formulário terá nome, WhatsApp, e-mail, interesse e consentimento. Enviar por POST a https://formsubmit.co/ajax/msrougi@gmail.com e depois abrir WhatsApp para 5511989911000 com os dados preenchidos. Mostrar enviando, sucesso, erro e fallback.\n\nSEO E PUBLICAÇÃO\nCriar title, description, canonical, Open Graph, Twitter Card, H1 único, headings semânticos e JSON-LD apenas com dados confirmados. Criar a pasta public/${payload.slug}/, incluir no sitemap, redirect sem barra, card na Home e ItemList da Home. Rodar build e validar desktop/mobile, links, assets, formulário, WhatsApp, schema e exatamente 3 depoimentos. Publicar no branch main e verificar a URL ao vivo.\n\nMATÉRIA ESCOLHIDA — PUBLICAR SOMENTE UMA\nTítulo: ${payload.article.title}\nSlug: /blog/${payload.article.slug}\nIntenção: ${payload.article.intent}\nData calculada: ${schedule?formatSchedule(schedule.local):"será calculada pelo servidor"}\nCriar uma única matéria original, ligada ao empreendimento e sem canibalizar posts existentes. Usar fatos confirmados, link natural para https://imoveis.digify.live/${payload.slug}/, adicionar ao blog, sitemap e RSS. Publicar no horário agendado. Só depois de confirmar resposta pública da URL, enviar e-mail para marcelo@digify.live.\n\nPROGRESSO\nCada etapa deve reportar eventos reais ao MontaSite: validação, leitura do PDF, pesquisa, construção, publicação/linkagem e agendamento. Nunca preencher a barra com temporizador falso. Em erros, registrar causa e tentativa.\n\nENTREGA\nAo concluir, informar URLs, dados confirmados, conteúdo extraído, testes executados e pendências comerciais.`;}
  function formatSchedule(value){return new Intl.DateTimeFormat("pt-BR",{timeZone:"America/Sao_Paulo",dateStyle:"full",timeStyle:"short"}).format(new Date(value));}

  function renderJob(job){const state=job.status==="failed"?"error":job.status==="completed"?"done":job.status==="scheduled"?"scheduled":"running";setProgress(job.percent,state);for(let i=renderedEvents;i<job.events.length;i++){const event=job.events[i];addLog(event.message,event.status||"info");const order=["validate","pdf","research","build","publish","article"],position=order.indexOf(event.step);order.forEach((key,index)=>markStep(key,job.status==="completed"?index<=position:index<position?"done":index===position?"active":""));}renderedEvents=job.events.length;if(job.status==="completed")$("#output").querySelector("h2").textContent="Site e matéria prontos.";if(job.articleSchedule){$("#schedule-preview").querySelector("small").textContent=`Publicação em ${job.articleSchedule.delayDays} dia(s)`;$("#schedule-preview").querySelector("strong").textContent=formatSchedule(job.articleSchedule.local);}if((job.siteUrl||job.articleUrl)&&!$("#output-summary").dataset.linksRendered){const links=[job.siteUrl?`<a href="${escapeHtml(job.siteUrl)}" target="_blank" rel="noopener">Abrir página do imóvel ↗</a>`:"",job.articleUrl?`<a href="${escapeHtml(job.articleUrl)}" target="_blank" rel="noopener">Abrir matéria ↗</a>`:""].filter(Boolean);if(links.length){$("#output-summary").innerHTML+=`<span class="result-links">${links.join(" · ")}</span>`;$("#output-summary").dataset.linksRendered="true";}}if(job.configuration){addLog(job.configuration.message,"warning");$("#job-state").className="error";$("#job-state").textContent="CONFIGURAR";}}
  async function pollJob(id){try{const response=await fetch(`/api/montasite-jobs?id=${encodeURIComponent(id)}`);const data=await response.json();if(!response.ok)throw new Error(data.error);renderJob(data.job);if(!["completed","failed","waiting_configuration","scheduled"].includes(data.job.status))pollTimer=setTimeout(()=>pollJob(id),2200);}catch(error){addLog(error.message,"error");setProgress(Number($("#progress-value").textContent.replace("%",""))||0,"error");}}

  form.addEventListener("submit",async event=>{event.preventDefault();if(!current||!resolvedPdfFile||!propertyImages.length||!photoState.every(Boolean)||!selectedArticle())return;resetConsole();setProgress(3);markStep("validate","active");addLog("Iniciando validação do projeto e dos arquivos.");const payload=buildPayload(),body=new FormData();body.append("payload",JSON.stringify(payload));propertyImages.forEach((item,index)=>body.append(`property_image_${index+1}`,item.file,item.file.name));photoState.forEach((file,index)=>body.append(`testimonial_photo_${index+1}`,file,file.name));body.append("uploaded_pdf",resolvedPdfFile,resolvedPdfFile.name);const button=$("#create-site");button.disabled=true;try{const response=await fetch("/api/montasite-jobs",{method:"POST",body});const data=await response.json().catch(()=>({error:"Resposta inválida do servidor."}));if(!response.ok)throw Object.assign(new Error(data.error||"Não foi possível criar o job."),{status:response.status});renderJob(data.job);const briefing=data.job.prompt||buildBriefing(payload,data.job.articleSchedule);promptEl.textContent=briefing;$("#output-summary").textContent=`Job ${data.job.id} criado com ${propertyImages.length} imagens do empreendimento. O prompt foi enviado automaticamente ao executor; a matéria está prevista para ${formatSchedule(data.job.articleSchedule.local)}.`;output.hidden=false;output.scrollIntoView({behavior:"smooth",block:"start"});if(!["completed","failed","waiting_configuration","scheduled"].includes(data.job.status))pollJob(data.job.id);}catch(error){setProgress(8,"error");markStep("validate","active");addLog(error.message,"error");const briefing=buildBriefing(payload,null);promptEl.textContent=briefing;$("#output-summary").textContent="Não foi possível iniciar a execução automática. O prompt ficou disponível apenas para conferência.";output.hidden=false;output.scrollIntoView({behavior:"smooth",block:"start"});}finally{button.disabled=false;updateCreateState();}});

  $("#copy").addEventListener("click",async event=>{await navigator.clipboard.writeText(promptEl.textContent);const old=event.target.textContent;event.target.textContent="Copiado ✓";setTimeout(()=>event.target.textContent=old,1500);});
  $("#download").addEventListener("click",()=>{const blob=new Blob([promptEl.textContent],{type:"text/plain;charset=utf-8"}),link=document.createElement("a");link.href=URL.createObjectURL(blob);link.download=`montasite-${slug.value||"projeto"}.txt`;link.click();URL.revokeObjectURL(link.href);});
  $("#clear-log").addEventListener("click",()=>$("#log-lines").replaceChildren());
  $("#logout").addEventListener("click",async()=>{await fetch("/api/montasite-auth/logout",{method:"POST"});location.replace("/montasite/login/");});
  const dialog=$("#google-dialog");$("#connect-google").addEventListener("click",()=>dialog.showModal());dialog.querySelectorAll(".dialog-close,.dialog-action").forEach(button=>button.addEventListener("click",()=>dialog.close()));
})();
