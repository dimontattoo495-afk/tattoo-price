(function(){
  const C=window.TP_CONFIG;
  const cat={machine:"Тату-машинка",power:"Блок питания",furniture:"Мебель",printer:"Принтер",equipment:"Оборудование",accessories:"Аксессуары",books:"Книги / обучение",other:"Другое"};
  const del={pickup:"Самовывоз",shipping:"Отправка",both:"Самовывоз или отправка"};
  const esc=s=>String(s??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]));
  const rub=v=>new Intl.NumberFormat("ru-RU").format(Number(v||0))+" ₽";

  function phoneHref(v){
    const p=String(v||"").replace(/[^+\d]/g,"");
    return p?("tel:"+p):"";
  }
  function tgHref(v){
    let s=String(v||"").trim();
    if(!s)return "";
    if(/^https?:\/\//i.test(s))return s;
    s=s.replace(/^@/,"");
    return "https://t.me/"+encodeURIComponent(s);
  }
  function vkHref(v){
    let s=String(v||"").trim();
    if(!s)return "";
    if(/^https?:\/\//i.test(s))return s;
    s=s.replace(/^@/,"").replace(/^vk\.(com|ru)\//i,"");
    return "https://vk.ru/"+encodeURIComponent(s);
  }

  async function report(publicNo){
    const reason=document.getElementById("reportReason")?.value||"other";
    const details=document.getElementById("reportDetails")?.value||"";
    const st=document.getElementById("reportStatus");
    st.textContent="Отправляем…";
    try{
      const r=await fetch(`${C.supabaseUrl}/rest/v1/rpc/tp_report_market_listing`,{
        method:"POST",
        headers:{apikey:C.publishableKey,"Content-Type":"application/json"},
        body:JSON.stringify({p_public_no:Number(publicNo),p_reason:reason,p_details:details})
      });
      const t=await r.text();
      if(!r.ok){
        let m=t;try{m=JSON.parse(t)?.message||t}catch{}
        throw new Error(m||`HTTP ${r.status}`);
      }
      st.textContent="Жалоба отправлена. Спасибо.";
      const b=document.getElementById("reportBtn");if(b)b.disabled=true;
    }catch(e){
      st.textContent="Ошибка: "+e.message;
    }
  }

  async function load(){
    const root=document.getElementById("root");
    const n=Number(new URLSearchParams(location.search).get("n"));
    if(!n){root.innerHTML='<div class="empty">Неверный номер объявления.</div>';return}
    try{
      const r=await fetch(`${C.supabaseUrl}/rest/v1/rpc/tp_get_market_listing`,{
        method:"POST",headers:{apikey:C.publishableKey,"Content-Type":"application/json"},
        body:JSON.stringify({p_public_no:n})
      });
      const t=await r.text();let a=null;try{a=t?JSON.parse(t):null}catch{a=t}
      if(!r.ok)throw new Error(a?.message||t||`HTTP ${r.status}`);
      const x=Array.isArray(a)?a[0]:null;
      if(!x){root.innerHTML='<div class="empty">Объявление не найдено или ещё не опубликовано.</div>';return}

      document.title=`${x.title} — TATTOO PRICE`;
      const photos=(Array.isArray(x.photos)?x.photos:[]).map(u=>`<img src="${esc(u)}" alt="">`).join("");

      const buttons=[];
      if(x.contact_phone)buttons.push(`<a class="btn primary" href="${esc(phoneHref(x.contact_phone))}">Позвонить</a>`);
      if(x.contact_telegram)buttons.push(`<a class="btn" target="_blank" rel="noopener" href="${esc(tgHref(x.contact_telegram))}">Telegram</a>`);
      if(x.contact_vk)buttons.push(`<a class="btn" target="_blank" rel="noopener" href="${esc(vkHref(x.contact_vk))}">VK</a>`);

      let mainContact="";
      if(x.contact_telegram)mainContact=tgHref(x.contact_telegram);
      else if(x.contact_vk)mainContact=vkHref(x.contact_vk);
      else if(x.contact_phone)mainContact=phoneHref(x.contact_phone);

      root.innerHTML=`
        <div class="eyebrow">БАРАХОЛКА №${x.public_no}</div>
        <h1>${esc(x.title)}</h1>
        <p>
          <span class="tag">${esc(cat[x.category]||x.category)}</span>
          <span class="tag">${x.item_condition==="new"?"Новое":"Б/у"}</span>
          <span class="tag">${esc(del[x.delivery_mode]||x.delivery_mode)}</span>
        </p>
        <div class="price">${rub(x.price)}</div>
        <p class="muted">${esc(x.city)}</p>

        ${mainContact?`<p><a class="btn primary" href="${esc(mainContact)}" target="${mainContact.startsWith("http")?"_blank":"_self"}" rel="noopener">СВЯЗАТЬСЯ С ПРОДАВЦОМ</a></p>`:""}

        <div class="market-detail-gallery">${photos}</div>

        <h3>Описание</h3>
        <p>${esc(x.description).replace(/\n/g,"<br>")}</p>
        ${x.completeness?`<h3>Комплектность</h3><p>${esc(x.completeness).replace(/\n/g,"<br>")}</p>`:""}

        <h3>Контакты продавца</h3>
        ${x.contact_name?`<p><b>${esc(x.contact_name)}</b></p>`:""}
        <div class="market-contact-buttons">${buttons.join("")||'<span class="muted">Контакт указан в объявлении.</span>'}</div>

        <div class="market-warning"><b>TATTOO PRICE — информационная площадка.</b> Мы не принимаем оплату, не организуем доставку и не проверяем качество, комплектность или происхождение товара. Сделка совершается напрямую между пользователями.</div>

        <details class="market-report">
          <summary>Пожаловаться на объявление</summary>
          <div class="market-report-form">
            <select id="reportReason">
              <option value="fraud">Подозрение на мошенничество</option>
              <option value="prohibited">Запрещённый товар</option>
              <option value="wrong_info">Неверная информация</option>
              <option value="sold">Товар уже продан</option>
              <option value="other">Другая причина</option>
            </select>
            <textarea id="reportDetails" maxlength="1000" placeholder="Комментарий (необязательно)"></textarea>
            <button class="btn secondary" id="reportBtn" type="button">ОТПРАВИТЬ ЖАЛОБУ</button>
            <div class="market-report-status" id="reportStatus"></div>
          </div>
        </details>
      `;

      document.getElementById("reportBtn")?.addEventListener("click",()=>report(x.public_no));
    }catch(e){
      root.innerHTML=`<div class="empty">Ошибка: ${esc(e.message)}</div>`;
    }
  }
  document.addEventListener("DOMContentLoaded",load);
})();