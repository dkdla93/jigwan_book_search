export default class BookSearchApp {
  constructor({ books, branches }) {
    this.books = books ?? [];
    this.branches = branches ?? [];
    this.el = document.createElement('div');
    this.el.innerHTML = `
      <h1>지관서가 도서검색</h1>
      <p>총 <strong>${this.books.length}</strong>권 · 지점 <strong>${this.branches.length}</strong>곳</p>
      <input id="q" placeholder="제목/저자/출판사" />
      <div id="result" style="margin-top:12px;"></div>
    `;
    this.bind();
  }

  bind() {
    const input = this.el.querySelector('#q');
    const result = this.el.querySelector('#result');
    input.addEventListener('input', () => {
      const q = input.value.trim();
      const list = this.search(q);
      result.innerHTML = list.slice(0, 20).map(b => `
        <div>${b.title} · ${b.author} · ${b.publisher} (${b.year}) · ${b.branch}</div>
      `).join('') || (q ? '검색 결과 없음' : '');
    });
  }

  search(q) {
    if (!q) return [];
    const s = q.toLowerCase();
    return this.books.filter(b =>
      (b.title || '').toLowerCase().includes(s) ||
      (b.author || '').toLowerCase().includes(s) ||
      (b.publisher || '').toLowerCase().includes(s) ||
      (b.branch || '').toLowerCase().includes(s)
    );
  }
}
