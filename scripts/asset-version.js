/* 给自托管静态资源加「内容指纹」，解决「部署了新版本但用户仍看到旧的」。

   背景：GitHub Pages 对包括 HTML 在内的所有资源都返回
   `cache-control: max-age=600`。浏览器在这 10 分钟里直接用磁盘缓存、
   连请求都不发，于是会出现最迷惑人的混合状态：
   HTML 已经更新、而它引用的 CSS/JS 还是旧的 —— 表现就是
   「明明改了，刷新却还是老样子」。

   做法：按文件内容算一个短 hash 拼到 URL 上。
   内容没变的资源 URL 不变，继续吃缓存；内容变了的 URL 就变，
   浏览器必定重新拉取，不存在「新 HTML 配旧 CSS」。

   为什么不用构建时间戳：那样每次部署都会让所有资源同时失效，
   用户每次都要重下全部 CSS/JS。能用，但白白浪费带宽，
   而且失去了「只有改动过的文件才失效」这个好处。

   用法：模板里把 url_for 换成 asset_url 即可，例如
     <link rel="stylesheet" href="<%- asset_url("/css/custom.css") %>" /> */
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const hashCache = Object.create(null);

/* 同一个 URL 在一次构建里只算一次 */
function hashOf(url) {
    if (hashCache[url] !== undefined) return hashCache[url];
    const rel = String(url).replace(/^\//, '').split('?')[0];
    const candidates = [
        path.join(hexo.source_dir, rel), // 站点级：source/css/custom.css
        path.join(hexo.theme_dir, 'source', rel), // 主题级：themes/loststar/source/js/lib/glass.js
    ];
    let v = '';
    for (const file of candidates) {
        try {
            if (fs.statSync(file).isFile()) {
                let buf = fs.readFileSync(file);
                /* .css 会在 after_generate 里被 minify-css.js 压缩后再写进 public/。
                   指纹必须算在「实际发出去的那份内容」上：
                   否则哪天改了压缩规则而源文件没动，URL 不变，
                   浏览器会继续吃旧缓存，问题极难查。
                   （minify-css.js 按字母序在 asset-version.js 之后加载，
                     但 hashOf 是渲染时才调用的，那时已经挂上来了。） */
                if (file.endsWith('.css') && typeof hexo._lyMinifyCss === 'function') {
                    buf = Buffer.from(hexo._lyMinifyCss(buf.toString('utf8')), 'utf8');
                }
                v = crypto.createHash('md5').update(buf).digest('hex').slice(0, 8);
                break;
            }
        } catch (e) {
            /* 文件不存在就试下一个候选路径 */
        }
    }
    hashCache[url] = v;
    return v;
}

hexo.extend.helper.register('asset_url', function (url) {
    const urlFor = hexo.extend.helper.get('url_for');
    const full = urlFor ? urlFor.call(this, url) : url;
    const v = hashOf(url);
    return v ? full + '?v=' + v : full;
});
