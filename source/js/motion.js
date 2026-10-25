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

        /* 首页文章卡片 + 侧边个人资料卡，共用同一套聚光效果 */
        var cards = document.querySelectorAll("#home-posts .post, #home-card #card-div");
        if (!cards.length) return;

        Array.prototype.forEach.call(cards, function (card) {
            var frame = 0;
            var pending = null;

            /* 描边高光挂在真实子元素上，不用伪元素 ——
               .post::after 被主题的镜面反光（--ly-glass-specular）占着，
               .post::before 被下面的光标光斑占着，两个都不能动。 */
            if (!card.querySelector(":scope > .ly-ring")) {
                var ring = document.createElement("i");
                ring.className = "ly-ring";
                ring.setAttribute("aria-hidden", "true");
                card.appendChild(ring);
            }

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

    /* ---------- 实验：液态玻璃导航（折射）----------
       为什么要低模糊：backdrop-filter 的模糊和位移是同一条管线，
       blur 16px 之后背景已经没有细节了，再位移一团糊 = 看不出任何效果。
       所以真折射必须配低模糊（2-4px），代价是导航文字要在背后内容上抢对比度。

       这个效果默认不开启：只有本函数跑通（把 SVG 滤镜注入 DOM 并给
       <html> 打上 ly-nav-liquid）之后，custom.css 里那几条规则才生效。
       JS 不跑 / 被拦 = 导航维持原样，不会因为 url(#) 取不到而丢掉模糊变透明。 */
    function initNavLiquid() {
        if (reduceMotion) return;
        if (!window.Lenis && !document.documentElement.classList.contains("lenis")) {
            /* 没有平滑滚动也能用，这里只是不额外拦 */
        }

        var svgNS = "http://www.w3.org/2000/svg";
        var map =
            "data:image/svg+xml," +
            encodeURIComponent(
                '<svg xmlns="http://www.w3.org/2000/svg" width="300" height="60">' +
                    "<defs>" +
                    '<linearGradient id="gx" x1="0" y1="0" x2="1" y2="0">' +
                    '<stop offset="0" stop-color="rgb(0,0,0)"/>' +
                    '<stop offset="0.10" stop-color="rgb(128,0,0)"/>' +
                    '<stop offset="0.90" stop-color="rgb(128,0,0)"/>' +
                    '<stop offset="1" stop-color="rgb(255,0,0)"/>' +
                    "</linearGradient>" +
                    '<linearGradient id="gy" x1="0" y1="0" x2="0" y2="1">' +
                    '<stop offset="0" stop-color="rgb(0,0,0)"/>' +
                    '<stop offset="0.20" stop-color="rgb(0,128,0)"/>' +
                    '<stop offset="0.80" stop-color="rgb(0,128,0)"/>' +
                    '<stop offset="1" stop-color="rgb(0,255,0)"/>' +
                    "</linearGradient>" +
                    "</defs>" +
                    '<rect width="300" height="60" fill="rgb(0,0,0)"/>' +
                    '<rect width="300" height="60" fill="url(#gx)"/>' +
                    '<rect width="300" height="60" fill="url(#gy)" style="mix-blend-mode:screen"/>' +
                    "</svg>"
            );

        var svg = document.createElementNS(svgNS, "svg");
        svg.setAttribute("width", "0");
        svg.setAttribute("height", "0");
        svg.setAttribute("aria-hidden", "true");
        svg.setAttribute("style", "position:absolute;pointer-events:none");

        var filter = document.createElementNS(svgNS, "filter");
        filter.setAttribute("id", "ly-nav-liquid");
        filter.setAttribute("x", "0");
        filter.setAttribute("y", "0");
        filter.setAttribute("width", "100%");
        filter.setAttribute("height", "100%");
        filter.setAttribute("filterUnits", "objectBoundingBox");
        filter.setAttribute("color-interpolation-filters", "sRGB");

        var feImage = document.createElementNS(svgNS, "feImage");
        feImage.setAttribute("href", map);
        feImage.setAttribute("result", "map");
        feImage.setAttribute("preserveAspectRatio", "none");

        var feDisp = document.createElementNS(svgNS, "feDisplacementMap");
        feDisp.setAttribute("in", "SourceGraphic");
        feDisp.setAttribute("in2", "map");
        feDisp.setAttribute("scale", "16");
        feDisp.setAttribute("xChannelSelector", "R");
        feDisp.setAttribute("yChannelSelector", "G");

        filter.appendChild(feImage);
        filter.appendChild(feDisp);
        svg.appendChild(filter);
        document.body.appendChild(svg);

        document.documentElement.classList.add("ly-nav-liquid");
    }

    /* ---------- 悬浮目录 ----------
       只在文章页、且标题 >= 3 个时才出现。
       位置放右侧留白里（.article 是 900px 定宽，1440 视口左右各剩 270px），
       不压正文 —— 代价是后面只有页面底色，折射在这里看不出来，
       它只是「磨砂玻璃面板」，不是折射展示位。 */
    function initToc() {
        var content = document.querySelector(".article > .content");
        if (!content) return;

        var heads = Array.prototype.slice.call(content.querySelectorAll("h2, h3"));
        if (heads.length < 3) return;

        var nav = document.createElement("nav");
        nav.className = "ly-toc";
        nav.setAttribute("aria-label", "文章目录");

        var title = document.createElement("div");
        title.className = "ly-toc__title";
        title.textContent = "目录";
        nav.appendChild(title);

        var list = document.createElement("ol");
        list.className = "ly-toc__list";
        nav.appendChild(list);

        var items = [];
        heads.forEach(function (heading) {
            if (!heading.id) return;
            var li = document.createElement("li");
            li.className = heading.tagName === "H3" ? "is-sub" : "is-top";
            var a = document.createElement("a");
            a.href = "#" + heading.id;
            a.textContent = (heading.textContent || "").replace(/\s+/g, " ").trim();
            li.appendChild(a);
            list.appendChild(li);
            items.push({ a: a, heading: heading });
        });
        if (!items.length) return;

        document.body.appendChild(nav);

        var current = null;

        function update() {
            /* 取「已经滚过阈值 140px 的最后一个标题」作为当前章节。
               标题在文档里天然有序，所以一旦遇到第一个还没到的就可以停。 */
            var best = null;
            for (var i = 0; i < items.length; i++) {
                if (items[i].heading.getBoundingClientRect().top - 140 <= 0) best = items[i];
                else break;
            }
            if (!best) best = items[0];
            if (best === current) return;
            if (current) current.a.classList.remove("is-current");
            best.a.classList.add("is-current");
            current = best;
        }

        var ticking = false;
        window.addEventListener(
            "scroll",
            function () {
                if (ticking) return;
                ticking = true;
                requestAnimationFrame(function () {
                    ticking = false;
                    update();
                });
            },
            { passive: true }
        );
        update();
    }

    /* ---------- 照片灯箱工具栏 ----------
       ★ 这是全站唯一「玻璃后面真的是照片」的地方 ——
         Apple 的规范里 .clear（高透版）就是给浮在照片/视频上的组件用的，
         折射在照片上才看得出来。 */

    function initPhotoBar() {
        var overlay = document.getElementById("preview");
        var img = document.getElementById("preview-content");
        if (!overlay || !img) return;

        var bar = document.createElement("div");
        bar.className = "ly-photo-bar";
        bar.setAttribute("role", "toolbar");
        bar.setAttribute("aria-label", "图片操作");

        var name = document.createElement("span");
        name.className = "ly-photo-bar__name";
        bar.appendChild(name);

        var open = document.createElement("a");
        open.className = "ly-photo-bar__btn";
        open.target = "_blank";
        open.rel = "noopener";
        open.textContent = "原图";
        bar.appendChild(open);

        var close = document.createElement("button");
        close.type = "button";
        close.className = "ly-photo-bar__btn is-close";
        close.textContent = "关闭";
        bar.appendChild(close);

        /* 关键：点击工具栏不能冒泡到 #preview —— 那边的监听是「点任意处关闭」。
           关闭按钮反过来主动触发一次 overlay 的 click，复用主题原有逻辑，
           不去碰 Vue 的 previewShow 状态。 */
        bar.addEventListener("click", function (event) {
            event.stopPropagation();
        });
        close.addEventListener("click", function () {
            overlay.click();
        });

        overlay.appendChild(bar);

        /* 工具栏必须压在照片上，折射才有意义 ——
           固定贴在视口底部的话，它下面是 #preview 那层 95% 白遮罩，等于什么都没有。
           所以按图片的实际矩形定位到图片底部内侧，并把宽度限制在图片宽度以内。 */
        function placeBar() {
            var r = img.getBoundingClientRect();
            var pr = overlay.getBoundingClientRect();
            if (!r.width || !r.height) return;
            bar.style.left = r.left - pr.left + r.width / 2 + "px";
            bar.style.bottom = pr.bottom - r.bottom + 14 + "px";
            bar.style.maxWidth = Math.max(180, Math.min(r.width - 24, 620)) + "px";
        }

        img.addEventListener("load", placeBar);

        /* 主题是给每个 <img> 绑点击来开预览的，这里用捕获阶段提前记一下
           被点的是哪张，等它把 src 换上去之后再同步工具栏文字并重新定位。 */
        document.addEventListener(
            "click",
            function (event) {
                var target = event.target;
                if (!target || target.tagName !== "IMG") return;
                setTimeout(function () {
                    name.textContent = (img.alt || "").trim();
                    open.href = img.currentSrc || img.src || "#";
                    placeBar();
                }, 0);
            },
            true
        );
    }

    /* ---------- 首屏照片点开灯箱 ----------
       主题的 preview 会给页面上每个 <img> 绑点击，但 #home-photo 是
       `pointer-events: none`（它上面压着 #home-info，点哪都是「滚到文章列表」），
       所以那张照片点不开 —— 程序化 .click() 能打开，说明监听一直是好的。

       做法：在 #home-head 上用捕获阶段拦一次，坐标落在照片矩形内才接管，
       然后回放一次 img.click() 复用主题原有的逻辑。
       不走「提高照片层级」这条路：手机端照片在文字后面，提层级会把字盖住。

       只在 ≥900px 生效：手机上照片几乎铺满首屏、文字叠在上面，
       按坐标判断会把「点文字」也当成「点照片」。 */
    function initHeroZoom() {
        var head = document.getElementById("home-head");
        var photo = document.getElementById("home-photo");
        if (!head || !photo) return;

        var desktop = window.matchMedia("(min-width: 900px)");

        head.addEventListener(
            "click",
            function (event) {
                if (!desktop.matches) return;
                var rect = photo.getBoundingClientRect();
                if (!rect.width || !rect.height) return;
                if (event.clientX < rect.left || event.clientX > rect.right) return;
                if (event.clientY < rect.top || event.clientY > rect.bottom) return;

                event.stopPropagation();
                event.preventDefault();

                /* 这张图是装饰性的（alt="" + aria-hidden），alt 为空会让灯箱工具栏
                   名字那栏空着。临时挂一个可读名称给主题的监听读，读完立刻还原，
                   装饰语义不变。click() 是同步派发的，所以这样写是安全的。 */
                var previousAlt = photo.getAttribute("alt");
                photo.setAttribute("alt", "首屏照片");
                photo.click();
                photo.setAttribute("alt", previousAlt);
            },
            true
        );
    }

    function boot() {
        initSmoothScroll();
        initReveal();
        initSpotlight();
        initNavLiquid();
        initToc();
        initPhotoBar();
        initHeroZoom();
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", boot);
    } else {
        boot();
    }
})();
