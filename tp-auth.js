(function(){
  const C = window.TP_CONFIG;
  const K = {
    access: "tp_auth_access_v1",
    refresh: "tp_auth_refresh_v1",
    expires: "tp_auth_expires_v1",
    user: "tp_auth_user_v1"
  };

  function saveSession(data){
    if(!data) return;
    if(data.access_token) localStorage.setItem(K.access, data.access_token);
    if(data.refresh_token) localStorage.setItem(K.refresh, data.refresh_token);
    const expiresAt = data.expires_at
      ? Number(data.expires_at) * 1000
      : Date.now() + Number(data.expires_in || 3600) * 1000;
    localStorage.setItem(K.expires, String(expiresAt));
    if(data.user) localStorage.setItem(K.user, JSON.stringify(data.user));
  }

  function clearSession(){
    Object.values(K).forEach(k=>localStorage.removeItem(k));
  }

  async function request(path, {method="GET", body=null, token=null}={}){
    const headers = {"apikey": C.publishableKey};
    if(body !== null) headers["Content-Type"] = "application/json";
    if(token) headers["Authorization"] = `Bearer ${token}`;
    const r = await fetch(`${C.supabaseUrl}${path}`, {
      method, headers, body: body === null ? undefined : JSON.stringify(body)
    });
    const text = await r.text();
    let data = null;
    try{ data = text ? JSON.parse(text) : null; }catch{ data = text; }
    if(!r.ok){
      const msg = data?.msg || data?.message || data?.error_description || data?.error || text || `HTTP ${r.status}`;
      const e = new Error(msg); e.status = r.status; throw e;
    }
    return data;
  }

  async function refresh(){
    const refreshToken = localStorage.getItem(K.refresh);
    if(!refreshToken) return null;
    try{
      const data = await request('/auth/v1/token?grant_type=refresh_token', {
        method:'POST', body:{refresh_token:refreshToken}
      });
      saveSession(data);
      return data.access_token || null;
    }catch(e){ clearSession(); return null; }
  }

  async function getAccessToken(){
    const token = localStorage.getItem(K.access);
    if(!token) return null;
    const expiresAt = Number(localStorage.getItem(K.expires)||0);
    if(expiresAt && Date.now() < expiresAt - 60000) return token;
    return await refresh();
  }

  async function getUser(){
    const token = await getAccessToken();
    if(!token) return null;
    try{
      const user = await request('/auth/v1/user', {token});
      localStorage.setItem(K.user, JSON.stringify(user));
      return user;
    }catch(e){ clearSession(); return null; }
  }

  async function signIn(email,password){
    const data = await request('/auth/v1/token?grant_type=password', {
      method:'POST', body:{email:String(email||'').trim(),password:String(password||'')}
    });
    saveSession(data); return data;
  }

  async function signUp(email,password){
    const data = await request('/auth/v1/signup', {
      method:'POST', body:{email:String(email||'').trim(),password:String(password||''),data:{account_type:'master'}}
    });
    if(data?.access_token) saveSession(data);
    return data;
  }

  async function signOut(){
    const token = await getAccessToken();
    try{ if(token) await request('/auth/v1/logout',{method:'POST',token}); }catch(e){}
    clearSession();
  }

  function cachedUser(){
    try{return JSON.parse(localStorage.getItem(K.user)||'null')}catch{return null}
  }

  window.TPAuth={signIn,signUp,signOut,getUser,getAccessToken,cachedUser,clearSession};
})();
