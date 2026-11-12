/* Shared, morphing navigation panel. No animation library or remote assets. */
(function () {
    'use strict';
    var nav = document.getElementById('desktop-menu');
    var viewport = document.getElementById('nav-preview');
    if (!nav || !viewport) return;

    var desktop = window.matchMedia('(min-width: 900px)');
    var reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    var triggers = Array.from(nav.querySelectorAll('[data-nav-preview]'));
    var navLinks = Array.from(nav.querySelectorAll('a'));
    var panels = Array.from(viewport.querySelectorAll('[data-nav-panel]'));
    var active = null;
    var current = null;
    var closeTimer;
    var lastIndex = 0;
    var restoringFocus = false;

    function cancelClose() { clearTimeout(closeTimer); }
    function position() {
        if (!active || !current) return;
        var rect = active.getBoundingClientRect();
        var navRect = document.getElementById('menu').getBoundingClientRect();
        var width = Math.min(Number(current.dataset.width), window.innerWidth - 32);
        current.style.width = (width - 2) + 'px';
        var x = Math.max(16, Math.min(rect.left + rect.width / 2 - width / 2, window.innerWidth - width - 16));
        viewport.style.width = width + 'px';
        viewport.style.height = (current.offsetHeight + 2) + 'px';
        viewport.style.left = x + 'px';
        var below = navRect.top < window.innerHeight / 2;
        viewport.dataset.side = below ? 'bottom' : 'top';
        viewport.style.top = below ? (navRect.bottom + 10) + 'px' : 'auto';
        viewport.style.bottom = below ? 'auto' : (window.innerHeight - navRect.top + 12) + 'px';
    }

    function close(restore) {
        cancelClose();
        var previous = active;
        triggers.forEach(function (trigger) { trigger.setAttribute('aria-expanded', 'false'); });
        active = null;
        current = null;
        viewport.classList.remove('is-open');
        viewport.inert = true;
        panels.forEach(function (panel) { panel.inert = true; });
        if (restore && previous) {
            restoringFocus = true;
            previous.focus();
            restoringFocus = false;
        }
    }

    function scheduleClose() {
        cancelClose();
        closeTimer = setTimeout(function () {
            if (!viewport.contains(document.activeElement)) close(false);
        }, 160);
    }

    function open(trigger) {
        if (!desktop.matches) return;
        cancelClose();
        if (active === trigger) return;
        var next = panels.find(function (panel) { return panel.dataset.navPanel === trigger.dataset.navPreview; });
        if (!next) return;
        var wasOpen = !!active;
        var index = triggers.indexOf(trigger);
        var direction = index >= lastIndex ? 1 : -1;
        lastIndex = index;
        triggers.forEach(function (item) { item.setAttribute('aria-expanded', String(item === trigger)); });
        panels.forEach(function (panel) {
            panel.getAnimations().forEach(function (animation) { animation.cancel(); });
            panel.hidden = panel !== next;
            panel.inert = panel !== next;
        });
        active = trigger;
        current = next;
        viewport.inert = false;
        viewport.classList.toggle('is-positioning', !wasOpen);
        position();
        // Commit the starting size before enabling transitions on first open.
        void viewport.offsetWidth;
        viewport.classList.remove('is-positioning');
        viewport.classList.add('is-open');
        if (!reduced.matches && next.animate) {
            next.animate([
                { opacity: 0, transform: 'translate(' + (wasOpen ? direction * 18 : 0) + 'px, ' + (wasOpen ? 0 : 6) + 'px)' },
                { opacity: 1, transform: 'translate(0, 0)' }
            ], { duration: 240, easing: 'cubic-bezier(.22, 1, .36, 1)' });
        }
    }

    triggers.forEach(function (trigger) {
        var panel = panels.find(function (item) { return item.dataset.navPanel === trigger.dataset.navPreview; });
        if (!panel) return;
        trigger.setAttribute('aria-controls', panel.id);
        trigger.setAttribute('aria-expanded', 'false');
        trigger.addEventListener('pointerenter', function (event) { if (event.pointerType !== 'touch') open(trigger); });
        trigger.addEventListener('focus', function () { if (!restoringFocus) open(trigger); });
        trigger.addEventListener('keydown', function (event) {
            if (!desktop.matches) return;
            if (event.key === 'ArrowUp' || event.key === 'ArrowDown' || (event.key === 'Tab' && !event.shiftKey && active === trigger)) {
                open(trigger);
                if (current) { event.preventDefault(); current.querySelector('a').focus(); }
            }
        });
    });
    navLinks.forEach(function (link, index) {
        link.addEventListener('keydown', function (event) {
            if (!desktop.matches || (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight')) return;
            event.preventDefault();
            var delta = event.key === 'ArrowRight' ? 1 : -1;
            navLinks[(index + delta + navLinks.length) % navLinks.length].focus();
        });
    });

    // The panel is outside the navigation's backdrop-filter.
    // A short exit delay bridges the 12px gap, allowing diagonal mouse travel.
    nav.addEventListener('pointerenter', cancelClose);
    nav.addEventListener('pointerleave', scheduleClose);
    viewport.addEventListener('pointerenter', cancelClose);
    viewport.addEventListener('pointerleave', scheduleClose);
    nav.querySelectorAll('a:not([data-nav-preview]), button').forEach(function (item) {
        item.addEventListener('pointerenter', function () { close(false); });
        item.addEventListener('focus', function () { close(false); });
    });
    viewport.addEventListener('keydown', function (event) {
        if (event.key !== 'Tab' || !current) return;
        var links = Array.from(current.querySelectorAll('a'));
        if (event.shiftKey && event.target === links[0]) {
            event.preventDefault();
            active.focus();
        } else if (!event.shiftKey && event.target === links[links.length - 1]) {
            event.preventDefault();
            var next = active.nextElementSibling || document.querySelector('.archive-shortcut') || document.getElementById('theme-toggle');
            close(false);
            if (next) next.focus();
        }
    });
    document.addEventListener('keydown', function (event) {
        if (event.key === 'Escape' && active) { event.preventDefault(); close(true); }
    });
    document.addEventListener('focusin', function (event) {
        if (!nav.contains(event.target) && !viewport.contains(event.target)) close(false);
    });
    document.addEventListener('pointerdown', function (event) {
        if (!nav.contains(event.target) && !viewport.contains(event.target)) close(false);
    });
    viewport.addEventListener('click', function (event) {
        if (event.target.closest('a')) close(false);
    });
    window.addEventListener('resize', function () { if (desktop.matches) position(); else close(false); });
    window.addEventListener('blur', function () { close(false); });
    if (window.ResizeObserver) {
        var observer = new ResizeObserver(position);
        panels.forEach(function (panel) { observer.observe(panel); });
    }
    viewport.hidden = false;
    viewport.inert = true;
})();
