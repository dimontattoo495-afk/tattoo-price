(function(){
  const C=window.TP_CONFIG,names={workplace:'Рабочее место',guest_spot:'Guest spot',cabinet:'Кабинет',studio:'Студия целиком'};
  const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));const rub=v=>v?new Intl.NumberFormat('ru-RU').format(v)+' ₽':'';
  async function load(){
    const root=document.querySelector('#root'),n=Number(new URLSearchParams(location.search).get('n'));if(!n){root.innerHTML='<div class="empty">Неверный номер объявления.</div>';return}
    try{
      const r=await fetch(`${C.supabaseUrl}/rest/v1/rpc/tp_get_rent_listing`,{method:'POST',headers:{apikey:C.publishableKey,'Content-Type':'application/json'},body:JSON.stringify({p_public_no:n})});
      const t=await r.text();let a=null;try{a=t?JSON.parse(t):null}catch{a=t}if(!r.ok)throw new Error(a?.message||a?.hint||t||`HTTP ${r.status}`);
      const x=Array.isArray(a)?a[0]:null;if(!x){root.innerHTML='<div class="empty">Объявление не найдено или ещё не опубликовано.</div>';return}
      const activePro=x.plan==='pro'&&x.pro_until&&new Date(x.pro_until)>new Date();
      const allPhotos=Array.isArray(x.photos)?x.photos:[],shownPhotos=activePro?allPhotos:allPhotos.slice(0,1);
      const photos=shownPhotos.map(u=>`<img src="${esc(u)}" alt="">`).join('');
      const contacts=[x.contact_name,x.contact_phone,x.contact_telegram,x.contact_vk].filter(Boolean);
      const shownContacts=activePro?contacts:contacts.slice(0,1);
      const price=x.price_day?rub(x.price_day)+'/день':x.price_month?rub(x.price_month)+'/мес':x.price_week?rub(x.price_week)+'/нед':'Цена по договорённости';
      document.title=`${x.title||'Аренда'} — TATTOO PRICE`;
      root.innerHTML=`<div class="eyebrow">АРЕНДА №${esc(x.public_no)} ${activePro?'· PRO':''}</div><h1>${esc(x.title||'')}</h1><p class="muted">${esc(x.city||'')}${x.metro?' · м. '+esc(x.metro):''}</p><p>${activePro?'<span class="tag pro">PRO</span>':''}<span class="tag">${x.listing_mode==='offer'?'Сдаю':'Ищу'}</span><span class="tag">${names[x.rent_type]||esc(x.rent_type||'')}</span></p><div class="price">${price}</div>${photos}${!activePro&&allPhotos.length>1?'<div class="notice">В FREE показывается одно фото. В PRO открывается вся галерея.</div>':''}${x.description?`<h3>Описание</h3><p>${esc(x.description).replace(/\n/g,'<br>')}</p>`:''}${x.included?`<h3>Что входит</h3><p>${esc(x.included).replace(/\n/g,'<br>')}</p>`:''}${x.conditions?`<h3>Условия</h3><p>${esc(x.conditions).replace(/\n/g,'<br>')}</p>`:''}<h3>Контакты</h3><p>${shownContacts.map(esc).join(' · ')||'Уточняйте у автора объявления.'}</p>${!activePro&&contacts.length>1?'<div class="muted">В FREE отображается один контакт. В PRO — все контакты.</div>':''}`;
    }catch(e){root.innerHTML=`<div class="empty">Ошибка: ${esc(e.message)}</div>`}
  }document.addEventListener('DOMContentLoaded',load);
})();