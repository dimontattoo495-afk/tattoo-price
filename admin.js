const C = window.TP_CONFIG;
const ADMIN_API = "https://zjncoehvevoxbntysgxv.supabase.co/functions/v1/admin-api";

let session = null;
let currentListings = [];

const $ = s => document.querySelector(s);
const esc = s => String(s ?? "").replace(/[&<>"']/g, m => ({
  "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"
}[m]));

function photoUrl(path) {
  return `${C.supabaseUrl}/storage/v1/object/public/${C.storageBucket}/${encodeURI(path)}`;
}

function money(n) {
  return n == null ? "Цена по договорённости" : new Intl.NumberFormat("ru-RU").format(n) + " ₽";
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
  if(!r.ok) throw new Error(data.error_description || data.msg || data.message || "Ошибка входа");

  return data;
}

async function api(body) {
  if(!session?.access_token) throw new Error("Нет активной сессии");

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
  if(!r.ok) throw new Error(data.error || "Ошибка сервера");
  return data;
}

function saveSession(data) {
  session = {
    access_token:data.access_token,
    refresh_token:data.refresh_token,
    expires_at:Date.now() + (Number(data.expires_in || 3600) * 1000)
  };
  sessionStorage.setItem("tp_admin_session", JSON.stringify(session));
}

function restoreSession() {
  try {
    const x = JSON.parse(sessionStorage.getItem("tp_admin_session") || "null");
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

async function loadListings() {
  $("#adminStatus").textContent = "Загружаем объявления…";
  const status = $("#statusFilter").value;
  const data = await api({action:"list", status});
  currentListings = data.listings || [];
  renderStats(currentListings);
  renderListings(currentListings);
  $("#adminStatus").textContent = `Загружено: ${currentListings.length}`;
}

function renderStats(list) {
  const counts = {};
  list.forEach(x => counts[x.status] = (counts[x.status] || 0) + 1);
  $("#stats").innerHTML =
    `<span class="stat-pill">Всего: ${list.length}</span>` +
    Object.entries(counts).map(([k,v]) =>
      `<span class="stat-pill">${statusLabel(k)}: ${v}</span>`
    ).join("");
}

function renderListings(list) {
  $("#listings").innerHTML = list.map(x => {
    const photos = (x.tp_listing_photos || []).slice().sort((a,b)=>a.sort_order-b.sort_order);
    const links = [
      x.telegram_url ? `<a target="_blank" rel="noopener" href="${esc(x.telegram_url)}">Telegram</a>` : "",
      x.vk_url ? `<a target="_blank" rel="noopener" href="${esc(x.vk_url)}">VK</a>` : "",
      x.website_url ? `<a target="_blank" rel="noopener" href="${esc(x.website_url)}">Сайт</a>` : ""
    ].filter(Boolean).join("");

    return `<article class="admin-card" data-id="${esc(x.id)}">
      <div class="admin-card-head">
        <div>
          <div class="small">№${esc(x.public_no)} · ${new Date(x.created_at).toLocaleString("ru-RU")}</div>
          <h3>${esc(x.title)}</h3>
          <div class="admin-meta">
            <span class="tag">${esc(x.city)}</span>
            <span class="tag">${esc(x.style)}</span>
            <span class="tag">${esc(x.plan)}</span>
            <span class="status-badge status-${esc(x.status)}">${statusLabel(x.status)}</span>
            <span class="tag">payment: ${esc(x.payment_status)}</span>
          </div>
        </div>
        <div>
          <div class="admin-price">${money(x.work_price)}</div>
          <div class="small">Размещение: ${money(x.placement_price)}</div>
        </div>
      </div>

      <div class="admin-photos">
        ${photos.map(p=>`<a target="_blank" href="${photoUrl(p.storage_path)}"><img src="${photoUrl(p.storage_path)}" loading="lazy"></a>`).join("")}
      </div>

      <div><b>${esc(x.master_name)}</b>${x.studio_name ? " · "+esc(x.studio_name) : ""}</div>
      <div class="admin-copy">${esc(x.description || "")}</div>
      <div class="admin-links">${links}</div>

      <div class="admin-actions">
        ${x.payment_status === "paid"
          ? `<button class="btn ok" onclick="setStatus('${x.id}','published')">Опубликовать</button>`
          : `<button class="btn ok" disabled title="Сначала должна пройти оплата">Опубликовать · нет оплаты</button>`
        }
        <button class="btn warn" onclick="setStatus('${x.id}','hidden')">Скрыть</button>
        <button class="btn secondary" onclick="setStatus('${x.id}','rejected')">Отклонить</button>
        <button class="btn danger" onclick="deleteListing('${x.id}', '${String(x.public_no).replace(/'/g,"")}')">Удалить</button>
      </div>
    </article>`;
  }).join("") || '<div class="panel">Объявлений с таким статусом нет.</div>';
}

window.setStatus = async function(id, status) {
  try {
    $("#adminStatus").textContent = "Сохраняем статус…";
    await api({action:"set_status", id, status});
    await loadListings();
  } catch(e) {
    $("#adminStatus").textContent = "Ошибка: " + e.message;
  }
}

window.deleteListing = async function(id, publicNo) {
  if(!confirm(`Удалить объявление №${publicNo} вместе с фотографиями? Это действие нельзя отменить.`)) return;
  try {
    $("#adminStatus").textContent = "Удаляем объявление и фотографии…";
    await api({action:"delete", id});
    await loadListings();
  } catch(e) {
    $("#adminStatus").textContent = "Ошибка: " + e.message;
  }
}

$("#loginBtn").addEventListener("click", async () => {
  $("#loginStatus").textContent = "Входим…";
  try {
    const data = await login($("#email").value.trim(), $("#password").value);
    saveSession(data);
    $("#loginPanel").hidden = true;
    $("#adminPanel").hidden = false;
    $("#logoutBtn").hidden = false;
    await loadListings();
  } catch(e) {
    $("#loginStatus").textContent = "Ошибка: " + e.message;
  }
});

$("#logoutBtn").addEventListener("click", logout);
$("#refreshBtn").addEventListener("click", ()=>loadListings().catch(e=>$("#adminStatus").textContent="Ошибка: "+e.message));
$("#statusFilter").addEventListener("change", ()=>loadListings().catch(e=>$("#adminStatus").textContent="Ошибка: "+e.message));

if(restoreSession()) {
  $("#loginPanel").hidden = true;
  $("#adminPanel").hidden = false;
  $("#logoutBtn").hidden = false;
  loadListings().catch(e=>{
    $("#adminStatus").textContent = "Ошибка: " + e.message;
  });
}
