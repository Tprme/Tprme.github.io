/* ============================================================
   CSS 压缩核心（纯函数，不依赖 hexo）
   ------------------------------------------------------------
   放在 scripts/ 之外，是为了让构建脚本和验证脚本能共用同一份实现 ——
   验证必须针对「真正跑在构建里的那个函数」，不能是复制品。
   Hexo 只扫描 scripts/ 目录，所以这个文件不会被当成 Hexo 脚本加载。

   只做三件事，全是无语义风险的：
     1. 删注释
     2. 空白折叠成一个空格
     3. 去掉 `{` `}` `;` `,` 附近以及「块内冒号后」的空格
   不做选择器合并、不做属性简写、不做规则去重。

   两个必须小心的点：
     - 字符串（引号内）原样跳过。`[style*="display: none"]` 里的空格
       一旦被吃掉，属性选择器的匹配语义就变了。
     - 冒号后的空格只在 depth >= 1（块内）才删。
       这样 `@media (hover: hover)` 的冒号在 depth 0、空格保留；
       `a :hover` 这种后代选择器也不会被误改成 `a:hover`。
   ============================================================ */
'use strict';

function lyMinifyCss(css) {
    let out = '';
    let i = 0;
    const n = css.length;
    let depth = 0;
    const isSpace = c => c === ' ' || c === '\t' || c === '\n' || c === '\r' || c === '\f';

    while (i < n) {
        const c = css[i];

        // 注释：整段丢弃
        if (c === '/' && css[i + 1] === '*') {
            const end = css.indexOf('*/', i + 2);
            i = end < 0 ? n : end + 2;
            continue;
        }

        // 字符串：原样复制
        if (c === '"' || c === "'") {
            let j = i + 1;
            while (j < n) {
                if (css[j] === '\\') { j += 2; continue; }
                if (css[j] === c) { j++; break; }
                j++;
            }
            out += css.slice(i, j);
            i = j;
            continue;
        }

        // 空白：折叠成 0 或 1 个空格
        if (isSpace(c)) {
            let j = i;
            while (j < n && isSpace(css[j])) j++;
            const next = css[j];
            const prev = out[out.length - 1];
            const drop =
                next === undefined || next === '{' || next === '}' || next === ';' || next === ',' ||
                prev === undefined || prev === '{' || prev === ';' || prev === ',' ||
                (prev === ':' && depth >= 1);
            if (!drop) out += ' ';
            i = j;
            continue;
        }

        if (c === '{') depth++;
        else if (c === '}') depth = Math.max(0, depth - 1);
        out += c;
        i++;
    }
    return out;
}

module.exports = { lyMinifyCss };
