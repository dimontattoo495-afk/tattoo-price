
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

form.addEventListener("submit", async e => {
  e.preventDefault();

  if(compressedFiles.length < 1){
    statusBox.textContent = "Добавь хотя бы одну фотографию.";
    return;
  }

  const raw = new FormData(form);
  const tg = cleanUrl(raw.get("telegram_url"));
  const vk = cleanUrl(raw.get("vk_url"));
  const web = cleanUrl(raw.get("website_url"));

  if(!tg && !vk && !web){
    statusBox.textContent = "Укажи хотя бы один рабочий контакт: Telegram, VK или сайт.";
    return;
  }

  const data = {
    master_name: String(raw.get("master_name")||"").trim(),
    studio_name: String(raw.get("studio_name")||"").trim(),
    city: String(raw.get("city")||"").trim(),
    style: String(raw.get("style")||"").trim(),
    title: String(raw.get("title")||"").trim(),
    description: String(raw.get("description")||"").trim(),
    work_price: raw.get("work_price") ? Number(raw.get("work_price")) : null,
    price_type: String(raw.get("price_type")||"from"),
    telegram_url: tg,
    vk_url: vk,
    website_url: web,
    plan: String(raw.get("plan")||"basic")
  };

  const upload = new FormData();
  upload.append("data", JSON.stringify(data));
  compressedFiles.forEach((f,i)=>upload.append("photos",f,`photo-${i+1}.webp`));

  btn.disabled = true;
  btn.textContent = "ЗАГРУЗКА…";
  statusBox.textContent = "Создаём объявление и загружаем фотографии…";

  try{
    const result = await TP.createListing(upload);
    localStorage.setItem(`tp_owner_${result.public_no}`, result.owner_key);
    localStorage.setItem("tp_last_public_no", result.public_no);

    statusBox.innerHTML =
      `Готово. Объявление № <b>${result.public_no}</b> создано. `+
      `Загружено фото: ${result.photos_count}. Статус: ожидает оплаты.`;

    btn.textContent = "ОБЪЯВЛЕНИЕ СОЗДАНО";
  }catch(err){
    console.error(err);
    statusBox.textContent = "Ошибка: "+err.message;
    btn.disabled = false;
    btn.textContent = "СОЗДАТЬ ОБЪЯВЛЕНИЕ";
  }
});
