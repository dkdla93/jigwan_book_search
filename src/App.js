// --- fetch & 유틸 ---
const fetchJSON = async (path) => {
  const r = await fetch(path, { cache: 'no-store' });
  if (!r.ok) throw new Error(`${path} ${r.status}`);
  return r.json();
};
function isArray(x) { return Array.isArray(x); }
function normalizeBooks(x) {
  if (isArray(x)) return x;
  if (x && isArray(x.books)) return x.books;
  return [];
}
function normalizeBranches(x) {
  if (isArray(x)) return x;
  if (x && isArray(x.branches)) return x.branches;
  return [];
}

// --- UI helper (함수 선언문: 호이스팅 OK) ---
function el(tag, attrs = {}, children) {
  const node = document.createElement(tag);
  for (const k in attrs) node.setAttribute(k, attrs[k]);
  if (Array.isArray(children)) children.forEach(ch => append(node, ch));
  else if (children != null) append(node, children);
  return node;
}
function append(parent, child) {
  if (child == null) return;
  if (typeof child === 'string') parent.appendChild(document.createTextNode(child));
  else parent.appendChild(child);
}
function chip(text, active = false, onClick = null, ghost = false) {
  const c = el('button', {
    class: `chip ${active ? 'active' : ''} ${ghost ? 'ghost' : ''}`,
    type: 'button',
    'aria-pressed': active,
    title: text
  }, text);
  if (onClick) c.addEventListener('click', onClick);
  return c;
}
function badge(text) { return el('span', { class: 'badge' }, text || ''); }

// --- 메인 ---
export default async function render(root) {
  // 상태
  let state = { q:'', branch:'전체', subTheme:'전체', books:[], branches:[] };

  // 데이터 로드 + 정규화
  try {
    const [rawBooks, rawBranches] = await Promise.all([
      fetchJSON('/src/data/books.json'),
      fetchJSON('/src/data/branches.json'),
    ]);
    state.books     = normalizeBooks(rawBooks);
    state.branches  = normalizeBranches(rawBranches);
  } catch (e) {
    showError(root, '데이터 로드 오류: ' + (e.message || e));
    return;
  }

  // 최소 유효성
  if (!isArray(state.branches)) {
    showError(root, 'branches 형식 오류: 배열이 아님');
    return;
  }

  // 뼈대 렌더
  root.innerHTML = '';
  const searchInput = el('input', { class:'search', placeholder:'도서명, 저자명, 출판사로 검색하세요', value: state.q });
  const branchRow  = el('div', { class:'row' }, el('span', { class:'label' }, '지점(인생테마)'), el('div', { class:'hscroll', id:'branchBar' }));
  const subRow     = el('div', { class:'row' }, el('span', { class:'label' }, '소분류'),       el('div', { class:'hscroll', id:'subBar' }));
  const tools      = el('div', { class:'toolbar' }, el('button', { class:'btn', id:'resetBtn' }, '필터 초기화'));
  const info       = el('div', { class:'muted', id:'meta' });
  const results    = el('div', { class:'results', id:'results' });

  root.append(
    searchInput, el('div', { style:'height:10px' }),
    branchRow, subRow, tools, el('div', { style:'height:6px' }),
    info, results
  );

  // 이벤트
  searchInput.addEventListener('input', () => { state.q = searchInput.value.trim(); safePaint(); });
  root.querySelector('#resetBtn').addEventListener('click', () => {
    state.q = ''; state.branch = '전체'; state.subTheme = '전체'; searchInput.value = ''; safePaint();
  });

  // 렌더 안전 래퍼
  function safePaint() {
    try { paint(); }
    catch (e) { showError(root, '렌더 오류: ' + (e.message || e)); }
  }

  // 실제 렌더
  function paint() {
    paintBranchChips();
    paintSubThemeChips();
    paintResults();
  }

  function paintBranchChips() {
    const bar = root.querySelector('#branchBar');
    bar.innerHTML = '';
    bar.append(chip('전체', state.branch === '전체', () => { state.branch='전체'; state.subTheme='전체'; safePaint(); }));
    state.branches.forEach(b => {
      const name  = b.branch || b.name || '';          // 방어적으로 키 확인
      const theme = b.lifeTheme || b.theme || '';
      const label = theme ? `${name} (${theme})` : name;
      bar.append(chip(label, state.branch === name, () => {
        state.branch = name; state.subTheme = '전체'; safePaint();
      }));
    });
  }

  function paintSubThemeChips() {
    const bar = root.querySelector('#subBar');
    bar.innerHTML = '';
    const active = state.branch === '전체'
      ? null
      : state.branches.find(b => (b.branch || b.name) === state.branch);

    if (!active) {
      bar.append(chip('전체', state.subTheme === '전체', () => { state.subTheme='전체'; safePaint(); }, true));
      bar.append(chip('지점을 먼저 선택하세요', false, null, true));
      return;
    }

    bar.append(chip('전체', state.subTheme === '전체', () => { state.subTheme='전체'; safePaint(); }));
    (active.subThemes || active.subthemes || []).forEach(st => {
      bar.append(chip(st, state.subTheme === st, () => { state.subTheme = st; safePaint(); }));
    });
  }

  function paintResults() {
    const { q, branch, subTheme, books } = state;
    const s = q.toLowerCase();
    const filtered = books.filter(b => {
      const matchesQ = !s ? true : [b.title,b.author,b.publisher,b.branch,b.subTheme]
        .filter(Boolean).some(v => String(v).toLowerCase().includes(s));
      const matchesBranch = branch === '전체' ? true : (b.branch === branch);
      const matchesSub    = subTheme === '전체' ? true : (b.subTheme === subTheme);
      return matchesQ && matchesBranch && matchesSub;
    });

    document.getElementById('meta').textContent =
      `총 ${filtered.length}권의 도서가 검색되었습니다.`;

    const box = document.getElementById('results');
    box.innerHTML = '';
    filtered.slice(0, 100).forEach(b => {
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
          badge(b.branch), badge(b.theme || b.lifeTheme || ''), badge(b.subTheme || '')
        )
      ));
    });
  }

  // 최초 렌더
  safePaint();
}

// --- 에러 표시 ---
function showError(root, msg) {
  root.innerHTML = '';
  root.append(
    el('div', { style:'color:#b00020;white-space:pre-wrap;background:#fff;border:1px solid #fecaca;padding:12px;border-radius:10px' }, msg)
  );
}
