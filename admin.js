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
    ["Истекло", Number(s.expired || 0), ""]
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

async function refreshAll() {
  $("#adminStatus").textContent = "Обновляем данные…";

  await Promise.all([
    loadSummary(),
    loadListings()
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

  const renewals = liveOk.filter(p =>
    p.payment_kind === "renewal"
  ).length;

  const total = liveOk.reduce(
    (sum,p) => sum + Number(p.amount_rub || 0),
    0
  );

  return {liveOk, initial, renewals, total};
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
            <span class="status-badge status-${esc(x.status)}">
              ${statusLabel(x.status)}
            </span>
            <span class="tag">payment: ${esc(x.payment_status)}</span>
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
        <span>Получено: <b>${money(pay.total)}</b></span>
        <span>Просмотров: <b>${Number(x.views || 0)}</b></span>
        ${expiryHtml(x)}
      </div>

      <div class="admin-actions">
        ${x.payment_status === "paid"
          ? `<button class="btn ok" onclick="setStatus('${x.id}','published')">Опубликовать</button>`
          : `<button class="btn ok" disabled title="Сначала должна пройти оплата">
              Опубликовать · нет оплаты
            </button>`
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

  refreshAll().catch(e => {
    $("#adminStatus").textContent =
      "Ошибка: " + e.message;
  });
}
