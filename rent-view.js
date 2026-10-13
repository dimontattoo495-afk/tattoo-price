(function(){
  const C=window.TP_CONFIG;
  const names={workplace:'Рабочее место',guest_spot:'Guest spot',cabinet:'Кабинет',studio:'Студия целиком'};

  function esc(s=''){
    return String(s).replace(/[&<>"']/g,m=>({
      '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
    }[m]));
  }
  function rub(v){return v?new Intl.NumberFormat('ru-RU').format(v)+' ₽':''}

  async function load(){
    const root=document.querySelector('#root');
    const n=Number(new URLSearchParams(location.search).get('n'));
    if(!n){root.innerHTML='<div class="empty">Неверный номер объявления.</div>';return}

    try{
      const r=await fetch(`${C.supabaseUrl}/rest/v1/rpc/tp_get_rent_listing`,{
        method:'POST',
        headers:{'apikey':C.publishableKey,'Content-Type':'application/json'},
        body:JSON.stringify({p_public_no:n})
      });
      const text=await r.text();
      let a=null; try{a=text?JSON.parse(text):null}catch{a=text}
      if(!r.ok) throw new Error(a?.message||a?.hint||text||`HTTP ${r.status}`);
      const x=Array.isArray(a)?a[0]:null;
      if(!x){root.innerHTML='<div class="empty">Объявление не найдено или ещё не опубликовано.</div>';return}

      const photos=(Array.isArray(x.photos)?x.photos:[]).map(u=>
        `<img src="${esc(u)}" alt="" style="width:100%;max-height:720px;object-fit:cover;border-radius:14px;margin:8px 0">`
      ).join('');

      const price=x.price_day
        ? rub(x.price_day)+'/день'
        : x.price_month
          ? rub(x.price_month)+'/мес'
          : 'Цена по договорённости';

      root.innerHTML=`
        <h1>${esc(x.title||'')}</h1>
        <p class="muted">${esc(x.city||'')}${x.metro?' · м. '+esc(x.metro):''}</p>
        <p><span class="tag">${x.listing_mode==='offer'?'Сдаю':'Ищу'}</span>
        <span class="tag">${names[x.rent_type]||esc(x.rent_type||'')}</span></p>
        <div class="price">${price}</div>
        ${photos}
        ${x.description?`<h3>Описание</h3><p>${esc(x.description).replace(/\n/g,'<br>')}</p>`:''}
        ${x.included?`<h3>Что входит</h3><p>${esc(x.included).replace(/\n/g,'<br>')}</p>`:''}
        ${x.conditions?`<h3>Условия</h3><p>${esc(x.conditions).replace(/\n/g,'<br>')}</p>`:''}
        <h3>Контакты</h3>
        <p>${[x.contact_name,x.contact_phone,x.contact_telegram,x.contact_vk].filter(Boolean).map(esc).join(' · ')||'Уточняйте у автора объявления.'}</p>`;
    }catch(e){
      console.error(e);
      root.innerHTML=`<div class="empty">Ошибка: ${esc(e.message)}</div>`;
    }
  }

  document.addEventListener('DOMContentLoaded',load);
})();