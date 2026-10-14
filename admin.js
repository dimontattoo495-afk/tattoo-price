const C = window.TP_CONFIG;
const ADMIN_API = `${C.supabaseUrl}/functions/v1/admin-api`;

let session = null;
let currentListings = [];
let currentSummary = {};

const $ = s => document.querySelector(s);

const esc = s => String(s ?? "").replace(/[&<>"']/g, m => ({
  "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"
}[m]));

function photoUrl(path) {
  return `${C.supabaseUrl}/storage/v1/object/public/${C.storageBucket}/${encodeURI(path)}`;
}

function money(n) {
  return new Intl.NumberFormat("ru-RU").format(Number(n || 0)) + " ₽";
}

function statusLabel(s) {
  return {
    pending_payment:"Ожидает оплаты",
    paid_review:"На модерации",
    published:"Опубликовано",
    hidden:"Скрыто",
    rejected:"Отклонено",
    expired:"Истекло"
  }[s] || s;
}

function dateText(value) {
  if(!value) return "—";
  return new Date(value).toLocaleString("ru-RU", {
    day:"2-digit", month:"2-digit", year:"numeric",
    hour:"2-digit", minute:"2-digit"
  });
}

function daysLeft(value) {
  if(!value) return null;
  return Math.ceil((new Date(value).getTime() - Date.now()) / 86400000);
}

async function login(email, password) {
  const r = await fetch(`${C.supabaseUrl}/auth/v1/token?grant_type=password`, {
    method:"POST",
    headers:{
      "Content-Type":"application/json",
      "apikey":C.publishableKey
    },
    body:JSON.stringify({email,password})
  });

  const data = await r.json().catch(()=>({}));

  if(!r.ok) {
    throw new Error(
      data.error_description ||
      data.msg ||
      data.message ||
      "Ошибка входа"
    );
  }

  return data;
}

async function api(body) {
  if(!session?.access_token) {
    throw new Error("Нет активной сессии");
  }

  const r = await fetch(ADMIN_API, {
    method:"POST",
    headers:{
      "Content-Type":"application/json",
      "apikey":C.publishableKey,
      "Authorization":`Bearer ${session.access_token}`
    },
    body:JSON.stringify(body)
  });

  const data = await r.json().catch(()=>({}));

  if(r.status === 401) {
    logout();
    throw new Error("Сессия истекла. Войди снова.");
  }

  if(!r.ok) {
    throw new Error(data.error || "Ошибка сервера");
  }

  return data;
}

function saveSession(data) {
  session = {
    access_token:data.access_token,
    refresh_token:data.refresh_token,
    expires_at:Date.now() + (Number(data.expires_in || 3600) * 1000)
  };

  sessionStorage.setItem(
    "tp_admin_session",
    JSON.stringify(session)
  );
}

function restoreSession() {
  try {
    const x = JSON.parse(
      sessionStorage.getItem("tp_admin_session") || "null"
    );

    if(x?.access_token && x?.expires_at > Date.now()+30000) {
      session = x;
      return true;
    }
  } catch {}

  return false;
}

function logout() {
  session = null;
  sessionStorage.removeItem("tp_admin_session");
  $("#adminPanel").hidden = true;
  $("#loginPanel").hidden = false;
  $("#logoutBtn").hidden = true;
}

function renderDashboard(s) {
  currentSummary = s || {};

  const cards = [
    ["Выручка · боевые", money(s.revenue_live), "primary"],
    ["Успешных оплат", Number(s.payments_live || 0), "good"],
    ["Первичных оплат", Number(s.initial_live || 0), ""],
    ["Продлений", Number(s.renewals_live || 0), ""],
    ["На модерации", Number(s.paid_review || 0), "warn"],
    ["Опубликовано", Number(s.published || 0), "good"],
    ["Истекают ≤ 5 дней", Number(s.expiring_5d || 0), "warn"],
    ["Истекло", Number(s.expired || 0), ""],
    ["Публичных профилей", Number(s.imported_profiles || 0), ""],
    ["Запросов на проверку", Number(s.pending_claims || 0), "warn"]
  ];

  $("#dashboard").innerHTML = cards.map(([k,v,c]) =>
    `<div class="dash-card ${c}">
      <div class="k">${k}</div>
      <div class="v">${v}</div>
    </div>`
  ).join("");

  const testListings = Number(s.test_listings || 0);
  const testPayments = Number(s.test_payments || 0);

  $("#testCleanupText").textContent =
    `${testListings} тестовых объявлений · ${testPayments} тестовых платежей. ` +
    `Объявления с успешными боевыми платежами защищены от очистки.`;

  $("#cleanupTestBtn").disabled = testListings < 1;
}

