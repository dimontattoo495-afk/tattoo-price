
let compressedFiles = [];
const photos = document.querySelector("#photos");
const previews = document.querySelector("#previews");
const info = document.querySelector("#compressInfo");
const form = document.querySelector("#form");
const btn = document.querySelector("#submitBtn");
const statusBox = document.querySelector("#status");

photos.addEventListener("change", async () => {
  const files = [...photos.files].slice(0,5);
  compressedFiles = [];
  previews.innerHTML = "";
  let before = 0, after = 0;

  try {
    for(let i=0;i<files.length;i++){
      const file = files[i];
      before += file.size;
      const compressed = await compressImage(file,1600,.80);
      if(compressed.size > 3*1024*1024) throw new Error(`Фото №${i+1} после сжатия больше 3 МБ`);
      compressedFiles.push(new File([compressed], `photo-${i+1}.webp`, {type:"image/webp"}));
      after += compressed.size;

      const url = URL.createObjectURL(compressed);
      const box = document.createElement("div");
      box.className = "preview";
      box.innerHTML = `<img src="${url}"><span>${Math.round(compressed.size/1024)} KB</span>`;
      previews.appendChild(box);
    }
    info.textContent = compressedFiles.length
      ? `Готово: ${compressedFiles.length}/5 · ${Math.round(before/1024)} KB → ${Math.round(after/1024)} KB`
      : "Фотографии не выбраны.";
  } catch(e) {
    compressedFiles = [];
    previews.innerHTML = "";
    info.textContent = e.message;
  }
});

