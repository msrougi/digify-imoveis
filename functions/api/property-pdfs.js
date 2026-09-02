import { json, requireSession } from "../_shared/montasite-auth.js";

export async function onRequestGet({ request, env }) {
  if (!(await requireSession({ request, env }))) return json({ ok:false, error:"Sessão expirada." }, 401);
  if (!env.GOOGLE_SEARCH_API_KEY || !env.GOOGLE_SEARCH_ENGINE_ID) {
    return json({ ok:true, connected:false, items:[], missing:["GOOGLE_SEARCH_API_KEY","GOOGLE_SEARCH_ENGINE_ID"] });
  }
  const params = new URL(request.url).searchParams;
  const bairro = String(params.get("bairro") || "").trim().slice(0,80);
  const tipologia = String(params.get("tipologia") || "").trim().slice(0,80);
  if (!bairro || !tipologia) return json({ ok:false, error:"Bairro e tipologia são obrigatórios." }, 400);
  const query = `filetype:pdf lançamento imobiliário "${bairro}" "${tipologia}" São Paulo`;
  const url = new URL("https://customsearch.googleapis.com/customsearch/v1");
  url.searchParams.set("key",env.GOOGLE_SEARCH_API_KEY);url.searchParams.set("cx",env.GOOGLE_SEARCH_ENGINE_ID);url.searchParams.set("q",query);url.searchParams.set("num","10");url.searchParams.set("safe","active");
  try {
    const response = await fetch(url.toString());
    if (!response.ok) throw new Error(`Google Search ${response.status}`);
    const data = await response.json();
    const items = (data.items || []).filter(item=>{try{const target=new URL(item.link);return target.protocol==="https:"&&(target.pathname.toLowerCase().endsWith(".pdf")||item.mime==="application/pdf");}catch{return false;}}).map((item,index)=>({ id:`search-${index}`, name:String(item.title||"Material imobiliário").replace(/\s*[|–—-]\s*PDF.*$/i,"").slice(0,120), bairro, pdf:String(item.link).split("/").pop()||`material-${index+1}.pdf`, pdfUrl:item.link, delivery:"prazo a confirmar", types:[tipologia], heat:50, searches:"a medir", competition:"a medir", summary:`PDF encontrado em ${item.displayLink}. Dados ainda serão confirmados pela leitura do material e por fontes oficiais.` }));
    return json({ ok:true, connected:true, items });
  } catch (error) { return json({ ok:false, connected:true, error:error.message, items:[] }, 502); }
}