async function loadSummary() {
  const data = await api({action:"summary"});
  renderDashboard(data.summary || {});
}

async function loadListings() {
  $("#adminStatus").textContent = "Загружаем объявления…";

  const status = $("#statusFilter").value;

  const data = await api({
    action:"list",
    status
  });

  currentListings = data.listings || [];

  applySearch();

  $("#adminStatus").textContent =
    `Загружено: ${currentListings.length}`;
}


function refreshAddonSections(){
  try{ window.TPRentAdmin?.load?.(); }catch(e){}
  try{ window.TPMarketAdmin?.load?.(); }catch(e){}
  try{ window.TPMarketAdmin?.loadReports?.(); }catch(e){}
}

async function refreshAll() {
  $("#adminStatus").textContent = "Обновляем данные…";

  await Promise.all([
    loadSummary(),
    loadListings(),
    loadClaims()
  ]);
}

function paymentSummary(x) {
  const payments = Array.isArray(x.tp_payments)
    ? x.tp_payments
    : [];

  const liveOk = payments.filter(p =>
    p.environment === "live" &&
    p.status === "succeeded"
  );

  const initial = liveOk.filter(p =>
    (p.payment_kind || "initial") === "initial"
  ).length;

  const renewals = liveOk.filter(p => p.payment_kind === "renewal").length;
  const upgrades = liveOk.filter(p => p.payment_kind === "upgrade").length;
  const boosts = liveOk.filter(p => p.payment_kind === "boost").length;

  const total = liveOk.reduce(
    (sum,p) => sum + Number(p.amount_rub || 0),
    0
  );

  return {liveOk, initial, renewals, upgrades, boosts, total};
}

function expiryHtml(x) {
  if(!x.expires_at) {
    return `<span>Срок: —</span>`;
  }

  const days = daysLeft(x.expires_at);

  if(x.status === "expired" || days <= 0) {
    return `<span class="expiry-bad">Срок истёк: ${dateText(x.expires_at)}</span>`;
  }

  if(days <= 5) {
    return `<span class="expiry-warn">Истекает: ${dateText(x.expires_at)} · ${days} дн.</span>`;
  }

  return `<span class="expiry-good">До: ${dateText(x.expires_at)} · ${days} дн.</span>`;
}

function renderListings(list) {
  $("#listings").innerHTML = list.map(x => {
    const photos = (x.tp_listing_photos || [])
      .slice()
      .sort((a,b)=>a.sort_order-b.sort_order);

    const links = [
      x.telegram_url
        ? `<a target="_blank" rel="noopener" href="${esc(x.telegram_url)}">Telegram</a>`
        : "",
      x.vk_url
        ? `<a target="_blank" rel="noopener" href="${esc(x.vk_url)}">VK</a>`
        : "",
      x.website_url
        ? `<a target="_blank" rel="noopener" href="${esc(x.website_url)}">Сайт</a>`
        : "",
      x.profile_origin === "imported" && x.source_url
        ? `<a target="_blank" rel="noopener" href="${esc(x.source_url)}">Источник · ${esc(x.source_label||"публичный")}</a>`
        : ""
    ].filter(Boolean).join("");

    const pay = paymentSummary(x);

    return `<article class="admin-card" data-id="${esc(x.id)}">
      <div class="admin-card-head">
        <div>
          <div class="small">
            №${esc(x.public_no)} · ${new Date(x.created_at).toLocaleString("ru-RU")}
          </div>

          <h3>${esc(x.title)}</h3>

          <div class="admin-meta">
            <span class="tag">${esc(x.city)}</span>
            <span class="tag">${esc(x.style)}</span>
            <span class="tag">${esc(x.plan)}</span>
            ${x.profile_origin === "imported" ? `<span class="tag">ИМПОРТ · ${esc(x.claim_status||"")}</span>` : ``}
            <span class="status-badge status-${esc(x.status)}">
              ${statusLabel(x.status)}
            </span>
            <span class="tag">payment: ${x.payment_status === "free" ? "FREE" : esc(x.payment_status)}</span>
          </div>
        </div>

        <div>
          <div class="admin-price">${money(x.work_price)}</div>
          <div class="small">Размещение: ${money(x.placement_price)}</div>
        </div>
      </div>

      <div class="admin-photos">
        ${photos.map(p =>
          `<a target="_blank" href="${photoUrl(p.storage_path)}">
            <img src="${photoUrl(p.storage_path)}" loading="lazy">
          </a>`
        ).join("")}
      </div>

      <div>
        <b>${esc(x.master_name)}</b>
        ${x.studio_name ? " · "+esc(x.studio_name) : ""}
      </div>

      <div class="admin-copy">${esc(x.description || "")}</div>
      <div class="admin-links">${links}</div>

      <div class="admin-payline">
        <span>Боевых оплат: <b>${pay.liveOk.length}</b></span>
        <span>Первичных: <b>${pay.initial}</b></span>
        <span>Продлений: <b>${pay.renewals}</b></span>
        <span>PRO-подключений: <b>${pay.upgrades}</b></span>
        <span>Поднятий: <b>${pay.boosts}</b></span>
        <span>Получено: <b>${money(pay.total)}</b></span>
        <span>Просмотров: <b>${Number(x.views || 0)}</b></span>
        ${expiryHtml(x)}
      </div>

      <div class="admin-actions">
        ${["paid","free"].includes(String(x.payment_status))
          ? `<button class="btn ok" onclick="setStatus('${x.id}','published')">Опубликовать</button>`
          : `<button class="btn ok" disabled title="Статус оплаты ещё не подтверждён">Опубликовать · недоступно</button>`
        }

        <button class="btn warn" onclick="setStatus('${x.id}','hidden')">Скрыть</button>
        <button class="btn secondary" onclick="setStatus('${x.id}','rejected')">Отклонить</button>
        <button class="btn danger" onclick="deleteListing('${x.id}','${String(x.public_no).replace(/'/g,"")}')">Удалить</button>
      </div>
    </article>`;
  }).join("") ||
  '<div class="panel">Объявлений с такими условиями нет.</div>';
}

