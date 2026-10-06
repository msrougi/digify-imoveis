const json = (body, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
const escape = value => value.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
export default {
  async fetch(request, env) {
    if (request.method !== 'POST') return json({ success: false }, 405);
    if (request.headers.get('origin') !== 'https://imoveis.digify.live') return json({ success: false }, 403);
    if (!request.headers.get('content-type')?.includes('application/json')) return json({ success: false }, 415);
    const raw = await request.text();
    if (raw.length > 8000) return json({ success: false }, 413);
    let data;
    try { data = JSON.parse(raw); } catch { return json({ success: false }, 400); }
    if (!data || typeof data !== 'object' || data.website) return json({ success: false }, 400);
    const read = (key, max) => typeof data[key] === 'string' ? data[key].trim().slice(0, max) : '';
    const name = read('name', 100), phone = read('phone', 30).replace(/\D/g, ''), email = read('email', 254);
    if (name.length < 2 || !/^\d{10,15}$/.test(phone) || (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) return json({ success: false }, 400);
    try {
      const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(request.headers.get('cf-connecting-ip') || 'unknown'));
      const key = 'jabaquara:lead-rate:' + Array.from(new Uint8Array(digest), x => x.toString(16).padStart(2, '0')).join('');
      const count = Number(await env.LIMITS.get(key) || 0);
      if (count >= 5) return json({ success: false }, 429);
      await env.LIMITS.put(key, String(count + 1), { expirationTtl: 600 });
      const text = ['Novo interesse — Edifício Comercial Jabaquara', 'Av. Jabaquara, 1907', '', 'Nome: ' + name, 'WhatsApp: ' + phone, 'E-mail: ' + (email || 'Não informado'), 'Empresa: ' + (read('company', 150) || 'Não informada'), 'Operação: ' + (read('operation', 150) || 'Não informada')].join('\n');
      await env.EMAIL.send({ from: { email: 'contato@leads.digify.live', name: 'Giordani Imóveis — Jabaquara' }, to: 'giordanirepresentacoes@gmail.com', subject: 'Novo contato — Edifício Comercial Jabaquara', text, html: '<div style="font-family:Arial,sans-serif;line-height:1.6;white-space:pre-wrap">' + escape(text) + '</div>', ...(email ? { replyTo: email } : {}) });
      return json({ success: true });
    } catch { return json({ success: false, error: 'Não foi possível confirmar o envio.' }, 502); }
  }
};
