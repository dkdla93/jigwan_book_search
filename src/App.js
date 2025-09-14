// 도메인 데이터는 정적 JSON으로 로드
const fetchJSON = (path) =>
  fetch(path).then((r) => { if (!r.ok) throw new Error(path + ' ' + r.status); return r.json(); });

export default async function render(root) {
  // 상태
  let state = {
    q: '',
    branch: '전체',          // '전체' or branches[i].branch
    subTheme: '전체',        // '전체' or 선택된 소분류
    books: [],
    branches: []            // [{branch, lifeTheme, subThemes: []}]
  };

  // 데이터 로드
  try {
    const [books, branches] = await Promise.all([
      fetchJSON('/src/data/books.json'),
      fetchJSON('/src/data/branches.json'),
    ]);
    state.books = books;
    state.branches = branches;
  } catch (e) {
    root.textContent = '데이터 로드 오류: ' + (e.message || e);
    return;
  }

  // 렌더
  root.innerHTML = '';
  const searchInput = el('input', { class: 'search', placeholder: '도서명, 저자명, 출판사로 검색하세요', value: state.q });
  const branchRow = el('div', { class: 'row' }, el('span', { class: 'label' }, '지점(인생테마)'), el('div', { class: 'hscroll', id: 'branchBar' }));
  const subRow    = el('div', { class: 'row' }, el('span', { class: 'label' }, '소분류'),      el('div', { class: 'hscroll', id: 'subBar' }));
  const tools     = el('div', { class: 'toolbar' }, el('button', { class: 'btn', id:'resetBtn' }, '필터 초기화'));
  const info      = el('div', { class: 'muted', id: 'meta' });
  const resultBox = el('div', { class: 'results', id: 'results' });

  root.append(
    searchInput,
    el('div', { style: 'height:10px' }),
    branchRow, subRow, tools,
    el('div', { style: 'height:6px' }),
    info, resultBox
  );

  // 이벤트
  searchInput.addEventListener('input', () => { state.q = searchInput.value.trim(); paint(); });
  root.querySelector('#resetBtn').addEventListener('click', () => { state.q=''; state.branch='전체'; state.subTheme='전체'; searchInput.value=''; paint(); });

  // 초기 렌더
  paint();

  // ---- 내부 함수들 ----
  function paint() {
    paintBranchChips();
    paintSubThemeChips();
    paintResults();
  }

  // 지점 칩
  function paintBranchChips() {
    const bar = root.querySelector('#branchBar');
    bar.innerHTML = '';
    bar.append(chip('전체', state.branch==='전체', () => { state.branch='전체'; state.subTheme='전체'; paint(); }));
    state.branches.forEach(b => {
      const label = `${b.branch} (${b.lifeTheme})`;
      bar.append(chip(label, state.branch===b.branch, () => {
        state.branch = b.branch;
        // 지점 바꾸면 소분류 초기화
        state.subTheme = '전체';
        paint();
      }));
    });
  }

  // 소분류 칩 (지점별)
  function paintSubThemeChips() {
    const bar = root.querySelector('#subBar');
    bar.innerHTML = '';
    const activeBranch = state.branch==='전체' ? null : state.branches.find(b => b.branch===state.branch);

    // 지점 미선택 → 전체 소분류는 감춤 대신 안내 칩
    if (!activeBranch) {
      bar.append(chip('전체', state.subTheme==='전체', () => { state.subTheme='전체'; paint(); }, true));
      bar.append(chip('지점을 먼저 선택하세요', false, null, true));
      return;
    }
    bar.append(chip('전체', state.subTheme==='전체', () => { state.subTheme='전체'; paint(); }));

    for (const st of activeBranch.subThemes || []) {
      bar.append(chip(st, state.subTheme===st, () => { state.subTheme = st; paint(); }));
    }
  }

  // 결과 영역
  function paintResults() {
    const { q, branch, subTheme, books } = state;
    const qLower = q.toLowerCase();

    const filtered = books.filter(b => {
      const matchesQ = !q ? true : [b.title,b.author,b.publisher,b.branch,b.subTheme]
        .filter(Boolean).some(v => String(v).toLowerCase().includes(qLower));
      const matchesBranch = (branch==='전체') ? true : (b.branch===branch);
      const matchesSub = (subTheme==='전체') ? true : (b.subTheme===subTheme);
      return matchesQ && matchesBranch && matchesSub;
    });

    root.querySelector('#meta').textContent = `총 ${filtered.length}권의 도서가 검색되었습니다.`;

    const box = root.querySelector('#results');
    box.innerHTML = '';
    filtered.slice(0, 100).forEach(b => {
      const card = el('div', { class:'card' },
        el('div', { style:'display:flex;align-items:center;gap:10px' },
          el('div', { style:'font-size:22px' }, '📘'),
          el('div', {},
            el('div', { style:'font-weight:700;font-size:18px' }, b.title || '제목 없음'),
            el('div', { class:'muted', style:'margin-top:4px' }, [
              '저자: ', b.author || '-', ' · 출판사: ', b.publisher || '-', b.year ? ` (${b.year})` : ''
            ].join(''))
          )
        ),
        el('div', { class:'badges' },
          badge(b.branch),
          badge(b.theme || b.lifeTheme || ''),
          badge(b.subTheme || '')
        )
      );
      box.append(card);
    });
  }

  // UI 유틸
  function chip(text, active=false, onClick=null, ghost=false){
    const c = el('button', { class:`chip ${active?'active':''} ${ghost?'ghost':''}`, type:'button', 'aria-pressed':active, title:text }, text);
    if(onClick) c.addEventListener('click', onClick);
    return c;
  }
  function badge(text){ return el('span', { class:'badge' }, text || ''); }

  function el(tag, attrs={}, children){
    const node = document.createElement(tag);
    for (const k in attrs) node.setAttribute(k, attrs[k]);
    if (Array.isArray(children)) children.forEach(ch=>append(node,ch));
    else if (children!=null) append(node, children);
    return node;
  }
  function append(parent, child){
    if (child==null) return;
    if (typeof child==='string') parent.appendChild(document.createTextNode(child));
    else parent.appendChild(child);
  }
}
