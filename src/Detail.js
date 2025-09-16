const root = document.getElementById("detail-app");
if (!root) {
  throw new Error("상세 페이지 컨테이너를 찾을 수 없습니다.");
}

const params = new URLSearchParams(window.location.search);
const rawIsbn = params.get("isbn") || "";
const isbn = rawIsbn.replace(/[^0-9Xx]/g, "");

const isArray = Array.isArray;
const normalizeBooks = (x) => (isArray(x) ? x : (x && isArray(x.books)) ? x.books : []);

function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const key in attrs) node.setAttribute(key, attrs[key]);
  children.flat(10).forEach((child) => {
    if (child == null) return;
    if (typeof child === "string") node.appendChild(document.createTextNode(child));
    else node.appendChild(child);
  });
  return node;
}

function showMessage(text, type = "info") {
  root.innerHTML = "";
  const box = el(
    "div",
    { class: `detail-message ${type}` },
    el("p", {}, text)
  );
  root.append(box);
}

function sanitizeDetailText(text) {
  if (!text) return "";
  let s = String(text);
  s = s.replace(/<\s*br\s*\/?\s*>/gi, "\n");
  s = s.replace(/<\s*\/p\s*>/gi, "\n\n");
  s = s.replace(/<[^>]+>/g, " ");
  s = s.replace(/&nbsp;/gi, " ");
  s = s.replace(/\r?\n\s*\r?\n/g, "\n\n");
  return s.replace(/[\t\r]+/g, " ").trim();
}

function buildParagraphs(text) {
  if (!text) return [el("p", { class: "detail-empty" }, "제공된 내용이 없습니다.")];
  const lines = text
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (!lines.length) return [el("p", { class: "detail-empty" }, "제공된 내용이 없습니다.")];
  return lines.map((line) => el("p", { class: "detail-paragraph" }, line));
}

function metaRow(label, value) {
  if (!value) return null;
  return [
    el("dt", { class: "detail-term" }, label),
    el("dd", { class: "detail-desc" }, value),
  ];
}

function buildSection(title, text, emptyFallback) {
  const section = el("section", { class: "detail-section" }, el("h2", { class: "detail-section-title" }, title));
  const body = el("div", { class: "detail-section-body" });
  if (!text) {
    body.append(el("p", { class: "detail-empty" }, emptyFallback));
  } else {
    buildParagraphs(text).forEach((node) => body.append(node));
  }
  section.append(body);
  return section;
}

function normalizeIsbnFromBook(book) {
  return (book?.isbn13 || book?.isbn || "").replace(/[^0-9Xx]/g, "");
}

function paint(detail, book) {
  root.innerHTML = "";

  const backBtn = el("button", { class: "detail-back", type: "button" }, "← 목록으로 돌아가기");
  backBtn.addEventListener("click", () => {
    if (window.history.length > 1) window.history.back();
    else window.location.href = "./";
  });

  const header = el("div", { class: "detail-header" }, backBtn);
  if (detail.link) {
    header.append(
      el(
        "a",
        {
          class: "detail-link",
          href: detail.link,
          target: "_blank",
          rel: "noopener noreferrer",
        },
        "알라딘에서 보기 ↗"
      )
    );
  }

  const cover = detail.cover
    ? el("img", { class: "detail-cover", src: detail.cover, alt: `${detail.title || "도서"} 표지`, loading: "lazy" })
    : el("div", { class: "detail-cover placeholder" }, "표지 이미지를 불러오지 못했습니다.");

  const metaItems = [];
  metaItems.push(
    ...(
      metaRow("저자", detail.author || book?.author) || []
    )
  );
  metaItems.push(
    ...(
      metaRow("출판사", detail.publisher || book?.publisher) || []
    )
  );
  const pub = detail.pubDate || (book?.year ? `${book.year}` : "");
  if (pub) metaItems.push(...(metaRow("발행일", pub) || []));
  if (book?.branch) {
    const branchValue = book.theme ? `${book.branch} · ${book.theme}` : book.branch;
    metaItems.push(...(metaRow("지점/테마", branchValue) || []));
  }
  if (book?.subTheme || book?.theme) {
    metaItems.push(...(metaRow("소분류", book.subTheme || book.theme) || []));
  }
  metaItems.push(...(metaRow("ISBN", isbn) || []));

  const metaList = el("dl", { class: "detail-meta" }, metaItems);

  const title = el("h1", { class: "detail-title" }, detail.title || book?.title || "도서 상세");

  const headerInfo = el("div", { class: "detail-info" }, title, metaList);
  const hero = el("div", { class: "detail-hero" }, cover, headerInfo);

  const descriptionText = sanitizeDetailText(detail.description || "");
  const tocText = sanitizeDetailText(detail.toc || "");

  const sections = [
    buildSection("소개", descriptionText, "알라딘에서 소개 내용을 제공하지 않았습니다."),
    buildSection("목차", tocText, "알라딘에서 목차 정보를 제공하지 않았습니다."),
  ];

  const container = el("article", { class: "detail-card" }, header, hero, ...sections);
  root.append(container);

  document.title = `${detail.title || book?.title || "도서 상세"} – 지관서가 도서검색`;
}

(async function init() {
  if (!isbn) {
    showMessage("잘못된 접근입니다. ISBN 정보가 없습니다.", "error");
    return;
  }

  showMessage("상세 정보를 불러오는 중입니다…", "loading");

  try {
    const detailResponse = await fetch(`/api/aladin-detail?isbn=${encodeURIComponent(isbn)}`);
    if (!detailResponse.ok) throw new Error(`상세 정보 요청 실패(${detailResponse.status})`);
    const detailData = await detailResponse.json();
    if (!detailData?.ok) throw new Error(detailData?.error || "상세 정보를 불러오지 못했습니다.");

    let book = null;
    try {
      const rawBooks = await fetch("/src/data/books.json", { cache: "no-store" }).then((r) => (r.ok ? r.json() : null));
      const books = normalizeBooks(rawBooks);
      book = books.find((item) => normalizeIsbnFromBook(item) === isbn) || null;
    } catch (err) {
      console.warn("books.json 로드 실패", err);
    }

    paint(detailData, book);
  } catch (err) {
    console.error(err);
    showMessage(`상세 정보를 불러오는 중 오류가 발생했습니다. ${err?.message ? `(${err.message})` : ""}`, "error");
  }
})();
