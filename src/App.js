/* -----------------------------------------
 * 지관서가 북카페 도서검색 App.js (vanilla JS)
 * - 기존 검색/필터/렌더를 그대로 유지
 * - 카드 클릭 → 요약 드로어 (책소개/목차 일부)
 * - 우상단 ℹ︎ → 상세 모달 (전체 세부정보)
 * - 세부정보 소스: 알라딘 ItemLookUp → (부족 시) NLK 보강
 * - 캐시: Map + localStorage(detail:v1:<isbn13>)
 * ----------------------------------------- */

/* =============== 전역 상태 =============== */
const STATE = {
  searchType: "title",         // 'title' | 'life' | 'sub' | 'all'
  query: "",
  selectedBranch: "전체",       // 지점(인생테마) 버튼
  selectedSub: "전체",          // 소분류 버튼
  books: [],
  branches: [],
  branchMap: {},               // branchName -> { lifeTheme, subThemes, total }
};

/* =============== DOM =============== */
const el = {
  // 검색 대상 탭
  segTitle: document.getElementById("seg-title"),
  segLife: document.getElementById("seg-life"),
  segSub: document.getElementById("seg-sub"),
  segAll: document.getElementById("seg-all"),

  // 검색창 / 버튼
  searchInput: document.getElementById("searchInput"),
  searchBtn: document.getElementById("searchBtn"),

  // 지점/소분류 칩 컨테이너
  branchChips: document.getElementById("branchChips"),
  subChips: document.getElementById("subChips"),

  // 필터 초기화
  resetFiltersBtn: document.getElementById("resetFiltersBtn"),

  // 결과
  resultList: document.getElementById("resultList"),
  resultCount: document.getElementById("resultCount"),

  // 모달
  detailModal: document.getElementById("detailModal"),
  detailModalBody: document.getElementById("detailModalBody"),
};

/* =============== 데이터 로드 =============== */
async function loadJSON(url) {
  const r = await fetch(url, { cache: "no-store" });
  if (!r.ok) throw new Error(`${url} ${r.status}`);
  return await r.json();
}

async function setup() {
  // branches.json (지점/인생테마/소분류/total)
  const branches = await loadJSON("/src/data/branches.json");
  STATE.branches = branches;
  STATE.branchMap = branches.reduce((acc, b) => {
    acc[b.branch] = { lifeTheme: b.lifeTheme, subThemes: b.subThemes || [], total: b.total || 0 };
    return acc;
  }, {});

  // books.json (기존 구조 그대로)
  const books = await loadJSON("/src/data/books.json");
  STATE.books = books;

  paintBranchChips();
  paintSubChips(); // '전체'만 있음 (지점 선택 전)
  bindEvents();
  applySearchType("title"); // 기본 '도서명'
  paintResults(); // 최초 전체(필터 없음)
}

/* =============== 이벤트 바인딩 =============== */
function bindEvents() {
  // 검색 대상 탭
  el.segTitle.addEventListener("click", () => applySearchType("title"));
  el.segLife.addEventListener("click", () => applySearchType("life"));
  el.segSub.addEventListener("click", () => applySearchType("sub"));
  el.segAll.addEventListener("click", () => applySearchType("all"));

  // 검색 폼: 엔터 & 버튼
  el.searchBtn.addEventListener("click", onSubmitSearch);
  el.searchInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") onSubmitSearch(e);
  });

  // 필터 초기화
  el.resetFiltersBtn.addEventListener("click", () => {
    STATE.selectedBranch = "전체";
    STATE.selectedSub = "전체";
    el.searchInput.value = "";
    STATE.query = "";
    // 칩 다시 그리기
    paintBranchChips();
    paintSubChips();
    paintResults();
  });

  // 모달 닫기
  if (el.detailModal) {
    el.detailModal.addEventListener("click", (e) => {
      const t = e.target;
      if (t.dataset && t.dataset.close) closeModal();
    });
  }
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeModal();
  });
}

/* =============== 검색 타입 =============== */
function applySearchType(type) {
  STATE.searchType = type;

  // 탭 활성화 토글
  [el.segTitle, el.segLife, el.segSub, el.segAll].forEach((b) => b.classList.remove("is-active"));
  if (type === "title") el.segTitle.classList.add("is-active");
  if (type === "life") el.segLife.classList.add("is-active");
  if (type === "sub") el.segSub.classList.add("is-active");
  if (type === "all") el.segAll.classList.add("is-active");

  // placeholder
  const placeholders = {
    title: "도서명으로 검색하세요",
    life: "인생테마로 검색하세요 (예: 관계, 일, 명상...)",
    sub: "소분류로 검색하세요 (예: 그림책, 침묵, 잡지...)",
    all: "통합검색 (도서명/저자/출판사/지점/테마/소분류)",
  };
  el.searchInput.setAttribute("placeholder", placeholders[type] || placeholders.title);

  // 즉시 반영 (버튼만 눌러도 필터가 바로 바뀌는 느낌)
  const q = el.searchInput.value.trim();
  if (q === "") {
    STATE.query = "";
    paintResults();
  } else {
    onSubmitSearch();
  }
}

