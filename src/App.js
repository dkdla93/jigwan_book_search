// ⚠️ 브라우저 모듈은 "상대경로 + .js 확장자" 필수
import { books } from './data/books.js';
import { branches } from './data/branches.js';
import BookSearchApp from './components/BookSearchApp.js';

export default function render(root) {
  console.log('[App] 시작', { bookCount: books?.length, branchCount: branches?.length });
  const app = new BookSearchApp({ books, branches });
  root.innerHTML = '';            // 초기화
  root.appendChild(app.el);       // 컴포넌트 DOM 삽입
}
