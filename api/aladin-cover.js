// /api/aladin-cover.js
export default async function handler(req, res) {
  try {
    const { isbn } = req.query;
    const key = process.env.ALADIN_TTBKEY;

    if (!key) return res.status(500).json({ error: "Missing ALADIN_TTBKEY" });
    if (!isbn) return res.status(400).json({ error: "Missing isbn" });

    // 먼저 ISBN13으로 시도, 실패 시 ISBN10 재시도
    const lookup = async (itemIdType) => {
      const url = `https://www.aladin.co.kr/ttb/api/ItemLookUp.aspx?ttbkey=${encodeURIComponent(
        key
      )}&itemIdType=${itemIdType}&ItemId=${encodeURIComponent(
        isbn
      )}&output=js&Version=20131101`;
      const r = await fetch(url);
      if (!r.ok) throw new Error(`Aladin ${r.status}`);
      return r.json();
    };

    let data = await lookup("ISBN13").catch(() => null);
    if (!data || !data.item || !data.item.length) {
      data = await lookup("ISBN");
    }

    const item = data?.item?.[0] || null;
    const cover =
      item?.cover || item?.coverLarge || item?.coverSmall || item?.coverS || "";

    res.setHeader("Cache-Control", "s-maxage=86400, stale-while-revalidate");
    return res.status(200).json({
      ok: true,
      isbn,
      cover,
      title: item?.title,
      publisher: item?.publisher,
      author: item?.author,
      link: item?.link,
    });
  } catch (e) {
    return res.status(200).json({ ok: false, error: String(e) });
  }
}
