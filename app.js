
const data = [
 {img:"work1.svg",city:"Москва",style:"Реализм",price:20000,title:"Черно-серый реализм · полный день",desc:"Свободное окно на большую работу. Индивидуальный эскиз включён.",master:"Дмитрий А.",hot:true},
 {img:"work2.svg",city:"Санкт-Петербург",style:"Old School",price:15000,title:"Old School · предплечье",desc:"Яркий классический old school. Помогу адаптировать сюжет под анатомию.",master:"Max Ink"},
 {img:"work3.svg",city:"Москва",style:"Графика",price:12000,title:"Графика · авторский эскиз",desc:"Свободный эскиз. Размер и детали можно адаптировать.",master:"Lena Black"},
 {img:"work4.svg",city:"Казань",style:"Орнаментал",price:18000,title:"Орнаментал · плечо",desc:"Сеанс 5–6 часов. Консультация перед записью бесплатно.",master:"Ramil Tattoo"},
 {img:"work5.svg",city:"Москва",style:"Реализм",price:30000,title:"Реализм · крупный проект",desc:"Цена за сеанс. Большие проекты делятся на несколько встреч.",master:"North Tattoo",hot:true},
 {img:"work6.svg",city:"Санкт-Петербург",style:"Графика",price:10000,title:"Минимализм и графика",desc:"Небольшие и средние проекты. Есть свободные эскизы.",master:"Nika Line"}
];

function money(n){return new Intl.NumberFormat("ru-RU").format(n)+" ₽"}
function render(){
 const q=document.querySelector("#search").value.toLowerCase().trim();
 const city=document.querySelector("#city").value;
 const style=document.querySelector("#style").value;
 const p=Number(document.querySelector("#price").value||0)*1000;
 const list=data.filter(x=>
   (!q || (x.title+" "+x.desc+" "+x.master).toLowerCase().includes(q)) &&
   (!city || x.city===city) && (!style || x.style===style) && (!p || x.price<=p)
 );
 document.querySelector("#count").textContent=list.length+" объявлений";
 document.querySelector("#cards").innerHTML=list.map((x,i)=>`
  <article class="card">
    <a href="./listing.html"><img class="cover" src="./assets/${x.img}" alt=""></a>
    <div class="cardbody">
      <div class="tags"><span class="tag">${x.city}</span><span class="tag">${x.style}</span>${x.hot?'<span class="tag hot">TOP</span>':''}</div>
      <div class="title">${x.title}</div>
      <div class="price">от ${money(x.price)}</div>
      <div class="desc">${x.desc}</div>
      <div class="master"><strong>${x.master}</strong><a class="btn secondary" href="./listing.html">Смотреть</a></div>
    </div>
  </article>`).join("") || '<div class="panel">Ничего не найдено. Попробуйте изменить фильтры.</div>';
}
["search","city","style","price"].forEach(id=>document.querySelector("#"+id).addEventListener("input",render));
render();
