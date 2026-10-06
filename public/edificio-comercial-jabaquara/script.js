(() => {
  const slider=document.querySelector('.hero-slider');if(!slider)return;
  const slides=[...slider.querySelectorAll('.hero-slide')],dots=[...slider.querySelectorAll('[data-hero-slide]')];let current=0;
  function show(index){current=(index+slides.length)%slides.length;slides.forEach((slide,i)=>{slide.classList.toggle('is-active',i===current);slide.setAttribute('aria-hidden',String(i!==current));dots[i].setAttribute('aria-pressed',String(i===current));});slider.querySelector('.hero-slide-count').textContent=String(current+1).padStart(2,'0')+' / 03';}
  dots.forEach((dot,i)=>dot.addEventListener('click',()=>show(i)));
  slider.querySelector('[data-hero-prev]').addEventListener('click',()=>show(current-1));
  slider.querySelector('[data-hero-next]').addEventListener('click',()=>show(current+1));
  slider.addEventListener('keydown',event=>{if(event.key==='ArrowRight'||event.key==='ArrowLeft'){event.preventDefault();show(current+(event.key==='ArrowRight'?1:-1));}});
  let touchX=null;slider.addEventListener('touchstart',event=>{touchX=event.touches[0].clientX;},{passive:true});slider.addEventListener('touchend',event=>{if(touchX!==null){const delta=event.changedTouches[0].clientX-touchX;if(Math.abs(delta)>50)show(current+(delta<0?1:-1));touchX=null;}},{passive:true});
  slider.querySelector('.hero-slider-controls').hidden=false;
  const motion=matchMedia('(prefers-reduced-motion: reduce)');
  let timer=null,hovered=false,focused=false,inView=true,paused=false;
  const pause=document.createElement('button');pause.type='button';pause.className='hero-slide-pause';pause.textContent='Ⅱ';
  slider.querySelector('.hero-slide-arrows').prepend(pause);
  const counter=slider.querySelector('.hero-slide-count');
  function sync(){
    clearInterval(timer);timer=null;
    const running=!paused&&!motion.matches&&!document.hidden&&!hovered&&!focused&&inView;
    counter.setAttribute('aria-live',running?'off':'polite');
    pause.textContent=paused?'▷':'Ⅱ';pause.setAttribute('aria-label',paused?'Retomar troca automática':'Pausar troca automática');pause.setAttribute('aria-pressed',String(paused));
    if(running)timer=setInterval(()=>show(current+1),3000);
  }
  pause.addEventListener('click',()=>{paused=!paused;sync();});
  slider.addEventListener('mouseenter',()=>{hovered=true;sync();});slider.addEventListener('mouseleave',()=>{hovered=false;sync();});
  slider.addEventListener('focusin',()=>{focused=true;sync();});slider.addEventListener('focusout',event=>{if(!slider.contains(event.relatedTarget)){focused=false;sync();}});
  document.addEventListener('visibilitychange',sync);motion.addEventListener('change',sync);
  if('IntersectionObserver' in window){new IntersectionObserver(entries=>{inView=entries[0].isIntersecting;sync();},{threshold:.1}).observe(slider);}
  sync();
})();

