(function(){
  const C=window.TP_CONFIG,cat={machine:"Тату-машинка",power:"Блок питания",furniture:"Мебель",printer:"Принтер",equipment:"Оборудование",accessories:"Аксессуары",books:"Книги / обучение",other:"Другое"},delivery={pickup:"Самовывоз",shipping:"Отправка",both:"Самовывоз / отправка"};
  const esc=s=>String(s??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]));
  const rub=v=>new Intl.NumberFormat("ru-RU").format(Number(v||0))+" ₽";
  async function rpc(name,body){const r=await fetch(`${C.supabaseUrl}/rest/v1/rpc/${name}`,{method:"POST",headers:{apikey:C.publishableKey,"Content-Type":"application/json"},body:JSON.stringify(body||{})});const t=await r.text();let d=null;try{d=t?JSON.parse(t):null}catch{d=t}if(!r.ok)throw new Error(d?.message||t||`HTTP ${r.status}`);return d}
  async function load(){
    const root=document.getElementById("marketGrid");root.innerHTML='<div class="empty">Загружаем объявления…</div>';
    try{
      const data=await rpc("tp_get_market_feed",{p_city:city.value.trim()||null,p_category:category.value||null,p_condition:condition.value||null,p_max_price:Number(maxPrice.value)||null});
      root.innerHTML="";
      if(!Array.isArray(data)||!data.length){root.innerHTML='<div class="empty">Пока нет объявлений по выбранным фильтрам.</div>';return}
      data.forEach(x=>{const photo=Array.isArray(x.photos)&&x.photos[0]||"";const el=document.createElement("article");el.className="card";el.innerHTML=`${photo?`<img src="${esc(photo)}" alt="">`:'<div style="aspect-ratio:16/10;background:#101216"></div>'}<div class="p"><span class="tag">${x.item_condition==="new"?"Новое":"Б/у"}</span><span class="tag">${esc(cat[x.category]||x.category)}</span><span class="tag">${esc(delivery[x.delivery_mode]||x.delivery_mode||"")}</span><h3>${esc(x.title)}</h3><div class="muted">${esc(x.city)}</div><div class="price">${rub(x.price)}</div><a class="btn" href="market-view.html?n=${encodeURIComponent(x.public_no)}">Подробнее</a></div>`;root.appendChild(el);});
    }catch(e){root.innerHTML=`<div class="empty">Ошибка загрузки: ${esc(e.message)}</div>`}
  }
  document.addEventListener("DOMContentLoaded",()=>{apply.onclick=load;load()});
})();