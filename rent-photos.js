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
    const src=[...files].slice(0,maxCount);
    const out=[];
    for(let i=0;i<src.length;i++){
      const f=await compress(src[i]);
      if(f.size>3*1024*1024)throw new Error(`Фото №${i+1} после сжатия больше 3 МБ`);
      out.push(f);
    }
    return out;
  }

  async function upload(publicNo,files,keepUrls=[]){
    const token=await TPAuth.getAccessToken();
    if(!token)throw new Error("Сессия закончилась. Войдите снова.");

    const fd=new FormData();
    fd.append("public_no",String(publicNo));
    fd.append("keep_urls",JSON.stringify(keepUrls||[]));
    files.forEach((f,i)=>fd.append("photos",f,`rent-${i+1}.webp`));

    const r=await fetch(`${C.supabaseUrl}/functions/v1/rent-upload-photos`,{
      method:"POST",
      headers:{apikey:C.publishableKey,Authorization:`Bearer ${token}`},
      body:fd
    });

    const text=await r.text();
    let data=null;try{data=text?JSON.parse(text):null}catch{data=text}
    if(!r.ok)throw new Error(data?.error||data?.message||text||`HTTP ${r.status}`);
    return data;
  }

  function preview(files,root){
    root.innerHTML="";
    files.forEach(f=>{
      const url=URL.createObjectURL(f);
      const box=document.createElement("div");
      box.className="rent-photo-preview";
      box.innerHTML=`<img src="${url}" alt=""><span>${Math.round(f.size/1024)} KB</span>`;
      root.appendChild(box);
    });
  }

  window.TPRentPhotos={prepare,upload,preview};
})();