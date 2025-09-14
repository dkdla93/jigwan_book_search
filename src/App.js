// --- fetch & utils -----------------------------------------------------------
const fetchJSON = async (path) => {
  const r = await fetch(path, { cache: "no-store" });
  if (!r.ok) throw new Error(`${path} ${r.status}`);
  return r.json();
};
const isArray = Array.isArray;
const normalizeBooks = (x) => (isArray(x) ? x : (x && isArray(x.books)) ? x.books : []);
const normalizeBranches = (x) => (isArray(x) ? x : (x && isArray(x.branches)) ? x.branches : []);

// 공백/대소문자 차이 방지를 위한 정규화
function norm(v) {
  if (v == null) return '';
  return String(v).trim().replace(/\s+/g, ' ');
}


// 엘리먼트 생성/부착 유틸
function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const k in attrs) node.setAttribute(k, attrs[k]);
  // children 각각을 붙임 (배열/문자열/노드 모두 처리)
  children.flat(10).forEach((ch) => {
    if (ch == null) return;
    if (typeof ch === 'string') node.appendChild(document.createTextNode(ch));
    else node.appendChild(ch);
  });
  return node;
}


function append(parent, child) {
  if (child == null) return;
  if (typeof child === "string") parent.appendChild(document.createTextNode(child));
  else parent.appendChild(child);
}
function ensure(root, selector, maker) {
  let n = root.querySelector(selector);
  if (!n) {
    n = maker();
    root.appendChild(n);
  }
  return n;
}
function chip(text, active = false, onClick = null, ghost = false) {
  const c = el(
    "button",
    {
      class: `chip ${active ? "active" : ""} ${ghost ? "ghost" : ""}`,
      type: "button",
      "aria-pressed": active,
      title: text,
    },
    text
  );
  if (onClick) c.addEventListener("click", onClick);
  return c;
}
function badge(text) {
  return el("span", { class: "badge" }, text || "");
}

