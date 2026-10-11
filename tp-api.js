(function(){
  const C = window.TP_CONFIG;

  function visitorToken(){
    const key='tp_visitor_token_v1';
    let v=localStorage.getItem(key);
    if(v && v.length>=16) return v;
    const a=new Uint8Array(24); crypto.getRandomValues(a);
    v=[...a].map(b=>b.toString(16).padStart(2,'0')).join('');
    localStorage.setItem(key,v); return v;
  }

  async function rpc(name, body, token=null){
    const headers={"Content-Type":"application/json","apikey":C.publishableKey};
    if(token) headers["Authorization"]=`Bearer ${token}`;
    const r=await fetch(`${C.supabaseUrl}/rest/v1/rpc/${name}`,{method:"POST",headers,body:JSON.stringify(body||{})});
    const text=await r.text();
    let data=null; try{data=text?JSON.parse(text):null}catch{data=text}
    if(!r.ok){const msg=data?.message||data?.error||data?.hint||text||`HTTP ${r.status}`;throw new Error(msg)}
    return data;
  }

  function photoUrl(path){
    if(!path) return null;
    return `${C.supabaseUrl}/storage/v1/object/public/${C.storageBucket}/${encodeURI(path)}`;
  }

  async function getFeed({city=null,style=null,limit=50,offset=0}={}){
    return rpc("tp_get_feed",{p_city:city||null,p_style:style||null,p_limit:limit,p_offset:offset});
  }

  async function getListing(publicNo){
    const t=visitorToken();
    try{await rpc("tp_register_view",{p_public_no:Number(publicNo),p_visitor_token:t})}catch(e){console.warn('view',e)}
    return rpc("tp_get_listing",{p_public_no:Number(publicNo),p_visitor_token:t});
  }

  async function toggleLike(publicNo){
    return rpc("tp_toggle_like",{p_public_no:Number(publicNo),p_visitor_token:visitorToken()});
  }

  async function createListing(formData){
    const headers={"apikey":C.publishableKey};
    try{
      const token=window.TPAuth?await TPAuth.getAccessToken():null;
      if(token) headers["Authorization"]=`Bearer ${token}`;
    }catch{}
    const r=await fetch(C.createListingFunction,{method:"POST",headers,body:formData});
    const text=await r.text(); let data=null; try{data=text?JSON.parse(text):null}catch{}
    if(!r.ok) throw new Error(data?.error||text||`HTTP ${r.status}`);
    return data;
  }

  window.TP={rpc,photoUrl,getFeed,getListing,toggleLike,createListing,visitorToken};
})();
