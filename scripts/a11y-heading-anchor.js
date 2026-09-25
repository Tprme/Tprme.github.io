/* ============================================================
   给标题锚点补可访问名
   ------------------------------------------------------------
   文章/页面标题旁边那个「#」锚点生成出来是空内容的：
     <h2 id="关于我"><a href="#关于我" class="headerlink" title="关于我"></a>关于我</h2>
   它没有文本，只有一个 title 属性。title 确实能兜底当可访问名，
   但它是最后手段、各家屏幕阅读器行为不一致；
   键盘用户 Tab 到它时通常只会听到「链接」两个字，不知道通到哪里。

   这里统一补 aria-label，内容取自已有的 title。

   为什么挂在 after_render:html 而不是 after_post_render：
   后者只覆盖文章（post），about 这类 page 不在其中，
   而 about 页恰恰是锚点最多的地方（实测 5 个，文章 8 个）。

   顺带说明：这些锚点是依赖生成的，仓库里搜不到 "headerlink" 字样，
   所以在源头改不了，只能在这里后处理。
   ============================================================ */
hexo.extend.filter.register("after_render:html", function (str) {
    return str.replace(/<a\b([^>]*\bclass="headerlink"[^>]*)><\/a>/g, function (whole, attrs) {
        // 已经有了就别重复加
        if (/\baria-label=/.test(attrs)) return whole;
        var m = /title="([^"]*)"/.exec(attrs);
        var label = m ? m[1] : "";
        var aria = label
            ? ' aria-label="链接到「' + label + '」"'
            : ' aria-label="链接到本节"';
        return "<a" + attrs + aria + "></a>";
    });
});
