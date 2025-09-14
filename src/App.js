export default async function render(root) {
  root.innerHTML = `<h1>지관서가 도서검색</h1><p>데이터 불러오는 중…</p>`;
  const $p = root.querySelector('p');

  try {
    // 동일 출처 정적 JSON을 안전하게 로드
    const [books, branches] = await Promise.all([
      fetch('/src/data/books.json').then(r => {
        if (!r.ok) throw new Error('books.json load failed: ' + r.status);
        return r.json();
      }),
      fetch('/src/data/branches.json').then(r => {
        if (!r.ok) throw new Error('branches.json load failed: ' + r.status);
        return r.json();
      })
    ]);

    $p.innerHTML = `총 <b>${books.length}</b>권 · 지점 <b>${branches.length}</b>곳`;
    
    // 간단 검색 UI
    const $input = document.createElement('input');
    $input.placeholder = '제목/저자/출판사';
    const $result = document.createElement('div');
    $result.style.marginTop = '12px';
    root.appendChild($input);
    root.appendChild($result);

    $input.addEventListener('input', () => {
      const s = $input.value.trim().toLowerCase();
      const list = s
        ? books.filter(b =>
            [b.title, b.author, b.publisher, b.branch]
              .filter(Boolean)
              .some(v => String(v).toLowerCase().includes(s))
          )
        : [];
      $result.innerHTML =
        list.slice(0, 30).map(b =>
          `<div>${b.title} · ${b.author ?? ''} · ${b.publisher ?? ''} (${b.year ?? ''}) · ${b.branch ?? ''}</div>`
        ).join('') || (s ? '검색 결과 없음' : '');
    });

  } catch (err) {
    $p.style.color = '#b00020';
    $p.style.whiteSpace = 'pre-wrap';
    $p.textContent = '데이터 로드 오류: ' + (err?.message || err);
  }
}
