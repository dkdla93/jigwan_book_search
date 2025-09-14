// JSON 모듈 import (브라우저 지원됨)
import books from './data/books.json' assert { type: 'json' };
import branches from './data/branches.json' assert { type: 'json' };

export default function render(root) {
  root.innerHTML = `
    <h1>지관서가 도서검색</h1>
    <p>총 <b>${books.length}</b>권 · 지점 <b>${branches.length}</b>곳</p>
    <input id="q" placeholder="제목/저자/출판사" />
    <div id="result" style="margin-top:12px"></div>
  `;

  const $q = root.querySelector('#q');
  const $result = root.querySelector('#result');

  $q.addEventListener('input', () => {
    const s = $q.value.trim().toLowerCase();
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
}
