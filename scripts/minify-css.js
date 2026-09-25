/* ============================================================
   CSS 压缩（构建钩子）
   ------------------------------------------------------------
   线上 custom.css 是 95.5 KB、gzip 后 34.0 KB。里面相当大一部分是
   中文注释与缩进空白，而 gzip 对中文注释的压缩率不如英文
   （UTF-8 三字节、内容重复度低），所以去掉注释能实打实省流量。

   为什么不用现成库：node_modules 里没有 clean-css / csso / cssnano /
   lightningcss，而装包要走代理（这次代理一直 502）。
   压缩算法本身在 hexo-tools/minify-css-core.js，那里写了安全性设计。

   ★ 指纹一致性：压缩只发生在 public/ 的产物上，而 asset_url 是按源文件
   算指纹的。为了让指纹覆盖「实际发出去的那份内容」，
   这里把压缩函数挂到 hexo._lyMinifyCss，asset-version.js 对 .css
   会先压缩再算 hash。否则会出现「改了压缩规则但源文件没动 ->
   URL 不变 -> 浏览器继续用旧缓存」这种极难查的问题。
   ============================================================ */
const { lyMinifyCss } = require('../hexo-tools/minify-css-core');

/* 给 asset-version.js 用：让指纹算在「压缩后的内容」上 */
hexo._lyMinifyCss = lyMinifyCss;

/* ★ 为什么注册渲染器，而不是用 after_generate 去改 public/ 里的文件：
   实测 after_generate 触发得比文件落盘更早 ——
   Hexo 的时序是 _routerRefresh()（生成路由）之后立刻 fire after_generate，
   而真正把内容写进 public/ 的是 console/generate 里遍历路由那一步。
   所以那个钩子里 readdir 看到的 public/ 是空的（日志实测「0 个文件」）。

   注册一个 css -> css 的渲染器就顺得多：
   Hexo 的 asset 生成器对「renderable 且 isRenderable(path)」的资源
   会走渲染管线（见 node_modules/hexo/dist/plugins/generator/asset.js），
   于是压缩后的内容直接被当成产物写出去，不依赖任何时序假设。 */
hexo.extend.renderer.register('css', 'css', function (data) {
    const src = data.text;
    const min = lyMinifyCss(src);
    const before = Buffer.byteLength(src), after = Buffer.byteLength(min);
    console.log('[minify-css] ' + data.path.replace(hexo.base_dir, '') + '  ' +
        (before / 1024).toFixed(1) + ' KB -> ' + (after / 1024).toFixed(1) + ' KB（省 ' +
        (100 - after / before * 100).toFixed(0) + '%）');
    return min;
}, true);
