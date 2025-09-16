// /api/aladin-detail.js
export default async function handler(req, res) {
  try {
    const { isbn } = req.query;
    const key = process.env.ALADIN_TTBKEY;

    if (!key) return res.status(500).json({ ok: false, error: "Missing ALADIN_TTBKEY" });
    if (!isbn) return res.status(400).json({ ok: false, error: "Missing isbn" });

    const lookup = async (itemIdType) => {
      const base = new URL("https://www.aladin.co.kr/ttb/api/ItemLookUp.aspx");
      base.searchParams.set("ttbkey", key);
      base.searchParams.set("itemIdType", itemIdType);
      base.searchParams.set("ItemId", isbn);
      base.searchParams.set("output", "js");
      base.searchParams.set("Version", "20131101");
      base.searchParams.set("OptResult", "FullDescription,Toc");
      const r = await fetch(base.toString());
      if (!r.ok) throw new Error(`Aladin ${r.status}`);
      return r.json();
    };

    let data = await lookup("ISBN13").catch(() => null);
    if (!data || !data.item || !data.item.length) {
      data = await lookup("ISBN");
    }

    const item = data?.item?.[0] || null;

    if (!item) {
      return res.status(200).json({ ok: false, isbn, error: "No item found" });
    }

    const cover =
      item.coverLarge || item.cover || item.coverSmall || item.coverS || item.coverMini || "";

    res.setHeader("Cache-Control", "s-maxage=86400, stale-while-revalidate");
    return res.status(200).json({
      ok: true,
      isbn,
      title: item.title,
      author: item.author,
      publisher: item.publisher,
      pubDate: item.pubDate,
      cover,
      description: item.fullDescription || item.description || "",
      toc: item.toc || "",
      link: item.link,
    });
  } catch (e) {
    return res.status(200).json({ ok: false, error: String(e) });
  }
}
