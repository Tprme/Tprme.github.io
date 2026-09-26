/* ============================================================
   按分享图的实际宽高决定用哪种卡片
   ------------------------------------------------------------
   为什么要按尺寸判断，而不是一刀切：
     - summary            小方图卡片（缩略图被裁成正方形）
     - summary_large_image 大图卡片（图在顶部整条铺开，约 1.91:1）
   本站的图有两种典型形态：
     默认分享图 share-default.jpg  1200x630（约 1.9:1）→ 适合大图卡片
     文章 cover 例如中秋那篇        1107x1476（竖图 0.75:1）→ 大图卡片会被
       平台从中间裁成 1.91:1，竖图会被裁掉上下大半，很难看
   所以这里读一下本地文件的真实宽高，宽高比达到阈值才用大图卡片。

   顺带说明：这个判断在构建期做（Node 读文件头），
   不是运行时 —— 页面上就是一个写死的 meta 值，没有任何额外开销。

   读不到的（外链、格式不认识）一律退回 summary，保守但不会出错。
   ============================================================ */
const fs = require("fs");
const path = require("path");

/* 宽高比达到这个值才认为「这是一张宽图」，可以用大图卡片。
   1.5 是留了余量的取值：主流大图卡片是 1.91:1，
   但 1.5 以上的图裁成 1.91:1 也不会损失太多。 */
const WIDE_RATIO = 1.5;

function pngSize(b) {
	if (b.length < 24 || b.readUInt32BE(0) !== 0x89504e47) return null;
	return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
}

function gifSize(b) {
	if (b.length < 10 || b.toString("ascii", 0, 3) !== "GIF") return null;
	return { w: b.readUInt16LE(6), h: b.readUInt16LE(8) };
}

function jpegSize(b) {
	if (b.length < 4 || b[0] !== 0xff || b[1] !== 0xd8) return null;
	let i = 2;
	while (i < b.length - 9) {
		if (b[i] !== 0xff) { i++; continue; }
		const m = b[i + 1];
		/* SOF0..SOF15，排除 DHT(c4) / JPG(c8) / DAC(cc) */
		if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) {
			return { h: b.readUInt16BE(i + 5), w: b.readUInt16BE(i + 7) };
		}
		if (m === 0xd8 || (m >= 0xd0 && m <= 0xd9)) { i += 2; continue; }
		i += 2 + b.readUInt16BE(i + 2);
	}
	return null;
}

function webpSize(b) {
	if (b.length < 30 || b.toString("ascii", 0, 4) !== "RIFF" || b.toString("ascii", 8, 12) !== "WEBP") return null;
	const fmt = b.toString("ascii", 12, 16);
	if (fmt === "VP8 ") {
		/* 有损：跳过 3 字节帧标签 + 3 字节同步码，再读 14 位宽高 */
		return { w: b.readUInt16LE(26) & 0x3fff, h: b.readUInt16LE(28) & 0x3fff };
	}
	if (fmt === "VP8L") {
		/* 无损：1 字节签名后是 14 位宽-1 / 14 位高-1 */
		const n = b.readUInt32LE(21);
		return { w: (n & 0x3fff) + 1, h: ((n >> 14) & 0x3fff) + 1 };
	}
	if (fmt === "VP8X") {
		/* 扩展：3 字节宽-1 / 3 字节高-1（小端） */
		const w = b[24] | (b[25] << 8) | (b[26] << 16);
		const h = b[27] | (b[28] << 8) | (b[29] << 16);
		return { w: w + 1, h: h + 1 };
	}
	return null;
}

function imageSize(file) {
	let b;
	try { b = fs.readFileSync(file); } catch (e) { return null; }
	return pngSize(b) || jpegSize(b) || gifSize(b) || webpSize(b);
}

hexo.extend.helper.register("ogCardType", function (image) {
	const fallback = "summary";
	const url = String(image || "");
	if (!url) return fallback;

	/* ★ 注意：layout.ejs 里传进来的 seoImage 已经被拼成绝对地址了
	   （config.url + url_for(...)）。所以不能一看到 http 就当外链跳过 ——
	   第一版就是这么写的，结果永远返回 summary，宽高判断形同虚设。
	   这里先把「本站 origin」剥掉，剥不掉才当成真外链。 */
	let rel;
	const site = String(hexo.config.url || "").replace(/\/+$/, "");
	if (/^https?:\/\//i.test(url)) {
		if (!site || url.indexOf(site) !== 0) return fallback;
		rel = url.slice(site.length).replace(/^\//, "");
	} else {
		rel = url.replace(/^\//, "");
	}
	rel = rel.split("?")[0];

	const candidates = [
		path.join(hexo.source_dir, rel),
		path.join(hexo.theme_dir, "source", rel),
	];
	for (const f of candidates) {
		try {
			if (!fs.statSync(f).isFile()) continue;
		} catch (e) { continue; }
		const s = imageSize(f);
		if (!s || !s.w || !s.h) return fallback;
		const ratio = s.w / s.h;
		return ratio >= WIDE_RATIO ? "summary_large_image" : fallback;
	}
	return fallback;
});