function applySearch() {
  const q = ($("#searchInput").value || "")
    .trim()
    .toLowerCase();

  if(!q) {
    renderListings(currentListings);
    return;
  }

  const filtered = currentListings.filter(x =>
    `${x.public_no} ${x.master_name||""} ${x.studio_name||""} ${x.city||""} ${x.style||""} ${x.title||""} ${x.description||""}`
      .toLowerCase()
      .includes(q)
  );

  renderListings(filtered);
}


async function loadClaims() {
  if(!document.querySelector("#claimsList")) return;
  try {
    const data = await api({action:"list_claims", status:"pending_review"});
    renderClaims(data.claims || []);
  } catch(e) {
    document.querySelector("#claimsStatus").textContent = "Ошибка загрузки запросов: " + e.message;
  }
}

function renderClaims(items) {
  const list = document.querySelector("#claimsList");
  const st = document.querySelector("#claimsStatus");
  if(!list || !st) return;
  st.textContent = `Ожидают проверки: ${items.length}`;
  list.innerHTML = items.map(c => `<article class="admin-card">
    <div class="admin-card-head"><div><div class="small">Профиль №${esc(c.public_no)} · ${c.claim_type === "removal" ? "УДАЛЕНИЕ" : "ПОДТВЕРЖДЕНИЕ"}</div><h3>${esc(c.claimant_email || "Аккаунт мастера")}</h3></div><span class="tag">${esc(c.challenge_code)}</span></div>
    <div class="admin-copy">${c.claim_type === "removal" ? "Пользователь просит удалить публичный профиль." : "Пользователь просит привязать публичный профиль к своему аккаунту."}</div>
    <div class="admin-links">${c.source_url ? `<a href="${esc(c.source_url)}" target="_blank" rel="noopener">Открыть источник</a>` : ""}${c.evidence_url ? `<a href="${esc(c.evidence_url)}" target="_blank" rel="noopener">Открыть доказательство</a>` : ""}</div>
    ${c.evidence_note ? `<div class="admin-copy" style="margin-top:8px">Комментарий: ${esc(c.evidence_note)}</div>` : ""}
    <div class="admin-actions"><button class="btn ok" onclick="resolveClaim('${c.id}','approve')">${c.claim_type === "removal" ? "Подтвердить удаление" : "Подтвердить владение"}</button><button class="btn secondary" onclick="resolveClaim('${c.id}','reject')">Отклонить</button></div>
  </article>`).join("") || '<div class="panel">Нет запросов, ожидающих проверки.</div>';
}

window.resolveClaim = async function(id, decision) {
  if(decision === "approve" && !confirm("Подтвердить этот запрос после проверки кода на публичном источнике?")) return;
  try {
    document.querySelector("#claimsStatus").textContent = "Сохраняем решение…";
    await api({action:"resolve_claim", claim_id:id, decision});
    await refreshAll();
    refreshAddonSections();
  } catch(e) {
    document.querySelector("#claimsStatus").textContent = "Ошибка: " + e.message;
  }
};

