// 반드시 상대경로 + .js 확장자
import { books } from './data/books.js';
import { branches } from './data/branches.js';

export default function render(root) {
  root.innerHTML = `
    <h1>지관서가 도서검색</h1>
    <p>총 <b>${Array.isArray(books) ? books.length : 0}</b>권 · 지점 <b>${Array.isArray(branches) ? branches.length : 0}</b>곳</p>
  `;
}
