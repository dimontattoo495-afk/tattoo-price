(function(){
  const C=window.TP_CONFIG;

  async function token(){
    const t=window.TPAuth?await TPAuth.getAccessToken():null;
    if(!t) throw new Error("Сначала войдите в аккаунт");
    return t;
  }

  async function call(fn,body){
    const t=await token();
    const r=await fetch(`${C.supabaseUrl}/functions/v1/${fn}`,{
      method:"POST",
      headers:{
        "Content-Type":"application/json",
        "apikey":C.publishableKey,
        "Authorization":`Bearer ${t}`
      },
      body:JSON.stringify(body||{})
    });
    const text=await r.text();
    let data=null;try{data=text?JSON.parse(text):null}catch{data=text}
    if(!r.ok) throw new Error(data?.error||data?.message||text||`HTTP ${r.status}`);
    return data;
  }

  async function createPayment(publicNo,mode){
    return call("rent-tbank-create-payment",{public_no:Number(publicNo),mode});
  }

  async function getPaymentStatus(publicNo,orderId){
    return call("rent-payment-status",{public_no:Number(publicNo),order_id:String(orderId||"")});
  }

  window.TPRentPay={createPayment,getPaymentStatus};
})();