/**
 * Taxonomy Style Helper
 *
 * Config-driven color resolver for categories and tags.
 * Category drives post background/text. Each category/tag can
 * define its own palette and optional text effects (outline, spark).
 *
 * Config path: theme.taxonomy_styles
 *
 * Helpers registered:
 *   getTxStyle(post)      → full resolved style for a post
 *   getTxCategoryStyle(categoryName) → style for a category chip
 *   getTxTagStyle(tagName, categoryName?) → style for a tag chip
 */

hexo.extend.helper.register("getTxStyle", function (post) {
	const ts = this.theme.taxonomy_styles;
	if (!ts || !ts.enable) return null;

	const defaults = ts.defaults || {};
	const categoriesMap = ts.categories || {};

	// Resolve first category name
	const cats = post.categories ? post.categories.data || post.categories : [];
	const firstCat =
		cats.length > 0
			? typeof cats[0] === "string"
				? cats[0]
				: cats[0].name
			: null;

	// Category config (or empty)
	const catConfig = firstCat ? categoriesMap[firstCat] || {} : {};

	// Resolve tag overrides: check if any tag has full style config
	const tagsMap = ts.tags || {};
	const postTags = post.tags ? post.tags.data || post.tags : [];
	let tagOverride = null;
	for (const t of postTags) {
		const tName = typeof t === "string" ? t : t.name;
		const tConfig = tagsMap[tName];
		if (tConfig && (tConfig.post || tConfig.title || tConfig.heading)) {
			tagOverride = tConfig;
			break;
		}
	}

	// Post palette: tag override → category override → defaults
	const postStyle = {
		bg:
			(tagOverride && tagOverride.post && tagOverride.post.bg) ||
			(catConfig.post && catConfig.post.bg) ||
			(defaults.post && defaults.post.bg) ||
			"#fffdfa",
		text:
			(tagOverride && tagOverride.post && tagOverride.post.text) ||
			(catConfig.post && catConfig.post.text) ||
			(defaults.post && defaults.post.text) ||
			"#1e3e3f",
	};

	// Title + heading colors: tag override → category override → defaults
	const titleColor =
		(tagOverride && tagOverride.title && tagOverride.title.color) ||
		(catConfig.title && catConfig.title.color) ||
		(defaults.title && defaults.title.color) ||
		null;
	const headingColor =
		(tagOverride && tagOverride.heading && tagOverride.heading.color) ||
		(catConfig.heading && catConfig.heading.color) ||
		(defaults.heading && defaults.heading.color) ||
		null;

	// Category chip palette
	const categoryChip = {
		bg:
			(catConfig.category && catConfig.category.bg) ||
			(defaults.category && defaults.category.bg) ||
			"#eef2f7",
		text:
			(catConfig.category && catConfig.category.text) ||
			(defaults.category && defaults.category.text) ||
			"#4f6370",
	};

	// Effects: tag override → category effects → defaults effects
	const defEffects = defaults.effects || {};
	const catEffects = catConfig.effects || {};
	const tagEffects = (tagOverride && tagOverride.effects) || {};

	// Title glow (text-shadow): tag override → category → defaults
	const titleGlow =
		(tagOverride && tagOverride.title && tagOverride.title.glow) ||
		(catConfig.title && catConfig.title.glow) ||
		(defaults.title && defaults.title.glow) ||
		null;

	const outline = mergeEffect(defEffects.outline, catEffects.outline, tagEffects.outline);
	const spark = mergeEffect(defEffects.spark, catEffects.spark, tagEffects.spark);

	return {
		category: firstCat,
		post: postStyle,
		categoryChip: categoryChip,
		titleColor,
		headingColor,
		titleGlow,
		tagDefault: catConfig.tag_default ||
			defaults.tag || { bg: "#eef2f7", text: "#4f6370" },
		effects: { outline, spark },
	};
});

/**
 * 由浅色配色自动推导深色模式的对应色。
 *
 * 背景：taxonomy_styles 里的配色是给浅色模式设计的（浅底 + 深字）。
 * 深色模式下如果照搬，每个胶囊都会变成一块亮斑 —— 实测 /tags/ 页
 * 六个胶囊、/categories/ 页两个，计算背景色都是 rgb(238,242,251) 这种亮色。
 *
 * 为什么不要求在配置里为每个分类再手写一套 dark 配色：
 * 那样新增分类很容易漏写，而漏写的表现是「深色页面里突然冒出一块白」——
 * 属于不容易在本地发现、上线才被看到的那类问题。
 * 所以这里按「保持色相、翻转明度」自动推导：
 *   深色底 = 同色相，饱和度压到 55%，明度 20%
 *   深色字 = 同色相，明度 80%
 * 实测对比度约 7~8:1（例：#eef2fb → 底 #222c44 / 字 #bcc6dc）。
 *
 * 只认 #rgb 与 #rrggbb；认不出来就退回中性深灰，绝不返回浅色。
 */
