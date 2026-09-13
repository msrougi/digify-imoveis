import { requireSession } from "../_shared/montasite-auth.js";

const MAX_PDF_BYTES = 25 * 1024 * 1024;
const MAX_REDIRECTS = 4;

const safeHttpsUrl = value => {
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();
    const bareHost = host.replace(/^\[|\]$/g, "");
    const blockedIpv4 = /^(?:0\.|127\.|10\.|100\.(?:6[4-9]|[7-9]\d|1[01]\d|12[0-7])\.|169\.254\.|192\.168\.|198\.(?:1[89])\.|172\.(?:1[6-9]|2\d|3[01])\.)/.test(bareHost);
    const blockedIpv6 = bareHost === "::1" || bareHost.startsWith("fc") || bareHost.startsWith("fd") || bareHost.startsWith("fe80:") || bareHost.startsWith("::ffff:");
    if (url.protocol !== "https:" || host === "localhost" || host.endsWith(".localhost") || blockedIpv4 || blockedIpv6) return null;
    url.username = "";
    url.password = "";
    url.hash = "";
    return url;
  } catch {
    return null;
  }
};

const fetchPdf = async initialUrl => {
  let target = initialUrl;
  for (let redirect = 0; redirect <= MAX_REDIRECTS; redirect += 1) {
    const response = await fetch(target.toString(), {
      redirect: "manual",
      headers: { accept: "application/pdf", "user-agent": "DigifyMontaSite/1.0 (+https://imoveis.digify.live/)" }
    });
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get("location");
      if (!location || redirect === MAX_REDIRECTS) throw new Error("O PDF excedeu o limite de redirecionamentos.");
      target = safeHttpsUrl(new URL(location, target).toString());
      if (!target) throw new Error("O servidor redirecionou para um endereço não permitido.");
      continue;
    }
    return response;
  }
  throw new Error("Não foi possível abrir o PDF.");
};

export async function onRequestGet({ request, env }) {
  if (!(await requireSession({ request, env }))) return new Response("Sessão expirada.", { status: 401 });
  const target = safeHttpsUrl(new URL(request.url).searchParams.get("url"));
  if (!target) return new Response("Endereço do PDF inválido.", { status: 400 });
  try {
    const response = await fetchPdf(target);
    if (!response.ok) return new Response(`Não foi possível baixar o PDF (${response.status}).`, { status: 502 });
    const declaredLength = Number(response.headers.get("content-length") || 0);
    if (declaredLength > MAX_PDF_BYTES) return new Response("O PDF excede 25 MB.", { status: 413 });
    const bytes = await response.arrayBuffer();
    if (!bytes.byteLength || bytes.byteLength > MAX_PDF_BYTES) return new Response("O PDF está vazio ou excede 25 MB.", { status: 413 });
    const signature = new TextDecoder("latin1").decode(bytes.slice(0, 5));
    const contentType = response.headers.get("content-type") || "";
    if (signature !== "%PDF-" && !/application\/pdf/i.test(contentType)) return new Response("O endereço selecionado não retornou um PDF.", { status: 415 });
    return new Response(bytes, {
      headers: {
        "content-type": "application/pdf",
        "content-length": String(bytes.byteLength),
        "cache-control": "private, no-store",
        "x-content-type-options": "nosniff"
      }
    });
  } catch (error) {
    return new Response(error instanceof Error ? error.message : "Falha ao abrir o PDF.", { status: 502 });
  }
}
