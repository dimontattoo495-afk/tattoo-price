(function(){
  const C = window.TP_CONFIG;

  function getVisitorToken(){
    const key="tp_visitor_token_v1";
    try{let token=localStorage.getItem(key);if(!token){token=(crypto.randomUUID?crypto.randomUUID():`${Date.now()}-${Math.random()}`)+"-"+Math.random().toString(36).slice(2);localStorage.setItem(key,token);}return token;}catch{if(!window.__tpVisitorToken)window.__tpVisitorToken=`${Date.now()}-${Math.random()}-${Math.random()}`;return window.__tpVisitorToken;}
  }

  async function maybeToken(){return window.TPAuth?.getAccessToken?await window.TPAuth.getAccessToken():null;}

  async function rpc(name,body){
    const r=await fetch(`${C.supabaseUrl}/rest/v1/rpc/${name}`,{method:"POST",headers:{"Content-Type":"application/json","apikey":C.publishableKey},body:JSON.stringify(body||{})});
    const text=await r.text();if(!r.ok){let message=text||`HTTP ${r.status}`;try{const j=JSON.parse(text);message=j.message||j.error||message;}catch{}throw new Error(message);}return text?JSON.parse(text):null;
  }

  async function authRpc(name,body){
    const token=await maybeToken();if(!token)throw new Error("Сначала войдите в аккаунт мастера");
    const r=await fetch(`${C.supabaseUrl}/rest/v1/rpc/${name}`,{method:"POST",headers:{"Content-Type":"application/json","apikey":C.publishableKey,"Authorization":`Bearer ${token}`},body:JSON.stringify(body||{})});
    const text=await r.text();if(!r.ok){let message=text||`HTTP ${r.status}`;try{const j=JSON.parse(text);message=j.message||j.error||message;}catch{}throw new Error(message);}return text?JSON.parse(text):null;
  }

  function photoUrl(path){return path?`${C.supabaseUrl}/storage/v1/object/public/${C.storageBucket}/${encodeURI(path)}`:null;}
  async function getFeed({city=null,style=null,limit=50,offset=0}={}){return rpc("tp_get_feed",{p_city:city||null,p_style:style||null,p_limit:limit,p_offset:offset});}
  async function registerView(publicNo){return rpc("tp_register_view",{p_public_no:Number(publicNo),p_visitor_token:getVisitorToken()});}
  async function getListing(publicNo){const visitor=getVisitorToken();try{await rpc("tp_register_view",{p_public_no:Number(publicNo),p_visitor_token:visitor});}catch(e){console.warn("View registration failed:",e);}return rpc("tp_get_listing",{p_public_no:Number(publicNo),p_visitor_token:visitor});}
  async function toggleLike(publicNo){return rpc("tp_toggle_like",{p_public_no:Number(publicNo),p_visitor_token:getVisitorToken()});}

  async function createListing(formData){
    const token=await maybeToken();if(!token)throw new Error("Сначала войдите в аккаунт мастера");
    const r=await fetch(C.createListingFunction,{method:"POST",headers:{"apikey":C.publishableKey,"Authorization":`Bearer ${token}`},body:formData});
    const text=await r.text();let data=null;try{data=text?JSON.parse(text):null;}catch{}if(!r.ok)throw new Error(data?.error||text||`HTTP ${r.status}`);return data;
  }

  async function getOwnerStatus(publicNo,ownerKey){return rpc("tp_get_owner_status",{p_public_no:Number(publicNo),p_owner_key:ownerKey});}
  async function getMyAccountListings(){return authRpc("tp_get_my_account_listings",{});}
  async function claimListing(publicNo,ownerKey){return authRpc("tp_claim_listing",{p_public_no:Number(publicNo),p_owner_key:ownerKey});}
  async function getAccountPaymentStatus(publicNo,orderId){return authRpc("tp_get_account_payment_status",{p_public_no:Number(publicNo),p_order_id:orderId});}

  async function createTbankPayment(publicNo,ownerKey="",mode="initial"){
    const token=await maybeToken();
    const headers={"Content-Type":"application/json","apikey":C.publishableKey};if(token)headers["Authorization"]=`Bearer ${token}`;
    const r=await fetch(C.tbankCreatePaymentFunction,{method:"POST",headers,body:JSON.stringify({public_no:Number(publicNo),owner_key:ownerKey||"",mode})});
    const text=await r.text();let data=null;try{data=text?JSON.parse(text):null;}catch{}if(!r.ok)throw new Error(data?.error||text||`HTTP ${r.status}`);return data;
  }

  async function getOwnerPaymentStatus(publicNo,ownerKey,orderId){return rpc("tp_get_owner_payment_status",{p_public_no:Number(publicNo),p_owner_key:ownerKey,p_order_id:orderId});}

  window.TP={rpc,authRpc,photoUrl,getFeed,getListing,registerView,toggleLike,createListing,getVisitorToken,getOwnerStatus,getOwnerPaymentStatus,getMyAccountListings,claimListing,getAccountPaymentStatus,createTbankPayment};
})();