function onSubmitSearch(e) {
  if (e) e.preventDefault();
  STATE.query = el.searchInput.value.trim();
  paintResults();
}

/* =============== 칩 UI =============== */
function paintBranchChips() {
  const frag = document.createDocumentFragment();

  // '전체'
  frag.appendChild(makeChip("전체", STATE.selectedBranch === "전체", () => {
    STATE.selectedBranch = "전체";
    STATE.selectedSub = "전체";
    paintBranchChips();
    paintSubChips();
    paintResults();
  }));

  // 지점들
  STATE.branches.forEach((b) => {
    frag.appendChild(
      makeChip(
        b.branch,
        STATE.selectedBranch === b.branch,
        () => {
          STATE.selectedBranch = b.branch;
          STATE.selectedSub = "전체"; // 지점 바뀌면 소분류 초기화
          paintBranchChips();
          paintSubChips();
          paintResults();
        }
      )
    );
  });

  el.branchChips.innerHTML = "";
  el.branchChips.appendChild(frag);
}

function paintSubChips() {
  const frag = document.createDocumentFragment();
  const bname = STATE.selectedBranch;

  // 선택된 지점의 소분류
  let subs = [];
  if (bname !== "전체" && STATE.branchMap[bname] && Array.isArray(STATE.branchMap[bname].subThemes)) {
    subs = STATE.branchMap[bname].subThemes;
  }

  // 전체 chip
  frag.appendChild(
    makeChip(
      "전체",
      STATE.selectedSub === "전체",
      () => {
        STATE.selectedSub = "전체";
        paintSubChips();
        paintResults();
      }
    )
  );

  if (subs.length === 0) {
    const disabled = document.createElement("span");
    disabled.className = "chip chip--ghost";
    disabled.textContent = "지점을 먼저 선택하세요";
    disabled.setAttribute("aria-disabled", "true");
    frag.appendChild(disabled);
  } else {
    subs.forEach((s) => {
      frag.appendChild(
        makeChip(
          s,
          STATE.selectedSub === s,
          () => {
            STATE.selectedSub = s;
            paintSubChips();
            paintResults();
          }
        )
      );
    });
  }

  el.subChips.innerHTML = "";
  el.subChips.appendChild(frag);
}

function makeChip(label, active, onClick) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "chip" + (active ? " is-active" : "");
  btn.textContent = label;
  btn.addEventListener("click", (e) => {
    e.preventDefault();
    onClick();
  });
  return btn;
}

/* =============== 필터/검색 로직 =============== */
function normalize(s) {
  return (s || "").toString().toLowerCase();
}

function bookMatchesQuery(b) {
  const q = normalize(STATE.query);
  if (!q) return true;

  const branchLife = (STATE.branchMap[b.branch]?.lifeTheme) || "";

  switch (STATE.searchType) {
    case "title":
      return normalize(b.title).includes(q);
    case "life":
      return normalize(branchLife).includes(q);
    case "sub": {
      const t1 = normalize(b.theme);
      const t2 = normalize(b.subTheme);
      return t1.includes(q) || t2.includes(q);
    }
    case "all": {
      const fields = [
        b.title, b.author, b.publisher, b.branch, b.theme, b.subTheme, branchLife
      ];
      return fields.some((f) => normalize(f).includes(q));
    }
    default:
      return normalize(b.title).includes(q);
  }
}

function bookMatchesBranch(b) {
  if (STATE.selectedBranch === "전체") return true;
  return b.branch === STATE.selectedBranch;
}

function bookMatchesSub(b) {
  if (STATE.selectedSub === "전체") return true;
  return b.theme === STATE.selectedSub || b.subTheme === STATE.selectedSub;
}

/* =============== 표지 URL (기존 라우트 유지) =============== */
function coverUrl(isbn) {
  // 기존에 쓰던 /api/cover?isbn= 라우트를 그대로 사용
  return `/api/cover?isbn=${encodeURIComponent(isbn || "")}`;
}

