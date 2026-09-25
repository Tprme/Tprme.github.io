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
        /* 手机上滚动时 scrollTop 会来回抖（手指的微小反向、动量回弹、
           子像素取整）。原来写的是「只要比上一次大 1px 就算往下滚」，
           于是 hiddenMenu 几乎每帧都在 true/false 之间翻。
           而 #menu 的 class 是 Vue 绑定的（menu.ejs 的 :class），
           Vue 重渲染会用 el.className = ... 把整个 class 属性重写一遍，
           顺手抹掉 glass.js 用 classList.add 加的 ly-scrolling。
           结果 backdrop-filter 以 60+Hz 在 blur(16px) 和 none 之间横跳 ——
           这就是「上下滑动一闪一闪」。
           实测：3 秒滚动里 #menu 的 class 被改写 204 次 / 共 205 帧。
           加 8px 死区，只有真的滚过 8px 才认为方向变了。 */
        handleScroll() {
            let wrap = this.$refs.homePostsWrap;
            let newScrollTop = document.documentElement.scrollTop;
            const DEADZONE = 8;
            const delta = newScrollTop - this.scrollTop;
            if (delta > DEADZONE) {
                if (!this.hiddenMenu) this.hiddenMenu = true;
                if (this.showMenuItems) this.showMenuItems = false;
                this.scrollTop = newScrollTop;
            } else if (delta < -DEADZONE) {
                if (this.hiddenMenu) this.hiddenMenu = false;
                this.scrollTop = newScrollTop;
            }
            if (wrap) {
                const shouldColor = newScrollTop <= window.innerHeight - 100;
                if (this.menuColor !== shouldColor) this.menuColor = shouldColor;
                wrap.style.top =
                    newScrollTop <= 400 ? "-" + newScrollTop / 5 + "px" : "-80px";
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
