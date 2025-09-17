// src/App.js

// ---------------- fetch & helpers ----------------
const fetchJSON = async (path) => {
  const r = await fetch(path, { cache: "no-store" });
  if (!r.ok) throw new Error(`${path} ${r.status}`);
  return r.json();
};
const isArray = Array.isArray;
const normalizeBooks = (x) => (isArray(x) ? x : (x && isArray(x.books)) ? x.books : []);
const normalizeBranches = (x) => (isArray(x) ? x : (x && isArray(x.branches)) ? x.branches : []);

// 공백/대소문자 차이 줄이기
function norm(v) { return v == null ? "" : String(v).trim().replace(/\s+/g, " "); }

// element 유틸
function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const k in attrs) node.setAttribute(k, attrs[k]);
  children.flat(10).forEach((ch) => {
    if (ch == null) return;
    if (typeof ch === "string") node.appendChild(document.createTextNode(ch));
    else node.appendChild(ch);
  });
  return node;
}
function chip(text, active = false, onClick = null, ghost = false) {
  const c = el(
    "button",
    { class: `chip ${active ? "active" : ""} ${ghost ? "ghost" : ""}`, type: "button", "aria-pressed": active, title: text, ...(ghost ? { disabled: true } : {}) },
    text
  );
  if (onClick && !ghost) c.addEventListener("click", onClick);
  return c;
}
function badge(text) { return el("span", { class: "badge" }, text || ""); }

function showError(root, msg) {
  root.innerHTML = "";
  root.append(
    el("div",
      { style: "color:#b00020;white-space:pre-wrap;background:#fff;border:1px solid #fecaca;padding:12px;border-radius:10px" },
      msg
    )
  );
}

// -------------- Aladin cover cache (localStorage, 30일) --------------
const LS_KEY = "aladin-cover-cache-v1";
const TTL = 1000 * 60 * 60 * 24 * 30;
function lsGetMap(){
  try{ return new Map(Object.entries(JSON.parse(localStorage.getItem(LS_KEY) || "{}"))); }
  catch{ return new Map(); }
}
function lsSetMap(m){
  const obj = Object.fromEntries(m);
  localStorage.setItem(LS_KEY, JSON.stringify(obj));
}
async function getCover(isbn){
  if (!isbn) return "";
  const map = lsGetMap();
  const entry = map.get(isbn);
  const now = Date.now();
  if (entry && entry.url && (now - (entry.ts||0)) < TTL) return entry.url;

  // serverless fetch (키 노출 방지)
  const r = await fetch(`/api/aladin-cover?isbn=${encodeURIComponent(isbn)}`);
  const j = await r.json();
  const url = j?.cover || "";
  if (url){
    map.set(isbn, { url, ts: now });
    lsSetMap(map);
  }
  return url;
}

// ---------------- 상세 집계 / 모달 / 요약 ----------------
const detailCache = new Map(); // isbn -> detail json

async function fetchDetail(isbn) {
  if (!isbn) return null;
  if (detailCache.has(isbn)) return detailCache.get(isbn);
  const r = await fetch(`/api/book-detail?isbn=${encodeURIComponent(isbn)}`);
  const j = await r.json();
  detailCache.set(isbn, j);
  return j;
}

