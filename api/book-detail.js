// /api/book-detail.js
// 한 번의 호출로 알라딘 + Data4Library + OpenLibrary(+NLK 일부)를 모아 반환
// ENV: ALADIN_TTBKEY, DATA4LIBRARY_KEY, (선택) NLK_API_KEY

const J = (r) => r.json();
const T = (r) => r.text();

async function tryFetchJson(url) {
  try { const r = await fetch(url, { timeout: 15000 }); if (!r.ok) throw 0; return await J(r); }
  catch { return null; }
}
async function tryFetchText(url) {
  try { const r = await fetch(url, { timeout: 15000 }); if (!r.ok) throw 0; return await T(r); }
  catch { return null; }
}

// 아주 가벼운 XML 파서(필요 태그만)
function pickXml(xml, tagNames) {
  const out = {};
  (tagNames || []).forEach(tag => {
    const m = xml?.match(new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`, 'i'));
    out[tag] = m ? m[1].replace(/\s+/g, " ").trim() : "";
  });
  return out;
}

export default async function handler(req, res) {
  const { isbn = "" } = req.query;
  if (!isbn) return res.status(400).json({ ok:false, error:"Missing isbn" });

  const result = {
    ok: true,
    isbn,
    title: "", author: "", publisher: "", pubYear: "",
    description: "",
    toc: [],                       // [{title, pagenum?}]
    cover: { best:"", sources:{}}, // sources: { aladin, data4lib, openlib }
    externalLinks: {},            // { aladin, openLibrary, nlk }
  };

  // ---------- 1) 알라딘 ItemLookUp (link/고품질 커버) ----------
  const ttb = process.env.ALADIN_TTBKEY;
  if (ttb) {
    const aladinUrl = `https://www.aladin.co.kr/ttb/api/ItemLookUp.aspx?ttbkey=${encodeURIComponent(ttb)}&itemIdType=ISBN13&ItemId=${encodeURIComponent(isbn)}&output=js&Version=20131101`;
    const aladin = await tryFetchJson(aladinUrl);
    const item = aladin?.item?.[0];
    if (item) {
      result.externalLinks.aladin = item.link || "";
      result.cover.sources.aladin = item.coverLarge || item.cover || "";
      // 일부 응답엔 description이 오기도 하나 보장X → fallback으로만 사용
      if (!result.description && item.description) result.description = String(item.description).trim();
      // 기본 서지 보정
      result.title ||= item.title || "";
      result.author ||= item.author || "";
      result.publisher ||= item.publisher || "";
      if (!result.pubYear && item.pubDate) result.pubYear = String(item.pubDate).slice(0,4);
    }
  }

  // ---------- 2) Data4Library 상세(설명/표지) ----------
  const d4lKey = process.env.DATA4LIBRARY_KEY;
  if (d4lKey) {
    const p = new URLSearchParams({ authKey:d4lKey, isbn13:isbn, loaninfoYN:"N" });
    const xml = await tryFetchText(`https://data4library.kr/api/srchDtlList?${p}`);
    if (xml) {
      const picked = pickXml(xml, ["bookImageURL","description","bookname","authors","publisher","publication_year"]);
      if (!result.description && picked.description) result.description = picked.description;
      if (!result.cover.sources.data4lib && picked.bookImageURL) result.cover.sources.data4lib = picked.bookImageURL;
      // 기본 서지 보정
      result.title ||= picked.bookname || "";
      result.author ||= picked.authors || "";
      result.publisher ||= picked.publisher || "";
      result.pubYear ||= picked.publication_year || "";
    }
  }

  // ---------- 3) OpenLibrary(TOC/추가 메타) ----------
  // edition → table_of_contents, works 링크
  const olEdition = await tryFetchJson(`https://openlibrary.org/isbn/${encodeURIComponent(isbn)}.json`);
  if (olEdition) {
    result.externalLinks.openLibrary = `https://openlibrary.org${olEdition.key || ""}`;
    // TOC (간혹 edition이나 work 중 하나에 존재)
    if (Array.isArray(olEdition.table_of_contents)) {
      result.toc = olEdition.table_of_contents.map(v => ({ title: v.title || v.label || v?.pagenum || "", pagenum: v.pagenum || "" })).filter(x => x.title);
    }
    // OL 표지
    if (Array.isArray(olEdition.covers) && olEdition.covers.length) {
      const id = olEdition.covers[0];
      result.cover.sources.openlib = `https://covers.openlibrary.org/b/id/${id}-L.jpg`;
    }
    // works 에도 TOC가 있을 수 있음
    const works = Array.isArray(olEdition.works) ? olEdition.works : [];
    if (!result.toc.length && works[0]?.key) {
      const work = await tryFetchJson(`https://openlibrary.org${works[0].key}.json`);
      if (Array.isArray(work?.table_of_contents)) {
        result.toc = work.table_of_contents.map(v => ({ title: v.title || v.label || v?.pagenum || "", pagenum: v.pagenum || "" })).filter(x => x.title);
      }
    }
  }

  // ---------- 4) NLK(보강용) ----------
  const nlk = process.env.NLK_API_KEY;
  if (nlk) {
    const q = new URLSearchParams({ key:nlk, detailSearch:"true", isbnOp:"isbn", isbnCode:isbn, pageNum:"1", pageSize:"1" });
    const xml = await tryFetchText(`https://www.nl.go.kr/NL/search/openApi/search.do?${q}`);
    if (xml) {
      const picked = pickXml(xml, ["title-info","author-info","pub-info","pub-year"]);
      result.title ||= picked["title-info"] || "";
      result.author ||= picked["author-info"] || "";
      result.publisher ||= picked["pub-info"] || "";
      result.pubYear ||= picked["pub-year"] || "";
      result.externalLinks.nlk = "https://www.nl.go.kr/NL/search/openApi/openApiList.do";
    }
  }

  // ---------- 커버 우선순위 & 정제 ----------
  result.cover.best = result.cover.sources.aladin || result.cover.sources.data4lib || result.cover.sources.openlib || "";
  // 설명 줄이기(과도한 공백 제거)
  result.description = (result.description || "").replace(/\s+/g, " ").trim();

  res.setHeader("Cache-Control", "s-maxage=86400, stale-while-revalidate");
  return res.status(200).json(result);
}
