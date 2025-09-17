/* ----------------------------------------------------
 * 지관서가 북카페 검색 App
 * - 소분류 SSOT: /src/data/branches.json 만 사용
 * - books.json 은 필터링 대상 데이터 출처일 뿐,
 *   소분류 칩을 만들거나 목록을 생성하는 데는 절대 사용하지 않음.
 * - 결과 카드가 안 보이는 문제 방지:
 *   #results, #meta 컨테이너가 없으면 자동 생성하여 렌더.
 * ---------------------------------------------------- */

(() => {
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const el = (tag, cls, text) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  };

  // 루트 패널(없어도 동작하게 document.body에 붙여줌)
  const panel =
    $('#app') ||
    $('[data-app-root]') ||
    $('.panel') ||
    (function () {
      const p = el('div', 'panel');
      document.body.appendChild(p);
      return p;
    })();

  /* -------------------- 상태 ---------------------- */
  const state = {
    q: '',
    searchMode: 'title', // 'title' | 'theme' | 'sub' | 'all'
    branch: '전체',
    subTheme: '전체',
    books: [],
    branches: [], // 원본
  };

  // 지점 -> 소분류(SSOT)
  const SUBS_BY_BRANCH = new Map();
  const SUBS_DEFAULT = []; // '전체' 지점일 때 소분류 칩을 보여주지 않음(원하면 공통 넣으세요)

  /* -------------------- DOM 보장 ------------------ */
  // 섹션 컨테이너들이 없으면 만들어서 패널에 삽입
  function ensureSection(id, titleText) {
    let sec = $('#' + id);
    if (!sec) {
      sec = el('section');
      sec.id = id;
      const h = el('h3', 'sr-only', titleText || '');
      sec.appendChild(h);
      panel.appendChild(sec);
    }
    return sec;
  }

  const headerSec = ensureSection('header-sec', '검색 제목 영역');
  const searchSec = ensureSection('search-sec', '검색 대상 및 검색창');
  const branchSec = ensureSection('branch-sec', '지점(인생테마)');
  const subSec = ensureSection('sub-sec', '소분류');
  const metaSec = ensureSection('meta-sec', '검색 결과 요약');
  const listSec = ensureSection('list-sec', '검색 결과 목록');

  // 제목이 이미 HTML에 배치돼 있다면 그대로 두고, 없으면 생성
  if (!$('#site-title', headerSec)) {
    const titleWrap = el('div', 'title-wrap');
    const title = el('h1', 'title', '止 觀 書 架 도서검색');
    title.id = 'site-title';
    titleWrap.appendChild(title);
    headerSec.appendChild(titleWrap);
  }

  // 검색 대상 칩 행
  let searchModeRow = $('#searchModeRow', searchSec);
  if (!searchModeRow) {
    searchModeRow = el('div', 'chip-row', null);
    searchModeRow.id = 'searchModeRow';
    const label = el('div', 'row-label', '검색 대상');
    searchSec.appendChild(label);
    searchSec.appendChild(searchModeRow);
  }

  // 검색 폼 (엔터 제출 가능)
  let searchForm = $('#searchForm', searchSec);
  if (!searchForm) {
    searchForm = el('form', 'searchbar');
    searchForm.id = 'searchForm';
    const input = el('input');
    input.id = 'searchInput';
    input.type = 'search';
    input.placeholder = '도서명으로 검색하세요';
    input.autocomplete = 'off';

    const btn = el('button', 'icon-btn');
    btn.id = 'searchBtn';
    btn.type = 'submit';
    btn.setAttribute('aria-label', '검색');
    btn.innerHTML =
      '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>';

    searchForm.appendChild(input);
    searchForm.appendChild(btn);
    searchSec.appendChild(searchForm);
  }
  const searchInput = $('#searchInput');
  const searchBtn = $('#searchBtn');

  // 지점 칩 행
  let branchRow = $('#branchchips', branchSec);
  if (!branchRow) {
    const label = el('div', 'row-label', '지점(인생테마)');
    branchRow = el('div', 'chip-row');
    branchRow.id = 'branchchips';
    branchSec.appendChild(label);
    branchSec.appendChild(branchRow);
  }

  // 소분류 칩 행
  let subRow = $('#subchips', subSec);
  if (!subRow) {
    const label = el('div', 'row-label', '소분류');
    subRow = el('div', 'chip-row');
    subRow.id = 'subchips';
    subSec.appendChild(label);
    subSec.appendChild(subRow);
  }

  // 메타/결과 컨테이너 보장
  let meta = $('#meta', metaSec);
  if (!meta) {
    meta = el('div', 'meta');
    meta.id = 'meta';
    metaSec.appendChild(meta);
  }

  let results = $('#results', listSec);
  if (!results) {
    results = el('div', 'results');
    results.id = 'results';
    // 결과 영역이 레이아웃에 가려지지 않도록 안전 장치
    results.style.display = 'block';
    results.style.minHeight = '24px';
    listSec.appendChild(results);
  }

  // 필터 초기화 버튼 보장(우측 하단)
  let resetBtn = $('#resetFilters');
  if (!resetBtn) {
    resetBtn = el('button', 'reset-btn', '필터 초기화');
    resetBtn.id = 'resetFilters';
    resetBtn.type = 'button';
    listSec.appendChild(resetBtn);
  }

  /* -------------------- 칩 컴포넌트 ------------------ */
  function makeChip(text, active, onClick, disabled = false) {
    const c = el('button', 'chip', text);
    if (active) c.classList.add('active');
    if (disabled) c.classList.add('disabled');
    c.type = 'button';
    if (!disabled) c.addEventListener('click', onClick);
    return c;
  }

  /* -------------------- 렌더러 ---------------------- */
  function renderSearchModeRow() {
    searchModeRow.innerHTML = '';
    const modes = [
      { key: 'title', label: '도서명', placeholder: '도서명으로 검색하세요' },
      { key: 'theme', label: '인생테마', placeholder: '인생테마로 검색하세요' },
      { key: 'sub', label: '소분류', placeholder: '소분류로 검색하세요 (예: 명상(침묵), 그림책)' },
      { key: 'all', label: '통합검색', placeholder: '도서명/저자/출판사/지점/소분류' },
    ];
    modes.forEach((m) => {
      searchModeRow.appendChild(
        makeChip(
          m.label,
          state.searchMode === m.key,
          () => {
            state.searchMode = m.key;
            // 플레이스홀더 즉시 반영
            if (searchInput) searchInput.placeholder = m.placeholder;
            paintResults();
            // 칩 상태 갱신
            renderSearchModeRow();
          },
          false
        )
      );
    });

    // 초기 placeholder 동기화
    const cur = modes.find((x) => x.key === state.searchMode);
    if (cur && searchInput) searchInput.placeholder = cur.placeholder;
  }

  function renderBranchRow() {
    branchRow.innerHTML = '';

    // '전체' 칩
    branchRow.appendChild(
      makeChip('전체', state.branch === '전체', () => {
        state.branch = '전체';
        state.subTheme = '전체'; // 지점 바꾸면 소분류 초기화
        paintResults();
        renderSubRow();
        renderBranchRow();
      })
    );

    state.branches.forEach((b) => {
      branchRow.appendChild(
        makeChip(b.branch, state.branch === b.branch, () => {
          state.branch = b.branch;
          state.subTheme = '전체'; // 지점 바꾸면 소분류 초기화
          paintResults();
          renderSubRow();
          renderBranchRow();
        })
      );
    });
  }

  function renderSubRow() {
    subRow.innerHTML = '';

    // '전체' 칩
    subRow.appendChild(
      makeChip('전체', state.subTheme === '전체', () => {
        state.subTheme = '전체';
        paintResults();
        renderSubRow();
      })
    );

    // '전체' 지점이면 안내 칩 하나만(선택 UX 명확)
    if (state.branch === '전체') {
      const hint = makeChip('지점을 먼저 선택하세요', false, () => {}, true);
      hint.classList.add('ghost');
      subRow.appendChild(hint);
      return;
    }

    const allow = SUBS_BY_BRANCH.get(state.branch) || [];
    allow.forEach((sub) => {
      subRow.appendChild(
        makeChip(sub, state.subTheme === sub, () => {
          state.subTheme = sub;
          paintResults();
          renderSubRow();
        })
      );
    });

    // 현재 선택된 소분류가 허용집합에 없다면 자동 리셋
    if (state.subTheme !== '전체' && !allow.includes(state.subTheme)) {
      state.subTheme = '전체';
      paintResults();
    }
  }

  function makeBookCard(b) {
    const card = el('article', 'card');

    const left = el('div', 'card-left');
    const img = el('img', 'cover');
    img.alt = `${b.title} 표지`;
    img.loading = 'lazy';
    // (표지는 추후 알라딘/국립중도서관 API로 주입 가능. 지금은 기본 이미지)
    img.src = b.cover || '/cover-placeholder.png';
    left.appendChild(img);

    const right = el('div', 'card-right');
    const ttl = el('h4', 'book-title', b.title || '');
    const meta1 = el(
      'div',
      'book-meta',
      `저자: ${b.author || '-'} · 출판사: ${b.publisher || '-'} · 연도: ${b.year || '-'}`
    );
    const tags = el('div', 'book-tags', null);

    const tBranch = el('span', 'tag', b.branch || '-');
    const tSub = el('span', 'tag', b.subTheme || b.theme || '-');
    tags.appendChild(tBranch);
    tags.appendChild(tSub);

    right.appendChild(ttl);
    right.appendChild(meta1);
    right.appendChild(tags);

    card.appendChild(left);
    card.appendChild(right);
    return card;
  }

  function lazyLoadCovers(imgs) {
    if (!('IntersectionObserver' in window)) return;
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) {
          const t = e.target;
          const src = t.getAttribute('data-src');
          if (src) t.src = src;
          io.unobserve(t);
        }
      });
    });
    imgs.forEach((img) => io.observe(img));
  }

  function paintResults() {
    const s = (state.q || '').trim().toLowerCase();
    const mode = state.searchMode;
    const selBranch = (state.branch || '전체').trim();
    const selSub = (state.subTheme || '전체').trim();

    const filtered = state.books.filter((b) => {
      // 1) 검색어
      let matchesQ = true;
      if (s) {
        const title = (b.title || '').toLowerCase();
        const theme = (b.theme || '').toLowerCase();
        const sub = (b.subTheme || '').toLowerCase();
        const auth = (b.author || '').toLowerCase();
        const pub = (b.publisher || '').toLowerCase();
        const br = (b.branch || '').toLowerCase();

        if (mode === 'title') matchesQ = title.includes(s);
        else if (mode === 'theme') matchesQ = theme.includes(s);
        else if (mode === 'sub') matchesQ = sub.includes(s);
        else {
          // 'all' 통합: 도서명/저자/출판사/지점/소분류(없으면 테마)
          matchesQ = [title, auth, pub, br, sub || theme].some((v) => v.includes(s));
        }
      }

      // 2) 지점
      const matchesBranch = selBranch === '전체' ? true : (b.branch || '') === selBranch;

      // 3) 소분류 (SSOT 기준으로 정확 일치. 레거시 대비로 theme fallback 한 줄 유지)
      let matchesSub = true;
      if (selSub !== '전체') {
        const facet = b.subTheme || b.theme || '';
        matchesSub = facet === selSub;
      }

      return matchesQ && matchesBranch && matchesSub;
    });

    // 메타 갱신
    meta.textContent = `총 ${filtered.length}권의 도서가 검색되었습니다.`;

    // 결과 렌더(공백/가림 방지: 한번에 교체)
    const frag = document.createDocumentFragment();
    const imgs = [];
    if (filtered.length === 0) {
      const empty = el('div', 'empty', '조건에 맞는 도서가 없습니다.');
      frag.appendChild(empty);
    } else {
      filtered.forEach((b) => {
        const card = makeBookCard(b);
        frag.appendChild(card);
        const img = card.querySelector('img.cover');
        if (img) imgs.push(img);
      });
    }
    results.replaceChildren(frag);

    // 레이아웃/가림 방지 안전 설정
    results.style.display = 'block';

    lazyLoadCovers(imgs);
  }

  /* -------------------- 이벤트 ---------------------- */
  // 검색 폼(엔터 제출)
  searchForm.addEventListener('submit', (e) => {
    e.preventDefault();
    state.q = (searchInput.value || '').trim();
    paintResults();
  });

  // 입력 도중에도 실시간 반영 원하면 아래 주석 해제
  // searchInput.addEventListener('input', (e) => {
  //   state.q = (e.target.value || '').trim();
  //   paintResults();
  // });

  resetBtn.addEventListener('click', () => {
    state.q = '';
    state.searchMode = 'title';
    state.branch = '전체';
    state.subTheme = '전체';
    if (searchInput) searchInput.value = '';
    renderSearchModeRow();
    renderBranchRow();
    renderSubRow();
    paintResults();
  });

  /* -------------------- 데이터 로딩 ------------------ */
  async function boot() {
    try {
      const [booksRes, branchesRes] = await Promise.all([
        fetch('/src/data/books.json', { cache: 'no-store' }),
        fetch('/src/data/branches.json', { cache: 'no-store' }),
      ]);
      if (!booksRes.ok) throw new Error('books.json 로드 실패');
      if (!branchesRes.ok) throw new Error('branches.json 로드 실패');

      const books = await booksRes.json();
      const branches = await branchesRes.json();

      state.books = Array.isArray(books) ? books : [];
      state.branches = Array.isArray(branches) ? branches : [];

      // SSOT: 지점 -> 소분류 맵 구성
      SUBS_BY_BRANCH.clear();
      state.branches.forEach((row) => {
        const key = (row.branch || '').trim();
        const subs = Array.isArray(row.subThemes) ? row.subThemes.map((s) => (s || '').trim()) : [];
        if (key) SUBS_BY_BRANCH.set(key, subs);
      });

      // 초기 렌더
      renderSearchModeRow();
      renderBranchRow();
      renderSubRow();
      paintResults();
    } catch (err) {
      console.error(err);
      meta.textContent = '데이터를 불러오는 중 오류가 발생했습니다.';
      results.replaceChildren(el('div', 'empty', '데이터 로드 실패'));
    }
  }

  // DOM 준비 후 기동
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
