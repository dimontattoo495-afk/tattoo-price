(function(){
  const C = window.TP_CONFIG;
  const typeNames = {
    workplace:'Рабочее место',
    guest_spot:'Guest spot',
    cabinet:'Кабинет',
    studio:'Студия целиком'
  };

  function esc(s=''){
    return String(s).replace(/[&<>"']/g,m=>({
      '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
    }[m]));
  }

  function money(v){
    return v ? new Intl.NumberFormat('ru-RU').format(v)+' ₽' : '';
  }

  async function rpc(name, body){
    if(!C?.supabaseUrl || !C?.publishableKey) throw new Error('Не загружен supabase-config.js');
    const r = await fetch(`${C.supabaseUrl}/rest/v1/rpc/${name}`,{
      method:'POST',
      headers:{
        'apikey':C.publishableKey,
        'Content-Type':'application/json'
      },
      body:JSON.stringify(body||{})
    });
    const text = await r.text();
    let data=null;
    try{data=text?JSON.parse(text):null}catch{data=text}
    if(!r.ok) throw new Error(data?.message||data?.hint||data?.error||text||`HTTP ${r.status}`);
    return data;
  }

  async function loadRent(){
    const grid=document.querySelector('#rentGrid');
    grid.innerHTML='<div class="empty">Загружаем объявления…</div>';
    try{
      const city=document.querySelector('#city').value.trim();
      const type=document.querySelector('#type').value;
      const mode=document.querySelector('#mode').value;
      const data=await rpc('tp_get_rent_feed',{
        p_city:city||null,
        p_type:type||null,
        p_mode:mode||null
      });

      grid.innerHTML='';
      if(!Array.isArray(data)||!data.length){
        grid.innerHTML='<div class="empty">Пока нет опубликованных объявлений по выбранным фильтрам.</div>';
        return;
      }

      for(const x of data){
        const photo=(Array.isArray(x.photos)&&x.photos[0])||'';
        const price=x.price_day
          ? money(x.price_day)+'/день'
          : x.price_month
            ? money(x.price_month)+'/мес'
            : 'Цена по договорённости';

        const card=document.createElement('article');
        card.className='card';
        card.innerHTML=`
          ${photo?`<img src="${esc(photo)}" alt="">`:'<div style="aspect-ratio:16/10;background:#101216"></div>'}
          <div class="p">
            <span class="tag">${x.listing_mode==='offer'?'Сдаю':'Ищу'}</span>
            <span class="tag">${typeNames[x.rent_type]||esc(x.rent_type||'')}</span>
            <h3>${esc(x.title||'Без названия')}</h3>
            <div class="muted">${esc(x.city||'')}${x.metro?' · м. '+esc(x.metro):''}</div>
            <div class="price">${price}</div>
            <a class="btn" href="rent-view.html?n=${encodeURIComponent(x.public_no)}">Подробнее</a>
          </div>`;
        grid.appendChild(card);
      }
    }catch(e){
      console.error(e);
      grid.innerHTML=`<div class="empty">Ошибка загрузки: ${esc(e.message)}</div>`;
    }
  }

  document.addEventListener('DOMContentLoaded',()=>{
    document.querySelector('#apply').onclick=loadRent;
    loadRent();
  });
})();