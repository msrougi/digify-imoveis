const destination = "marcelo@digify.live";

const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" }
});

export default {
  async fetch(request, env) {
    if (request.method !== "POST" || new URL(request.url).pathname !== "/send") {
      return json({ ok: false }, 404);
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return json({ ok: false, error: "Dados inválidos." }, 400);
    }

    if (String(body.to || "").trim().toLowerCase() !== destination) {
      return json({ ok: false, error: "Destinatário não permitido." }, 403);
    }

    const subject = String(body.subject || "").slice(0, 180);
    const text = String(body.text || "").slice(0, 4000);
    const html = String(body.html || "").slice(0, 12000);
    if (!subject || (!text && !html)) return json({ ok: false, error: "Mensagem incompleta." }, 400);

    await env.EMAIL.send({
      from: { email: "montasite@digify.live", name: "Digify MontaSite" },
      to: destination,
      subject,
      text,
      html
    });

    return json({ ok: true });
  }
};
