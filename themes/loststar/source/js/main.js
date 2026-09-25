const app = Vue.createApp({
    mixins: Object.values(mixins),
    data() {
        return {
            loading: true,
            hiddenMenu: false,
            showMenuItems: false,
            menuColor: false,
            scrollTop: 0,
            renderers: [],
        };
    },
    created() {
        /* 关闭加载层。
           注意这里必须判断 readyState，不能只挂 load 监听：
           Vue 在 DOMContentLoaded 之后才挂载，若此时 load 事件已经触发过
           （本地打开或缓存命中时很常见），再注册监听就永远等不到回调，
           加载层会一直挡住页面。 */
        const hide = () => {
            this.loading = false;
        };
        if (document.readyState === "complete") {
            hide();
        } else {
            window.addEventListener("load", hide);
            /* 兜底：极端情况下（某个资源一直挂起）load 可能迟迟不来，
               最多等 2.5 秒就放行，避免页面被加载层锁死。 */
            setTimeout(hide, 2500);
        }
    },
    mounted() {
        window.addEventListener("scroll", this.handleScroll, true);
        this.render();
    },
    methods: {
        render() {
            for (let i of this.renderers) i();
        },
        /* 这个回调以前每次滚动都写 hiddenMenu / menuColor /
           #home-posts-wrap 的 top。三者在 custom.css 里都已经被完全覆盖，
           改了看不出任何区别：
             - #menu.hidden 被钉在 bottom:10px（底栏常驻，不再收起）
             - #menu.menu-color 的背景色和文字色都被覆盖
             - #home-posts-wrap { top: 0 !important } 压掉了视差
           代价却是实打实的：Vue 的 :class 绑定在 hiddenMenu / menuColor 变化时
           会用 el.className = ... 整体重写 #menu 的 class 属性。
           实测（390x844 模拟手机，3 秒滚动）改写 204 次 / 共 205 帧，
           而每次改写都卡在「手指刚开始滑」的时刻 ——
           这就是「每次起手闪一下」的来源。
           现在只保留唯一真正有视觉作用的动作：
           向下滑动时收起手机端已经展开的菜单。 */
        handleScroll() {
            const newScrollTop = document.documentElement.scrollTop;
            const DEADZONE = 8;
            if (newScrollTop - this.scrollTop > DEADZONE) {
                /* 只在真的展开着的时候才赋值，避免无谓的重渲染 */
                if (this.showMenuItems) this.showMenuItems = false;
                this.scrollTop = newScrollTop;
            } else if (this.scrollTop - newScrollTop > DEADZONE) {
                this.scrollTop = newScrollTop;
            }
        },
    },
});
app.mount("#layout");

// Discord-like spoiler reveal behavior
(function initDiscordSpoiler() {
    function reveal(el) {
        if (!el || el.classList.contains("revealed")) return;
        el.classList.add("revealed");
        el.setAttribute("aria-expanded", "true");
    }

    document.addEventListener("click", (e) => {
        const t = e.target;
        if (t && t.classList && t.classList.contains("discord-spoiler")) {
            reveal(t);
        }
    });

    document.addEventListener("keydown", (e) => {
        if (e.key !== "Enter" && e.key !== " ") return;
        const t = e.target;
        if (t && t.classList && t.classList.contains("discord-spoiler")) {
            e.preventDefault();
            reveal(t);
        }
    });
})();