function withDark(style) {
	style = style || {};
	style.dBg = "#26313d";
	style.dText = "#b6c2d0";

	const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(String(style.bg || "").trim());
	if (!m) return style;
	let h = m[1];
	if (h.length === 3) h = h.split("").map((c) => c + c).join("");

	const r = parseInt(h.slice(0, 2), 16) / 255;
	const g = parseInt(h.slice(2, 4), 16) / 255;
	const b = parseInt(h.slice(4, 6), 16) / 255;
	const max = Math.max(r, g, b);
	const min = Math.min(r, g, b);
	const l = (max + min) / 2;
	let hue = 0;
	let sat = 0;
	if (max !== min) {
		const d = max - min;
		sat = l > 0.5 ? d / (2 - max - min) : d / (max + min);
		if (max === r) hue = (g - b) / d + (g < b ? 6 : 0);
		else if (max === g) hue = (b - r) / d + 2;
		else hue = (r - g) / d + 4;
		hue *= 60;
	}

	function hsl(hh, ss, ll) {
		const c = (1 - Math.abs(2 * ll - 1)) * ss;
		const x = c * (1 - Math.abs(((hh / 60) % 2) - 1));
		const mm = ll - c / 2;
		let rr, gg, bb;
		if (hh < 60) { rr = c; gg = x; bb = 0; }
		else if (hh < 120) { rr = x; gg = c; bb = 0; }
		else if (hh < 180) { rr = 0; gg = c; bb = x; }
		else if (hh < 240) { rr = 0; gg = x; bb = c; }
		else if (hh < 300) { rr = x; gg = 0; bb = c; }
		else { rr = c; gg = 0; bb = x; }
		const to = (v) => Math.round((v + mm) * 255).toString(16).padStart(2, "0");
		return "#" + to(rr) + to(gg) + to(bb);
	}

	style.dBg = hsl(hue, Math.min(0.5, sat * 0.55), 0.2);
	style.dText = hsl(hue, Math.min(0.45, sat * 0.5), 0.8);
	return style;
}

hexo.extend.helper.register("getTxCategoryStyle", function (categoryName) {
	const ts = this.theme.taxonomy_styles;
	if (!ts || !ts.enable) return null;

	const defaults = ts.defaults || {};
	const categoriesMap = ts.categories || {};
	const catConfig = categoryName ? categoriesMap[categoryName] || {} : {};

	return withDark({
		bg:
			(catConfig.category && catConfig.category.bg) ||
			(defaults.category && defaults.category.bg) ||
			"#eef2f7",
		text:
			(catConfig.category && catConfig.category.text) ||
			(defaults.category && defaults.category.text) ||
			"#4f6370",
	});
});

hexo.extend.helper.register("getTxTagStyle", function (tagName, categoryName) {
	const ts = this.theme.taxonomy_styles;
	if (!ts || !ts.enable) return null;

	const defaults = ts.defaults || {};
	const tagsMap = ts.tags || {};
	const categoriesMap = ts.categories || {};

	// Priority: explicit tag override → category's tag_default → global default
	if (tagsMap[tagName]) {
		return withDark({ bg: tagsMap[tagName].bg, text: tagsMap[tagName].text });
	}

	if (
		categoryName &&
		categoriesMap[categoryName] &&
		categoriesMap[categoryName].tag_default
	) {
		const td = categoriesMap[categoryName].tag_default;
		return withDark({ bg: td.bg, text: td.text });
	}

	return withDark({
		bg: (defaults.tag && defaults.tag.bg) || "#eef2f7",
		text: (defaults.tag && defaults.tag.text) || "#4f6370",
	});
});

/**
 * Merge effect config: base defaults → category overrides → tag overrides.
 */
function mergeEffect(base, override, tagOverride) {
	base = base || {};
	override = override || {};
	tagOverride = tagOverride || {};
	// Merge base + category first
	const merged = {
		enable:
			override.enable !== undefined ? override.enable : base.enable || false,
		color: override.color || base.color || "#00000033",
		width: override.width || base.width || "1px",
		blur: override.blur || base.blur || "8px",
		opacity:
			override.opacity !== undefined
				? override.opacity
				: base.opacity !== undefined
					? base.opacity
					: 0.35,
		duration: override.duration || base.duration || "2.6s",
	};
	// Then apply tag override on top
	return {
		enable:
			tagOverride.enable !== undefined ? tagOverride.enable : merged.enable,
		color: tagOverride.color || merged.color,
		width: tagOverride.width || merged.width,
		blur: tagOverride.blur || merged.blur,
		opacity:
			tagOverride.opacity !== undefined ? tagOverride.opacity : merged.opacity,
		duration: tagOverride.duration || merged.duration,
	};
}