// HTML 이스케이프
function escapeHtml(s){ return (s||"").replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function escapeAttr(s){ return escapeHtml(s); }

// 카드 안에 요약 드롭다운 채우기
async function toggleSummary(cardEl, book) {
  const sum = cardEl.querySelector(".summary");
  const isOpen = cardEl.classList.contains("open");
  if (isOpen) { cardEl.classList.remove("open"); return; }

  // 처음 열 때만 로드
  if (!sum.dataset.ready) {
    sum.innerHTML = "불러오는 중…";
    const d = await fetchDetail(book.isbn);
    const desc = d?.description || "(소개 정보 없음)";
    const tocHtml = (d?.toc?.length)
      ? `<ul class="toc">${d.toc.slice(0,8).map(t => `<li>• ${escapeHtml(t.title)}${t.pagenum ? ` (${escapeHtml(t.pagenum)})` : ""}</li>`).join("")}</ul>`
      : '<div class="toc muted">목차 정보 없음</div>';
    sum.innerHTML = `
      <div style="white-space:pre-wrap">${escapeHtml(desc).slice(0, 700)}${desc.length>700?'…':''}</div>
      ${tocHtml}
    `;
    sum.dataset.ready = "1";
  }

  cardEl.classList.add("open");
}

// 상세 모달 열기
function openDetailModal(detail) {
  const root = document.getElementById("modal-root");
  const body = document.getElementById("modal-body");
  body.innerHTML = `
    <div class="modal-grid">
      <img class="cover-lg" alt="표지" src="${escapeAttr(detail.cover?.best || "")}">
      <div>
        <h3>${escapeHtml(detail.title || "")}</h3>
        <div class="kv">저자: ${escapeHtml(detail.author || "-")} · 출판사: ${escapeHtml(detail.publisher || "-")} ${detail.pubYear?`(${escapeHtml(detail.pubYear)})`:""}</div>
        <div class="kv" style="margin-top:12px;white-space:pre-wrap">${escapeHtml(detail.description || "소개 정보 없음")}</div>
        <div class="toc">
          <strong>목차</strong>
          ${
            (detail.toc && detail.toc.length)
            ? `<ul>${detail.toc.map(t => `<li>• ${escapeHtml(t.title)}${t.pagenum?` (${escapeHtml(t.pagenum)})`:""}</li>`).join("")}</ul>`
            : `<div class="muted">목차 정보 없음</div>`
          }
        </div>
        <div class="ext" style="margin-top:10px">
          ${detail.externalLinks?.aladin ? `<a target="_blank" rel="noopener" href="${escapeAttr(detail.externalLinks.aladin)}">알라딘</a>`:""}
          ${detail.externalLinks?.openLibrary ? `<a target="_blank" rel="noopener" href="${escapeAttr(detail.externalLinks.openLibrary)}">OpenLibrary</a>`:""}
        </div>
      </div>
    </div>
  `;
  root.style.display = "flex";
  root.setAttribute("aria-hidden","false");
  // 포커스
  root.querySelector(".modal-close")?.focus();
}

// 모달 닫기/바인딩
function bindModal() {
  const root = document.getElementById("modal-root");
  if (!root) return;
  const closeBtn = root.querySelector(".modal-close");
  const close = () => {
    root.style.display = "none";
    root.setAttribute("aria-hidden","true");
  };
  closeBtn?.addEventListener("click", close);
  root.addEventListener("click", (e) => { if (e.target === root) close(); });
  document.addEventListener("keydown", (e) => {
    if (root.style.display === "flex" && e.key === "Escape") close();
  });
}

// ------- 결과 카드 생성 -------
function makeBookCard(b) {
  const elCard = document.createElement("div");
  elCard.className = "card";
  elCard.style.position = "relative";
  const isbnClean = (b.isbn || b.isbn13 || "").replace(/[^0-9Xx]/g,"");

  elCard.innerHTML = `
    <button class="more-btn" title="상세보기" aria-label="상세보기">i</button>
    <div style="display:flex;align-items:center;gap:12px">
      <img class="cover" alt="표지" data-isbn="${escapeAttr(isbnClean)}" loading="lazy">
      <div>
        <div style="font-weight:700;font-size:18px">${escapeHtml(b.title || "제목 없음")}</div>
        <div class="muted" style="margin-top:4px">저자: ${escapeHtml(b.author || "-")} · 출판사: ${escapeHtml(b.publisher || "-")}${b.year?` (${escapeHtml(b.year)})`:""}</div>
      </div>
    </div>
    <div class="badges" style="margin-top:8px">${[b.branch,b.theme,b.subTheme].filter(Boolean).map(t=>`<span class="badge">${escapeHtml(t)}</span>`).join("")}</div>
    <div class="summary" aria-live="polite"></div>
  `;

  // 카드 클릭 → 요약 토글
  elCard.addEventListener("click", (e) => {
    const isMore = (e.target.closest(".more-btn") != null);
    if (isMore) return; // 상세 버튼은 별도 처리
    toggleSummary(elCard, b);
  });

  // 상세 버튼 → 모달
  elCard.querySelector(".more-btn").addEventListener("click", async (e) => {
    e.stopPropagation();
    const d = await fetchDetail(isbnClean || b.isbn);
    openDetailModal(d || {});
  });

  return elCard;
}

// ---------------- main ----------------
export default async function render(root) {
  // 상태
  let state = {
    q: "",
    branch: "전체",
    subTheme: "전체",
    searchMode: "title", // 'title' | 'theme' | 'sub' | 'all'
    books: [],
    branches: [],
  };

  // 데이터 로드
  try {
    const [rawBooks, rawBranches] = await Promise.all([
      fetchJSON("/src/data/books.json"),
      fetchJSON("/src/data/branches.json"),
    ]);
    state.books = normalizeBooks(rawBooks);
    state.branches = normalizeBranches(rawBranches);
  } catch (e) {
    showError(root, "데이터 로드 오류: " + (e.message || e));
    return;
  }

  // 뼈대
  root.innerHTML = "";
  const modeRow = el("div", { class: "row" }, el("div", { class: "label" }, "검색 대상"), el("div", { class: "chips", id: "modeBar" }));
  const searchInput = el("input", { class: "search", placeholder: placeholderFor(state.searchMode), value: state.q });
  const branchRow = el("div", { class: "row" }, el("div", { class: "label" }, "지점(인생테마)"), el("div", { class: "chips", id: "branchBar" }));
  const subRow = el("div", { class: "row" }, el("div", { class: "label" }, "소분류"), el("div", { class: "chips", id: "subBar" }));
  const tools = el("div", { class: "toolbar" }, el("button", { class: "btn", id: "resetBtn" }, "필터 초기화"));
  const info = el("div", { class: "muted", id: "meta" });
  const results = el("div", { class: "results", id: "results" });

  root.append(modeRow, searchInput, el("div", { style: "height:10px" }), branchRow, subRow, tools, el("div", { style: "height:6px" }), info, results);

  // 모달 바인딩
  bindModal();

  // 이벤트
  searchInput.addEventListener("input", () => { state.q = searchInput.value.trim(); paint(); });
  tools.querySelector("#resetBtn").addEventListener("click", () => {
    state.q = ""; state.branch = "전체"; state.subTheme = "전체"; state.searchMode = "title";
    searchInput.value = ""; searchInput.placeholder = placeholderFor(state.searchMode);
    paint();
  });

  function paint(){ paintSearchModeChips(); paintBranchChips(); paintSubThemeChips(); paintResults(); }

  // 🔹 검색 대상 칩
  function paintSearchModeChips(){
    const bar = root.querySelector("#modeBar"); bar.innerHTML = "";
    [["도서명","title"],["인생테마","theme"],["소분류","sub"],["통합검색","all"]]
    .forEach(([label,key]) => {
      bar.append(chip(label, state.searchMode===key, () => {
        state.searchMode = key;
        // 즉시 칩 활성화 + placeholder 반영 + 목록 갱신
        searchInput.placeholder = placeholderFor(state.searchMode);
        paintSearchModeChips();   // ✅ 누르자마자 초록색 반영
        paintResults();
        searchInput.focus();
      }));
    });
  }

  function placeholderFor(mode){
    switch(mode){
      case "title": return "도서명으로 검색하세요";
      case "theme": return "인생테마로 검색하세요 (예: 테마:명상)";
      case "sub":   return "소분류로 검색하세요 (예: 명상(침묵), 그림책)";
      case "all":   return "도서명/저자/출판사/지점/소분류(테마)까지 통합검색";
      default:      return "검색어를 입력하세요";
    }
  }

  function paintBranchChips(){
    const bar = root.querySelector("#branchBar"); bar.innerHTML = "";
    bar.append(chip("전체", state.branch==="전체", () => { state.branch="전체"; state.subTheme="전체"; paint(); }));
    state.branches.forEach((b) => {
      const name = b.branch || b.name || ""; const theme = b.lifeTheme || b.theme || "";
      const label = theme ? `${name} (${theme})` : name;
      bar.append(chip(label, state.branch===name, () => { state.branch=name; state.subTheme="전체"; paint(); }));
    });
  }

  // 지점별 소분류: 정의(curated) + 데이터 실측 facet 유니온
  function paintSubThemeChips(){
    const bar = root.querySelector("#subBar"); bar.innerHTML = "";
    const active = state.branch==="전체" ? null : state.branches.find((b)=> (b.branch||b.name)===state.branch);

    if (!active){
      bar.append(chip("전체", state.subTheme==="전체", () => { state.subTheme="전체"; paint(); }));
      bar.append(chip("지점을 먼저 선택하세요", false, null, true));
      return;
    }

    const inBranch = state.books.filter((bk)=> norm(bk.branch)===norm(state.branch));
    const facetCount = new Map();
    inBranch.forEach((bk)=>{ const f = norm(bk.subTheme) || norm(bk.theme); if (!f) return; facetCount.set(f,(facetCount.get(f)||0)+1); });

    bar.append(chip("전체", state.subTheme==="전체", () => { state.subTheme="전체"; paint(); }));

    const curated = Array.isArray(active.subThemes) ? active.subThemes : [];
    const seen = new Set();
    curated.forEach((raw) => {
      const label = String(raw); const key = norm(label); const hasBooks = facetCount.has(key); seen.add(key);
      bar.append(chip(label, state.subTheme===label, hasBooks ? () => { state.subTheme=label; paint(); } : null, !hasBooks));
    });

    Array.from(facetCount.keys()).filter((k)=>!seen.has(k)).sort().forEach((k)=>{
      bar.append(chip(k, state.subTheme===k, () => { state.subTheme=k; paint(); }));
    });
  }


  
  // App.js 안의 paintResults 함수를 이 버전으로 교체하세요.
  function paintResults(){
    const { q, branch, subTheme, searchMode, books } = state;
    const s = norm(q).toLowerCase(); 
    const selBranch = norm(branch); 
    const selSub = norm(subTheme);
  
    const filtered = books.filter((b) => {
      const bTitle = norm(b.title);
      const bAuthor = norm(b.author);
      const bPublisher = norm(b.publisher);
      const bBranch = norm(b.branch);
      const bTheme = norm(b.theme);
      const bSub = norm(b.subTheme);
  
      let matchesQ = true;
      if (s){
        if (searchMode==="title") matchesQ = bTitle.toLowerCase().includes(s);
        else if (searchMode==="theme") matchesQ = bTheme.toLowerCase().includes(s);
        else if (searchMode==="sub") { 
          const f=(bSub||bTheme).toLowerCase(); 
          matchesQ = f.includes(s); 
        }
        else { // 'all' 통합검색: 도서명/저자/출판사/지점/소분류(없으면 테마)
          const f = (bSub || bTheme);
          matchesQ = [bTitle, bAuthor, bPublisher, bBranch, f].some(v => (v||"").toLowerCase().includes(s));
        }
      }
  
      const matchesBranch = selBranch==="전체" ? true : bBranch===selBranch;
      const bookFacet = bSub || bTheme;
      const matchesSub = selSub==="전체" ? true : norm(bookFacet)===selSub;
  
      return matchesQ && matchesBranch && matchesSub;
    });
  
    // 메타 갱신
    const metaEl = root.querySelector("#meta");
    metaEl.textContent = `총 ${filtered.length}권의 도서가 검색되었습니다.`;
  
    // 결과 그리기 (한 번에 교체)
    const box = root.querySelector("#results");
    const frag = document.createDocumentFragment();
  
    if (filtered.length === 0) {
      const empty = document.createElement("div");
      empty.className = "empty";
      empty.textContent = "조건에 맞는 도서가 없습니다.";
      frag.appendChild(empty);
      box.replaceChildren(frag);
      return;
    }
  
    const imgs = [];
    filtered.slice(0, 100).forEach((b) => {
      const card = makeBookCard(b);
      frag.appendChild(card);
      const img = card.querySelector("img.cover");
      if (img) imgs.push(img);
    });
  
    box.replaceChildren(frag);
  
    // 표지 지연 로딩
    lazyLoadCovers(imgs);
  }

  function lazyLoadCovers(imgs){
    if (!imgs.length) return;

    const load = async (img) => {
      const isbn = img.getAttribute("data-isbn");
      if (!isbn) return;
      const url = await getCover(isbn);
      if (url) {
        img.src = url;
        img.onerror = () => { img.style.display="none"; }; // 실패시 숨김
      } else {
        img.style.display = "none";
      }
    };

    if ("IntersectionObserver" in window){
      const io = new IntersectionObserver((entries) => {
        entries.forEach(e => {
          if (e.isIntersecting){
            io.unobserve(e.target);
            load(e.target);
          }
        });
      }, { rootMargin: "200px 0px" });
      imgs.forEach(img => io.observe(img));
    } else {
      imgs.forEach(load);
    }
  }

  // 최초 렌더
  paint();
}