/* =============== 결과 렌더링 =============== */
function paintResults() {
  const filtered = STATE.books.filter((b) => {
    return bookMatchesQuery(b) && bookMatchesBranch(b) && bookMatchesSub(b);
  });

  el.resultCount.textContent = `총 ${filtered.length}권의 도서가 검색되었습니다.`;

  const frag = document.createDocumentFragment();
  // 과도한 DOM 생성을 막고 싶다면 여기에서 slice 수치를 조절 (예: 200)
  filtered.forEach((b) => frag.appendChild(renderBookCard(b)));

  el.resultList.innerHTML = "";
  el.resultList.appendChild(frag);
}

/* =============== 카드 DOM =============== */
function renderBookCard(b) {
  const card = document.createElement("div");
  card.className = "book";

  // 좌측 표지
  const coverBox = document.createElement("div");
  coverBox.className = "book__cover";
  const img = document.createElement("img");
  img.src = coverUrl(b.isbn);
  img.alt = b.title || "cover";
  img.loading = "lazy";
  coverBox.appendChild(img);

  // 중앙 텍스트
  const main = document.createElement("div");
  main.className = "book__main";

  const title = document.createElement("div");
  title.className = "book__title";
  title.textContent = b.title || "";

  const meta = document.createElement("div");
  meta.className = "book__meta";
  const parts = [];
  if (b.author) parts.push(`저자: ${b.author}`);
  if (b.publisher) parts.push(`출판사: ${b.publisher}`);
  if (b.year) parts.push(`(${b.year})`);
  meta.textContent = parts.join(" · ");

  const tags = document.createElement("div");
  tags.className = "book__tags";
  if (b.branch) tags.appendChild(makeTag(b.branch));
  if (b.theme) tags.appendChild(makeTag(b.theme));

  main.appendChild(title);
  main.appendChild(meta);
  main.appendChild(tags);

  // 우측(비워둠)
  const aside = document.createElement("div");
  aside.className = "book__aside";

  // 우상단 액션(상세 아이콘)
  const actions = document.createElement("div");
  actions.className = "book__actions";

  const infoBtn = document.createElement("button");
  infoBtn.type = "button";
  infoBtn.className = "icon-btn";
  infoBtn.title = "상세정보 보기";
  infoBtn.setAttribute("aria-label", "상세정보 보기");
  infoBtn.textContent = "ℹ︎";
  infoBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    openDetailModal(b);
  });
  actions.appendChild(infoBtn);

  // 조립
  card.appendChild(coverBox);
  card.appendChild(main);
  card.appendChild(aside);
  card.appendChild(actions);

  // 카드 클릭 → 드로어 토글
  card.addEventListener("click", () => toggleDrawer(card, b));

  return card;
}

function makeTag(text) {
  const span = document.createElement("span");
  span.className = "tag";
  span.textContent = text;
  return span;
}

/* =============== 상세(드로어/모달) 보조 =============== */
// detail cache
const detailCache = new Map();
function saveDetailCache(isbn13, data) {
  try {
    detailCache.set(isbn13, data);
    localStorage.setItem("detail:v1:" + isbn13, JSON.stringify(data));
  } catch (_) {}
}
function loadDetailCache(isbn13) {
  if (detailCache.has(isbn13)) return detailCache.get(isbn13);
  try {
    const raw = localStorage.getItem("detail:v1:" + isbn13);
    if (raw) {
      const d = JSON.parse(raw);
      detailCache.set(isbn13, d);
      return d;
    }
  } catch (_) {}
  return null;
}

async function fetchJSONSafe(url) {
  try {
    const r = await fetch(url);
    if (!r.ok) throw new Error(r.status);
    return await r.json();
  } catch (e) {
    return { error: String(e) };
  }
}

function hasRich(d) {
  return d && (d.intro || d.toc || d.authorIntro || d.pubReview);
}
function mergeDetails(a = {}, b = {}) {
  return {
    provider: [a.provider, b.provider].filter(Boolean).join("+") || "unknown",
    title: a.title || b.title || "",
    author: a.author || b.author || "",
    publisher: a.publisher || b.publisher || "",
    pubDate: a.pubDate || b.pubDate || "",
    pages: a.pages || b.pages || "",
    categories: (a.categories || []).concat(b.categories || []),
    link: a.link || b.link || "",
    cover: a.cover || b.cover || "",
    intro: a.intro || b.intro || "",
    authorIntro: a.authorIntro || b.authorIntro || "",
    pubReview: a.pubReview || b.pubReview || "",
    toc: a.toc || b.toc || "",
  };
}

