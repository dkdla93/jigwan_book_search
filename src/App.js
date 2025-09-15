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
function norm(v) {
  if (v == null) return "";
  return String(v).trim().replace(/\s+/g, " ");
}

// children 여러 개를 받는 element 유틸
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
    {
      class: `chip ${active ? "active" : ""} ${ghost ? "ghost" : ""}`,
      type: "button",
      "aria-pressed": active,
      title: text,
      ...(ghost ? { disabled: true } : {})
    },
    text
  );
  if (onClick && !ghost) c.addEventListener("click", onClick);
  return c;
}
function badge(text) { return el("span", { class: "badge" }, text || ""); }

function showError(root, msg) {
  root.innerHTML = "";
  root.append(
    el(
      "div",
      {
        style:
          "color:#b00020;white-space:pre-wrap;background:#fff;border:1px solid #fecaca;padding:12px;border-radius:10px",
      },
      msg
    )
  );
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
    branches: []
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

  // 뼈대 DOM
  root.innerHTML = "";

  // 🔹 검색 대상 선택 칩 (검색창 '바로 위')
  const modeRow = el(
    "div",
    { class: "row" },
    el("div", { class: "label" }, "검색 대상"),
    el("div", { class: "chips", id: "modeBar" })
  );

  const searchInput = el("input", {
    class: "search",
    placeholder: placeholderFor(state.searchMode),
    value: state.q,
  });

  const branchRow = el(
    "div",
    { class: "row" },
    el("div", { class: "label" }, "지점(인생테마)"),
    el("div", { class: "chips", id: "branchBar" })
  );
  const subRow = el(
    "div",
    { class: "row" },
    el("div", { class: "label" }, "소분류"),
    el("div", { class: "chips", id: "subBar" })
  );

  const tools = el(
    "div",
    { class: "toolbar" },
    el("button", { class: "btn", id: "resetBtn" }, "필터 초기화")
  );
  const info = el("div", { class: "muted", id: "meta" });
  const results = el("div", { class: "results", id: "results" });

  root.append(
    modeRow,                 // ← 검색 대상 칩
    searchInput,             // ← 그 아래 검색창
    el("div", { style: "height:10px" }),
    branchRow,
    subRow,
    tools,
    el("div", { style: "height:6px" }),
    info,
    results
  );

  // 이벤트
  searchInput.addEventListener("input", () => {
    state.q = searchInput.value.trim();
    paint();
  });
  tools.querySelector("#resetBtn").addEventListener("click", () => {
    state.q = "";
    state.branch = "전체";
    state.subTheme = "전체";
    state.searchMode = "title"; // 검색 대상도 기본으로 복귀
    searchInput.value = "";
    searchInput.placeholder = placeholderFor(state.searchMode);
    paint();
  });

  // ------- 렌더러들 -------
  function paint() {
    paintSearchModeChips();
    paintBranchChips();
    paintSubThemeChips();
    paintResults();
  }

  // 🔹 검색 대상 칩
  function paintSearchModeChips() {
    const bar = root.querySelector("#modeBar");
    bar.innerHTML = "";

    const opts = [
      ["도서명", "title"],
      ["인생테마", "theme"],
      ["소분류", "sub"],
      ["통합검색", "all"],
    ];

    opts.forEach(([label, key]) => {
      bar.append(
        chip(label, state.searchMode === key, () => {
          state.searchMode = key;
          searchInput.placeholder = placeholderFor(state.searchMode);
          paintResults(); // 리스트만 즉시 갱신
        })
      );
    });
  }

  function placeholderFor(mode) {
    switch (mode) {
      case "title": return "도서명으로 검색하세요";
      case "theme": return "인생테마로 검색하세요 (예: 테마:명상)";
      case "sub":   return "소분류로 검색하세요 (예: 명상(침묵), 그림책)";
      case "all":   return "도서명/저자/출판사로 검색하세요";
      default:      return "검색어를 입력하세요";
    }
  }

  function paintBranchChips() {
    const bar = root.querySelector("#branchBar");
    bar.innerHTML = "";

    bar.append(
      chip("전체", state.branch === "전체", () => {
        state.branch = "전체";
        state.subTheme = "전체";
        paint();
      })
    );

    state.branches.forEach((b) => {
      const name = b.branch || b.name || "";
      const theme = b.lifeTheme || b.theme || "";
      const label = theme ? `${name} (${theme})` : name;
      bar.append(
        chip(label, state.branch === name, () => {
          state.branch = name;
          state.subTheme = "전체"; // 지점 바꾸면 소분류 초기화
          paint();
        })
      );
    });
  }

  // 지점별 소분류: 1) 정의된 전체 표시(없으면 회색), 2) 데이터에만 있는 건 뒤에 추가
  function paintSubThemeChips() {
    const bar = root.querySelector("#subBar");
    bar.innerHTML = "";

    const active =
      state.branch === "전체"
        ? null
        : state.branches.find((b) => (b.branch || b.name) === state.branch);

    if (!active) {
      bar.append(chip("전체", state.subTheme === "전체", () => {
        state.subTheme = "전체";
        paint();
      }));
      bar.append(chip("지점을 먼저 선택하세요", false, null, true));
      return;
    }

    // 현재 지점의 facet(subTheme || theme) 카운트
    const inBranch = state.books.filter((bk) => norm(bk.branch) === norm(state.branch));
    const facetCount = new Map();
    inBranch.forEach((bk) => {
      const f = norm(bk.subTheme) || norm(bk.theme);
      if (!f) return;
      facetCount.set(f, (facetCount.get(f) || 0) + 1);
    });

    // 1) 항상 '전체'
    bar.append(
      chip("전체", state.subTheme === "전체", () => {
        state.subTheme = "전체";
        paint();
      })
    );

    // 2) branches.json에 정의된 모든 소분류 (없으면 회색)
    const curated = Array.isArray(active.subThemes) ? active.subThemes : [];
    const seen = new Set();

    curated.forEach((raw) => {
      const label = String(raw);
      const key = norm(label);
      const hasBooks = facetCount.has(key);
      seen.add(key);

      bar.append(
        chip(
          label,
          state.subTheme === label,
          hasBooks
            ? () => {
                state.subTheme = label;
                paint();
              }
            : null,
          !hasBooks // 책이 없으면 비활성/회색
        )
      );
    });

    // 3) 데이터에만 존재하는 추가 facet들(중복 제외) 뒤에 붙이기
    Array.from(facetCount.keys())
      .filter((k) => !seen.has(k))
      .sort()
      .forEach((k) => {
        const label = k;
        bar.append(
          chip(label, state.subTheme === label, () => {
            state.subTheme = label;
            paint();
          })
        );
      });
  }

  function paintResults() {
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

      // 🔎 검색어 매칭: 모드별 필드 제한
      let matchesQ = true;
      if (s) {
        if (searchMode === "title") {
          matchesQ = bTitle.toLowerCase().includes(s);
        } else if (searchMode === "theme") {
          matchesQ = bTheme.toLowerCase().includes(s);
        } else if (searchMode === "sub") {
          const facet = (bSub || bTheme).toLowerCase();
          matchesQ = facet.includes(s);
        } else { // 'all' = 통합검색 → 도서명/저자/출판사
          matchesQ = [bTitle, bAuthor, bPublisher].some(v => v.toLowerCase().includes(s));
        }
      }

      // 지점 필터
      const matchesBranch =
        selBranch === "전체" ? true : bBranch === selBranch;

      // 소분류 필터: subTheme 비면 theme로 대체
      const bookFacet = bSub || bTheme;
      const matchesSub =
        selSub === "전체" ? true : norm(bookFacet) === selSub;

      return matchesQ && matchesBranch && matchesSub;
    });

    const metaEl = root.querySelector("#meta");
    const box = root.querySelector("#results");
    metaEl.textContent = `총 ${filtered.length}권의 도서가 검색되었습니다.`;

    box.innerHTML = "";
    filtered.slice(0, 100).forEach((b) => {
      const badges = [norm(b.branch), norm(b.theme), norm(b.subTheme)].filter(Boolean);

      box.append(
        el(
          "div",
          { class: "card" },
          el(
            "div",
            { style: "display:flex;align-items:center;gap:10px" },
            el("div", { style: "font-size:22px" }, "📘"),
            el(
              "div",
              {},
              el(
                "div",
                { style: "font-weight:700;font-size:18px" },
                b.title || "제목 없음"
              ),
              el(
                "div",
                { class: "muted", style: "margin-top:4px" },
                `저자: ${b.author || "-"} · 출판사: ${
                  b.publisher || "-"
                }${b.year ? ` (${b.year})` : ""}`
              )
            )
          ),
          el("div", { class: "badges" }, ...badges.map((t) => badge(t)))
        )
      );
    });
  }

  // 최초 렌더
  paint();
}
