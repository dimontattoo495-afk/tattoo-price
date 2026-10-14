(function(){
  const C=window.TP_CONFIG;
  async function compress(file,maxSide=1600,quality=.82){
    const img=await createImageBitmap(file);
    const scale=Math.min(1,maxSide/Math.max(img.width,img.height));
    const canvas=document.createElement("canvas");
    canvas.width=Math.max(1,Math.round(img.width*scale));
    canvas.height=Math.max(1,Math.round(img.height*scale));
    canvas.getContext("2d").drawImage(img,0,0,canvas.width,canvas.height);
    const blob=await new Promise(r=>canvas.toBlob(r,"image/webp",quality));
    if(!blob)throw new Error("Не удалось обработать фотографию");
    return new File([blob],(file.name||"photo").replace(/\.[^.]+$/,"")+".webp",{type:"image/webp"});
  }
  async function prepare(files,maxCount=8){
    const src=[...files].slice(0,maxCount),out=[];
    for(let i=0;i<src.length;i++){
      const f=await compress(src[i]);
      if(f.size>3*1024*1024)throw new Error(`Фото №${i+1} после сжатия больше 3 МБ`);
      out.push(f);
    }
    return out;
  }
  async function upload(publicNo,files,keepUrls=[]){
    const user=await TPAuth.getUser(),token=await TPAuth.getAccessToken();
    if(!user||!token)throw new Error("Сессия закончилась. Войдите снова.");
    const urls=[...(keepUrls||[])];
    for(let i=0;i<files.length;i++){
      const path=`market/${user.id}/${publicNo}/${Date.now()}-${i+1}.webp`;
      const r=await fetch(`${C.supabaseUrl}/storage/v1/object/${C.storageBucket}/${path}`,{
        method:"POST",
        headers:{apikey:C.publishableKey,Authorization:`Bearer ${token}`,"Content-Type":"image/webp","x-upsert":"true"},
        body:files[i]
      });
      const t=await r.text();if(!r.ok)throw new Error(t||`Ошибка загрузки фото ${i+1}`);
      urls.push(`${C.supabaseUrl}/storage/v1/object/public/${C.storageBucket}/${path}`);
    }
    const rr=await fetch(`${C.supabaseUrl}/rest/v1/rpc/tp_market_set_photos`,{
      method:"POST",headers:{apikey:C.publishableKey,Authorization:`Bearer ${token}`,"Content-Type":"application/json"},
      body:JSON.stringify({p_public_no:Number(publicNo),p_photos:urls})
    });
    const rt=await rr.text();if(!rr.ok)throw new Error(rt||"Не удалось сохранить фото");
    return urls;
  }
  function preview(files,root){
    root.innerHTML="";
    files.forEach(f=>{const u=URL.createObjectURL(f),d=document.createElement("div");d.className="rent-photo-preview";d.innerHTML=`<img src="${u}" alt=""><span>${Math.round(f.size/1024)} KB</span>`;root.appendChild(d);});
  }
  window.TPMarketPhotos={prepare,upload,preview};
})();