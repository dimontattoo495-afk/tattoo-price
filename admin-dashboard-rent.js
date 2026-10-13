/* TATTOO PRICE — ADMIN RENT REVENUE V1 */
(function(){
  const C=window.TP_CONFIG;
  const root=document.getElementById("dashboard");
  if(!C||!root)return;

  const money=n=>new Intl.NumberFormat("ru-RU").format(Number(n||0))+" ₽";

  function adminToken(){
    try{
      const s=JSON.parse(sessionStorage.getItem("tp_admin_session")||"null");
      return s?.access_token||null;
    }catch{return null}
  }

  async function post(url,body){
    const token=adminToken();
    if(!token)throw new Error("Нет админ-сессии");
    const r=await fetch(url,{
      method:"POST",
      headers:{
        "Content-Type":"application/json",
        "apikey":C.publishableKey,
        "Authorization":`Bearer ${token}`
      },
      body:JSON.stringify(body||{})
    });
    const text=await r.text();
    let data={};try{data=text?JSON.parse(text):{}}catch{data={error:text}}
    if(!r.ok)throw new Error(data.error||`HTTP ${r.status}`);
    return data;
  }

  function findCard(label){
    return [...root.querySelectorAll(".dash-card")].find(c=>
      c.querySelector(".k")?.textContent?.trim()===label
    );
  }

  function setCard(card,label,value){
    if(!card)return;
    const k=card.querySelector(".k"),v=card.querySelector(".v");
    if(k)k.textContent=label;
    if(v)v.textContent=value;
  }

  function extraCard(label,value,cls=""){
    const d=document.createElement("div");
    d.className=`dash-card ${cls}`.trim();
    d.dataset.rentRevenueAddon="1";
    d.innerHTML=`<div class="k">${label}</div><div class="v">${value}</div>`;
    return d;
  }

  let running=false;
  async function enhance(){
    if(running)return;
    if(root.querySelector('[data-rent-revenue-addon="1"]'))return;
    const token=adminToken();
    if(!token||!root.querySelector(".dash-card"))return;

    running=true;
    try{
      const [masterData,rentData]=await Promise.all([
        post(`${C.supabaseUrl}/functions/v1/admin-api`,{action:"summary"}),
        post(`${C.supabaseUrl}/functions/v1/admin-rent-stats`,{})
      ]);

      const master=masterData.summary||{};
      const rent=rentData.rent||{};

      const masterRevenue=Number(master.revenue_live||0);
      const masterPayments=Number(master.payments_live||0);
      const rentRevenue=Number(rent.revenue_live||0);
      const rentPayments=Number(rent.payments_live||0);

      setCard(
        findCard("Выручка · боевые"),
        "Выручка · все боевые",
        money(masterRevenue+rentRevenue)
      );

      setCard(
        findCard("Успешных оплат"),
        "Успешных оплат · всего",
        masterPayments+rentPayments
      );

      root.appendChild(extraCard("Мастера · выручка",money(masterRevenue)));
      root.appendChild(extraCard("Мастера · оплат",masterPayments,"good"));
      root.appendChild(extraCard("Аренда · выручка",money(rentRevenue),"primary"));
      root.appendChild(extraCard("Аренда · оплат",rentPayments,"good"));
      root.appendChild(extraCard("Аренда · PRO",Number(rent.pro_live||0),"good"));
      root.appendChild(extraCard("Аренда · поднятий",Number(rent.boosts_live||0),""));
    }catch(e){
      console.error("Rent revenue dashboard:",e);
      const d=extraCard("Аренда · статистика","ошибка","warn");
      d.title=e.message||String(e);
      root.appendChild(d);
    }finally{
      running=false;
    }
  }

  const observer=new MutationObserver(()=>{
    if(!root.querySelector('[data-rent-revenue-addon="1"]')){
      setTimeout(enhance,50);
    }
  });
  observer.observe(root,{childList:true});
  setTimeout(enhance,250);
})();