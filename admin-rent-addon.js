/* TATTOO PRICE RENT ADMIN ADDON V1.2 */
(function(){
  const C = window.TP_CONFIG;
  if(!C) return;

  const RENT_ADMIN_API = `${C.supabaseUrl}/functions/v1/rent-admin`;

  async function rentAdminApi(body) {
    if(!window.session?.access_token && typeof session !== "undefined" && session?.access_token){
      // use existing admin session variable
    }

    const activeSession = (typeof session !== "undefined") ? session : null;
    if(!activeSession?.access_token) throw new Error("Нет активной сессии");

    const r = await fetch(RENT_ADMIN_API, {
      method:"POST",
      headers:{
        "Content-Type":"application/json",
        "apikey":C.publishableKey,
        "Authorization":`Bearer ${activeSession.access_token}`
      },
      body:JSON.stringify(body)
    });

    const data = await r.json().catch(()=>({}));

    if(r.status === 401) {
      if(typeof logout === "function") logout();
      throw new Error("Сессия истекла. Войди снова.");
    }

    if(!r.ok) throw new Error(data.error || "Ошибка сервера аренды");
    return data;
  }

  function rentTypeLabel(v) {
    return {
      workplace:"Рабочее место",
      guest_spot:"Guest spot",
      cabinet:"Кабинет",
      studio:"Студия целиком"
    }[v] || v || "—";
  }

  function rentModeLabel(v) {
    return v === "wanted" ? "Ищу" : "Сдаю";
  }

  function rentPrice(x) {
    if(x.price_day) return money(x.price_day) + " / день";
    if(x.price_month) return money(x.price_month) + " / месяц";
    if(x.price_week) return money(x.price_week) + " / неделю";
    return "Цена по договорённости";
  }

  function renderRentAdmin(items) {
    const list = document.querySelector("#rentAdminList");
    if(!list) return;

    list.innerHTML = items.map(x => {
      const photos = Array.isArray(x.photos) ? x.photos : [];
      const contacts = [
        x.contact_name,
        x.contact_phone,
        x.contact_telegram,
        x.contact_vk
      ].filter(Boolean).map(esc).join(" · ");

      return `<article class="admin-card">
        <div class="admin-card-head">
          <div>
            <div class="small">АРЕНДА №${esc(x.public_no)} · ${dateText(x.created_at)}</div>
            <h3>${esc(x.title || "Без названия")}</h3>
            <div class="admin-meta">
              <span class="tag">${rentModeLabel(x.listing_mode)}</span>
              <span class="tag">${esc(rentTypeLabel(x.rent_type))}</span>
              <span class="tag">${esc(x.city || "—")}</span>
              ${x.metro ? `<span class="tag">м. ${esc(x.metro)}</span>` : ""}
              <span class="status-badge status-${esc(x.status)}">${statusLabel(x.status)}</span>
            </div>
          </div>
          <div class="admin-price">${rentPrice(x)}</div>
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
          <button class="btn ok" onclick="setRentStatus('${x.id}','published')">Опубликовать</button>
          <button class="btn warn" onclick="setRentStatus('${x.id}','hidden')">Скрыть</button>
          <button class="btn secondary" onclick="setRentStatus('${x.id}','rejected')">Отклонить</button>
          <button class="btn danger" onclick="deleteRent('${x.id}','${String(x.public_no).replace(/'/g,"")}')">Удалить</button>
        </div>
      </article>`;
    }).join("") || '<div class="panel">Нет объявлений аренды с таким статусом.</div>';
  }

  async function loadRentAdmin() {
    const statusBox = document.querySelector("#rentAdminStatus");
    if(!statusBox) return;

    statusBox.textContent = "Загружаем аренду…";

    try {
      const filter = document.querySelector("#rentStatusFilter")?.value || "";
      const data = await rentAdminApi({action:"list_rent", status:filter});
      const items = data.listings || [];
      renderRentAdmin(items);
      statusBox.textContent = `Объявлений аренды: ${items.length}`;
    } catch(e) {
      statusBox.textContent = "Ошибка аренды: " + e.message;
    }
  }

  window.setRentStatus = async function(id, status) {
    const box = document.querySelector("#rentAdminStatus");
    try {
      box.textContent = "Сохраняем статус аренды…";
      await rentAdminApi({action:"set_rent_status", id, status});
      await loadRentAdmin();
    } catch(e) {
      box.textContent = "Ошибка: " + e.message;
    }
  };

  window.deleteRent = async function(id, publicNo) {
    if(!confirm(`Удалить объявление аренды №${publicNo}?`)) return;

    const box = document.querySelector("#rentAdminStatus");
    try {
      box.textContent = "Удаляем объявление аренды…";
      await rentAdminApi({action:"delete_rent", id});
      await loadRentAdmin();
    } catch(e) {
      box.textContent = "Ошибка: " + e.message;
    }
  };

  function hook(){
    const refresh = document.querySelector("#rentRefreshBtn");
    const filter = document.querySelector("#rentStatusFilter");

    if(refresh) refresh.addEventListener("click", loadRentAdmin);
    if(filter) filter.addEventListener("change", loadRentAdmin);

    const oldRefreshAll = window.refreshAll || (typeof refreshAll === "function" ? refreshAll : null);
    if(oldRefreshAll && !window.__rentRefreshHooked){
      window.__rentRefreshHooked = true;
      window.refreshAll = async function(){
        await oldRefreshAll();
        await loadRentAdmin();
      };
    }

    // If admin session was restored before addon loaded, load rent immediately.
    setTimeout(()=>{
      try{
        if(typeof session !== "undefined" && session?.access_token &&
           !document.querySelector("#adminPanel")?.hidden){
          loadRentAdmin();
        }
      }catch{}
    },300);
  }

  if(document.readyState === "loading"){
    document.addEventListener("DOMContentLoaded", hook);
  }else{
    hook();
  }

  // Existing admin login calls refreshAll() defined in admin.js.
  // Patch that lexical function safely via a delayed wrapper if possible.
  setTimeout(()=>{
    try{
      if(typeof refreshAll === "function" && !refreshAll.__rentWrapped){
        const old = refreshAll;
        const wrapped = async function(){
          await old();
          await loadRentAdmin();
        };
        wrapped.__rentWrapped = true;
        // top-level `let/const` isn't on window, but function declaration is mutable in this script realm
        refreshAll = wrapped;
      }
    }catch{}
  },0);
})();
