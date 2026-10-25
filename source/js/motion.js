/* ============================================================
   动效增强：① 平滑滚动  ② 滚动进场  ⑤ 胶片颗粒
   颗粒是纯 CSS（custom.css 里 body::after），这里只管前两项。

   三条设计原则（也是「高级感」和「花哨」的分界线）：
   1. 全部是可降级增强。
      JS 没加载、被拦、或用户开了「减弱动效」时，内容必须照常可见 ——
      所以隐藏只由 html.ly-motion 这个 class 触发，而这个 class 只在
      JS 跑通之后才加。没有 JS = 永远没有隐藏状态 = 不可能白屏。
   2. 只动 transform / opacity。
      这两样走合成层，不触发重排；动 width/top 会让长文滚动掉帧。
   3. 进场错峰，且用自定义曲线。
      同一批进入视口的元素依次延迟 70ms（上限 280ms），
      曲线用 cubic-bezier(0.22, 1, 0.36, 1)（easeOutQuint 同族）——
      默认的 ease 收尾太软，看着"飘"。
   ============================================================ */
(function () {
    "use strict";

    var root = document.documentElement;
    var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    /* ---------- ① 平滑滚动 ---------- */
    function initSmoothScroll() {
        if (reduceMotion || !window.Lenis) return;

        /* 触屏设备不接管：系统自带的惯性滚动手感更好，
           而且 Lenis 接管触摸后容易和「下拉刷新」打架。 */
        if (window.matchMedia("(hover: none)").matches) return;

        var lenis = new window.Lenis({
            duration: 1.15,
            /* 自定曲线。Lenis 默认是线性的，收尾很生硬；
               easeOutQuint 前段快、后段缓，才像有质量的东西停下来。 */
            easing: function (t) {
                return 1 - Math.pow(1 - t, 5);
            },
            smoothWheel: true,
            syncTouch: false
        });

        var raf = function (time) {
            lenis.raf(time);
            requestAnimationFrame(raf);
        };
        requestAnimationFrame(raf);

        /* 站内锚点（标题上的 # 链接）也要走 Lenis，
           否则它和 Lenis 会同时滚动，看起来像跳了一下。 */
        document.addEventListener("click", function (event) {
            var link = event.target.closest && event.target.closest('a[href^="#"]');
            if (!link) return;

            var hash = link.getAttribute("href").slice(1);
            if (!hash) return;

            var target = document.getElementById(decodeURIComponent(hash));
            if (!target) return;

            event.preventDefault();
            /* -80 是给吸顶导航让出的高度 */
            lenis.scrollTo(target, { offset: -80 });
        });

        /* 暴露给调试用：控制台里 __lyLenis.vars 可以看当前参数 */
        window.__lyLenis = lenis;
    }

    /* ---------- ② 滚动进场 ---------- */
    function initReveal() {
        if (reduceMotion) return;
        if (!("IntersectionObserver" in window)) return;

        /* 必须用 `.article > .content` 而不是 `.content`：
           首页每张文章卡片里也有一个 .content（放摘要的），
           用宽选择器会抓到首页第一个卡片的摘要并把它藏死。
           （这个 bug 真出现过：首页有一块文字永久 opacity:0。） */
        var content = document.querySelector(".article > .content");
        if (!content) return;

        /* 只挑块级元素。刻意不动 h1 —— 它不在 .content 里，
           而且首屏标题立刻出现比"淡入"更像正式文章。 */
        var selector = "h2, h3, h4, p, pre, blockquote, ul, ol, figure, table";
        var items = Array.prototype.slice.call(content.querySelectorAll(selector));
        if (!items.length) return;

        /* 加密文章：.content 这时是空的（等 Vue 解密后填充），
           上面 querySelectorAll 已经返回空数组，走到这里就退出了。
           所以不会给加密页留下"永远不显示"的元素。 */
        items.forEach(function (el) {
            el.classList.add("ly-reveal");
        });
        root.classList.add("ly-motion");

        var batchStartedAt = 0;
        var callbackCount = 0;

        var observer = new IntersectionObserver(
            function (entries) {
                callbackCount += 1;
                var now = performance.now();
                /* 120ms 内进来的算同一批，重新起算错峰序号 */
                if (now - batchStartedAt > 120) batchStartedAt = now;

                var index = 0;
                entries.forEach(function (entry) {
                    if (!entry.isIntersecting) return;

                    var el = entry.target;
                    var delay = Math.min(index * 70, 280);
                    index += 1;

                    /* 用 transitionDelay 而不是 animation，
                       这样元素即使中途被再次交叉也不会重播 */
                    el.style.transitionDelay = delay + "ms";
                    el.classList.add("ly-in");
                    observer.unobserve(el);
                });
            },
            {
                /* 元素顶端进入视口下沿 8% 处就开始播，
                   等它完全进来才动会让用户觉得"卡了一下" */
                rootMargin: "0px 0px -8% 0px",
                threshold: 0.01
            }
        );

        items.forEach(function (el) {
            observer.observe(el);
        });

        /* 兜底保险：2.5 秒内观察器一次回调都没来，说明它在这个环境里不工作
           （标签页被隐藏、老浏览器、或被 overflow 裁掉）。
           这时整体降级 —— 直接把 .ly-motion 摘掉，
           CSS 里 `.ly-motion .ly-reveal { opacity: 0 }` 随之失效，内容立刻全部可见。

           注意：不能用「定时器把所有元素都加上 .ly-in」的办法。
           那样一来，首屏之外的元素会在定时器到点时被一次性点亮，
           用户往下滚就再也看不到进场效果了 —— 等于把动效做废。
           宁可动效失效，不能内容消失。 */
        setTimeout(function () {
            if (callbackCount === 0) {
                root.classList.remove("ly-motion");
            }
        }, 2500);
    }

    /* ---------- ③ 卡片光标聚光 ---------- */
    function initSpotlight() {
        if (reduceMotion) return;
        /* 触屏没有 hover，装了也是空转 */
        if (window.matchMedia("(hover: none)").matches) return;

        var cards = document.querySelectorAll("#home-posts .post");
        if (!cards.length) return;

        Array.prototype.forEach.call(cards, function (card) {
            var frame = 0;
            var pending = null;

            card.addEventListener("pointermove", function (event) {
                pending = event;
                /* rAF 节流：pointermove 一秒能来上百次，
                   每次都写样式会让主线程一直在做样式重算。
                   读取 rect 也放进 rAF 里，避免读写交错触发同步布局。 */
                if (frame) return;
                frame = requestAnimationFrame(function () {
                    frame = 0;
                    if (!pending) return;

                    var rect = card.getBoundingClientRect();
                    card.style.setProperty("--ly-mx", pending.clientX - rect.left + "px");
                    card.style.setProperty("--ly-my", pending.clientY - rect.top + "px");
                    pending = null;
                });
            });
        });
    }

    function boot() {
        initSmoothScroll();
        initReveal();
        initSpotlight();
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", boot);
    } else {
        boot();
    }
})();
