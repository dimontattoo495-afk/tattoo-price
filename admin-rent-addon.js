/* TATTOO PRICE RENT ADMIN V1.3 FIX
   Reads the existing admin session directly from sessionStorage.
*/
(function(){
  const C = window.TP_CONFIG;
  const statusBox = () => document.querySelector("#rentAdminStatus");
  const listBox = () => document.querySelector("#rentAdminList");
  const filterBox = () => document.querySelector("#rentStatusFilter");
  const refreshBtn = () => document.querySelector("#rentRefreshBtn");

  function esc(s=""){
    return String(s ?? "").replace(/[&<>"']/g, m => ({
      "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"
    }[m]));
  }

  function moneyLocal(n){
    return new Intl.NumberFormat("ru-RU").format(Number(n || 0)) + " ₽";
  }

  function dateLocal(value){
    if(!value) return "—";
    try{
      return new Date(value).toLocaleString("ru-RU", {
        day:"2-digit", month:"2-digit", year:"numeric",
        hour:"2-digit", minute:"2-digit"
      });
    }catch{
      return value;
    }
  }

  function statusLocal(s){
    return {
      paid_review:"На модерации",
      published:"Опубликовано",
      hidden:"Скрыто",
      rejected:"Отклонено"
    }[s] || s || "—";
  }

  function typeLocal(v){
    return {
      workplace:"Рабочее место",
      guest_spot:"Guest spot",
      cabinet:"Кабинет",
      studio:"Студия целиком"
    }[v] || v || "—";
  }

  function modeLocal(v){
    return v === "wanted" ? "Ищу" : "Сдаю";
  }

  function getAdminToken(){
    try{
      const s = JSON.parse(sessionStorage.getItem("tp_admin_session") || "null");
      if(s?.access_token) return s.access_token;
    }catch(e){}
    return null;
  }

  async function callRentAdmin(body){
    if(!C?.supabaseUrl || !C?.publishableKey){
      throw new Error("Не загружен supabase-config.js");
    }

    const token = getAdminToken();
    if(!token){
      throw new Error("Нет активной админ-сессии. Выйдите и войдите в админку снова.");
    }

    const controller = new AbortController();
    const timer = setTimeout(()=>controller.abort(), 12000);

    try{
      const r = await fetch(`${C.supabaseUrl}/functions/v1/rent-admin`, {
        method:"POST",
        headers:{
          "Content-Type":"application/json",
          "apikey":C.publishableKey,
          "Authorization":`Bearer ${token}`
        },
        body:JSON.stringify(body),
        signal:controller.signal
      });

      const raw = await r.text();
      let data = {};
      try{ data = raw ? JSON.parse(raw) : {}; }catch{ data = {raw}; }

      if(!r.ok){
        const msg = data?.error || data?.message || data?.raw || `HTTP ${r.status}`;
        throw new Error(`${msg} [HTTP ${r.status}]`);
      }
      return data;
    }catch(e){
      if(e?.name === "AbortError"){
        throw new Error("Сервер аренды не ответил за 12 секунд.");
      }
      throw e;
    }finally{
      clearTimeout(timer);
    }
  }

  function render(items){
    const root = listBox();
    if(!root) return;

    if(!items.length){
      root.innerHTML = '<div class="panel">Нет объявлений аренды с таким статусом.</div>';
      return;
    }

    root.innerHTML = items.map(x => {
      const photos = Array.isArray(x.photos) ? x.photos : [];
      const price = x.price_day
        ? moneyLocal(x.price_day) + " / день"
        : x.price_month
          ? moneyLocal(x.price_month) + " / месяц"
          : x.price_week
            ? moneyLocal(x.price_week) + " / неделю"
            : "Цена по договорённости";

      const contacts = [
        x.contact_name,
        x.contact_phone,
        x.contact_telegram,
        x.contact_vk
      ].filter(Boolean).map(esc).join(" · ");

      return `<article class="admin-card">
        <div class="admin-card-head">
          <div>
            <div class="small">АРЕНДА №${esc(x.public_no)} · ${dateLocal(x.created_at)}</div>
            <h3>${esc(x.title || "Без названия")}</h3>
            <div class="admin-meta">
              <span class="tag">${modeLocal(x.listing_mode)}</span>
              <span class="tag">${esc(typeLocal(x.rent_type))}</span>
              <span class="tag">${esc(x.city || "—")}</span>
              ${x.metro ? `<span class="tag">м. ${esc(x.metro)}</span>` : ""}
              <span class="status-badge status-${esc(x.status)}">${statusLocal(x.status)}</span>
            </div>
          </div>
          <div class="admin-price">${price}</div>
        </div>

        ${photos.length ? `<div class="admin-photos">${photos.slice(0,8).map(u =>
          `<a target="_blank" rel="noopener" href="${esc(u)}"><img src="${esc(u)}" loading="lazy"></a>`
        ).join("")}</div>` : ""}

        ${x.address_text ? `<div class="small">Адрес/ориентир: ${esc(x.address_text)}</div>` : ""}
        ${x.description ? `<div class="admin-copy">${esc(x.description)}</div>` : ""}
        ${x.included ? `<div class="admin-copy"><b>Что входит:</b> ${esc(x.included)}</div>` : ""}
        ${x.conditions ? `<div class="admin-copy"><b>Условия:</b> ${esc(x.conditions)}</div>` : ""}
        ${contacts ? `<div class="admin-links">${contacts}</div>` : ""}

        <div class="admin-actions">
          <button class="btn ok" onclick="TPRentAdmin.setStatus('${esc(x.id)}','published')">Опубликовать</button>
          <button class="btn warn" onclick="TPRentAdmin.setStatus('${esc(x.id)}','hidden')">Скрыть</button>
          <button class="btn secondary" onclick="TPRentAdmin.setStatus('${esc(x.id)}','rejected')">Отклонить</button>
          <button class="btn danger" onclick="TPRentAdmin.remove('${esc(x.id)}','${esc(x.public_no)}')">Удалить</button>
        </div>
      </article>`;
    }).join("");
  }

  async function load(){
    const box = statusBox();
    if(!box) return;

    box.textContent = "Загружаем объявления аренды…";

    try{
      const status = filterBox()?.value || "";
      const data = await callRentAdmin({action:"list_rent", status});
      const items = Array.isArray(data?.listings) ? data.listings : [];
      render(items);
      box.textContent = `Объявлений аренды: ${items.length}`;
    }catch(e){
      console.error("rent-admin", e);
      box.textContent = "Ошибка аренды: " + (e?.message || e);
    }
  }

  async function setStatus(id, status){
    const box = statusBox();
    if(box) box.textContent = "Сохраняем статус…";
    try{
      await callRentAdmin({action:"set_rent_status", id, status});
      await load();
    }catch(e){
      if(box) box.textContent = "Ошибка: " + (e?.message || e);
    }
  }

  async function remove(id, publicNo){
    if(!confirm(`Удалить объявление аренды №${publicNo}?`)) return;
    const box = statusBox();
    if(box) box.textContent = "Удаляем объявление…";
    try{
      await callRentAdmin({action:"delete_rent", id});
      await load();
    }catch(e){
      if(box) box.textContent = "Ошибка: " + (e?.message || e);
    }
  }

  window.TPRentAdmin = {load, setStatus, remove};

  function init(){
    const b = refreshBtn();
    const f = filterBox();

    if(b){
      b.onclick = function(){
        load();
      };
    }

    if(f){
      f.onchange = function(){
        load();
      };
    }

    // If already logged in, load immediately.
    if(getAdminToken()){
      load();
    }else if(statusBox()){
      statusBox().textContent = "Войдите в админку, чтобы загрузить аренду.";
    }
  }

  if(document.readyState === "loading"){
    document.addEventListener("DOMContentLoaded", init, {once:true});
  }else{
    init();
  }
})();