(() => {
  'use strict';
  const $ = (s, root = document) => root.querySelector(s);
  const $$ = (s, root = document) => [...root.querySelectorAll(s)];
  const config = window.SITE_CONFIG || {};
  const storage = {
    get(key, permanent = false) { try { return (permanent ? localStorage : sessionStorage).getItem(key); } catch { return null; } },
    set(key, value, permanent = false) { try { (permanent ? localStorage : sessionStorage).setItem(key, value); } catch {} }
  };
  const params = new URLSearchParams(location.search);
  let attribution = {};
  try { attribution = JSON.parse(storage.get('jabaquara_utm') || '{}'); } catch {}
  ['utm_source','utm_medium','utm_campaign','utm_content','utm_term'].forEach(key => {
    if (params.has(key)) attribution[key] = params.get(key).slice(0,200);
  });
  storage.set('jabaquara_utm', JSON.stringify(attribution));
  window.dataLayer = window.dataLayer || [];
  let consent = 'granted';
  let activeAnalytics = false;
  function track(event, detail = {}) {
    // Nunca encaminhar nome, telefone, e-mail ou conteúdo livre para analytics.
    const payload = {event, ...detail};
    window.dataLayer.push(payload);
    if (consent !== 'granted') return;
    if (typeof window.gtag === 'function' && !config.analytics?.gtmId) window.gtag('event', event, detail);
    if (typeof window.fbq === 'function') window.fbq('trackCustom', event, detail);
  }
  window.siteTrack = track;
  function loadScript(src) { const s = document.createElement('script'); s.async = true; s.src = src; document.head.append(s); }
  function activateAnalytics() {
    if (activeAnalytics || consent !== 'granted') return;
    activeAnalytics = true;
    const a = config.analytics || {};
    if (/^GTM-[A-Z0-9]+$/.test(a.gtmId)) {
      window.dataLayer.push({'gtm.start':Date.now(), event:'gtm.js'});
      loadScript('https://www.googletagmanager.com/gtm.js?id='+a.gtmId);
    } else if (/^G-[A-Z0-9]+$/.test(a.ga4Id) || /^AW-\d+$/.test(a.googleAdsId)) {
      window.gtag = function(){window.dataLayer.push(arguments);};
      window.gtag('js',new Date());
      loadScript('https://www.googletagmanager.com/gtag/js?id='+(a.ga4Id || a.googleAdsId));
      if (/^G-[A-Z0-9]+$/.test(a.ga4Id)) window.gtag('config',a.ga4Id);
      if (/^AW-\d+$/.test(a.googleAdsId)) window.gtag('config',a.googleAdsId);
    }
    if (/^\d+$/.test(a.metaPixelId)) {
      const fbq = function(){fbq.callMethod ? fbq.callMethod.apply(fbq,arguments) : fbq.queue.push(arguments);};
      fbq.queue=[];fbq.loaded=true;fbq.version='2.0';window.fbq=fbq;
      loadScript('https://connect.facebook.net/en_US/fbevents.js');
      fbq('init',a.metaPixelId);fbq('track','PageView');
    }
  }
  const analyticsConfigured = Object.values(config.analytics || {}).some(Boolean);
  if (analyticsConfigured && !consent) $('#consent').hidden=true;
  $('#consent-accept').addEventListener('click',()=>{consent='granted';storage.set('jabaquara_consent',consent,true);$('#consent').hidden=true;activateAnalytics();});
  $('#consent-deny').addEventListener('click',()=>{consent='denied';storage.set('jabaquara_consent',consent,true);$('#consent').hidden=true;});
  activateAnalytics();
  let engaged=false, converted=false, popupShown=false, requestText='', lastFocused=null;
  const whatsapp = String(config.whatsapp || '').replace(/\D/g,'');
  const whatsappReady = /^\d{10,15}$/.test(whatsapp);
  const endpointReady = /^https:\/\//.test(config.leadEndpoint || '');
  const defaultMessage = 'Olá! Vi o prédio comercial de 1.600 m² na Av. Jabaquara e gostaria de receber mais informações e verificar horários para uma visita.';
  const attributionText = () => Object.keys(attribution).length ? '\n\nOrigem: '+Object.entries(attribution).map(([k,v])=>k+'='+v).join(' | ') : '';
  function whatsappUrl(message) { return 'https://wa.me/'+whatsapp+'?text='+encodeURIComponent(message+attributionText()); }
  function openDialog(dialog) { lastFocused=document.activeElement;dialog.showModal();document.body.classList.add('modal-open'); }
  function closeDialog(dialog) { dialog.close();document.body.classList.remove('modal-open');if(lastFocused?.isConnected)lastFocused.focus({preventScroll:true}); }
  $$('dialog').forEach(dialog=>{
    $$('[data-close]',dialog).forEach(b=>b.addEventListener('click',()=>closeDialog(dialog)));
    dialog.addEventListener('click',e=>{if(e.target===dialog){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)closeDialog(dialog);}});
    dialog.addEventListener('close',()=>document.body.classList.remove('modal-open'));
  });
  document.addEventListener('click',e=>{
    const link=e.target.closest('[data-event]');
    if(link){track(link.dataset.event,{placement:link.closest('section')?.id || 'navigation'});if(link.dataset.hero)track('click_hero_cta',{action:'visit'});}
    if(e.target.closest('[data-sticky]'))track('sticky_mobile_click',{action:e.target.closest('[data-whatsapp]')?'whatsapp':'visit'});
    if(e.target.closest('[data-map]'))track('map_interaction',{action:'external_map'});
  });
  $$('[data-whatsapp]').forEach(button=>button.addEventListener('click',()=>{
    engaged=true;
    track('click_whatsapp',{destination_ready:whatsappReady});
    if(whatsappReady){window.open(whatsappUrl(defaultMessage),'_blank','noopener,noreferrer');}
    else {$('#contato').scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});$('#form-status').textContent='O WhatsApp de atendimento ainda não foi informado nesta prévia. Você pode preparar sua solicitação no formulário, mas ela não será enviada.';$('#form-status').focus({preventScroll:true});}
  }));
  $('#privacy-open').addEventListener('click',()=>openDialog($('#privacy-dialog')));
  if(config.privacyContact){const p=document.createElement('p');p.textContent='Contato de privacidade: '+config.privacyContact;$('#privacy-dialog').append(p);}
  $('#config-notice').hidden=whatsappReady||endpointReady;
  const form=$('#lead-form'), status=$('#form-status');
  let started=false;
  form.addEventListener('focusin',()=>{engaged=true;if(!started){started=true;track('form_start');}});
  form.elements.phone.addEventListener('input',()=>form.elements.phone.setCustomValidity(''));
  form.elements.name.addEventListener('input',()=>form.elements.name.setCustomValidity(''));
  form.addEventListener('submit',async e=>{
    e.preventDefault();
    if(form.elements.website.value)return;
    const phone=form.elements.phone.value.replace(/\D/g,'');
    form.elements.name.setCustomValidity(form.elements.name.value.trim().length<2?'Informe seu nome.':'');
    if(phone.length<10||phone.length>15){form.elements.phone.setCustomValidity('Informe um WhatsApp com DDD válido.');form.elements.phone.reportValidity();return;}
    if(!form.reportValidity())return;
    const values=Object.fromEntries(new FormData(form));
    const {name,email,company,operation}=values;
    requestText=defaultMessage+'\n\nNome: '+name.trim()+'\nWhatsApp: '+phone+(email?'\nE-mail: '+email.trim():'')+(company?'\nEmpresa: '+company.trim():'')+(operation?'\nOperação: '+operation:'');
    const submit=$('button[type=submit]',form);
    if(endpointReady){
      submit.disabled=true;status.textContent='Encaminhando sua solicitação…';
      try{
        const r=await fetch(config.leadEndpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:name.trim(),phone,email:email.trim(),company:company.trim(),operation,website:values.website,property:'jabaquara-1907'}),signal:AbortSignal.timeout(15000)});
        if(!r.ok)throw Error('Falha no recebimento');
        const response=await r.json();if(response.success!==true)throw Error('Recebimento não confirmado');
        status.textContent='Formulário enviado para o e-mail do corretor. Deseja falar agora com ele pelo WhatsApp?';
        $('#copy-request').hidden=true;
        if(whatsappReady){
          const actions=document.createElement('div');actions.className='lead-success-actions';
          const link=document.createElement('a');link.href=whatsappUrl(requestText);link.target='_blank';link.rel='noopener';link.className='button';link.textContent='Falar pelo WhatsApp';
          const dismiss=document.createElement('button');dismiss.type='button';dismiss.className='text-link';dismiss.textContent='Agora não';dismiss.addEventListener('click',()=>{status.textContent='Formulário enviado. O corretor entrará em contato.';status.focus();});
          actions.append(link,dismiss);status.append(actions);
        }
        converted=true;track('form_submit',{channel:'endpoint'});form.reset();
        if(consent==='granted'&&window.fbq)window.fbq('track','Lead');
        const a=config.analytics||{};
        if(consent==='granted'&&window.gtag&&a.googleAdsId&&a.googleAdsConversionLabel)window.gtag('event','conversion',{send_to:a.googleAdsId+'/'+a.googleAdsConversionLabel});
      }catch{status.textContent='Não foi possível confirmar o recebimento. Tente novamente'+(whatsappReady?' ou fale pelo WhatsApp.':'. Você também pode copiar a solicitação abaixo.');$('#copy-request').hidden=false;}
      finally{submit.disabled=false;status.focus({preventScroll:true});}
    }else if(whatsappReady){
      track('form_submit',{channel:'whatsapp_handoff'});
      converted=true;window.open(whatsappUrl(requestText),'_blank','noopener,noreferrer');
      status.textContent='Sua mensagem está pronta no WhatsApp. Conclua o envio por lá para iniciar o atendimento. O horário da visita será combinado na conversa.';
      const link=document.createElement('a');link.href=whatsappUrl(requestText);link.target='_blank';link.rel='noopener';link.textContent='Abrir conversa novamente ↗';link.className='text-link';status.append(document.createElement('br'),link);
    }else{
      status.textContent='Solicitação preparada, mas não enviada. Esta versão ainda não tem um canal de atendimento configurado. Copie sua mensagem para usar quando tiver o contato.';
      $('#copy-request').hidden=false;track('form_preview_prepared');status.focus({preventScroll:true});
    }
  });
  $('#copy-request').addEventListener('click',async()=>{
    const text=requestText+attributionText();
    try{await navigator.clipboard.writeText(text);status.textContent='Solicitação copiada. Nenhum dado foi enviado.';}
    catch{let box=$('#copy-text');if(!box){box=document.createElement('textarea');box.id='copy-text';box.setAttribute('aria-label','Solicitação para copiar');box.style.cssText='width:100%;min-height:170px;margin-top:14px';status.after(box);}box.value=text;box.focus();box.select();status.textContent='Selecione e copie a mensagem abaixo. Nenhum dado foi enviado.';}
  });
  // Gallery: URLs vêm do HTML, permitindo também a abertura local sem fetch.
  const galleryItems=$$('[data-gallery]');
  let selected=0, filter='Todas', expanded=false;
  const filtered=()=>galleryItems.filter(b=>filter==='Todas'||b.dataset.category===filter);
  function updateGallery(){
    galleryItems.forEach(b=>b.classList.remove('visible'));
    const items=filtered();items.forEach((b,i)=>{if(expanded||filter!=='Todas'||i<6)b.classList.add('visible');});
    $('#gallery-more').hidden=filter!=='Todas'||expanded;
  }
  $$('[data-filter]').forEach(b=>b.addEventListener('click',()=>{filter=b.dataset.filter;$$('[data-filter]').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));updateGallery();}));
  $('#gallery-more').addEventListener('click',()=>{expanded=true;updateGallery();galleryItems[6].focus({preventScroll:true});});
  updateGallery();
  function renderPhoto(){
    const item=galleryItems[selected],img=$('img',item),id=img.getAttribute('src').replace('-1280.jpg','-1920.webp');
    $('#lightbox-image').src=id;$('#lightbox-image').alt=img.alt;
    $('#lightbox-caption').textContent=String(selected+1).padStart(2,'0')+' / '+galleryItems.length+' — '+img.alt;
  }
  function movePhoto(direction){const items=filtered();let index=items.indexOf(galleryItems[selected]);index=(index+direction+items.length)%items.length;selected=galleryItems.indexOf(items[index]);renderPhoto();}
  galleryItems.forEach((b,i)=>b.addEventListener('click',()=>{selected=i;renderPhoto();openDialog($('#lightbox'));track('gallery_open',{photo:i+1,category:b.dataset.category});}));
  $('#prev-photo').addEventListener('click',()=>movePhoto(-1));$('#next-photo').addEventListener('click',()=>movePhoto(1));
  $('#lightbox').addEventListener('keydown',e=>{if(e.key==='ArrowLeft'){e.preventDefault();movePhoto(-1);}if(e.key==='ArrowRight'){e.preventDefault();movePhoto(1);}});
  let touchStart=null;
  $('#lightbox').addEventListener('touchstart',e=>{touchStart={x:e.changedTouches[0].clientX,y:e.changedTouches[0].clientY};},{passive:true});
  $('#lightbox').addEventListener('touchend',e=>{if(!touchStart)return;const dx=e.changedTouches[0].clientX-touchStart.x,dy=e.changedTouches[0].clientY-touchStart.y;if(Math.abs(dx)>55&&Math.abs(dx)>Math.abs(dy))movePhoto(dx<0?1:-1);touchStart=null;},{passive:true});
  const floorData=[['8º pavimento · Duplex','≈ 200','Potencial para diretoria, reuniões, treinamento ou convivência. Configuração a definir conforme a operação.'],['7º pavimento','140','Um pavimento para organizar um núcleo da operação.'],['6º pavimento','140','Um pavimento para organizar um núcleo da operação.'],['5º pavimento','140','Um pavimento para organizar um núcleo da operação.'],['4º pavimento','140','Um pavimento para organizar um núcleo da operação.'],['3º pavimento','140','Um pavimento para organizar um núcleo da operação.'],['2º pavimento','160','Espaço para organizar equipes e atividades conforme o seu projeto.'],['1º pavimento','160','Espaço para organizar equipes e atividades conforme o seu projeto.'],['Térreo','190','A conexão da operação com a entrada do edifício. Distribuição a avaliar na visita.'],['Subsolo','190','Área do subsolo conforme a distribuição fornecida. Conheça os acessos durante a visita.']];
  function setFloor(b,report){const i=Number(b.dataset.floor),d=floorData[i];$$('[data-floor]').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));$('#floor-name').textContent=d[0];$('#floor-area').replaceChildren(document.createTextNode(d[1]+' '));const unit=document.createElement('small');unit.textContent='m²';$('#floor-area').append(unit);$('#floor-use').textContent=d[2];if(report)track('floor_interaction',{floor:i});}
  $$('[data-floor]').forEach(b=>{b.addEventListener('click',()=>setFloor(b,true));b.addEventListener('pointerenter',e=>{if(e.pointerType==='mouse')setFloor(b,false);});b.addEventListener('focus',()=>setFloor(b,false));});
  const video=$('#tour-video');
  $('#tour-play').addEventListener('click',async()=>{try{await video.play();$('#tour-play').hidden=true;}catch{video.controls=true;$('#tour-play').hidden=true;}});
  video.addEventListener('play',()=>{$('#tour-play').hidden=true;track('video_play',{video:'property_tour'});});
  const observer=new IntersectionObserver(entries=>{entries.forEach(e=>{if(!e.isIntersecting&&!video.paused)video.pause();});},{threshold:.1});observer.observe(video);
  function updateProgress(){const max=document.documentElement.scrollHeight-innerHeight;$('.progress').style.transform='scaleX('+(max>0?Math.min(1,scrollY/max):0)+')';}
  window.addEventListener('scroll',updateProgress,{passive:true});updateProgress();
  const desktop=matchMedia('(min-width: 1000px) and (hover: hover)');
  let popupType='exit';
  function showVisit(type){if(!desktop.matches||engaged||converted||popupShown||storage.get('jabaquara_popup_closed',true)||scrollY<innerHeight*.6||$$('dialog[open]').length)return;popupShown=true;popupType=type;storage.set('jabaquara_popup_closed','1',true);if(type==='engagement'){$('#visit-title').textContent='Quer conhecer pessoalmente?';$('#visit-description').textContent='Se o imóvel entrou no radar da sua empresa, podemos verificar um horário para conhecer o prédio.';$('#visit-convert').textContent='Agendar visita ↗';}openDialog($('#visit-dialog'));}
  document.addEventListener('mouseleave',e=>{if(e.clientY<=0&&performance.now()>30000)showVisit('exit');});
  setTimeout(()=>{if(scrollY>innerHeight*2)showVisit('engagement');},100000);
  $('#visit-convert').addEventListener('click',()=>{closeDialog($('#visit-dialog'));engaged=true;track(popupType==='exit'?'exit_intent_conversion':'engagement_conversion');track('click_agendar_visita',{placement:'popup'});});
  if('IntersectionObserver' in window&&!matchMedia('(prefers-reduced-motion: reduce)').matches){const reveal=new IntersectionObserver(entries=>entries.forEach(e=>{if(e.isIntersecting){e.target.classList.add('is-visible');reveal.unobserve(e.target);}}),{threshold:.1});$$('.section-intro,.ownership-copy,.gallery-head,.duplex>div,.price-section>h2').forEach(el=>{el.classList.add('reveal','js-reveal');reveal.observe(el);});}
})();
