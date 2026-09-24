/* ============================================================
   顶部导航的「液态玻璃」高光层
   ------------------------------------------------------------
   做什么：
     把鼠标在导航条上的位置换算成百分比，写进 CSS 变量
     --ly-glass-x / --ly-glass-y，由 custom.css 里的 #menu::after
     用来定位那团跟随指针的径向高光。

   为什么用事件委托绑在 document 上：
     最初是直接 menu.addEventListener 绑到 #menu 上，但实测（含 CDP
     的 DOMDebugger 核查与页内派发验证）监听器绑上了却收不到任何事件。
     原因是这段脚本在 <body> 末尾执行，而主题的 Vue 随后挂载、
     重建了导航节点 —— 监听器留在了被丢弃的旧节点上。
     （页面里 .ly-glass-lit 类还在，是因为 classList 操作与监听器
      生效性无关，正好掩盖了这个问题。）
     改成委托到 document、并在回调里用 closest('#menu') 惰性取当前节点，
     节点被替换多少次都不受影响。

   为什么用 rAF 节流 + setTimeout 兜底：
     mousemove 触发极频繁，直接写 style 会在每次移动时引发样式重算。
     这里只记录坐标并申请一帧，把写入次数压到每帧最多一次；
     同时挂一个 50ms 的 setTimeout —— 如果 rAF 因为页面不可见、
     标签页被挂起或自动化环境而不触发，高光会彻底卡死不动。
     哪个先到用哪个，两个都取消，不会重复执行。

   为什么桌面才启用：
     触屏没有 hover 概念，高光会一直停在某个固定位置，反而显得脏。
     用 matchMedia('(hover: hover)') 判断。

   无障碍：
     尊重 prefers-reduced-motion: reduce —— 这类用户对移动的光斑敏感，
     此时只保留静态的左上角环境光，不做跟随。
   ============================================================ */
(function () {
    "use strict";

    /* 诊断轨迹：导航高光属于「失败也不影响使用」的渐进增强，
       一旦因环境差异静默失效会非常难查（排查这个功能时确实吃过亏）。
       只保留在内存里，不上报、不输出控制台。 */
    var trace = [];
    window.__lyGlassDebug = trace;

    function currentMenu() {
        return document.getElementById("menu");
    }

    var menu = currentMenu();
    trace.push("menu=" + (menu ? "#" + menu.id : "null"));
    if (!menu) return;

    // 减少动效偏好：直接点亮静态高光，不做跟随
    var reduceMotion =
        window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    trace.push("reduceMotion=" + reduceMotion);
    if (reduceMotion) {
        menu.classList.add("ly-glass-lit");
        return;
    }

    // 触屏设备不启用跟随，只保留静态高光
    var hoverOK = window.matchMedia && window.matchMedia("(hover: hover)").matches;
    trace.push("hoverOK=" + hoverOK);
    if (!hoverOK) {
        menu.classList.add("ly-glass-lit");
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
        // 惰性取节点：即使 Vue 中途替换过 #menu，这里拿到的也是当前那个
        var el = currentMenu();
        if (!el) return;
        el.style.setProperty("--ly-glass-x", nextX + "%");
        el.style.setProperty("--ly-glass-y", nextY + "%");
    }

    function onMove(e) {
        var el = currentMenu();
        if (!el) return;
        var rect = el.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) return;
        if (trace.length < 40) trace.push("move@" + e.clientX + "," + e.clientY);
        // 允许指针略超出导航条（接近上下边缘时高光仍有渐进变化）
        nextX = ((e.clientX - rect.left) / rect.width) * 100;
        nextY = ((e.clientY - rect.top) / rect.height) * 100;
        if (pending) return;
        pending = true;
        rafId = window.requestAnimationFrame(flush);
        fallbackId = window.setTimeout(flush, 50);
    }

    // 委托：判断事件是否发生在导航条内（含其子元素）
    function inMenu(target) {
        if (!target || !target.closest) return null;
        var el = target.closest("#menu");
        return el || null;
    }

    document.addEventListener(
        "mouseover",
        function (e) {
            if (inMenu(e.target)) {
                var el = currentMenu();
                if (el) el.classList.add("ly-glass-lit");
            }
        },
        { passive: true }
    );

    document.addEventListener(
        "mouseout",
        function (e) {
            // relatedTarget 是移向的目标：仍在导航内就不算离开
            var el = currentMenu();
            if (!el) return;
            if (inMenu(e.target) && !inMenu(e.relatedTarget)) {
                el.classList.remove("ly-glass-lit");
            }
        },
        { passive: true }
    );

    /* 用 mousemove 而不是 pointermove：
       mousemove 更通用（触屏已由上面的 hover 判断排除），
       也便于用 CDP 的 Input.dispatchMouseEvent 做自动化验证。 */
    document.addEventListener(
        "mousemove",
        function (e) {
            if (inMenu(e.target)) onMove(e);
        },
        { passive: true }
    );
    trace.push("delegated");

    // 页面初始就静态点亮一次，避免首屏导航条显得比原来「扁」
    menu.classList.add("ly-glass-lit");
    trace.push("done");
})();
