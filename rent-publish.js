(function(){
  const C = window.TP_CONFIG;

  function esc(s=''){
    return String(s).replace(/[&<>"']/g,m=>({
      '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
    }[m]));
  }

  async function submitRent(e){
    e.preventDefault();
    const msg=document.querySelector('#msg');
    msg.className='notice';
    msg.textContent='Проверяем аккаунт…';

    try{
      if(!C?.supabaseUrl || !C?.publishableKey) throw new Error('Не загружен supabase-config.js');
      if(!window.TPAuth) throw new Error('Не загружен tp-auth.js');

      const user=await TPAuth.getUser();
      if(!user){
        msg.innerHTML='Сначала войдите в аккаунт Tattoo Price: <a href="account.html?next=rent-publish.html">Войти</a>';
        return;
      }

      const token=await TPAuth.getAccessToken();
      if(!token) throw new Error('Сессия закончилась. Войдите в аккаунт ещё раз.');

      const f=new FormData(e.target);
      const photos=(f.get('photos')||'')
        .split(/\r?\n|\s+(?=https?:\/\/)/)
        .map(x=>x.trim())
        .filter(Boolean)
        .slice(0,8);

      const row={
        user_id:user.id,
        status:'paid_review',
        listing_mode:f.get('listing_mode'),
        rent_type:f.get('rent_type'),
        title:String(f.get('title')||'').trim(),
        city:String(f.get('city')||'').trim(),
        district:String(f.get('district')||'').trim()||null,
        metro:String(f.get('metro')||'').trim()||null,
        address_text:String(f.get('address_text')||'').trim()||null,
        price_day:Number(f.get('price_day'))||null,
        price_week:Number(f.get('price_week'))||null,
        price_month:Number(f.get('price_month'))||null,
        description:String(f.get('description')||'').trim()||null,
        included:String(f.get('included')||'').trim()||null,
        conditions:String(f.get('conditions')||'').trim()||null,
        contact_name:String(f.get('contact_name')||'').trim()||null,
        contact_phone:String(f.get('contact_phone')||'').trim()||null,
        contact_telegram:String(f.get('contact_telegram')||'').trim()||null,
        contact_vk:String(f.get('contact_vk')||'').trim()||null,
        photos
      };

      if(!row.title || !row.city) throw new Error('Заполните город и заголовок.');

      msg.textContent='Отправляем на модерацию…';

      const r=await fetch(`${C.supabaseUrl}/rest/v1/tp_rent_listings`,{
        method:'POST',
        headers:{
          'apikey':C.publishableKey,
          'Authorization':`Bearer ${token}`,
          'Content-Type':'application/json',
          'Prefer':'return=representation'
        },
        body:JSON.stringify(row)
      });

      const text=await r.text();
      let data=null;
      try{data=text?JSON.parse(text):null}catch{data=text}
      if(!r.ok){
        throw new Error(data?.message||data?.hint||data?.details||text||`HTTP ${r.status}`);
      }

      const item=Array.isArray(data)?data[0]:data;
      msg.className='notice ok';
      msg.innerHTML=`Готово. Объявление <b>№${esc(item?.public_no||'')}</b> отправлено на модерацию.`;
      e.target.reset();
    }catch(err){
      console.error(err);
      msg.className='notice';
      msg.textContent='Ошибка: '+err.message;
    }
  }

  window.submitRent=submitRent;
})();