async function importPublicProfile() {
  const b = document.querySelector("#importProfileBtn");
  const st = document.querySelector("#importProfileStatus");
  b.disabled = true; st.textContent = "Скачиваем фото и создаём публичный профиль…";
  try {
    const payload = {
      action:"import_profile",
      master_name:document.querySelector("#impMaster").value.trim(),
      studio_name:document.querySelector("#impStudio").value.trim(),
      city:document.querySelector("#impCity").value.trim(),
      style:document.querySelector("#impStyle").value.trim(),
      title:document.querySelector("#impTitle").value.trim(),
      description:document.querySelector("#impDescription").value.trim(),
      work_price:document.querySelector("#impPrice").value.trim(),
      price_type:document.querySelector("#impPriceType").value,
      source_url:document.querySelector("#impSource").value.trim(),
      photo_url:document.querySelector("#impPhoto").value.trim(),
      vk_url:document.querySelector("#impVk").value.trim(),
      telegram_url:document.querySelector("#impTelegram").value.trim(),
      website_url:document.querySelector("#impWebsite").value.trim()
    };
    const r = await api(payload);
    st.textContent = `Готово: создан неподтверждённый FREE-профиль №${r.public_no} с одним фото.`;
    ["impMaster","impStudio","impCity","impStyle","impTitle","impDescription","impPrice","impSource","impPhoto","impVk","impTelegram","impWebsite"].forEach(id=>{const el=document.querySelector("#"+id);if(el)el.value=""});
    await refreshAll();
  } catch(e) {
    st.textContent = "Ошибка импорта: " + e.message;
  } finally { b.disabled = false; }
}

window.setStatus = async function(id, status) {
  try {
    $("#adminStatus").textContent = "Сохраняем статус…";

    await api({
      action:"set_status",
      id,
      status
    });

    await refreshAll();
  } catch(e) {
    $("#adminStatus").textContent =
      "Ошибка: " + e.message;
  }
};

window.deleteListing = async function(id, publicNo) {
  if(!confirm(
    `Удалить объявление №${publicNo} вместе с фотографиями и историей платежей? Это действие нельзя отменить.`
  )) return;

  try {
    $("#adminStatus").textContent =
      "Удаляем объявление и фотографии…";

    await api({
      action:"delete",
      id
    });

    await refreshAll();
  } catch(e) {
    $("#adminStatus").textContent =
      "Ошибка: " + e.message;
  }
};

$("#cleanupTestBtn").addEventListener("click", async () => {
  const n = Number(currentSummary.test_listings || 0);

  if(n < 1) return;

  const ok = confirm(
    `Удалить ${n} тестовых объявлений вместе с их фотографиями и тестовыми платежами?\n\n` +
    `Объявления с успешными боевыми платежами удалены НЕ будут.`
  );

  if(!ok) return;

  $("#cleanupTestBtn").disabled = true;
  $("#adminStatus").textContent = "Удаляем тестовые данные…";

  try {
    const result = await api({
      action:"delete_test_data"
    });

    $("#adminStatus").textContent =
      `Удалено тестовых объявлений: ${result.deleted_listings}, фотографий: ${result.deleted_photos}.`;

    await refreshAll();
  } catch(e) {
    $("#adminStatus").textContent =
      "Ошибка очистки: " + e.message;
  }
});

if(document.querySelector("#importProfileBtn")) document.querySelector("#importProfileBtn").addEventListener("click", importPublicProfile);

$("#loginBtn").addEventListener("click", async () => {
  $("#loginStatus").textContent = "Входим…";

  try {
    const data = await login(
      $("#email").value.trim(),
      $("#password").value
    );

    saveSession(data);

    $("#loginPanel").hidden = true;
    $("#adminPanel").hidden = false;
    $("#logoutBtn").hidden = false;

    await refreshAll();
  } catch(e) {
    $("#loginStatus").textContent =
      "Ошибка: " + e.message;
  }
});

$("#logoutBtn").addEventListener("click", logout);

$("#refreshBtn").addEventListener("click", () =>
  refreshAll().catch(e =>
    $("#adminStatus").textContent = "Ошибка: " + e.message
  )
);

$("#statusFilter").addEventListener("change", () =>
  loadListings().catch(e =>
    $("#adminStatus").textContent = "Ошибка: " + e.message
  )
);

$("#searchInput").addEventListener("input", applySearch);

if(restoreSession()) {
  $("#loginPanel").hidden = true;
  $("#adminPanel").hidden = false;
  $("#logoutBtn").hidden = false;

  refreshAll().then(()=>refreshAddonSections()).catch(e => {
    $("#adminStatus").textContent =
      "Ошибка: " + e.message;
  });
}
