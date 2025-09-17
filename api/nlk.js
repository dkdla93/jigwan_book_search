// api/nlk.js
export default async function handler(req, res) {
  const { isbn } = req.query;
  if (!isbn) return res.status(400).json({ error: 'isbn required' });

  // NLK는 응답 스펙이 컬렉션마다 다른데, ISBN 키워드 검색으로 유연하게 긁어서 요약 필드들을 최대한 추출
  try {
    const key = process.env.NLK_KEY;
    const url =
      `https://www.nl.go.kr/NL/search/openApi/search.do?key=${key}&apiType=json&srchTarget=book&kwd=${encodeURIComponent(isbn)}`;

    const r = await fetch(url);
    if (!r.ok) throw new Error(`NLK ${r.status}`);
    const data = await r.json();

    // 응답 구조를 느슨하게 파싱 (항상 존재하지 않음)
    const rec = (((data || {}).result || {}).item || [])[0] || {};

    const normalized = {
      provider: 'nlk',
      title: rec.titleInfo || rec.title || '',
      author: rec.authorInfo || rec.author || '',
      publisher: rec.pubInfo || rec.publisher || '',
      pubDate: rec.pubYy || rec.pubDate || '',
      pages: rec.page || '',
      link: rec.link || '',
      // 아래 필드명은 컬렉션에 따라 다름 → 존재하면 취합
      intro: rec.description || rec.abstract || '',
      authorIntro: rec.authorIntro || '',
      pubReview: rec.publisherReview || '',
      toc: rec.tableOfContents || rec.toc || '',
      categories: rec.classNo ? [String(rec.classNo)] : []
    };

    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=86400');
    return res.status(200).json(normalized);
  } catch (e) {
    return res.status(200).json({ provider: 'nlk', error: String(e) });
  }
}
