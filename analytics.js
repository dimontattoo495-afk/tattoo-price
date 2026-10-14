(function(){
  const C=window.TP_CONFIG;
  if(!C?.supabaseUrl||!C?.publishableKey)return;

  function token(){
    const k="tp_analytics_visitor_v1";
    let v=localStorage.getItem(k);
    if(v&&v.length>=16)return v;
    const a=new Uint8Array(24);crypto.getRandomValues(a);
    v=[...a].map(b=>b.toString(16).padStart(2,"0")).join("");
    localStorage.setItem(k,v);return v;
  }

  function section(){
    const p=location.pathname.toLowerCase();
    if(p.includes("market"))return "market";
    if(p.includes("rent"))return "rent";
    if(p.includes("master")||p.includes("listing")||p==="/"||p.endsWith("/index.html"))return "masters";
    return "other";
  }

  function entityNo(){
    const n=Number(new URLSearchParams(location.search).get("n"));
    return Number.isFinite(n)&&n>0?n:null;
  }

  async function track(eventType,meta){
    try{
      await fetch(C.supabaseUrl+"/rest/v1/rpc/tp_track_event",{
        method:"POST",
        keepalive:true,
        headers:{"Content-Type":"application/json","apikey":C.publishableKey},
        body:JSON.stringify({
          p_visitor_token:token(),
          p_event_type:eventType,
          p_section:section(),
          p_path:location.pathname+location.search,
          p_entity_no:entityNo(),
          p_referrer:document.referrer||null,
          p_meta:meta||{}
        })
      });
    }catch(e){}
  }

  window.TPAnalytics={track};

  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",()=>track("page_view"));
  else track("page_view");

  document.addEventListener("click",function(e){
    const el=e.target.closest("a,button");
    if(!el)return;
    const href=(el.getAttribute("href")||"").trim();
    const txt=(el.textContent||"").trim().toLowerCase();

    if(href.startsWith("tel:")||href.includes("t.me/")||href.includes("vk.ru/")||href.includes("vk.com/")||
       txt.includes("связаться")||txt.includes("позвонить")){
      track("contact_click",{label:(el.textContent||"").trim().slice(0,80),href:href.slice(0,200)});
      return;
    }
    if(el.id==="shareListingBtn"||txt.includes("поделиться")){
      track("share",{label:(el.textContent||"").trim().slice(0,80)});
      return;
    }
    if(href.includes("publish")||txt.includes("разместить")||txt.includes("продать")){
      track("publish_click",{label:(el.textContent||"").trim().slice(0,80),href:href.slice(0,200)});
    }
  },true);
})();