(function(){
  if(location.hostname!=="price.smoke-tattoo.ru")return;
  const path=location.pathname.toLowerCase();
  if(path==="/"||path.endsWith("/index.html"))return;
  const beacon=new Image();
  beacon.referrerPolicy="origin";
  beacon.src="https://www.stats4u.net/c/5486364719-950.png?form=doppel&pal=night";
})();