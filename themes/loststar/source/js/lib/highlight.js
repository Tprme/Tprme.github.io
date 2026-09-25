mixins.highlight = {
    data() {
        return { copying: false };
    },
    created() {
        hljs.configure({ ignoreUnescapedHTML: true });
        this.renderers.push(this.highlight);
    },
    methods: {
        sleep(ms) {
            return new Promise((resolve) => setTimeout(resolve, ms));
        },
        highlight() {
            let codes = document.querySelectorAll("pre");
            for (let i of codes) {
                let code = i.textContent;

                /* ------------------------------------------------------------
                   本站的代码块在服务端渲染时已经带上了高亮标记
                   （<span class="line"> 包住每一行，行内是 .keyword / .string 等），
                   配色由 source/css/custom.css 提供。
                   这种情况下不能再让 hljs 重新高亮：一来服务端没有输出
                   language-xxx，语言名取不到；二来 textContent 会丢掉行结构，
                   重高亮反而把多行代码压成一行。
                   所以这里只补上「语言标签」和「复制」按钮，保留原有排版。
                   ------------------------------------------------------------ */
                let serverHighlighted = i.querySelector(".line") !== null;
                let language = "";
                if (serverHighlighted) {
                    // 从代码块的 class（如 language-python）里取语言名，取不到就不显示
                    let cls = [...i.classList].find((c) => c.startsWith("language-"));
                    language = cls ? cls.replace("language-", "") : "";
                } else {
                    language = [...i.classList, ...(i.firstChild ? i.firstChild.classList : [])][0] || "plaintext";
                    let highlighted;
                    try {
                        highlighted = hljs.highlight(code, { language }).value;
                    } catch {
                        highlighted = code;
                    }
                    i.innerHTML = `<div class="code-content hljs">${highlighted}</div>`;
                    let content = i.querySelector(".code-content");
                    hljs.lineNumbersBlock(content, { singleLine: true });
                }

                // 用 .code-block 包住 <pre>，语言标签与复制按钮定位在它上面，
                // 这样它们不会被划入代码选区、也不会被一起复制
                let wrapper = document.createElement("div");
                wrapper.className = "code-block";
                i.parentNode.insertBefore(wrapper, i);
                wrapper.appendChild(i);

                let toolbar = document.createElement("div");
                toolbar.className = "code-toolbar";
                toolbar.innerHTML = `
                    ${language ? `<div class="language">${language}</div>` : ""}
                    <div class="copycode" role="button" tabindex="0" aria-label="复制代码" title="复制代码">
                        <i class="fa-solid fa-copy fa-fw" aria-hidden="true"></i>
                        <i class="fa-solid fa-check fa-fw" aria-hidden="true"></i>
                    </div>
                `;
                wrapper.insertBefore(toolbar, i);

                let copycode = toolbar.querySelector(".copycode");
                /* 用闭包变量而不是 this.copying：后者是所有代码块共用的，
                   复制 A 块会把 B 块也锁住 1 秒。 */
                let copying = false;
                const doCopy = async () => {
                    if (copying) return;
                    copying = true;
                    copycode.classList.add("copied");
                    try {
                        await navigator.clipboard.writeText(code);
                    } catch {
                        // 剪贴板不可用（非 https 或权限被拒）时静默失败
                    }
                    await this.sleep(1000);
                    copycode.classList.remove("copied");
                    copying = false;
                };
                copycode.addEventListener("click", doCopy);
                /* role="button" 的元素不会像真按钮那样在回车/空格时触发 click，
                   必须自己接键盘事件，否则键盘用户按下去没有任何反应。 */
                copycode.addEventListener("keydown", (e) => {
                    if (e.key === "Enter" || e.key === " " || e.key === "Spacebar") {
                        e.preventDefault();
                        doCopy();
                    }
                });
            }
        },
    },
};
