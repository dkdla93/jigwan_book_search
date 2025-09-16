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

// -------------- Cover cache (localStorage, 30일) --------------
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

  // serverless fetch
  const r = await fetch(`/api/aladin-cover?isbn=${encodeURIComponent(isbn)}`);
  const j = await r.json();
  const url = j?.cover || "";
  if (url){
    map.set(isbn, { url, ts: now });
    lsSetMap(map);
  }
  return url;
}

const detailCache = new Map();
async function getBookDetail(isbn){
  const key = (isbn || "").trim();
  if (!key) throw new Error("ISBN이 없어 상세 정보를 불러올 수 없습니다.");
  const cached = detailCache.get(key);
  if (cached) return cached;

  const loader = (async () => {
    const r = await fetch(`/api/aladin-detail?isbn=${encodeURIComponent(key)}`);
    if (!r.ok) throw new Error(`상세 정보 요청 실패(${r.status})`);
    const data = await r.json();
    if (!data?.ok) throw new Error(data?.error || "상세 정보를 불러오지 못했습니다.");
    return data;
  })();

  detailCache.set(key, loader);

  try {
    const data = await loader;
    detailCache.set(key, data);
    return data;
  } catch (err) {
    detailCache.delete(key);
    throw err;
  }
}

function sanitizeDetailText(text){
  if (!text) return "";
  let s = String(text);
  s = s.replace(/<\s*br\s*\/?\s*>/gi, "\n");
  s = s.replace(/<\s*\/p\s*>/gi, "\n\n");
  s = s.replace(/<[^>]+>/g, " ");
  s = s.replace(/&nbsp;/gi, " ");
  s = s.replace(/\r?\n\s*\r?\n/g, "\n\n");
  return s.replace(/[\t\r]+/g, " ");
}

function truncateText(text, limit = 360){
  if (!text) return "";
  const trimmed = text.trim();
  if (trimmed.length <= limit) return trimmed;
  return trimmed.slice(0, limit).trimEnd() + "…";
}

function buildParagraphs(text){
  if (!text) return [];
  return text
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => el("p", { class: "summary-text-line" }, line));
}

