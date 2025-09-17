// api/aladin-item.js
export default async function handler(req, res) {
  const { isbn13 } = req.query;
  if (!isbn13) return res.status(400).json({ error: 'isbn13 required' });

  try {
    const key = process.env.ALADIN_TTBKEY; // 기존 aladin-cover와 동일한 방식
    const url = `https://www.aladin.co.kr/ttb/api/ItemLookUp.aspx?ttbkey=${key}&itemIdType=ISBN13&ItemId=${isbn13}&output=js&Version=20131101&OptResult=fulldescription,summary,story,toc,reviewList,subInfo`;

    const r = await fetch(url);
    if (!r.ok) throw new Error(`Aladin ${r.status}`);
    const text = await r.text();

    // 알라딘 JS 포맷은 콜백 없이 JSON으로 내려오므로 JSON.parse
    let data;
    try { data = JSON.parse(text); } catch (_) { data = {}; }

    const first = (data && data.item && data.item[0]) || {};
    const sub = first.subInfo || {};

    // 정규화
    const normalized = {
      provider: 'aladin',
      title: first.title,
      author: first.author,
      publisher: first.publisher,
      pubDate: first.pubDate,
      pages: first.itemPage,
      link: first.link,
      cover: first.cover, // fallback 용
      intro: sub.bookIntro || first.description || '',
      authorIntro: sub.authorIntro || '',
      pubReview: sub.publisherReview || '',
      toc: sub.tableOfContents || sub.toc || '',
      categories: first.categoryName ? [first.categoryName] : []
    };

    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=86400');
    return res.status(200).json(normalized);
  } catch (e) {
    return res.status(200).json({ provider: 'aladin', error: String(e) });
  }
}
