
(function(){
  const C = window.TP_CONFIG;

  async function rpc(name, body){
    const r = await fetch(`${C.supabaseUrl}/rest/v1/rpc/${name}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": C.publishableKey
      },
      body: JSON.stringify(body || {})
    });
    const text = await r.text();
    if (!r.ok) throw new Error(text || `HTTP ${r.status}`);
    return text ? JSON.parse(text) : null;
  }

  function photoUrl(path){
    if(!path) return null;
    return `${C.supabaseUrl}/storage/v1/object/public/${C.storageBucket}/${encodeURI(path)}`;
  }

  async function getFeed({city=null, style=null, limit=50, offset=0} = {}){
    return rpc("tp_get_feed", {
      p_city: city || null,
      p_style: style || null,
      p_limit: limit,
      p_offset: offset
    });
  }

  async function getListing(publicNo){
    return rpc("tp_get_listing", { p_public_no: Number(publicNo) });
  }

  async function createListing(formData){
    const r = await fetch(C.createListingFunction, {
      method: "POST",
      headers: { "apikey": C.publishableKey },
      body: formData
    });
    const text = await r.text();
    let data = null;
    try { data = text ? JSON.parse(text) : null; } catch {}
    if(!r.ok) throw new Error(data?.error || text || `HTTP ${r.status}`);
    return data;
  }

  window.TP = { rpc, photoUrl, getFeed, getListing, createListing };
})();