// --- main --------------------------------------------------------------------
export default async function render(root) {
  // 상태
  let state = { q: "", branch: "전체", subTheme: "전체", books: [], branches: [] };

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

  // 뼈대 DOM (없으면 생성해서 붙임)
  root.innerHTML = "";
  const searchInput = el("input", {
    class: "search",
    placeholder: "도서명, 저자명, 출판사로 검색하세요",
    value: state.q,
  });

  const panel = el("div");
  const branchRow = el(
    "div",
    { class: "row" },
    el("span", { class: "label" }, "지점(인생테마)"),
    el("div", { class: "hscroll", id: "branchBar" })
  );
  const subRow = el(
    "div",
    { class: "row" },
    el("span", { class: "label" }, "소분류"),
    el("div", { class: "hscroll", id: "subBar" })
  );
  const tools = el(
    "div",
    { class: "toolbar" },
    el("button", { class: "btn", id: "resetBtn" }, "필터 초기화")
  );
  const meta = el("div", { class: "muted", id: "meta" });
  const results = el("div", { class: "results", id: "results" });

  panel.append(
    searchInput,
    el("div", { style: "height:10px" }),
    branchRow,
    subRow,
    tools,
    el("div", { style: "height:6px" }),
    meta,
    results
  );
  root.append(panel);

  // 이벤트
  searchInput.addEventListener("input", () => {
    state.q = searchInput.value.trim();
    safePaint();
  });
  tools.querySelector("#resetBtn").addEventListener("click", () => {
    state.q = ""; state.branch = "전체"; state.subTheme = "전체";
    searchInput.value = ""; safePaint();
  });

  // 안전 렌더 래퍼
  function safePaint() {
    try { paint(); }
    catch (e) { showError(root, "렌더 오류: " + (e.message || e)); }
  }

  // 실제 렌더
  function paint() {
    paintBranchChips();
    paintSubThemeChips();
    paintResults();
  }

  function paintBranchChips() {
    // 없으면 생성
    const bar = ensure(root, "#branchBar", () =>
      el("div", { class: "hscroll", id: "branchBar" })
    );
    bar.innerHTML = "";

    bar.append(
      chip("전체", state.branch === "전체", () => {
        state.branch = "전체"; state.subTheme = "전체"; safePaint();
      })
    );

    state.branches.forEach((b) => {
      const name = b.branch || b.name || "";
      const theme = b.lifeTheme || b.theme || "";
      const label = theme ? `${name} (${theme})` : name;
      bar.append(
        chip(label, state.branch === name, () => {
          state.branch = name; state.subTheme = "전체"; safePaint();
        })
      );
    });
  }

  function paintSubThemeChips() {
    const bar = ensure(root, "#subBar", () =>
      el("div", { class: "hscroll", id: "subBar" })
    );
    bar.innerHTML = "";

    const active =
      state.branch === "전체"
        ? null
        : state.branches.find((b) => (b.branch || b.name) === state.branch);

    if (!active) {
      bar.append(
        chip("전체", state.subTheme === "전체", () => { state.subTheme = "전체"; safePaint(); }, true)
      );
      bar.append(chip("지점을 먼저 선택하세요", false, null, true));
      return;
    }

    bar.append(
      chip("전체", state.subTheme === "전체", () => { state.subTheme = "전체"; safePaint(); })
    );
    (active.subThemes || active.subthemes || []).forEach((st) => {
      bar.append(
        chip(st, state.subTheme === st, () => { state.subTheme = st; safePaint(); })
      );
    });
  }


function paintResults() {
  const { q, branch, subTheme, books } = state;
  const s = norm(q).toLowerCase();
  const selBranch = norm(branch);
  const selSub    = norm(subTheme);

  const filtered = books.filter(b => {
    const bTitle = norm(b.title);
    const bAuthor = norm(b.author);
    const bPublisher = norm(b.publisher);
    const bBranch = norm(b.branch);
    const bTheme = norm(b.theme);
    const bSub   = norm(b.subTheme);

    // 검색어: 제목/저자/출판사/지점/소분류/테마 중 하나라도 포함
    const matchesQ = !s ? true :
      [bTitle, bAuthor, bPublisher, bBranch, bSub || bTheme]
        .some(v => v.toLowerCase().includes(s));

    // 지점 필터
    const matchesBranch = (selBranch === '전체') ? true : (bBranch === selBranch);

    // 소분류 필터: 우선 subTheme, 비어있으면 theme로 매칭
    const bookFacet = bSub || bTheme;            // ← 핵심!
    const matchesSub = (selSub === '전체') ? true : (norm(bookFacet) === selSub);

    return matchesQ && matchesBranch && matchesSub;
  });

  const metaEl = root.querySelector('#meta');
  const box    = root.querySelector('#results');
  if (!metaEl || !box) return;

  metaEl.textContent = `총 ${filtered.length}권의 도서가 검색되었습니다.`;

  box.innerHTML = '';
  filtered.slice(0, 100).forEach(b => {
    const badges = [norm(b.branch), norm(b.theme), norm(b.subTheme)].filter(Boolean);

    box.append(el('div', { class:'card' },
      el('div', { style:'display:flex;align-items:center;gap:10px' },
        el('div', { style:'font-size:22px' }, '📘'),
        el('div', {},
          el('div', { style:'font-weight:700;font-size:18px' }, b.title || '제목 없음'),
          el('div', { class:'muted', style:'margin-top:4px' },
            `저자: ${b.author || '-'} · 출판사: ${b.publisher || '-'}${b.year ? ` (${b.year})` : ''}`)
        )
      ),
      el('div', { class:'badges' },
        ...badges.map(txt => badge(txt))
      )
    ));
  });
}


// --- error view --------------------------------------------------------------
function showError(root, msg) {
  root.innerHTML = "";
  root.append(
    el(
      "div",
      { style: "color:#b00020;white-space:pre-wrap;background:#fff;border:1px solid #fecaca;padding:12px;border-radius:10px" },
      msg
    )
  );
}
