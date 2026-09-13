const demo = [
  {public_no:"demo1",img:"./assets/work1.svg",city:"Москва",style:"Реализм",work_price:20000,price_type:"from",title:"Черно-серый реализм · полный день",description:"Демонстрационная карточка интерфейса.",master_name:"Демо-мастер",plan:"top",views:0,likes:0,isDemo:true},
  {public_no:"demo2",img:"./assets/work2.svg",city:"Санкт-Петербург",style:"Old School",work_price:15000,price_type:"fixed",title:"Old School · предплечье",description:"Демонстрационная карточка интерфейса.",master_name:"Демо-мастер",plan:"basic",views:0,likes:0,isDemo:true},
  {public_no:"demo3",img:"./assets/work3.svg",city:"Москва",style:"Графика",work_price:12000,price_type:"from",title:"Графика · авторский эскиз",description:"Демонстрационная карточка интерфейса.",master_name:"Демо-мастер",plan:"basic",views:0,likes:0,isDemo:true}
];

let all = [];

const esc = s => String(s ?? "").replace(/[&<>"']/g, m => ({
  "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"
}[m]));

const money = n =>
  n == null ? "" : new Intl.NumberFormat("ru-RU").format(n) + " ₽";

function priceText(x){
  if(x.price_type === "negotiable" || x.work_price == null){
    return "Цена по договорённости";
  }

  const m = money(x.work_price);

  return {
    from: "от " + m,
    fixed: m,
    session: m + " за сеанс",
    hour: m + " за час"
  }[x.price_type] || "от " + m;
}

function card(x){
  const img = x.isDemo
    ? x.img
    : (TP.photoUrl(x.cover_path) || "./assets/work1.svg");

  const href = x.isDemo
    ? "#"
    : `./listing.html?n=${encodeURIComponent(x.public_no)}`;

  const planClass =
    x.plan === "top"
      ? "top-card"
      : (x.plan === "highlight" ? "highlight-card" : "");

  return `<article class="card ${planClass}">
    <a href="${href}" ${x.isDemo?'onclick="event.preventDefault()"':''}>
      <img class="cover" src="${img}" alt="" loading="lazy">
    </a>

    <div class="cardbody">
      <div class="tags">
        <span class="tag">${esc(x.city)}</span>
        <span class="tag">${esc(x.style)}</span>
        ${x.plan==="highlight"?'<span class="tag featured">ВЫДЕЛЕНО</span>':""}
        ${x.plan==="top"?'<span class="tag hot">TOP</span>':""}
        ${x.isDemo?'<span class="tag">ДЕМО</span>':""}
      </div>

      <div class="title">${esc(x.title)}</div>
      <div class="price">${priceText(x)}</div>
      <div class="desc">${esc(x.description || "")}</div>

      <div class="card-metrics" aria-label="Статистика объявления">
        <span>♡ ${Number(x.likes || 0)}</span>
        <span>👁 ${Number(x.views || 0)}</span>
      </div>

      <div class="master">
        <strong>${esc(x.master_name)}</strong>
        ${x.isDemo?"":`<a class="btn secondary" href="${href}">Смотреть</a>`}
      </div>
    </div>
  </article>`;
}

function apply(){
  const q = document.querySelector("#search").value.toLowerCase().trim();
  const city = document.querySelector("#city").value;
  const style = document.querySelector("#style").value;
  const max = Number(document.querySelector("#price").value || 0) * 1000;

  const list = all.filter(x =>
    (!q || `${x.title||""} ${x.description||""} ${x.master_name||""}`.toLowerCase().includes(q)) &&
    (!city || x.city === city) &&
    (!style || x.style === style) &&
    (!max || x.work_price == null || Number(x.work_price) <= max)
  );

  document.querySelector("#count").textContent = `${list.length} объявлений`;

  document.querySelector("#cards").innerHTML =
    list.map(card).join("") ||
    '<div class="panel">Ничего не найдено.</div>';
}

async function load(){
  try{
    const live = await TP.getFeed({limit:50});

    if(Array.isArray(live) && live.length){
      all = live;
      document.querySelector("#liveCount").textContent = live.length;
      document.querySelector("#statText").textContent =
        "реальных опубликованных работ";
    }else{
      all = demo;
      document.querySelector("#liveCount").textContent = "ДЕМО";
      document.querySelector("#statText").textContent =
        "пока нет опубликованных работ";
    }
  }catch(e){
    console.error(e);
    all = demo;
    document.querySelector("#liveCount").textContent = "ДЕМО";
    document.querySelector("#statText").textContent =
      "каталог временно недоступен";
  }

  apply();
}

["search","city","style","price"].forEach(id =>
  document.querySelector("#"+id).addEventListener("input", apply)
);

load();
