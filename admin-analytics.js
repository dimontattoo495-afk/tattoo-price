(function(){
  const C=window.TP_CONFIG;
  const root=document.getElementById("analyticsPanel");
  if(!root)return;

  const esc=s=>String(s??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]));

  function getSession(){
    try{return JSON.parse(sessionStorage.getItem("tp_admin_session")||"null")}catch{return null}
  }

  async function rpc(days){
    const s=getSession();
    if(!s?.access_token)throw new Error("Войдите в админку");
    const r=await fetch(C.supabaseUrl+"/rest/v1/rpc/tp_admin_analytics",{
      method:"POST",
      headers:{"Content-Type":"application/json","apikey":C.publishableKey,"Authorization":"Bearer "+s.access_token},
      body:JSON.stringify({p_days:days})
    });
    const t=await r.text();let d=null;try{d=t?JSON.parse(t):null}catch{d=t}
    if(!r.ok)throw new Error(d?.message||t||("HTTP "+r.status));
    return d||{};
  }

  const names={masters:"Мастера",rent:"Аренда",market:"Барахолка",other:"Прочее"};
  const num=n=>new Intl.NumberFormat("ru-RU").format(Number(n||0));

  function card(label,value,cls=""){return '<div class="dash-card '+cls+'"><div class="k">'+esc(label)+'</div><div class="v">'+num(value)+'</div></div>'}

  function render(d,label){
    document.getElementById("analyticsPeriodTitle").textContent=label;
    document.getElementById("analyticsCards").innerHTML=
      card("Посетители",d.visitors,"primary")+
      card("Просмотры страниц",d.pageviews,"good")+
      card("Клики «Связаться»",d.contact_clicks,"")+
      card("Поделились",d.shares,"")+
      card("Переходы к публикации",d.publish_clicks,"");

    const sec=d.sections||{};
    const entries=Object.entries(sec).sort((a,b)=>Number(b[1])-Number(a[1]));
    document.getElementById("analyticsSections").innerHTML=entries.length
      ? entries.map(([k,v])=>'<div class="analytics-row"><span>'+esc(names[k]||k)+'</span><b>'+num(v)+'</b></div>').join("")
      : '<div class="muted">Пока нет данных.</div>';

    const pages=Array.isArray(d.top_pages)?d.top_pages:[];
    document.getElementById("analyticsPages").innerHTML=pages.length
      ? pages.map(x=>'<div class="analytics-row"><span>'+esc(x.path)+'</span><b>'+num(x.views)+'</b></div>').join("")
      : '<div class="muted">Пока нет данных.</div>';
  }

  async function load(){
    const days=Number(document.getElementById("analyticsPeriod").value||1);
    const labels={1:"Сегодня",7:"Последние 7 дней",30:"Последние 30 дней"};
    document.getElementById("analyticsStatus").textContent="Загружаем статистику…";
    try{
      const d=await rpc(days);
      render(d,labels[days]||days+" дней");
      document.getElementById("analyticsStatus").textContent="Обновлено: "+new Date().toLocaleTimeString("ru-RU",{hour:"2-digit",minute:"2-digit"});
    }catch(e){
      document.getElementById("analyticsStatus").textContent="Ошибка статистики: "+e.message;
    }
  }

  window.TPAdminAnalytics={load};
  document.getElementById("analyticsPeriod").addEventListener("change",load);
  document.getElementById("analyticsRefreshBtn").addEventListener("click",load);

  const obs=new MutationObserver(()=>{
    const panel=document.getElementById("adminPanel");
    if(panel&&!panel.hidden)load();
  });
  const panel=document.getElementById("adminPanel");
  if(panel)obs.observe(panel,{attributes:true,attributeFilter:["hidden"]});
  if(panel&&!panel.hidden)load();
})();