/* ============================================================
   液态玻璃（Liquid Glass）交互层
   ------------------------------------------------------------
   包含四件事，各自独立、互不阻塞：
     1) 导航高光跟随鼠标
     2) 滚动视差：滚动后加深模糊与阴影
     3) 点击涟漪：玻璃被「按下去」的形变反馈
     4) 深色模式切换（首屏防闪烁的代码在 layout.ejs 的 <head> 内联脚本里）

   设计原则：这些都是渐进增强，任何一项失败都不该影响阅读。
   所以每块都单独 try/catch 包起来，并用 window.__lyGlassDebug
   记录执行轨迹（只在内存里，不上报、不打控制台）—— 这类静默失效
   没有现场信息会非常难查，之前排查高光不生效时就吃过这个亏。
   ============================================================ */
(function () {
    "use strict";

    var trace = [];
    window.__lyGlassDebug = trace;

    var reduceMotion =
        window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    trace.push("reduceMotion=" + reduceMotion);

    function safe(name, fn) {
        try {
            fn();
        } catch (e) {
            trace.push("ERR@" + name + ":" + (e && e.message ? e.message : e));
        }
    }

    /* ============================================================
       1) 导航高光跟随鼠标
       ------------------------------------------------------------
       把指针在导航条上的位置换算成百分比写进 --ly-glass-x / --ly-glass-y，
       由 CSS 里 #menu::after 的径向渐变用来定位高光。

       为什么用事件委托绑在 document 上：
         最初是直接 menu.addEventListener 绑到 #menu 上，但实测监听器
         绑上了却收不到任何事件 —— 这段脚本在 <body> 末尾执行，而主题的
         Vue 随后挂载、重建了导航节点，监听器留在了被丢弃的旧节点上
         （页面里 .ly-glass-lit 类还在，因为 classList 操作与监听器
          生效性无关，正好掩盖了这个问题）。
         改成委托 + 回调里惰性取节点，节点被替换多少次都不受影响。

       为什么 rAF 节流 + setTimeout 兜底：
         mousemove 极频繁，直接写 style 会引发大量样式重算；这里每帧最多
         写一次。同时挂 50ms 的 setTimeout —— rAF 在页面不可见或被挂起时
         不触发，没有兜底高光会彻底卡死。
       ============================================================ */
    function setupPointerGlow() {
        var menu = document.getElementById("menu");
        trace.push("menu=" + (menu ? "#" + menu.id : "null"));
        if (!menu) return;

        if (reduceMotion) {
            menu.classList.add("ly-glass-lit");
            trace.push("glow:static(reduce-motion)");
            return;
        }
        // 触屏没有 hover 概念，跟随会停在一个固定位置，只保留静态高光
        if (!(window.matchMedia && window.matchMedia("(hover: hover)").matches)) {
            menu.classList.add("ly-glass-lit");
            trace.push("glow:static(touch)");
            return;
        }

        var pending = false;
        var nextX = null;
        var nextY = null;
        var rafId = null;
        var fallbackId = null;

        function flush() {
            if (rafId !== null) {
                window.cancelAnimationFrame(rafId);
                rafId = null;
            }
            if (fallbackId !== null) {
                window.clearTimeout(fallbackId);
                fallbackId = null;
            }
            pending = false;
            if (nextX === null) return;
            // 惰性取节点：Vue 中途替换过 #menu 也拿的是当前那个
            var el = document.getElementById("menu");
            if (!el) return;
            el.style.setProperty("--ly-glass-x", nextX + "%");
            el.style.setProperty("--ly-glass-y", nextY + "%");
        }

        function onMove(e) {
            var el = document.getElementById("menu");
            if (!el) return;
            var rect = el.getBoundingClientRect();
            if (rect.width === 0 || rect.height === 0) return;
            nextX = ((e.clientX - rect.left) / rect.width) * 100;
            nextY = ((e.clientY - rect.top) / rect.height) * 100;
            if (pending) return;
            pending = true;
            rafId = window.requestAnimationFrame(flush);
            fallbackId = window.setTimeout(flush, 50);
        }

        function inMenu(target) {
            return target && target.closest ? target.closest("#menu") : null;
        }

        document.addEventListener(
            "mouseover",
            function (e) {
                if (inMenu(e.target)) {
                    var el = document.getElementById("menu");
                    if (el) el.classList.add("ly-glass-lit");
                }
            },
            { passive: true }
        );

        document.addEventListener(
            "mouseout",
            function (e) {
                var el = document.getElementById("menu");
                if (!el) return;
                // relatedTarget 是移向的目标：仍在导航内就不算离开
                if (inMenu(e.target) && !inMenu(e.relatedTarget)) {
                    el.classList.remove("ly-glass-lit");
                }
            },
            { passive: true }
        );

        /* 用 mousemove 而不是 pointermove：更通用（触屏已排除），
           也便于用 CDP 的 Input.dispatchMouseEvent 自动化验证。 */
        document.addEventListener(
            "mousemove",
            function (e) {
                if (inMenu(e.target)) onMove(e);
            },
            { passive: true }
        );

        // 初始点亮一次，避免首屏导航看着比原来「扁」
        menu.classList.add("ly-glass-lit");
        trace.push("glow:dynamic");
    }

    /* ============================================================
       2) 滚动视差
       ------------------------------------------------------------
       滚过一定距离后给 #menu 加 .ly-glass-scrolled，CSS 里据此
       把模糊从 16px 提到 22px、阴影加重，让导航「浮」得更高。
       同样用 rAF 节流 + 惰性取节点。
       ============================================================ */
    function setupScrollParallax() {
        var ticking = false;
        var lastState = null;

        function apply() {
            ticking = false;
            var el = document.getElementById("menu");
            if (!el) return;
            var scrolled = (window.pageYOffset || document.documentElement.scrollTop || 0) > 8;
            if (scrolled === lastState) return;
            lastState = scrolled;
            el.classList.toggle("ly-glass-scrolled", scrolled);
        }

        function onScroll() {
            if (ticking) return;
            ticking = true;
            window.requestAnimationFrame(apply);
            // 兜底：与高光同理，rAF 不触发时也能更新
            window.setTimeout(function () {
                if (ticking) apply();
            }, 60);
        }

        window.addEventListener("scroll", onScroll, { passive: true });
        apply();
        trace.push("parallax");
    }

    /* ============================================================
       3) 点击涟漪
       ------------------------------------------------------------
       在玻璃表面上按下时，从指针位置扩散一圈光，做出「按下去」的反馈。
       实现要点：
         - 用独立覆盖层做扩散，靠 CSS mask 把它限制在玻璃范围内
           （直接给元素加 overflow:hidden 会破坏原有的悬停/定位）；
         - mask-composite 不支持的浏览器整条规则失效，也就自然不显示，
           属于优雅降级；
         - 只对「有面积的玻璃表面」生效，纯文字链接不参与。
       ============================================================ */
    function setupRipple() {
        if (reduceMotion) {
            trace.push("ripple:skip(reduce-motion)");
            return;
        }

        var RIPPLE_SELECTOR = [
            "#home-posts .post",
            ".article[data-category]",
            ".timeline-content",
            "#home-card #card-div",
            "#comment"
        ].join(",");

        function spawn(el, clientX, clientY) {
            var rect = el.getBoundingClientRect();
            if (rect.width === 0 || rect.height === 0) return;

            /* 用一层「带圆角遮罩的全尺寸覆盖层」把涟漪限制在玻璃范围内。
               为什么不直接给元素加 overflow:hidden：卡片本来就有，
               但 .timeline-content / #comment 是 visible，而硬加 hidden
               可能裁掉评论区的 iframe 内容，风险太大。
               遮罩用 mask-composite 取反做「圆角挖空」，
               不支持的浏览器整条失效 → 涟漪显示为方形扩散，可接受。 */
            var layer = document.createElement("span");
            layer.className = "ly-ripple-mask";
            layer.style.borderRadius = getComputedStyle(el).borderRadius;

            var dot = document.createElement("span");
            dot.className = "ly-ripple";
            var size = Math.max(rect.width, rect.height) * 0.75;
            dot.style.setProperty("--ly-ripple-size", size + "px");
            dot.style.left = clientX - rect.left - size / 2 + "px";
            dot.style.top = clientY - rect.top - size / 2 + "px";
            layer.appendChild(dot);

            el.appendChild(layer);
            // 动画结束后移除；animationend 不可靠（元素可能被提前移除），
            // 所以再挂一个定时器兜底，避免节点在 DOM 里堆积
            var removed = false;
            function cleanup() {
                if (removed) return;
                removed = true;
                if (layer.parentNode) layer.parentNode.removeChild(layer);
            }
            dot.addEventListener("animationend", cleanup);
            window.setTimeout(cleanup, 900);
        }

        document.addEventListener(
            "pointerdown",
            function (e) {
                // 只响应鼠标左键 / 触摸 / 笔
                if (e.button !== undefined && e.button !== 0) return;
                var el = e.target && e.target.closest ? e.target.closest(RIPPLE_SELECTOR) : null;
                if (!el) return;
                spawn(el, e.clientX, e.clientY);
            },
            { passive: true }
        );

        trace.push("ripple");
    }

    /* ============================================================
       4) 深色模式切换
       ------------------------------------------------------------
       首屏防闪烁的代码在 layout.ejs 的 <head> 内联脚本里（必须在绘制前跑）。
       这里只负责按钮交互与持久化，键名与那边保持一致：ly-theme。
       ============================================================ */
    function setupThemeToggle() {
        var moon = "fa-moon";
        var sun = "fa-sun";

        function isDark() {
            return document.documentElement.getAttribute("data-theme") === "dark";
        }

        function syncIcons() {
            var dark = isDark();
            var icons = document.querySelectorAll("#theme-toggle i, #theme-toggle-mobile i");
            for (var i = 0; i < icons.length; i++) {
                icons[i].classList.toggle(moon, !dark);
                icons[i].classList.toggle(sun, dark);
            }
            var mobileLabel = document.querySelector("#theme-toggle-mobile .item div:last-child");
            if (mobileLabel) mobileLabel.textContent = dark ? "浅色模式" : "深色模式";
        }

        function toggle() {
            var dark = !isDark();
            if (dark) {
                document.documentElement.setAttribute("data-theme", "dark");
            } else {
                document.documentElement.setAttribute("data-theme", "light");
            }
            document.documentElement.style.colorScheme = dark ? "dark" : "light";
            try {
                localStorage.setItem("ly-theme", dark ? "dark" : "light");
            } catch (e) {
                /* 隐私模式下写不了，忽略即可 */
            }
            syncIcons();
            trace.push("theme:" + (dark ? "dark" : "light"));
        }

        // 委托：节点可能被 Vue 重建，绑在 document 上更稳
        document.addEventListener("click", function (e) {
            if (!e.target || !e.target.closest) return;
            if (e.target.closest("#theme-toggle") || e.target.closest("#theme-toggle-mobile")) {
                toggle();
            }
        });

        syncIcons();
        trace.push("themeToggle");
    }

    safe("pointerGlow", setupPointerGlow);
    safe("scrollParallax", setupScrollParallax);
    safe("ripple", setupRipple);
    safe("themeToggle", setupThemeToggle);

    trace.push("done");
})();
