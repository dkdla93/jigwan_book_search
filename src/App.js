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
    },
    text
  );
  if (onClick) c.addEventListener("click", onClick);
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

  // 뼈대 DOM
  root.innerHTML = "";
  const searchInput = el("input", {
    class: "search",
    placeholder: "도서명, 저자명, 출판사로 검색하세요",
    value: state.q,
  });
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
  const info = el("div", { class: "muted", id: "meta" });
  const results = el("div", { class: "results", id: "results" });

  root.append(
    searchInput,
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
    searchInput.value = "";
    paint();
  });

  // ------- 렌더러들 -------
  function paint() {
    paintBranchChips();
    paintSubThemeChips();
    paintResults();
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

  // ✅ 지점별 소분류: branches.json과 실제 데이터의 교집합만 표시
  function paintSubThemeChips() {
    const bar = root.querySelector("#subBar");
    bar.innerHTML = "";

    const active =
      state.branch === "전체"
        ? null
        : state.branches.find((b) => (b.branch || b.name) === state.branch);

    // 현재 지점의 도서에서 실제로 존재하는 facet(subTheme || theme)
    const availableFacetSet = new Set(
      state.books
        .filter((bk) => norm(bk.branch) === norm(state.branch))
        .map((bk) => norm(bk.subTheme) || norm(bk.theme))
        .filter(Boolean)
    );

    // 1) branches.json의 subThemes 중에서 실제 존재하는 것만
    let candidate = [];
    if (active && Array.isArray(active.subThemes) && active.subThemes.length) {
      candidate = active.subThemes.filter((st) => availableFacetSet.has(norm(st)));
    }
    // 2) 교집합이 비면, 데이터 기반 facet들로 대체
    if (!candidate.length) {
      candidate = Array.from(availableFacetSet).sort();
    }

    // 항상 '전체' 먼저
    bar.append(
      chip("전체", state.subTheme === "전체", () => {
        state.subTheme = "전체";
        paint();
      })
    );

    // 후보 칩 출력(없으면 가이드 칩)
    if (candidate.length) {
      candidate.forEach((st) => {
        bar.append(
          chip(st, state.subTheme === st, () => {
            state.subTheme = st;
            paint();
          })
        );
      });
    } else {
      bar.append(chip("이 지점에는 소분류 데이터가 없습니다", false, null, true));
    }
  }

  function paintResults() {
    const { q, branch, subTheme, books } = state;
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

      // 검색어: 제목/저자/출판사/지점/소분류(없으면 theme) 중 포함
      const matchesQ = !s
        ? true
        : [bTitle, bAuthor, bPublisher, bBranch, bSub || bTheme].some((v) =>
            v.toLowerCase().includes(s)
          );

      // 지점 필터
      const matchesBranch =
        selBranch === "전체" ? true : bBranch === selBranch;

      // 소분류 필터: subTheme가 비면 theme로 대체
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
