(function(){
  const C=window.TP_CONFIG,form=document.querySelector("#rentPublishForm"),msg=document.querySelector("#msg"),btn=document.querySelector("#rentSubmitBtn");
  const input=document.querySelector("#rentPhotos"),info=document.querySelector("#rentPhotoInfo"),preview=document.querySelector("#rentPhotoPreview");
  let prepared=[];

  function esc(s=''){return String(s).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));}
  function choice(){return document.querySelector('input[name="plan_choice"]:checked')?.value||"free"}
  function refresh(){btn.textContent=choice()==="pro"?"СОЗДАТЬ И ПЕРЕЙТИ К ОПЛАТЕ 200 ₽":"ОТПРАВИТЬ БЕСПЛАТНО НА МОДЕРАЦИЮ"}

  document.querySelectorAll('input[name="plan_choice"]').forEach(x=>x.addEventListener("change",refresh));refresh();

  input.addEventListener("change",async()=>{
    try{
      const files=[...input.files].slice(0,8);
      info.textContent="Обрабатываем фотографии…";
      prepared=await TPRentPhotos.prepare(files,8);
      TPRentPhotos.preview(prepared,preview);
      info.textContent=`Готово: ${prepared.length}/8 фото · ${Math.round(prepared.reduce((a,f)=>a+f.size,0)/1024)} KB`;
    }catch(e){
      prepared=[];preview.innerHTML="";info.textContent="Ошибка: "+e.message;
    }
  });

  form.addEventListener("submit",async e=>{
    e.preventDefault();
    msg.className="notice";
    if(prepared.length<1){msg.textContent="Добавьте хотя бы одну фотографию.";return}

    try{
      const user=await TPAuth.getUser();if(!user){location.href="./account.html?next=rent-publish.html";return}
      const token=await TPAuth.getAccessToken();if(!token)throw new Error("Сессия закончилась. Войдите снова.");

      const f=new FormData(form);
      const row={
        user_id:user.id,status:"paid_review",
        listing_mode:f.get("listing_mode"),rent_type:f.get("rent_type"),
        title:String(f.get("title")||"").trim(),city:String(f.get("city")||"").trim(),
        district:String(f.get("district")||"").trim()||null,metro:String(f.get("metro")||"").trim()||null,
        address_text:String(f.get("address_text")||"").trim()||null,
        price_day:Number(f.get("price_day"))||null,price_week:Number(f.get("price_week"))||null,price_month:Number(f.get("price_month"))||null,
        description:String(f.get("description")||"").trim()||null,included:String(f.get("included")||"").trim()||null,conditions:String(f.get("conditions")||"").trim()||null,
        contact_name:String(f.get("contact_name")||"").trim()||null,contact_phone:String(f.get("contact_phone")||"").trim()||null,
        contact_telegram:String(f.get("contact_telegram")||"").trim()||null,contact_vk:String(f.get("contact_vk")||"").trim()||null,
        photos:[]
      };
      if(!row.title||!row.city)throw new Error("Заполните город и заголовок.");

      btn.disabled=true;msg.textContent="Создаём объявление…";
      const r=await fetch(`${C.supabaseUrl}/rest/v1/tp_rent_listings`,{
        method:"POST",headers:{apikey:C.publishableKey,Authorization:`Bearer ${token}`,"Content-Type":"application/json",Prefer:"return=representation"},
        body:JSON.stringify(row)
      });
      const text=await r.text();let data=null;try{data=text?JSON.parse(text):null}catch{data=text}
      if(!r.ok)throw new Error(data?.message||data?.hint||data?.details||text||`HTTP ${r.status}`);

      const item=Array.isArray(data)?data[0]:data;
      msg.textContent=`Объявление №${item.public_no} создано. Загружаем фотографии…`;
      await TPRentPhotos.upload(item.public_no,prepared,[]);

      if(choice()==="pro"){
        msg.textContent=`Фото загружены. Открываем оплату PRO для объявления №${item.public_no}…`;
        const p=await TPRentPay.createPayment(item.public_no,"upgrade");
        if(!p.payment_url)throw new Error("Т-Банк не вернул ссылку на оплату");
        location.href=p.payment_url;return;
      }

      msg.innerHTML=`Готово. FREE-объявление <b>№${esc(item.public_no)}</b> с фотографиями отправлено на модерацию.`;
      setTimeout(()=>location.href="./my.html",800);
    }catch(e){
      msg.textContent="Ошибка: "+e.message;
      btn.disabled=false;refresh();
    }
  });
})();