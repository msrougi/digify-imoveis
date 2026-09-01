(() => {
  const whatsappNumber = "5511989911000";
  const whatsappText = "Olá, quero receber os valores atualizados e a disponibilidade do Peak Vila Olímpia.";
  const form = document.querySelector("#contato form");
  const formSection = document.querySelector("#contato");
  const progress = document.querySelector(".progress span");

  const testimonialList = document.querySelector(".testimonial-list");
  if (testimonialList && testimonialList.children.length === 2) {
    testimonialList.insertAdjacentHTML("beforeend", `<article class="testimonial-card"><div class="portrait portrait-three" role="img" aria-label="Homem em ambiente profissional" style="background-image:linear-gradient(0deg,rgba(0,0,0,.36),transparent 45%),url('https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=900&q=86')"></div><div><div class="stars" aria-label="5 de 5 estrelas">★★★★★</div><blockquote>“Gostei de poder comparar um studio enxuto com plantas maiores no mesmo endereço. A localização permite pensar no imóvel tanto para uso próprio quanto para uma estratégia patrimonial.”</blockquote><p><strong>André L.</strong><span>Consultor de negócios</span></p></div></article>`);
    const heading = document.querySelector(".testimonial-heading > p:last-child");
    if (heading) heading.textContent = "Três perfis que enxergam valor no Peak por razões diferentes: praticidade para morar, flexibilidade e demanda qualificada para investir.";
    testimonialList.insertAdjacentHTML("afterend", '<p class="testimonial-note">Depoimentos ilustrativos para validação do layout. Substituir por relatos autorizados antes da campanha definitiva.</p>');
  }

  const scrollToForm = () => formSection?.scrollIntoView({ behavior: "smooth" });

  const updateProgress = () => {
    const available = document.documentElement.scrollHeight - innerHeight;
    if (progress) progress.style.width = `${available > 0 ? Math.min(100, scrollY / available * 100) : 0}%`;
  };
  addEventListener("scroll", updateProgress, { passive: true });
  updateProgress();

  [
    ".top-cta",
    ".hero-actions .button.acid",
    ".plans-copy .button.dark",
    ".testimonial-cta",
    ".closing .button.acid",
    ".mobile-sticky",
  ].forEach(selector => document.querySelector(selector)?.addEventListener("click", scrollToForm));

  const images = {
    pool: ["Piscina", "/peak-vilaolimpia/images/piscina.webp"],
    sky: ["Sky lounge", "/peak-vilaolimpia/images/sky-lounge.webp"],
    fitness: ["Fitness", "/peak-vilaolimpia/images/fitness.webp"],
  };

  const openImage = (title, src, plan = false) => {
    const overlay = document.createElement("div");
    overlay.className = "lightbox";
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    overlay.innerHTML = `<button type="button" aria-label="Fechar">×</button><div class="lightbox-content ${plan ? "plan-view" : ""}" style="${plan ? "" : `background-image:linear-gradient(0deg,rgba(0,0,0,.68),transparent),url('${src}')`}">${plan ? `<small>Planta ilustrativa</small><strong>${title}</strong><img class="plan-modal-image" src="${src}" alt="${title}"><button class="button dark" type="button">Receber valores</button>` : `<span>Peak Vila Olímpia</span><strong>${title}</strong>`}</div>`;
    const close = () => overlay.remove();
    overlay.addEventListener("click", close);
    overlay.querySelector(".lightbox-content")?.addEventListener("click", event => event.stopPropagation());
    overlay.querySelector(":scope > button")?.addEventListener("click", close);
    overlay.querySelector(".plan-view .button")?.addEventListener("click", () => { close(); scrollToForm(); });
    document.body.appendChild(overlay);
  };

  document.querySelector(".play")?.addEventListener("click", () => openImage(...images.pool));
  document.querySelector(".photo-a")?.addEventListener("click", () => openImage(...images.pool));
  document.querySelector(".photo-b")?.addEventListener("click", () => openImage(...images.sky));
  document.querySelector(".photo-c")?.addEventListener("click", () => openImage(...images.fitness));
  document.querySelectorAll(".plan").forEach(button => button.addEventListener("click", () => {
    const image = button.querySelector("img");
    const title = image?.alt || button.textContent?.trim() || "Planta do Peak Vila Olímpia";
    if (image) openImage(title, image.getAttribute("src"), true);
  }));

  addEventListener("keydown", event => {
    if (event.key === "Escape") document.querySelector(".lightbox, .lead-popup")?.remove();
  });

  if (form) form.addEventListener("submit", async event => {
    event.preventDefault();
    const data = new FormData(form);
    const button = form.querySelector("button[type=submit]");
    const error = form.querySelector(".form-error") || document.createElement("p");
    error.className = "form-error";
    error.setAttribute("role", "alert");
    error.textContent = "";
    if (!error.parentNode) button?.before(error);
    const submittedAt = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "medium", timeZone: "America/Sao_Paulo" }).format(new Date());
    data.set("Data e hora", submittedAt);
    data.set("Origem", "Landing page Peak Vila Olímpia");
    data.set("_subject", "Novo Lead — Peak Vila Olímpia");
    data.set("_template", "table");
    data.set("_captcha", "false");
    data.set("_autoresponse", "Recebemos seu contato sobre o Peak Vila Olímpia. Um especialista falará com você em breve.");
    const message = [whatsappText, `Nome: ${data.get("nome") || ""}`, `WhatsApp: ${data.get("telefone") || ""}`, `Email: ${data.get("email") || ""}`, `Interesse: ${data.get("interesse") || ""}`].join("\n");
    if (button) { button.disabled = true; button.textContent = "Enviando..."; }
    try {
      const response = await fetch("https://formsubmit.co/ajax/msrougi@gmail.com", { method: "POST", headers: { Accept: "application/json" }, body: data });
      if (!response.ok) throw new Error("Falha no envio");
      form.outerHTML = `<div class="success" role="status"><span>✓</span><h3>Contato enviado.</h3><p>Os dados foram encaminhados para o e-mail e o WhatsApp foi aberto para você continuar.</p><a class="button acid" href="https://wa.me/${whatsappNumber}?text=${encodeURIComponent(whatsappText)}" target="_blank" rel="noreferrer">Abrir WhatsApp</a></div>`;
      window.open(`https://wa.me/${whatsappNumber}?text=${encodeURIComponent(message)}`, "_blank", "noopener,noreferrer");
    } catch {
      error.textContent = "Não foi possível enviar por e-mail agora. Você ainda pode falar diretamente pelo WhatsApp.";
      if (button) { button.disabled = false; button.textContent = "Receber valores agora"; }
    }
  });

  const showPopup = kind => {
    if (document.querySelector(".lead-popup")) return;
    const overlay = document.createElement("div");
    overlay.className = "lead-popup";
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    overlay.innerHTML = `<div class="popup-card"><button class="popup-close" type="button" aria-label="Fechar">×</button><p class="eyebrow">Peak Vila Olímpia</p><h2>${kind === "exit" ? "Antes de sair…" : "Qual planta combina com você?"}</h2><p>${kind === "exit" ? "A disponibilidade e as condições mudam. Receba os dados vigentes antes de comparar." : "Em poucos minutos, um especialista pode mostrar as diferenças entre os studios e as plantas de 2 dormitórios."}</p><button class="button acid" type="button">Receber valores e plantas</button><button class="popup-secondary" type="button">Continuar navegando</button></div>`;
    const close = () => overlay.remove();
    overlay.addEventListener("click", close);
    overlay.querySelector(".popup-card")?.addEventListener("click", event => event.stopPropagation());
    overlay.querySelector(".popup-close")?.addEventListener("click", close);
    overlay.querySelector(".popup-secondary")?.addEventListener("click", close);
    overlay.querySelector(".button.acid")?.addEventListener("click", () => { close(); scrollToForm(); });
    document.body.appendChild(overlay);
  };

  document.addEventListener("mouseleave", event => {
    if (event.clientY <= 0 && !localStorage.getItem("peak-exit-seen")) {
      localStorage.setItem("peak-exit-seen", "1"); showPopup("exit");
    }
  });
  setTimeout(() => {
    if (!localStorage.getItem("peak-stay-seen") && !localStorage.getItem("peak-exit-seen")) {
      localStorage.setItem("peak-stay-seen", "1"); showPopup("stay");
    }
  }, 40000);
})();
