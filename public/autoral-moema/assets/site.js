(() => {
  const form = document.querySelector("#lead-form");
  const whatsappNumber = "5511989911000";
  const baseMessage = "Olá, quero receber os valores atualizados e a disponibilidade do Autoral Moema.";
  const goToForm = () => document.querySelector("#contato")?.scrollIntoView({ behavior: "smooth" });

  document.querySelectorAll("[data-to-form]").forEach(button => button.addEventListener("click", goToForm));

  const menuButton = document.querySelector(".menu");
  const nav = document.querySelector(".header nav");
  menuButton?.addEventListener("click", () => {
    const open = nav?.classList.toggle("open");
    menuButton.setAttribute("aria-expanded", String(Boolean(open)));
    menuButton.textContent = open ? "FECHAR" : "MENU";
  });
  nav?.querySelectorAll("a").forEach(link => link.addEventListener("click", () => {
    nav.classList.remove("open");
    menuButton?.setAttribute("aria-expanded", "false");
    if (menuButton) menuButton.textContent = "MENU";
  }));

  const progress = document.querySelector(".reading-progress span");
  const updateProgress = () => {
    const height = document.documentElement.scrollHeight - innerHeight;
    if (progress) progress.style.width = `${height > 0 ? Math.min(100, scrollY / height * 100) : 0}%`;
  };
  addEventListener("scroll", updateProgress, { passive: true });
  updateProgress();

  const lightbox = document.querySelector(".lightbox");
  const lightboxImage = lightbox?.querySelector("img");
  const lightboxCaption = lightbox?.querySelector("figcaption");
  const closeLightbox = () => { if (lightbox) lightbox.hidden = true; };
  document.querySelectorAll("[data-image]").forEach(button => button.addEventListener("click", () => {
    if (!lightbox || !lightboxImage || !lightboxCaption) return;
    lightboxImage.src = button.dataset.image || "";
    lightboxImage.alt = button.dataset.title || "Imagem do Autoral Moema";
    lightboxCaption.textContent = button.dataset.title || "Autoral Moema";
    lightbox.hidden = false;
  }));
  lightbox?.querySelector(":scope > button")?.addEventListener("click", closeLightbox);
  lightbox?.addEventListener("click", event => { if (event.target === lightbox) closeLightbox(); });
  addEventListener("keydown", event => { if (event.key === "Escape") closeLightbox(); });

  if (form) form.addEventListener("submit", async event => {
    event.preventDefault();
    const data = new FormData(form);
    const button = form.querySelector("button[type=submit]");
    const error = form.querySelector(".form-error");
    if (error) error.textContent = "";
    data.set("Origem", "Landing page Autoral Moema");
    data.set("Data e hora", new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "medium", timeZone: "America/Sao_Paulo" }).format(new Date()));
    data.set("_subject", "Novo lead — Autoral Moema");
    data.set("_captcha", "false");
    data.set("_autoresponse", "Recebemos seu contato sobre o Autoral Moema. Um especialista falará com você em breve.");
    const message = [baseMessage, `Nome: ${data.get("nome") || ""}`, `WhatsApp: ${data.get("telefone") || ""}`, `E-mail: ${data.get("email") || ""}`, `Interesse: ${data.get("interesse") || ""}`].join("\n");
    if (button) { button.disabled = true; button.textContent = "Enviando..."; }
    try {
      const response = await fetch("https://formsubmit.co/ajax/msrougi@gmail.com", { method: "POST", headers: { Accept: "application/json" }, body: data });
      if (!response.ok) throw new Error("Falha no envio");
      form.innerHTML = `<div class="success" role="status"><b>✓</b><h3>Contato enviado.</h3><p>Recebemos seus dados. Continue agora pelo WhatsApp.</p><a class="button primary" href="https://wa.me/${whatsappNumber}?text=${encodeURIComponent(message)}" target="_blank" rel="noopener">Abrir WhatsApp</a></div>`;
      window.open(`https://wa.me/${whatsappNumber}?text=${encodeURIComponent(message)}`, "_blank", "noopener,noreferrer");
    } catch {
      if (error) error.textContent = "Não foi possível enviar por e-mail agora. Você ainda pode continuar diretamente pelo WhatsApp.";
      if (button) { button.disabled = false; button.textContent = "Receber valores agora"; }
    }
  });
})();
