(function(){
  const C=window.TP_CONFIG;
  const box=()=>document.getElementById("marketAdminStatus");
  const list=()=>document.getElementById("marketAdminList");
  const filter=()=>document.getElementById("marketStatusFilter");
  const reportBox=()=>document.getElementById("marketReportStatus");
  const reportList=()=>document.getElementById("marketReportList");
  const reportFilter=()=>document.getElementById("marketReportStatusFilter");
  const esc=s=>String(s??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]));
  const reasonNames={fraud:"Подозрение на мошенничество",prohibited:"Запрещённый товар",wrong_info:"Неверная информация",sold:"Товар уже продан",other:"Другая причина"};

  function token(){
    try{return JSON.parse(sessionStorage.getItem("tp_admin_session")||"null")?.access_token||null}catch{return null}
  }

  async function rpc(name,body){
    const t=token();if(!t)throw new Error("Нет активной админ-сессии");
    const r=await fetch(`${C.supabaseUrl}/rest/v1/rpc/${name}`,{
      method:"POST",
      headers:{apikey:C.publishableKey,Authorization:`Bearer ${t}`,"Content-Type":"application/json"},
      body:JSON.stringify(body||{})
    });
    const raw=await r.text();let d=null;try{d=raw?JSON.parse(raw):null}catch{d=raw}
    if(!r.ok)throw new Error(d?.message||raw||`HTTP ${r.status}`);
    return d;
  }

  function render(items){
    list().innerHTML=items.length?items.map(x=>`<article class="admin-card">
      <div class="admin-card-head">
        <div>
          <div class="small">БАРАХОЛКА №${x.public_no}</div>
          <h3>${esc(x.title)}</h3>
          <div class="admin-meta">
            <span class="tag">${esc(x.city)}</span>
            <span class="tag">${x.item_condition==="new"?"Новое":"Б/у"}</span>
            <span class="status-badge">${esc(x.status)}</span>
          </div>
        </div>
        <div class="admin-price">${new Intl.NumberFormat("ru-RU").format(x.price||0)} ₽</div>
      </div>
      ${Array.isArray(x.photos)&&x.photos.length?`<div class="admin-photos">${x.photos.slice(0,8).map(u=>`<a target="_blank" href="${esc(u)}"><img src="${esc(u)}"></a>`).join("")}</div>`:""}
      <div class="admin-copy">${esc(x.description||"")}</div>
      <div class="admin-actions">
        <button class="btn ok" onclick="TPMarketAdmin.setStatus('${x.id}','published')">Опубликовать</button>
        <button class="btn warn" onclick="TPMarketAdmin.setStatus('${x.id}','hidden')">Скрыть</button>
        <button class="btn secondary" onclick="TPMarketAdmin.setStatus('${x.id}','rejected')">Отклонить</button>
        <button class="btn danger" onclick="TPMarketAdmin.remove('${x.id}','${x.public_no}')">Удалить</button>
      </div>
    </article>`).join(""):'<div class="panel">Нет объявлений.</div>';
  }

  async function load(){
    if(!box())return;
    try{
      box().textContent="Загружаем барахолку…";
      const rows=await rpc("tp_market_admin_list",{p_status:filter()?.value||null});
      render(rows||[]);
      box().textContent=`Объявлений: ${rows?.length||0}`;
    }catch(e){box().textContent="Ошибка: "+e.message}
  }

  async function setStatus(id,s){await rpc("tp_market_admin_set_status",{p_id:id,p_status:s});load()}
  async function remove(id,no){if(!confirm(`Удалить товар №${no}?`))return;await rpc("tp_market_admin_delete",{p_id:id});load()}

  function renderReports(items){
    if(!reportList())return;
    reportList().innerHTML=items.length?items.map(x=>`<article class="admin-card">
      <div class="admin-card-head">
        <div>
          <div class="small">ЖАЛОБА · ОБЪЯВЛЕНИЕ №${x.public_no}</div>
          <h3>${esc(x.listing_title||"Без названия")}</h3>
          <div class="admin-meta"><span class="tag">${esc(reasonNames[x.reason]||x.reason)}</span><span class="status-badge">${esc(x.status)}</span></div>
        </div>
        <div class="small">${new Date(x.created_at).toLocaleString("ru-RU")}</div>
      </div>
      ${x.details?`<div class="admin-copy">${esc(x.details)}</div>`:""}
      <div class="admin-actions">
        <a class="btn secondary" target="_blank" href="./market-view.html?n=${x.public_no}">Открыть объявление</a>
        <button class="btn secondary" onclick="TPMarketAdmin.reportStatus('${x.id}','reviewed')">Просмотрено</button>
        <button class="btn ok" onclick="TPMarketAdmin.reportStatus('${x.id}','closed')">Закрыть</button>
      </div>
    </article>`).join(""):'<div class="panel">Жалоб нет.</div>';
  }

  async function loadReports(){
    if(!reportBox())return;
    try{
      reportBox().textContent="Загружаем жалобы…";
      const rows=await rpc("tp_market_admin_reports",{p_status:reportFilter()?.value||null});
      renderReports(rows||[]);
      reportBox().textContent=`Жалоб: ${rows?.length||0}`;
    }catch(e){reportBox().textContent="Ошибка жалоб: "+e.message}
  }

  async function reportStatus(id,s){
    await rpc("tp_market_admin_report_status",{p_id:id,p_status:s});
    loadReports();
  }

  window.TPMarketAdmin={load,setStatus,remove,loadReports,reportStatus};

  document.addEventListener("DOMContentLoaded",()=>{
    document.getElementById("marketRefreshBtn")?.addEventListener("click",load);
    filter()?.addEventListener("change",load);
    document.getElementById("marketReportRefreshBtn")?.addEventListener("click",loadReports);
    reportFilter()?.addEventListener("change",loadReports);
    if(token()){load();loadReports();}
  });
})();