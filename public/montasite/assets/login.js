(() => {
  "use strict";
  const $ = selector => document.querySelector(selector), loginForm = $("#login-form"), codeForm = $("#code-form"), message = $("#form-message"), configBox = $("#config-box");
  const setBusy = (form, busy) => { const button = form.querySelector('button[type="submit"]'); button.disabled = busy; button.classList.toggle("is-loading", busy); };
  const showMessage = (text, type = "error") => { message.textContent = text; message.className = `form-message ${type}`; };
  const parseResponse = async response => {
    const raw = await response.text();
    if (!raw) return {};
    try { return JSON.parse(raw); } catch { return null; }
  };
  const request = async (url, body) => {
    let response;
    try {
      response = await fetch(url, { method:"POST", credentials:"same-origin", headers:{"content-type":"application/json", accept:"application/json"}, body:JSON.stringify(body) });
    } catch {
      throw Object.assign(new Error("Não foi possível conectar ao servidor. Confira sua internet e tente novamente."), {status:0});
    }
    const data = await parseResponse(response);
    if (!response.ok) {
      const fallback = response.status >= 500 ? `Servidor indisponível no momento (HTTP ${response.status}).` : `Não foi possível concluir (HTTP ${response.status}).`;
      throw Object.assign(new Error(data?.error || fallback), {data: data || {}, status:response.status});
    }
    if (!data || typeof data !== "object") throw Object.assign(new Error("Resposta inválida do servidor. Tente novamente."), {status:response.status});
    return data;
  };
  fetch("/api/montasite-auth/status", {credentials:"same-origin", headers:{accept:"application/json"}}).then(async response => ({response, data:await parseResponse(response)})).then(({response, data}) => { if (!response.ok || !data) return; if (data.authenticated) location.replace("/montasite/"); if (!data.configured && data.missing?.length) { configBox.hidden=false; $("#missing-list").innerHTML=data.missing.map(item=>`<li>${item}</li>`).join(""); } }).catch(()=>{});
  loginForm.addEventListener("submit", async event => { event.preventDefault(); setBusy(loginForm,true); showMessage("Validando acesso e enviando o código…","working"); configBox.hidden=true; try { const data=await request("/api/montasite-auth/start",Object.fromEntries(new FormData(loginForm))); $("#masked-email").textContent=data.email; $("#login-step").hidden=true; $("#code-step").hidden=false; codeForm.elements.code.focus(); showMessage("Código enviado. Confira também a pasta de spam.","success"); } catch(error) { showMessage(error.message); if(error.data?.missing){configBox.hidden=false;$("#missing-list").innerHTML=error.data.missing.map(item=>`<li>${item}</li>`).join("");} } finally {setBusy(loginForm,false);} });
  codeForm.addEventListener("submit", async event => { event.preventDefault(); setBusy(codeForm,true); showMessage("Confirmando o código…","working"); try { const data=await request("/api/montasite-auth/verify",{code:codeForm.elements.code.value}); showMessage("Acesso confirmado. Abrindo o painel…","success"); location.replace(data.redirect||"/montasite/"); } catch(error){showMessage(error.message);codeForm.elements.code.select();} finally {setBusy(codeForm,false);} });
  $("#back-login").addEventListener("click",()=>{$("#code-step").hidden=true;$("#login-step").hidden=false;codeForm.reset();showMessage("");});
  $("#toggle-password").addEventListener("click",event=>{const input=loginForm.elements.password;const showing=input.type==="password";input.type=showing?"text":"password";event.currentTarget.textContent=showing?"Ocultar":"Mostrar";event.currentTarget.setAttribute("aria-label",showing?"Ocultar senha":"Mostrar senha");event.currentTarget.setAttribute("aria-pressed",String(showing));input.focus({preventScroll:true});});
})();
