
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
document.querySelectorAll('input[name="plan"]').forEach(r =>
  r.addEventListener("change",()=>document.querySelector("#total").textContent=prices[r.value]+" ₽")
);

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
    plan:String(fd0.get("plan")||"basic")
  };

  const fd=new FormData();
  fd.append("data", JSON.stringify(payload));
  compressedFiles.forEach((f,i)=>fd.append("photos",f,`photo-${i+1}.webp`));

  btn.disabled=true;
  btn.textContent="СОЗДАЁМ ОБЪЯВЛЕНИЕ…";
  statusBox.textContent="Создаём объявление и загружаем фотографии…";

  try{
    const result=await TP.createListing(fd);

    localStorage.setItem(`tp_owner_${result.public_no}`, result.owner_key);
    localStorage.setItem("tp_last_public_no", result.public_no);

    pendingPayment = {
      publicNo: result.public_no,
      ownerKey: result.owner_key
    };

    await startPayment(result.public_no, result.owner_key);
  }catch(err){
    console.error(err);
    statusBox.textContent="Ошибка: "+err.message;
    btn.disabled=false;
    btn.textContent="ПЕРЕЙТИ К ОПЛАТЕ";
  }
});
