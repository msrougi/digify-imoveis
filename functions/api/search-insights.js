const json = (data, status = 200) => new Response(JSON.stringify(data), {
  status,
  headers: { "content-type": "application/json; charset=utf-8", "cache-control": "private, max-age=1800" }
});

const required = [
  "GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "GOOGLE_REFRESH_TOKEN",
  "GOOGLE_ADS_DEVELOPER_TOKEN", "GOOGLE_ADS_CUSTOMER_ID", "SEARCH_CONSOLE_SITE_URL"
];

async function accessToken(env) {
  const body = new URLSearchParams({
    client_id: env.GOOGLE_CLIENT_ID,
    client_secret: env.GOOGLE_CLIENT_SECRET,
    refresh_token: env.GOOGLE_REFRESH_TOKEN,
    grant_type: "refresh_token"
  });
  const response = await fetch("https://oauth2.googleapis.com/token", { method:"POST", headers:{"content-type":"application/x-www-form-urlencoded"}, body });
  if (!response.ok) throw new Error(`OAuth ${response.status}`);
  return (await response.json()).access_token;
}

const scoreInsights = ({ monthlySearches = 0, competitionIndex = 0, impressions = 0, clicks = 0 }) => {
  const volume = Math.min(100, Math.log10(monthlySearches + 1) * 28);
  const traction = Math.min(100, Math.log10(impressions + 1) * 24 + Math.min(25, clicks * 1.5));
  return Math.round(Math.min(100, volume * .58 + competitionIndex * .17 + traction * .25));
};

export async function onRequestGet({ request, env }) {
  const missing = required.filter(key => !env[key]);
  if (missing.length) return json({ connected:false, status:"configuration_required", missing }, 503);

  const input = new URL(request.url).searchParams;
  const name = input.get("name")?.trim(), bairro = input.get("bairro")?.trim(), pageUrl = input.get("url")?.trim();
  if (!name || !bairro) return json({ connected:false, error:"name_and_bairro_required" }, 400);

  try {
    const token = await accessToken(env);
    const customerId = env.GOOGLE_ADS_CUSTOMER_ID.replace(/-/g, "");
    const keywords = [name, `${name} ${bairro}`, `apartamento ${bairro}`, `lançamento ${bairro}`, `imóveis ${bairro}`];
    const adsResponse = await fetch(`https://googleads.googleapis.com/v25/customers/${customerId}:generateKeywordHistoricalMetrics`, {
      method:"POST",
      headers:{
        authorization:`Bearer ${token}`,
        "developer-token":env.GOOGLE_ADS_DEVELOPER_TOKEN,
        ...(env.GOOGLE_ADS_LOGIN_CUSTOMER_ID ? { "login-customer-id":env.GOOGLE_ADS_LOGIN_CUSTOMER_ID.replace(/-/g, "") } : {}),
        "content-type":"application/json"
      },
      body:JSON.stringify({ keywords, language:"languageConstants/1014", geoTargetConstants:["geoTargetConstants/1001773"], keywordPlanNetwork:"GOOGLE_SEARCH" })
    });
    if (!adsResponse.ok) throw new Error(`Google Ads ${adsResponse.status}`);
    const ads = await adsResponse.json();
    const exact = ads.results?.find(result => result.text?.toLowerCase() === name.toLowerCase()) || ads.results?.[0] || {};
    const metrics = exact.keywordMetrics || {};

    let search = { rows:[], responseAggregationType:"AUTO" };
    if (pageUrl) {
      const site = encodeURIComponent(env.SEARCH_CONSOLE_SITE_URL);
      const end = new Date(), start = new Date(Date.now() - 90 * 86400000);
      const scResponse = await fetch(`https://searchconsole.googleapis.com/webmasters/v3/sites/${site}/searchAnalytics/query`, {
        method:"POST", headers:{authorization:`Bearer ${token}`,"content-type":"application/json"},
        body:JSON.stringify({ startDate:start.toISOString().slice(0,10), endDate:end.toISOString().slice(0,10), dimensions:["page","query"], dimensionFilterGroups:[{filters:[{dimension:"page",operator:"equals",expression:pageUrl}]}], rowLimit:25000 })
      });
      if (scResponse.ok) search = await scResponse.json();
    }
    const sc = (search.rows || []).reduce((acc,row) => ({ impressions:acc.impressions+(row.impressions||0), clicks:acc.clicks+(row.clicks||0), weightedPosition:acc.weightedPosition+(row.position||0)*(row.impressions||0) }), {impressions:0,clicks:0,weightedPosition:0});
    const monthlySearches = Number(metrics.avgMonthlySearches || 0), competitionIndex = Number(metrics.competitionIndex || 0);
    const score = scoreInsights({ monthlySearches, competitionIndex, impressions:sc.impressions, clicks:sc.clicks });
    return json({ connected:true, score, monthlySearches, competition:metrics.competition || "UNSPECIFIED", competitionIndex, lowBidMicros:metrics.lowTopOfPageBidMicros, highBidMicros:metrics.highTopOfPageBidMicros, impressions:sc.impressions, clicks:sc.clicks, ctr:sc.impressions ? sc.clicks/sc.impressions : 0, position:sc.impressions ? sc.weightedPosition/sc.impressions : null, collectedAt:new Date().toISOString(), summary:`Dados combinados de Google Ads e Search Console para ${name} e ${bairro}.` });
  } catch (error) {
    return json({ connected:false, status:"google_api_error", error:error.message }, 502);
  }
}
