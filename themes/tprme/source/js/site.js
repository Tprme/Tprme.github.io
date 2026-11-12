(function () {
    'use strict';
    var root = document.documentElement;
    var themeButton = document.getElementById('theme-toggle');
    var scheme = window.matchMedia('(prefers-color-scheme: dark)');
    function applyTheme(theme) {
        root.dataset.theme = theme;
        var label = theme === 'dark' ? '切换浅色模式' : '切换深色模式';
        themeButton.setAttribute('aria-label', label);
        themeButton.title = label;
        document.querySelector('meta[name="theme-color"]').content = theme === 'dark' ? '#101216' : '#f8f9fb';
    }
    applyTheme(root.dataset.theme);
    themeButton.addEventListener('click', function () {
        var theme = root.dataset.theme === 'dark' ? 'light' : 'dark';
        applyTheme(theme);
        try { localStorage.setItem('ly-theme', theme); } catch (_) {}
    });
    scheme.addEventListener('change', function (event) {
        var saved;
        try { saved = localStorage.getItem('ly-theme'); } catch (_) {}
        if (saved !== 'dark' && saved !== 'light') applyTheme(event.matches ? 'dark' : 'light');
    });

    var mobile = document.getElementById('mobile-menu');
    document.addEventListener('click', function (event) {
        if (mobile.open && !mobile.contains(event.target)) mobile.open = false;
    });
    document.addEventListener('keydown', function (event) {
        if (event.key === 'Escape' && mobile.open) {
            mobile.open = false;
            mobile.querySelector('summary').focus();
        }
    });
    window.matchMedia('(min-width: 900px)').addEventListener('change', function (event) {
        if (event.matches) mobile.open = false;
    });

    var search = document.getElementById('archive-search');
    if (search) {
        var rows = Array.from(document.querySelectorAll('.archive-row'));
        function filterArchive() {
            var words = search.value.trim().toLowerCase().split(/\s+/).filter(Boolean);
            var count = 0;
            rows.forEach(function (row) {
                row.hidden = !words.every(function (word) { return row.dataset.search.includes(word); });
                if (!row.hidden) count++;
            });
            document.querySelectorAll('.archive-month').forEach(function (month) {
                month.hidden = !month.querySelector('.archive-row:not([hidden])');
            });
            document.getElementById('search-count').textContent = count + ' 篇文章';
            document.getElementById('search-empty').hidden = count > 0;
        }
        search.addEventListener('input', filterArchive);
        function followArchiveAnchor(hash, scroll) {
            if (hash === '#search') {
                search.focus({ preventScroll: true });
                if (scroll) document.getElementById('search').scrollIntoView({ block: 'start' });
            } else if (/^#month-\d{4}-\d{2}$/.test(hash)) {
                var month = document.getElementById(hash.slice(1));
                if (!month) return;
                search.value = '';
                filterArchive();
                if (scroll) month.scrollIntoView({ block: 'start' });
            }
        }
        // Same-document navigation does not reload the search state. Handle
        // clicks as well as hashchange, including a repeated click on one month.
        document.addEventListener('click', function (event) {
            if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
            var link = event.target.closest('a[href]');
            if (!link || link.target === '_blank' || link.hasAttribute('download')) return;
            var url = new URL(link.href, location.href);
            if (url.origin !== location.origin || url.pathname !== location.pathname || url.search !== location.search) return;
            if (url.hash !== '#search' && !/^#month-\d{4}-\d{2}$/.test(url.hash)) return;
            event.preventDefault();
            if (location.hash !== url.hash) history.pushState(null, '', url.hash);
            followArchiveAnchor(url.hash, true);
        });
        window.addEventListener('hashchange', function () { followArchiveAnchor(location.hash, true); });
        followArchiveAnchor(location.hash, false);
    }

    var feedUrl = document.getElementById('feed-url');
    var feedCopy = document.getElementById('feed-copy');
    if (feedUrl && feedCopy) {
        feedCopy.hidden = false;
        feedUrl.addEventListener('focus', function () { feedUrl.select(); });
        feedCopy.addEventListener('click', async function () {
            var status = document.getElementById('feed-copy-status');
            try {
                await navigator.clipboard.writeText(feedUrl.value);
                status.textContent = '已复制。到 RSS 阅读器里添加订阅即可。';
            } catch (_) {
                feedUrl.focus();
                feedUrl.select();
                status.textContent = '未能自动复制，地址已选中，请手动复制。';
            }
        });
    }

    var viewer = document.getElementById('photo-viewer');
    var full = document.getElementById('photo-full');
    var previousOverflow = '';
    function openPhoto(src, alt) {
        if (!viewer.showModal) { window.open(src, '_blank', 'noopener'); return; }
        full.src = src;
        full.alt = alt;
        document.getElementById('photo-caption').textContent = alt;
        document.getElementById('photo-original').href = src;
        previousOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        viewer.showModal();
    }
    document.querySelectorAll('[data-photo]').forEach(function (button) {
        button.addEventListener('click', function () {
            openPhoto(button.dataset.photo, button.querySelector('img').alt);
        });
    });
    document.querySelectorAll('.prose img').forEach(function (img) {
        if (img.closest('a')) return;
        img.dataset.lightbox = '';
        img.tabIndex = 0;
        img.setAttribute('role', 'button');
        img.setAttribute('aria-label', '放大图片：' + (img.alt || '文章图片'));
        img.loading = 'lazy';
        img.addEventListener('click', function () { openPhoto(img.currentSrc || img.src, img.alt); });
        img.addEventListener('keydown', function (event) {
            if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); img.click(); }
        });
    });
    document.getElementById('photo-close').addEventListener('click', function () { viewer.close(); });
    viewer.addEventListener('click', function (event) { if (event.target === viewer) viewer.close(); });
    viewer.addEventListener('close', function () { document.body.style.overflow = previousOverflow; });

    document.querySelectorAll('.prose pre').forEach(function (pre, index) {
        var wrapper = document.createElement('div');
        wrapper.className = 'code-wrap';
        var block = pre.closest('figure.highlight') || pre;
        if (block.parentElement.classList.contains('code-wrap')) return;
        block.before(wrapper);
        wrapper.appendChild(block);
        block.tabIndex = 0;
        block.setAttribute('role', 'region');
        block.setAttribute('aria-label', '代码块 ' + (index + 1) + '，可横向滚动');
        var button = document.createElement('button');
        button.type = 'button';
        button.className = 'code-copy';
        button.textContent = '复制';
        button.setAttribute('aria-label', '复制代码');
        button.addEventListener('click', async function () {
            try {
                var copy = (pre.querySelector('code') || pre).cloneNode(true);
                copy.querySelectorAll('br').forEach(function (br) { br.replaceWith('\n'); });
                await navigator.clipboard.writeText(copy.textContent);
                button.textContent = '已复制';
            } catch (_) {
                button.textContent = '请选中后复制';
            }
            setTimeout(function () { button.textContent = '复制'; }, 2000);
        });
        wrapper.appendChild(button);
    });
    document.querySelectorAll('.prose table').forEach(function (table, index) {
        if (table.closest('figure.highlight')) return;
        var wrapper = document.createElement('div');
        wrapper.className = 'table-scroll';
        wrapper.tabIndex = 0;
        wrapper.setAttribute('role', 'region');
        wrapper.setAttribute('aria-label', '表格 ' + (index + 1) + '，可横向滚动');
        table.before(wrapper);
        wrapper.appendChild(table);
    });

    var prose = document.querySelector('.prose');
    if (prose) {
        var progress = document.querySelector('.reading-progress span');
        var heads = Array.from(prose.querySelectorAll('h2[id], h3[id], h4[id]'));
        var links = Array.from(document.querySelectorAll('.toc a'));
        var frame = 0;
        function updateReading() {
            frame = 0;
            if (progress) {
                var top = prose.getBoundingClientRect().top + window.scrollY;
                var distance = Math.max(1, prose.offsetHeight - window.innerHeight + 160);
                progress.style.transform = 'scaleX(' + Math.max(0, Math.min(1, (window.scrollY - top + 160) / distance)) + ')';
            }
            var active = heads[0];
            heads.forEach(function (head) { if (head.getBoundingClientRect().top <= 180) active = head; });
            links.forEach(function (link) {
                var selected = active && decodeURIComponent(link.hash.slice(1)) === active.id;
                link.classList.toggle('is-current', !!selected);
                if (selected) link.setAttribute('aria-current', 'location');
                else link.removeAttribute('aria-current');
            });
        }
        function requestUpdate() { if (!frame) frame = requestAnimationFrame(updateReading); }
        window.addEventListener('scroll', requestUpdate, { passive: true });
        window.addEventListener('resize', requestUpdate);
        if (window.ResizeObserver) new ResizeObserver(requestUpdate).observe(prose);
        updateReading();
    }
})();
