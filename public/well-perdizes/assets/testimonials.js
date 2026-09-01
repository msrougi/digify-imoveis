(() => {
  const apply = () => {
    const list = document.querySelector(".testimonial-list");
    if (!list || list.dataset.three === "true") return false;
    list.dataset.three = "true";
    list.insertAdjacentHTML("beforeend", `<article class="testimonial-card"><div class="portrait portrait-three" role="img" aria-label="Retrato de um homem em ambiente profissional" style="background-image:linear-gradient(0deg,rgba(0,0,0,.36),transparent 45%),url('https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=900&q=86')"></div><div><div class="stars" aria-label="5 de 5 estrelas">★★★★★</div><blockquote>“A variedade de plantas ajudou a equilibrar orçamento e objetivo. Perdizes já tem vida de bairro consolidada, o que tornou a comparação com outros lançamentos mais clara.”</blockquote><p><strong>Renato A.</strong><span>Profissional liberal</span></p></div></article>`);
    const heading = document.querySelector(".testimonial-heading > p:last-child");
    if (heading) heading.textContent = "Três perfis que analisam localização, demanda e potencial patrimonial antes de decidir.";
    const license = document.querySelector(".photo-license");
    if (license) { license.className = "testimonial-note"; license.textContent = "Depoimentos ilustrativos para validação do layout. Substituir por relatos autorizados antes da campanha definitiva."; }
    else list.insertAdjacentHTML("afterend", '<p class="testimonial-note">Depoimentos ilustrativos para validação do layout. Substituir por relatos autorizados antes da campanha definitiva.</p>');
    return true;
  };
  if (!apply()) {
    const observer = new MutationObserver(() => { if (apply()) observer.disconnect(); });
    observer.observe(document.getElementById("root"), { childList:true, subtree:true });
  }
})();