async function compressImage(file,maxSide,quality){
  const img = await createImageBitmap(file);
  const scale = Math.min(1, maxSide/Math.max(img.width,img.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1,Math.round(img.width*scale));
  canvas.height = Math.max(1,Math.round(img.height*scale));
  canvas.getContext("2d").drawImage(img,0,0,canvas.width,canvas.height);
  const blob = await new Promise(r => canvas.toBlob(r,"image/webp",quality));
  if(!blob) throw new Error("Не удалось обработать изображение");
  return blob;
}

const prices = {basic:199,highlight:399,top:699};

let betaFreeActive = false;
let betaFreeDays = 15;
let betaFreeRemaining = 0;
let betaFreeLimit = 50;

function selectedPlan(){
  return document.querySelector('input[name="plan"]:checked')?.value || "basic";
}

function updatePaidTotal(){
  const plan = selectedPlan();
  document.querySelector("#total").textContent = (prices[plan] || 199) + " ₽";
}

document.querySelectorAll('input[name="plan"]').forEach(r =>
  r.addEventListener("change",()=>{
    if(!betaFreeActive) updatePaidTotal();
  })
);

function applyPublicMode(s){
  betaFreeDays = Number(s?.beta_free_days || 15);
  betaFreeLimit = Number(s?.beta_free_limit || 50);
  betaFreeRemaining = Math.max(0, Number(s?.beta_free_remaining || 0));
  betaFreeActive = !!s?.beta_free_active && betaFreeRemaining > 0;

  const betaBanner = document.querySelector("#betaBanner");
  const betaTariff = document.querySelector("#betaTariff");
  const paidTariffs = document.querySelector("#paidTariffs");
  const quotaEnded = document.querySelector("#quotaEnded");
  const payHint = document.querySelector("#payHint");
  const total = document.querySelector("#total");
  const intro = document.querySelector("#publishIntro");

  if(betaFreeActive){
    betaBanner.style.display = "";
    betaTariff.style.display = "";
    paidTariffs.style.display = "none";
    quotaEnded.style.display = "none";

    document.querySelector("#betaCounter").textContent =
      `осталось ${betaFreeRemaining} из ${betaFreeLimit} бесплатных мест`;
    document.querySelector("#betaRemaining").textContent =
      `Осталось бесплатных размещений: ${betaFreeRemaining} из ${betaFreeLimit}.`;

    intro.textContent =
      `Первые ${betaFreeLimit} размещений — бесплатно на ${betaFreeDays} дней. Без карты и без списаний.`;

    payHint.textContent =
      "Банковская карта не требуется. Объявление публикуется сразу и может быть скрыто администратором при нарушении правил.";

    document.querySelector("#totalLabel").textContent = "К оплате";
    total.textContent = "0 ₽";
    btn.textContent = `ОПУБЛИКОВАТЬ БЕСПЛАТНО НА ${betaFreeDays} ДНЕЙ`;

    const basic = document.querySelector('input[name="plan"][value="basic"]');
    if(basic) basic.checked = true;
  }else{
    betaBanner.style.display = "none";
    betaTariff.style.display = "none";
    paidTariffs.style.display = "";
    quotaEnded.style.display = "";

    intro.textContent =
      "Бесплатные места закончились. Выбери обычный тариф размещения.";

    payHint.textContent =
      "После создания объявления откроется защищённая страница оплаты Т-Банка.";

    document.querySelector("#totalLabel").textContent = "К оплате";
    updatePaidTotal();
    btn.textContent = "ПЕРЕЙТИ К ОПЛАТЕ";
  }
}

async function refreshPublicMode(){
  try{
    const s = await TP.getPublicSettings();
    applyPublicMode(s || {});
    return s || {};
  }catch(e){
    console.warn("Public settings unavailable:", e);
    // Fail safe: do not promise a free slot if quota status is unknown.
    applyPublicMode({
      beta_free_active:false,
      beta_free_days:15,
      beta_free_limit:50,
      beta_free_remaining:0
    });
    return null;
  }
}

refreshPublicMode();

function cleanUrl(v){
  v = String(v||"").trim();
  if(!v) return "";
  try{
    const u = new URL(v);
    if(!["http:","https:"].includes(u.protocol)) return "";
    return u.toString();
  }catch{return ""}
}

let pendingPayment = null;

async function startPayment(publicNo, ownerKey){
  btn.disabled = true;
  btn.textContent = "СОЗДАЁМ ПЛАТЁЖ…";
  statusBox.textContent = "Создаём защищённый платёж в Т-Банке…";

  try{
    const payment = await TP.createTbankPayment(publicNo, ownerKey);

    if(payment.already_paid){
      location.href = `./payment-return.html?status=success&n=${encodeURIComponent(publicNo)}`;
      return;
    }

    if(!payment.payment_url){
      throw new Error("Т-Банк не вернул ссылку на оплату");
    }

    statusBox.textContent = "Перенаправляем на защищённую страницу Т-Банка…";
    location.href = payment.payment_url;
  }catch(err){
    console.error(err);
    pendingPayment = {publicNo, ownerKey};
    statusBox.textContent = "Ошибка создания платежа: " + err.message;
    btn.disabled = false;
    btn.textContent = "ПОВТОРИТЬ ОПЛАТУ";
  }
}

form.addEventListener("submit", async e=>{
  e.preventDefault();

  // Refresh remaining quota at the moment of submission.
  if(!pendingPayment){
    await refreshPublicMode();
  }

  if(pendingPayment){
    await startPayment(pendingPayment.publicNo, pendingPayment.ownerKey);
    return;
  }

  if(compressedFiles.length<1){
    statusBox.textContent="Добавь хотя бы одну фотографию.";
    return;
  }

  const fd0=new FormData(form);
  const tg=cleanUrl(fd0.get("telegram_url"));
  const vk=cleanUrl(fd0.get("vk_url"));
  const web=cleanUrl(fd0.get("website_url"));

  if(!tg && !vk && !web){
    statusBox.textContent="Укажи хотя бы один рабочий контакт: Telegram, VK или сайт.";
    return;
  }

  const payload={
    master_name:String(fd0.get("master_name")||"").trim(),
    studio_name:String(fd0.get("studio_name")||"").trim(),
    city:String(fd0.get("city")||"").trim(),
    style:String(fd0.get("style")||"").trim(),
    title:String(fd0.get("title")||"").trim(),
    description:String(fd0.get("description")||"").trim(),
    work_price: fd0.get("work_price") ? Number(fd0.get("work_price")) : null,
    price_type:String(fd0.get("price_type")||"from"),
    telegram_url:tg,
    vk_url:vk,
    website_url:web,
    plan: betaFreeActive ? "basic" : String(fd0.get("plan")||"basic")
  };

  const fd=new FormData();
  fd.append("data", JSON.stringify(payload));
  compressedFiles.forEach((f,i)=>fd.append("photos",f,`photo-${i+1}.webp`));

  btn.disabled=true;
  btn.textContent="СОЗДАЁМ ОБЪЯВЛЕНИЕ…";
  statusBox.textContent="Создаём объявление и загружаем фотографии…";

  const expectedFree = betaFreeActive;

  try{
    const result=await TP.createListing(fd);

    localStorage.setItem(`tp_owner_${result.public_no}`, result.owner_key);
    localStorage.setItem("tp_last_public_no", result.public_no);

    // Server-side result is authoritative.
    const ownerStatus = await TP.getOwnerStatus(result.public_no, result.owner_key);

    if(ownerStatus?.is_beta_free && ownerStatus?.status === "published"){
      statusBox.textContent =
        `Готово! Работа опубликована бесплатно на ${betaFreeDays} дней.`;
      location.href =
        `./my.html?beta=1&n=${encodeURIComponent(result.public_no)}`;
      return;
    }

    pendingPayment = {
      publicNo: result.public_no,
      ownerKey: result.owner_key
    };

    // Race-safe behavior:
    // if the visitor saw a free place but somebody took the last one a moment earlier,
    // NEVER open the bank automatically. Let the visitor explicitly choose payment.
    if(expectedFree){
      statusBox.textContent =
        "Бесплатные места только что закончились. Никаких списаний не было. " +
        "Объявление сохранено. Если хочешь продолжить по обычному тарифу — нажми кнопку оплаты.";
      btn.disabled = false;
      btn.textContent = "ПЕРЕЙТИ К ОПЛАТЕ · 199 ₽";
      await refreshPublicMode();
      return;
    }

    await startPayment(result.public_no, result.owner_key);
  }catch(err){
    console.error(err);
    statusBox.textContent="Ошибка: "+err.message;
    btn.disabled=false;
    btn.textContent = betaFreeActive ? `ОПУБЛИКОВАТЬ БЕСПЛАТНО НА ${betaFreeDays} ДНЕЙ` : "ПЕРЕЙТИ К ОПЛАТЕ";
  }
});