// ---------------- main ----------------
export default async function render(root) {
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
    return showError(root, "데이터 로드 오류: " + (e.message || e));
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

  // 이벤트
  searchInput.addEventListener("input", () => { state.q = searchInput.value.trim(); paint(); });
  tools.querySelector("#resetBtn").addEventListener("click", () => {
    state.q = ""; state.branch = "전체"; state.subTheme = "전체"; state.searchMode = "title";
    searchInput.value = ""; searchInput.placeholder = placeholderFor(state.searchMode);
    paint();
  });

  function paint(){ paintSearchModeChips(); paintBranchChips(); paintSubThemeChips(); paintResults(); }

  function paintSearchModeChips(){
    const bar = root.querySelector("#modeBar"); bar.innerHTML = "";
    [["도서명","title"],["인생테마","theme"],["소분류","sub"],["통합검색","all"]]
    .forEach(([label,key]) => {
      bar.append(chip(label, state.searchMode===key, () => {
        state.searchMode = key;
        searchInput.placeholder = placeholderFor(state.searchMode);
        paintSearchModeChips();   // 즉시 칩 UI 반영
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

  function paintResults(){
    const { q, branch, subTheme, searchMode, books } = state;
    const s = norm(q).toLowerCase(); const selBranch = norm(branch); const selSub = norm(subTheme);

    const filtered = books.filter((b) => {
      const bTitle = norm(b.title); const bAuthor = norm(b.author); const bPublisher = norm(b.publisher);
      const bBranch = norm(b.branch); const bTheme = norm(b.theme); const bSub = norm(b.subTheme);

      let matchesQ = true;
      if (s){
        if (searchMode==="title") matchesQ = bTitle.toLowerCase().includes(s);
        else if (searchMode==="theme") matchesQ = bTheme.toLowerCase().includes(s);
        else if (searchMode==="sub") { const f=(bSub||bTheme).toLowerCase(); matchesQ = f.includes(s); }
        else { // all
          const f = (bSub || bTheme);
          matchesQ = [bTitle, bAuthor, bPublisher, bBranch, f].some(v => (v||"").toLowerCase().includes(s));
        }
      }

      const matchesBranch = selBranch==="전체" ? true : bBranch===selBranch;
      const bookFacet = bSub || bTheme;
      const matchesSub = selSub==="전체" ? true : norm(bookFacet)===selSub;

      return matchesQ && matchesBranch && matchesSub;
    });

    const metaEl = root.querySelector("#meta");
    const box = root.querySelector("#results");
    metaEl.textContent = `총 ${filtered.length}권의 도서가 검색되었습니다.`;

    box.innerHTML = "";
    const imgs = [];
    filtered.slice(0, 100).forEach((b, idx) => {
      const badges = [norm(b.branch), norm(b.theme), norm(b.subTheme)].filter(Boolean);
      const safeIsbn = (b.isbn || b.isbn13 || "").replace(/[^0-9Xx]/g, "");
      const summaryId = `summary-${safeIsbn || idx}`;

      const img = el("img", {
        class: "cover",
        alt: b.title ? `${b.title} 표지` : "표지",
        "data-isbn": safeIsbn,
        loading: "lazy",
      });
      imgs.push(img);

      const title = el("div", { class: "card-title" }, b.title || "제목 없음");
      const meta = el(
        "div",
        { class: "card-meta muted" },
        `저자: ${b.author || "-"} · 출판사: ${b.publisher || "-"}${b.year ? ` (${b.year})` : ""}`
      );
      const infoCol = el("div", { class: "card-info" }, title, meta);
      const mainInner = el("div", { class: "card-main-inner" }, img, infoCol);
      const indicator = el("span", { class: "summary-indicator", "aria-hidden": "true" });

      const main = el(
        "div",
        {
          class: "card-main",
          role: "button",
          tabindex: "0",
          "aria-expanded": "false",
          "aria-controls": summaryId,
        },
        mainInner,
        indicator
      );

      const detailIcon = el("span", { class: "detail-btn-icon", "aria-hidden": "true" });
      detailIcon.innerHTML = `
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.6" fill="none"></circle>
          <rect x="11.25" y="10" width="1.5" height="6" rx="0.75" fill="currentColor"></rect>
          <circle cx="12" cy="8" r="1.1" fill="currentColor"></circle>
        </svg>
      `;
      const detailBtn = el(
        "button",
        {
          class: "detail-btn",
          type: "button",
          title: "상세 페이지로 이동",
          "aria-label": `${b.title || "해당 도서"} 상세 페이지 열기`,
        },
        detailIcon
      );

      if (!safeIsbn) {
        detailBtn.disabled = true;
        detailBtn.classList.add("disabled");
        detailBtn.setAttribute("title", "ISBN 정보가 없어 상세 페이지를 열 수 없습니다.");
      } else {
        detailBtn.addEventListener("click", (ev) => {
          ev.stopPropagation();
          window.location.href = `detail.html?isbn=${encodeURIComponent(safeIsbn)}`;
        });
      }

      const summaryContent = el("div", { class: "summary-content" });
      const summary = el(
        "div",
        { class: "summary", id: summaryId, "aria-hidden": "true", role: "region", "aria-label": `${b.title || "도서"} 요약` },
        summaryContent
      );
      summary.style.maxHeight = "0px";

      const cardBadges = el("div", { class: "badges" }, ...badges.map((t) => badge(t)));
      const topRow = el("div", { class: "card-top" }, main, detailBtn);
      const card = el("div", { class: "card" }, topRow, summary, cardBadges);
      box.append(card);

      const setSummaryHeight = (open) => {
        if (open) {
          summary.classList.add("open");
          summary.style.maxHeight = summary.scrollHeight + "px";
          summary.setAttribute("aria-hidden", "false");
        } else {
          summary.classList.remove("open");
          summary.style.maxHeight = "0px";
          summary.setAttribute("aria-hidden", "true");
        }
      };

      const renderDetail = async () => {
        if (!safeIsbn) {
          summaryContent.innerHTML = "";
          summaryContent.append(el("p", { class: "summary-empty" }, "ISBN 정보가 없어 상세 요약을 볼 수 없습니다."));
          summary.dataset.loaded = "error";
          setSummaryHeight(true);
          return;
        }

        if (summary.dataset.loaded === "done") {
          setSummaryHeight(true);
          return;
        }

        summary.dataset.loaded = "loading";
        summaryContent.innerHTML = "";
        summaryContent.append(el("p", { class: "summary-empty" }, "상세 정보를 불러오는 중…"));
        setSummaryHeight(true);

        try {
          const detail = await getBookDetail(safeIsbn);
          const sections = [];
          const desc = truncateText(sanitizeDetailText(detail.description || ""));
          if (desc) sections.push({ label: "소개", value: desc });
          const toc = truncateText(sanitizeDetailText(detail.toc || ""));
          if (toc) sections.push({ label: "목차", value: toc });

          summaryContent.innerHTML = "";
          if (!sections.length) {
            summaryContent.append(el("p", { class: "summary-empty" }, "알라딘에서 제공하는 요약 정보가 없습니다."));
          } else {
            sections.forEach((section) => {
              const block = el("div", { class: "summary-block" }, el("div", { class: "summary-title" }, section.label));
              const paragraphs = buildParagraphs(section.value);
              if (paragraphs.length) paragraphs.forEach((p) => block.append(p));
              else block.append(el("p", { class: "summary-text-line" }, "내용이 제공되지 않았습니다."));
              summaryContent.append(block);
            });
          }
          summary.dataset.loaded = "done";
        } catch (err) {
          summary.dataset.loaded = "error";
          summaryContent.innerHTML = "";
          summaryContent.append(
            el(
              "p",
              { class: "summary-error" },
              `상세 정보를 불러오는 중 오류가 발생했습니다. ${err?.message ? `(${err.message})` : ""}`
            )
          );
        } finally {
          requestAnimationFrame(() => {
            if (main.getAttribute("aria-expanded") === "true") {
              setSummaryHeight(true);
            }
          });
        }
      };

      const toggleSummary = () => {
        const expanded = main.getAttribute("aria-expanded") === "true";
        if (expanded) {
          main.setAttribute("aria-expanded", "false");
          main.classList.remove("expanded");
          setSummaryHeight(false);
        } else {
          main.setAttribute("aria-expanded", "true");
          main.classList.add("expanded");
          renderDetail();
        }
      };

      main.addEventListener("click", (ev) => {
        if (ev.target.closest(".detail-btn")) return;
        toggleSummary();
      });
      main.addEventListener("keydown", (ev) => {
        if (ev.key === "Enter" || ev.key === " ") {
          ev.preventDefault();
          toggleSummary();
        }
      });
    });

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