async function loadBookDetails(isbn13) {
  if (!isbn13) return null;

  const cached = loadDetailCache(isbn13);
  if (cached) return cached;

  // 알라딘 우선
  const aladin = await fetchJSONSafe(`/api/aladin-item?isbn13=${isbn13}`);
  let merged = aladin;

  // 부족하면 NLK 보강
  if (!hasRich(aladin)) {
    const nlk = await fetchJSONSafe(`/api/nlk?isbn=${isbn13}`);
    merged = mergeDetails(aladin, nlk);
  }

  saveDetailCache(isbn13, merged);
  return merged;
}

function sliceText(s, n = 380) {
  if (!s) return "";
  const t = s.replace(/\s+/g, " ").trim();
  return t.length > n ? t.slice(0, n) + "…" : t;
}

/* =============== 드로어 =============== */
async function toggleDrawer(cardEl, book) {
  let drawer = cardEl.querySelector(".book__drawer");
  if (drawer) {
    drawer.remove();
    return;
  }
  drawer = document.createElement("div");
  drawer.className = "book__drawer";
  drawer.innerHTML = `<div class="sec">불러오는 중…</div>`;
  cardEl.appendChild(drawer);

  try {
    const d = await loadBookDetails(book.isbn || book.isbn13 || "");
    if (!d) {
      drawer.innerHTML = `<div class="sec">세부 정보를 찾을 수 없습니다.</div>`;
      return;
    }
    const intro = sliceText(d.intro);
    const toc = sliceText(d.toc);

    drawer.innerHTML = `
      ${intro ? `<div class="sec"><span class="label">책소개</span>${intro}</div>` : ``}
      ${toc ? `<div class="sec"><span class="label">목차</span>${toc}</div>` : ``}
      ${!intro && !toc ? `<div class="sec">요약 정보가 없습니다.</div>` : ``}
      <div style="margin-top:8px">
        <button type="button" class="icon-btn" aria-label="상세정보 모두 보기" title="상세정보 모두 보기"
          onclick="window.__openModalFromDrawer('${book.isbn || book.isbn13 || ''}')">⌕</button>
      </div>
    `;
  } catch (e) {
    drawer.innerHTML = `<div class="sec">세부 정보 로딩 중 오류가 발생했습니다.</div>`;
  }
}

// 드로어에서 모달 열기 연결
window.__openModalFromDrawer = async function (isbn13) {
  const dummy = { isbn: isbn13, isbn13 };
  openDetailModal(dummy);
};

/* =============== 모달 =============== */
function closeModal() {
  if (!el.detailModal) return;
  el.detailModal.classList.add("hidden");
  el.detailModal.setAttribute("aria-hidden", "true");
}

async function openDetailModal(book) {
  if (!el.detailModal || !el.detailModalBody) return;
  el.detailModal.classList.remove("hidden");
  el.detailModal.setAttribute("aria-hidden", "false");
  el.detailModalBody.innerHTML = `<div class="block">불러오는 중…</div>`;

  const d = await loadBookDetails(book.isbn || book.isbn13 || "");
  if (!d) {
    el.detailModalBody.innerHTML = `<div class="block">세부 정보를 찾을 수 없습니다.</div>`;
    return;
  }

  const meta = [
    d.author && `저자: ${d.author}`,
    d.publisher && `출판사: ${d.publisher}`,
    d.pubDate && `발행일: ${d.pubDate}`,
    d.pages && `페이지: ${d.pages}`,
  ].filter(Boolean).join(" · ");

  el.detailModalBody.innerHTML = `
    <h3>${d.title || ""}</h3>
    ${meta ? `<div class="meta">${meta}</div>` : ``}

    ${d.intro ? `<div class="block"><div class="head">책소개</div><div>${(d.intro || "").replace(/\n/g, "<br>")}</div></div>` : ``}
    ${d.toc ? `<div class="block"><div class="head">목차</div><div>${(d.toc || "").replace(/\n/g, "<br>")}</div></div>` : ``}
    ${d.pubReview ? `<div class="block"><div class="head">출판사 서평</div><div>${(d.pubReview || "").replace(/\n/g, "<br>")}</div></div>` : ``}
    ${d.authorIntro ? `<div class="block"><div class="head">저자 소개</div><div>${(d.authorIntro || "").replace(/\n/g, "<br>")}</div></div>` : ``}
    ${d.link ? `<div class="block"><a href="${d.link}" target="_blank" rel="noreferrer">원문 페이지로 이동</a></div>` : ``}
    <div class="block" style="font-size:12px;color:#6c757d;">source: ${d.provider || "unknown"}</div>
  `;
}

/* =============== 초기 실행 =============== */
document.addEventListener("DOMContentLoaded", setup);
