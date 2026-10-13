(async function(){
  const q=new URLSearchParams(location.search),no=Number(q.get("n"));
  const form=document.querySelector("#editForm"),msg=document.querySelector("#msg");
  if(!no){msg.textContent="Неверный номер объявления.";return}

  const user=await TPAuth.getUser();
  if(!user){location.href=`./account.html?next=rent-edit.html?n=${encodeURIComponent(no)}`;return}

  function set(name,value){const el=form.elements[name];if(el)el.value=value??""}

  try{
    const rows=await TP.authRpc("tp_get_my_rent_listing",{p_public_no:no});
    const x=Array.isArray(rows)?rows[0]:null;
    if(!x)throw new Error("Объявление не найдено или принадлежит другому аккаунту");

    set("listing_mode",x.listing_mode);set("rent_type",x.rent_type);set("city",x.city);set("metro",x.metro);
    set("title",x.title);set("district",x.district);set("address_text",x.address_text);
    set("price_day",x.price_day);set("price_week",x.price_week);set("price_month",x.price_month);
    set("description",x.description);set("included",x.included);set("conditions",x.conditions);
    set("contact_name",x.contact_name);set("contact_phone",x.contact_phone);set("contact_telegram",x.contact_telegram);set("contact_vk",x.contact_vk);
    set("photos",Array.isArray(x.photos)?x.photos.join("\n"):"");
    msg.textContent=`Редактируется объявление №${x.public_no}. После сохранения оно снова пройдёт модерацию.`;
    form.hidden=false;
  }catch(e){msg.textContent="Ошибка: "+e.message;return}

  form.addEventListener("submit",async e=>{
    e.preventDefault();
    msg.textContent="Сохраняем изменения…";
    const f=new FormData(form);
    const photos=String(f.get("photos")||"").split(/\r?\n|\s+(?=https?:\/\/)/).map(x=>x.trim()).filter(Boolean).slice(0,8);
    const body={
      p_public_no:no,
      p_listing_mode:String(f.get("listing_mode")||"offer"),
      p_rent_type:String(f.get("rent_type")||"workplace"),
      p_title:String(f.get("title")||"").trim(),
      p_city:String(f.get("city")||"").trim(),
      p_district:String(f.get("district")||""),
      p_metro:String(f.get("metro")||""),
      p_address_text:String(f.get("address_text")||""),
      p_price_day:Number(f.get("price_day"))||null,
      p_price_week:Number(f.get("price_week"))||null,
      p_price_month:Number(f.get("price_month"))||null,
      p_description:String(f.get("description")||""),
      p_included:String(f.get("included")||""),
      p_conditions:String(f.get("conditions")||""),
      p_contact_name:String(f.get("contact_name")||""),
      p_contact_phone:String(f.get("contact_phone")||""),
      p_contact_telegram:String(f.get("contact_telegram")||""),
      p_contact_vk:String(f.get("contact_vk")||""),
      p_photos:photos
    };
    try{
      await TP.authRpc("tp_update_my_rent_listing",body);
      msg.innerHTML=`Готово. Объявление №<b>${no}</b> сохранено и снова отправлено на модерацию.`;
      setTimeout(()=>location.href="./my.html",900);
    }catch(e){msg.textContent="Ошибка сохранения: "+e.message}
  });
})();