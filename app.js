(() => {
  const $ = (id) => document.getElementById(id);
  const state = { videos: [], liked: new Set(JSON.parse(localStorage.getItem("animatube-liked") || "[]")), view: "home", selectedFile: null };
  const DEFAULT_API_URL = "http://78.154.103.19:12978";
  const apiBase = () => (localStorage.getItem("animatube-api") || DEFAULT_API_URL).replace(/\/+$/, "");
  const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const openModal = id => $(id).classList.add("open");
  const closeModal = id => $(id).classList.remove("open");

  function normalizeVideo(item, index) {
    const raw = typeof item === "string" ? item : (item.url || item.video || item.src || "");
    const url = raw.startsWith("http") ? raw : apiBase() + (raw.startsWith("/") ? raw : "/" + raw);
    return { id: String(item.id ?? item.filename ?? index), title: item.title || item.name || item.filename || `Анимация ${index + 1}`, url, created: item.created_at || item.date || "" };
  }

  function visibleVideos() {
    const q = $("searchInput").value.trim().toLowerCase();
    return state.videos.filter(v => (state.view !== "liked" || state.liked.has(v.id)) && (!q || v.title.toLowerCase().includes(q)));
  }

  function render() {
    const list = visibleVideos();
    $("resultCount").textContent = `${list.length} ${list.length === 1 ? "видео" : "видео"}`;
    const titles = {home:["DISCOVER","Популярные анимации"],tiktok:["VERTICAL FEED","TikTok режим"],youtube:["WATCH & ENJOY","YouTube режим"],liked:["YOUR COLLECTION","Понравилось"]};
    $("sectionEyebrow").textContent = titles[state.view][0];
    $("sectionTitle").textContent = titles[state.view][1];
    $("hero").style.display = state.view === "home" ? "" : "none";
    document.querySelectorAll(".nav-item").forEach(b => b.classList.toggle("active", b.dataset.view === state.view));
    if (!list.length) {
      $("videoGrid").innerHTML = `<div class="empty-state"><div class="empty-icon">✧</div><h3>${state.view === "liked" ? "Пока ничего не понравилось" : "Здесь пока пусто"}</h3><p>${apiBase() ? "Загрузи первую HTML-анимацию или проверь подключение API." : "Подключи API-сервер в настройках или загрузи свою анимацию."}</p></div>`;
      return;
    }
    $("videoGrid").innerHTML = list.map((v,i) => `<article class="video-card"><div class="thumb" data-play="${escapeHtml(v.id)}"><span class="thumb-symbol">${["◈","✦","◎","✧","◇"][i%5]}</span><span class="play-bubble">▶</span></div><div class="card-meta"><div class="card-title" title="${escapeHtml(v.title)}">${escapeHtml(v.title)}</div><div class="card-sub"><span>HTML animation</span><button class="like-button ${state.liked.has(v.id)?"liked":""}" data-like="${escapeHtml(v.id)}" aria-label="Нравится">${state.liked.has(v.id)?"♥":"♡"}</button></div></div></article>`).join("");
    $("videoGrid").querySelectorAll("[data-play]").forEach(el => el.addEventListener("click", () => playVideo(el.dataset.play)));
    $("videoGrid").querySelectorAll("[data-like]").forEach(el => el.addEventListener("click", e => { e.stopPropagation(); toggleLike(el.dataset.like); }));
  }

  async function loadVideos() {
    if (!apiBase()) { state.videos=[]; render(); return; }
    $("videoGrid").innerHTML = '<div class="empty-state"><div class="empty-icon">◌</div><h3>Загружаем анимации</h3><p>Получаем список с сервера...</p></div>';
    try {
      const response = await fetch(apiBase()+"/api/videos");
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      const items = Array.isArray(data) ? data : (data.videos || data.items || []);
      state.videos = items.map(normalizeVideo);
      render();
    } catch (error) {
      $("videoGrid").innerHTML = `<div class="empty-state"><div class="empty-icon">!</div><h3>Не удалось подключиться</h3><p>${escapeHtml(error.message)}. Проверь API URL и CORS на сервере.</p><button class="filter-button" id="retryLoad">Повторить</button></div>`;
      $("retryLoad").addEventListener("click", loadVideos);
    }
  }

  function toggleLike(id) {
    state.liked.has(id) ? state.liked.delete(id) : state.liked.add(id);
    localStorage.setItem("animatube-liked", JSON.stringify([...state.liked]));
    render();
  }
  function playVideo(id) {
    const video = state.videos.find(v => v.id === id);
    if (!video) return;
    $("viewerVideo").src = video.url;
    $("viewerInfo").textContent = video.title;
    $("viewer").classList.add("open");
    $("viewerVideo").play().catch(()=>{});
  }

  function selectFile(file) {
    if (!file) return;
    if (!/\.html?$/i.test(file.name)) { $("uploadStatus").textContent = "Нужен файл с расширением .html или .htm"; return; }
    if (file.size > 20*1024*1024) { $("uploadStatus").textContent = "Размер файла превышает 20 МБ"; return; }
    state.selectedFile=file;
    $("fileName").textContent=file.name;
    $("uploadButton").disabled=false;
    $("uploadStatus").textContent="";
  }

  async function uploadFile() {
    if (!state.selectedFile) return;
    if (!apiBase()) { $("uploadStatus").textContent="Сначала укажи API URL в настройках."; return; }
    const button=$("uploadButton"), progress=$("uploadProgress"), bar=progress.firstElementChild;
    button.disabled=true; progress.classList.add("visible"); bar.style.width="15%"; $("uploadStatus").textContent="Отправляем HTML на сервер...";
    const body=new FormData(); body.append("file",state.selectedFile);
    try {
      const response=await fetch(apiBase()+"/api/upload",{method:"POST",body});
      bar.style.width="85%";
      const result=await response.json().catch(()=>({}));
      if(!response.ok) throw new Error(result.error || result.message || `HTTP ${response.status}`);
      bar.style.width="100%"; $("uploadStatus").textContent=result.message || "Файл принят сервером. Обновляем библиотеку...";
      state.selectedFile=null; $("htmlFile").value=""; $("fileName").textContent="Файл не выбран";
      setTimeout(async()=>{closeModal("uploadModal");progress.classList.remove("visible");bar.style.width="0";button.disabled=true;await loadVideos();},900);
    } catch(error) {
      $("uploadStatus").textContent="Ошибка загрузки: "+error.message+" (проверь API и CORS)";
      button.disabled=false; progress.classList.remove("visible");
    }
  }

  document.querySelectorAll(".nav-item").forEach(b=>b.addEventListener("click",()=>{state.view=b.dataset.view;render();}));
  ["openUpload","heroUpload"].forEach(id=>$(id).addEventListener("click",()=>openModal("uploadModal")));
  $("exploreButton").addEventListener("click",()=>{document.querySelector(".content-section").scrollIntoView({behavior:"smooth"});});
  $("settingsButton").addEventListener("click",()=>{ $("apiUrl").value=apiBase(); openModal("settingsModal"); });
  $("saveSettings").addEventListener("click",()=>{const value=$("apiUrl").value.trim().replace(/\/+$/,"");if(value&&!/^https?:\/\//i.test(value)){ $("settingsStatus").textContent="URL должен начинаться с https:// или http://";return;}localStorage.setItem("animatube-api",value);$("settingsStatus").textContent="Сохранено. Проверяем соединение...";setTimeout(()=>{closeModal("settingsModal");loadVideos();},500);});
  $("refreshButton").addEventListener("click",loadVideos);
  $("searchInput").addEventListener("input",render);
  $("htmlFile").addEventListener("change",e=>selectFile(e.target.files[0]));
  $("dropZone").addEventListener("click",()=> $("htmlFile").click());
  $("dropZone").addEventListener("dragover",e=>{e.preventDefault();$("dropZone").classList.add("dragover");});
  $("dropZone").addEventListener("dragleave",()=> $("dropZone").classList.remove("dragover"));
  $("dropZone").addEventListener("drop",e=>{e.preventDefault();$("dropZone").classList.remove("dragover");selectFile(e.dataTransfer.files[0]);});
  $("uploadButton").addEventListener("click",uploadFile);
  document.querySelectorAll("[data-close]").forEach(b=>b.addEventListener("click",()=>closeModal(b.dataset.close)));
  document.querySelectorAll(".modal-backdrop").forEach(m=>m.addEventListener("click",e=>{if(e.target===m)m.classList.remove("open");}));
  $("viewerClose").addEventListener("click",()=>{$("viewerVideo").pause();$("viewerVideo").removeAttribute("src");$("viewer").classList.remove("open");});
  document.addEventListener("keydown",e=>{if(e.key==="Escape"){closeModal("uploadModal");closeModal("settingsModal");$("viewerClose").click();}});
  loadVideos();
})();