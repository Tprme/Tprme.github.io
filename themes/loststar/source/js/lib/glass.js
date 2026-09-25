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

    /* 触屏判定。CSS 里用同一个查询把底栏固定成实色，
       这里用它决定「滚动时还要不要做任何事」。 */
    var isTouch = window.matchMedia && window.matchMedia("(hover: none)").matches;
    trace.push("isTouch=" + isTouch);

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
            document.documentElement.classList.add("ly-glass-lit");
            trace.push("glow:static(reduce-motion)");
            return;
        }
        // 触屏没有 hover 概念，跟随会停在一个固定位置，只保留静态高光
        if (!(window.matchMedia && window.matchMedia("(hover: hover)").matches)) {
            document.documentElement.classList.add("ly-glass-lit");
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
                if (inMenu(e.target) && document.getElementById("menu")) {
                    document.documentElement.classList.add("ly-glass-lit");
                }
            },
            { passive: true }
        );

        document.addEventListener(
            "mouseout",
            function (e) {
                if (!document.getElementById("menu")) return;
                // relatedTarget 是移向的目标：仍在导航内就不算离开
                if (inMenu(e.target) && !inMenu(e.relatedTarget)) {
                    document.documentElement.classList.remove("ly-glass-lit");
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
        document.documentElement.classList.add("ly-glass-lit");
        trace.push("glow:dynamic");
    }

    /* ============================================================
       2) 滚动期间的玻璃降级
       ------------------------------------------------------------
       这里原本是「滚动视差」：滚过 8px 就给 #menu 加 .ly-glass-scrolled，
       CSS 据此把模糊从 16px 提到 22px、阴影加重。那个效果已经删掉 ——
       #menu 带 backdrop-filter，任何让它重绘的变化都会连带重新采样背景
       做模糊，而用户上下滑动时这个变化会反复发生，就是「一闪一闪」。

       但把样式冻结之后，真机上滚动**仍然会闪**。原因是 backdrop-filter
       本身：它必须在每一帧重新采样并模糊它下面的内容（内容在滚动、一直在变），
       这是它绕不开的成本，手机 GPU 上就表现成闪。

       所以反过来做：滚动**期间**主动把模糊关掉，换成接近不透明的底。
       滚动时人眼注意力在内容上，导航变实几乎察觉不到；
       停手 160ms 后再把模糊交回来。
       关键是这个切换只在「开始滚」和「停下来」各发生一次，
       不是每帧 —— 每帧重绘才是闪的根源。

       用防抖而不是直接监听 scroll 的「停止」：
       滚动事件是连续触发的，每次重置计时器，160ms 内没有新事件才算停。
       ============================================================ */
    function setupScrollParallax() {
        /* 触屏上不装这个监听。
           触屏的 #menu 已经由 CSS 永久固定成 92% 实色 + backdrop-filter: none，
           滚动时本来就没有任何东西需要变 —— 实测 205/205 帧零变化。
           但这个类挂在 <html> 上，增删它会让整个文档重新匹配样式，
           而它恰好发生在「每次开始滑动」的那一刻。
           收益为零、代价明确，所以触屏直接不跑。
           桌面端继续保留：那里的 #menu 是真毛玻璃，
           滚动时关掉模糊确实能省下每帧的背景重采样。 */
        if (isTouch) {
            trace.push("scrollDegrade:skip(touch)");
            return;
        }
        var ticking = false;
        var stopTimer = null;

        function apply() {
            ticking = false;
            /* 这个类必须挂在 <html> 上，绝对不能挂在 #menu 上。
               #menu 的 class 是 Vue 绑定的（menu.ejs 的 :class），
               Vue 每次重渲染都会执行 el.className = ...，那是「整个属性替换」，
               会把这里 classList.add 上去的类一起抹掉。
               实测（390x844 模拟手机，3 秒滚动）：#menu 的 class 被改写 204 次 /
               共 205 帧，backdrop-filter 跟着在 blur(16px) 与 none 之间横跳，
               屏幕上就是一闪一闪。
               之前的两次修复（加深模糊、冻结样式）都是往 #menu 上加类，
               因此全都被这个机制抹掉了 —— 这才是「改了三次都没用」的原因。
               <html> 不在 Vue 的挂载范围内（app.mount("#layout")），不会被重写。 */
            var root = document.documentElement;
            if (!document.getElementById("menu")) return;
            root.classList.add("ly-scrolling");
            if (stopTimer) window.clearTimeout(stopTimer);
            stopTimer = window.setTimeout(function () {
                stopTimer = null;
                root.classList.remove("ly-scrolling");
            }, 160);
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
        /* 这里绝对不能调 apply()。
           初始化时调一次会让菜单一进页面就带上 ly-scrolling，
           玻璃效果被关掉而且没人再把它摘下来 —— 看起来就是「菜单变塑料了」。
           只在滚动事件里加，靠 160ms 防抖自动摘掉。 */
        trace.push("scrollDegrade");
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
        function isDark() {
            return document.documentElement.getAttribute("data-theme") === "dark";
        }

        /* 图标用内联 SVG 遮罩（见 custom.css 的 .ly-theme-icon），
           靠 data-icon 切换，不再依赖图标字体：
           深色时显示太阳（表示「可切回浅色」），浅色时显示月亮。 */
        function syncIcons() {
            var icon = isDark() ? "sun" : "moon";
            var nodes = document.querySelectorAll("#theme-toggle .ly-theme-icon, #theme-toggle-mobile .ly-theme-icon");
            for (var i = 0; i < nodes.length; i++) {
                nodes[i].setAttribute("data-icon", icon);
            }
            var mobileLabel = document.querySelector("#theme-toggle-mobile .item div:last-child");
            if (mobileLabel) mobileLabel.textContent = isDark() ? "浅色模式" : "深色模式";
        }

        /* 评论是 giscus 的 iframe，有自己的主题；
           改本站主题时必须同步通知它，否则会出现「深色站点里嵌一块白色评论区」。
           giscus 只认 postMessage 里的 theme 字段，改 src 无效。

           这里有个时序坑（实测确认过）：
           MutationObserver 是在 iframe 元素刚插进 DOM 的那一刻回调的，
           那时 giscus 内部文档还没跑起来、message 监听还没挂上，
           这一发 postMessage 会被直接丢掉。症状很迷惑 ——
           调试轨迹里明明写着 giscus:dark（函数确实执行了、消息确实发了），
           但评论区依然是白的；隔几秒手动补发一次就立刻变深。
           所以真正管用的是 iframe 的 load 事件（那时内部脚本一定已就绪），
           外加几个定时重试兜住「load 早于挂监听」和缓存命中的情况。 */
        function pushGiscusTheme(frame) {
            if (!frame || !frame.contentWindow) return false;
            frame.contentWindow.postMessage(
                { giscus: { setConfig: { theme: isDark() ? "dark" : "light" } } },
                "https://giscus.app"
            );
            return true;
        }

        var giscusHooked = []; // 已挂过补发逻辑的 iframe，防止重复挂

        function syncGiscus() {
            var frame = document.querySelector("iframe.giscus-frame");
            if (!frame || !frame.contentWindow) {
                trace.push("giscus:absent");
                return;
            }
            pushGiscusTheme(frame);
            if (giscusHooked.indexOf(frame) === -1) {
                giscusHooked.push(frame);
                frame.addEventListener("load", function () {
                    pushGiscusTheme(frame);
                    trace.push("giscus:onload");
                });
                [400, 1200, 2500].forEach(function (ms) {
                    window.setTimeout(function () {
                        pushGiscusTheme(frame);
                    }, ms);
                });
            }
            trace.push("giscus:" + (isDark() ? "dark" : "light"));
        }

        function toggle() {
            var dark = !isDark();
            if (dark) {
                document.documentElement.setAttribute("data-theme", "dark");
            } else {
                document.documentElement.setAttribute("data-theme", "light");
            }
            /* color-scheme 交给 layout.ejs 里那份唯一实现去设。
               这里原先自己写了一行 `style.colorScheme = dark ? "dark" : "light"`，
               **漏了 only** —— 于是点了切换按钮之后，内联脚本设的
               `only light` 就被这个不带 only 的值覆盖掉，
               浏览器又开始对浅色页面做自动深色，背景变灰。
               症状很有迷惑性：刚打开是好的，切一次主题就坏。
               回退分支保留，以防某种情况下内联脚本没跑到。 */
            if (window.__lyApplyColorScheme) {
                window.__lyApplyColorScheme(dark);
            } else {
                document.documentElement.style.colorScheme = dark ? "dark" : "light";
            }
            try {
                localStorage.setItem("ly-theme", dark ? "dark" : "light");
            } catch (e) {
                /* 隐私模式下写不了，忽略即可 */
            }
            syncIcons();
            syncGiscus();
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

        /* giscus 是懒加载 + 异步的，首次进文章页时 iframe 可能还没出现，
           所以：先用 MutationObserver 等它出现，再立刻同步一次。
           另外这里先无条件调一次 syncGiscus()，覆盖「iframe 在本次脚本执行前
           就已经存在」的情况（前进/后退缓存、评论已加载完再切页等），
           那种情况下不会有新的 DOM 变更，光靠观察者是等不到的。 */
        syncGiscus();

        try {
            var obs = new MutationObserver(function () {
                var f = document.querySelector("iframe.giscus-frame");
                /* 只在「出现了一个还没处理过的 iframe」时同步，
                   否则每次 DOM 变更都会重复发消息、把调试轨迹刷爆。 */
                if (f && giscusHooked.indexOf(f) === -1) {
                    syncGiscus();
                }
            });
            obs.observe(document.body, { childList: true, subtree: true });
            window.setTimeout(function () {
                obs.disconnect();
            }, 30000);
        } catch (e) {
            trace.push("giscus:observer-failed");
        }
    }

    /* ============================================================
       流星随机化
       ------------------------------------------------------------
       页面上放固定几个 .ly-meteor，这里给每一颗随机：
         - 起点：落在首屏左上角的一个区域内
         - 周期 / 相位：把自己的出场时刻在整段周期里均匀打散
         - 尾巴长度：避免几条一模一样
       为什么用 JS 而不是写死多条 CSS 规则：
         随机值每次刷新都不同，而且颗数可调；
         但运动本身仍然全部由 CSS 关键帧驱动（JS 只赋变量），
         所以不会每帧跑 JS，性能上没有代价。
       ============================================================ */
    function setupMeteors() {
        var meteors = document.querySelectorAll(".ly-meteor");
        if (!meteors.length) {
            trace.push("meteors:none");
            return;
        }

        /* 总周期。每颗流星在一个周期里只出场一次，
           所以平均间隔 = CYCLE / 颗数。
           24s / 4 颗 ≈ 6 秒一颗 —— 配合均分+抖动，
           既不空太久，也不会几颗挤在一起。 */
        var CYCLE = 24; // 秒
        var slots = [];

        for (var i = 0; i < meteors.length; i++) {
            var el = meteors[i];

            /* 起点区域：首屏左上角。x 取 0~46%、y 取 0~16%，
               这样整条轨迹都从左上来、往右下走；
               再往右会让终点越过首屏底边太多，出画太早。 */
            var x = Math.random() * 46;
            var y = Math.random() * 16;
            el.style.setProperty("--ly-meteor-x", x.toFixed(2) + "%");
            el.style.setProperty("--ly-meteor-y", y.toFixed(2) + "%");

            /* 尾巴长度随机，避免几条完全一致 */
            var len = Math.round(260 + Math.random() * 160);
            el.style.setProperty("--ly-meteor-len", len + "px");

            /* 把 CYCLE 均分成 n 段，每颗占一段、段内再随机抖动。
               均分保证平均间隔稳定（不会几颗挤在一起、又长时间没有），
               抖动保证看起来不规律（不会像定时器）。 */
            slots.push((i + Math.random() * 0.8) * (CYCLE / meteors.length));
        }

        // 打散后赋给各颗：每个周期只出现一次
        for (var j = 0; j < meteors.length; j++) {
            var node = meteors[j];
            var startAt = slots[j];
            node.style.setProperty("--ly-meteor-dur", CYCLE + "s");
            node.style.setProperty("--ly-meteor-delay", (-startAt).toFixed(2) + "s");
            /* 直接写 animation 而不是只改变量：动画已经在跑，
               改时长/延迟需要重启动画才会应用到新的时间轴上 */
            var anim = "linear " + CYCLE + "s " + (-startAt).toFixed(2) + "s infinite";
            node.style.animation = "lyMeteorFall " + anim;
            var tail = node.querySelector(".ly-meteor-tail");
            if (tail) tail.style.animation = "lyMeteorTail " + anim;
            var dot = node.querySelector(".ly-meteor-dot");
            if (dot) dot.style.animation = "lyMeteorFade " + anim;
        }

        trace.push("meteors:" + meteors.length + "/cycle" + CYCLE + "s");
    }

    safe("pointerGlow", setupPointerGlow);
    safe("scrollParallax", setupScrollParallax);
    safe("ripple", setupRipple);
    safe("themeToggle", setupThemeToggle);
    safe("meteors", setupMeteors);

    trace.push("done");
})();
