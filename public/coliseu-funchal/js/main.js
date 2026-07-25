emailjs.init("q8Q2Bs8nQcGY7pSSj");
(function(){
  var end=new Date();end.setDate(end.getDate()+2);end.setHours(end.getHours()+14);end.setMinutes(end.getMinutes()+37);
  function pad(n){return n<10?'0'+n:n}
  function tick(){
    var now=new Date(),diff=Math.max(0,end-now);
    var d=Math.floor(diff/86400000),h=Math.floor((diff%86400000)/3600000),m=Math.floor((diff%3600000)/60000),s=Math.floor((diff%60000)/1000);
    var de=document.getElementById('cd-days'),he=document.getElementById('cd-hrs'),me=document.getElementById('cd-min'),se=document.getElementById('cd-sec');
    if(de)de.childNodes[0].nodeValue=pad(d);if(he)he.childNodes[0].nodeValue=pad(h);if(me)me.childNodes[0].nodeValue=pad(m);if(se)se.childNodes[0].nodeValue=pad(s);
  }
  tick();setInterval(tick,1000);
})();
(function(){
  var total=15*60;
  function upd(){var el=document.getElementById('popup-timer');if(!el)return;if(total<=0){el.textContent='00:00';return}var m=Math.floor(total/60),s=total%60;el.textContent=(m<10?'0'+m:m)+':'+(s<10?'0'+s:s);total--;}
  upd();setInterval(upd,1000);
})();
var popupShown=false,popupDismissed=false;
document.addEventListener('mouseleave',function(e){if(!popupShown&&!popupDismissed&&e.clientY<=10){document.getElementById('popup').classList.add('active');popupShown=true;}});
setTimeout(function(){if(!popupShown&&!popupDismissed){document.getElementById('popup').classList.add('active');popupShown=true;}},40000);
function fecharPopup(){document.getElementById('popup').classList.remove('active');popupDismissed=true;}
function enviarFormulario(e){
  e.preventDefault();
  var btn=document.querySelector('.btn-form');
  btn.textContent='Enviando...';
  btn.disabled=true;
  var nome=document.getElementById('nome').value;
  var whatsapp=document.getElementById('whatsapp').value;
  var email=document.getElementById('email').value;
  var horario=document.getElementById('horario').value;
  var mensagem=document.getElementById('mensagem').value;
  var params={
    from_name: nome,
    whatsapp: whatsapp,
    email: email,
    horario: horario,
    mensagem: mensagem,
    to_email: 'msrougi@gmail.com'
  };
  emailjs.send('service_in3p4pp','template_aqd801j',params)
    .then(function(){
      btn.textContent='✅ Visita agendada! Entraremos em contato.';
      btn.style.background='#18A84A';
      document.getElementById('nome').value='';
      document.getElementById('whatsapp').value='';
      document.getElementById('email').value='';
      document.getElementById('horario').value='';
      document.getElementById('mensagem').value='';
      var waMsg=encodeURIComponent('Olá! Me chamo '+nome+' e gostaria de agendar uma visita ao Coliseu Funchal. Meu WhatsApp é '+whatsapp+'. Prefiro visitar: '+horario);
      setTimeout(function(){window.open('https:
    },function(err){
      btn.textContent='🗓️ Garantir minha visita gratuita';
      btn.disabled=false;
      alert('Erro ao enviar. Por favor, entre em contato pelo WhatsApp.');
      console.error('EmailJS error:',err);
    });
}

// FAQ accordion
document.querySelectorAll('#faq details').forEach(function(d){
  d.addEventListener('toggle', function(){
    var plus = d.querySelector('summary span');
    if(plus) plus.textContent = d.open ? '−' : '+';
  });
});