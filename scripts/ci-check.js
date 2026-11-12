if (require.main !== module) {
    module.exports = {};
} else {
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const publicDir = path.join(root, 'public');
const required = [
    'index.html',
    'about/index.html',
    'subscribe/index.html',
    'archives/index.html',
    'categories/index.html',
    'tags/index.html',
    '404.html',
    'code/check_pwd.py.txt',
    'code/c-language-week1.c.txt',
    'atom.xml',
    'sitemap.xml',
    'css/site.css',
    'js/site.js',
    'css/nav-preview.css',
    'js/nav-preview.js',
];

function exists(relative) {
    return fs.existsSync(path.join(publicDir, relative));
}

const missing = required.filter((relative) => !exists(relative));
if (missing.length) {
    console.error('Missing generated files:\n- ' + missing.join('\n- '));
    process.exit(1);
}

const htmlFiles = [];
function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const file = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(file);
        else if (entry.name.endsWith('.html')) htmlFiles.push(file);
    }
}
walk(publicDir);

const localRefs = new Set();
const fragments = [];
for (const file of htmlFiles) {
    const html = fs.readFileSync(file, 'utf8');
    if (!/<title>\s*[^<]+<\/title>/i.test(html)) {
        console.error('Missing or empty title: ' + path.relative(publicDir, file));
        process.exit(1);
    }
    if ((html.match(/<h1(?:\s|>)/gi) || []).length !== 1) {
        console.error('Expected exactly one h1: ' + path.relative(publicDir, file));
        process.exit(1);
    }
    let headingLevel = 0;
    for (const match of html.matchAll(/<h([1-6])(?:\s|>)/gi)) {
        const nextLevel = Number(match[1]);
        if (nextLevel > headingLevel + 1) {
            console.error('Skipped heading level: ' + path.relative(publicDir, file) + ' h' + headingLevel + ' -> h' + nextLevel);
            process.exit(1);
        }
        headingLevel = nextLevel;
    }
    if (html.includes('&lt;%#') || html.includes('<%#')) {
        console.error('Template comment leaked into page: ' + path.relative(publicDir, file));
        process.exit(1);
    }
    if (!/<link\b[^>]*rel="canonical"[^>]*href="https:\/\//i.test(html)) {
        console.error('Missing canonical URL: ' + path.relative(publicDir, file));
        process.exit(1);
    }
    for (const match of html.matchAll(/href="([^"#]*)#([^"\s]+)"/g)) {
        if (match[1] && !match[1].startsWith('/')) continue;
        fragments.push({ file, target: match[1], id: decodeURIComponent(match[2]) });
    }
    for (const match of html.matchAll(/(?:href|src)=["']([^"']+)["']/gi)) {
        const rawRef = match[1].split('#')[0].split('?')[0];
        if (!rawRef || rawRef.startsWith('#') || /^(?:https?:|mailto:|javascript:|data:)/i.test(rawRef)) continue;
        if (rawRef.startsWith('/')) {
            try {
                localRefs.add(decodeURIComponent(rawRef.slice(1)));
            } catch {
                localRefs.add(rawRef.slice(1));
            }
        }
    }
}

const missingRefs = [...localRefs].filter((ref) => {
    const target = path.join(publicDir, ref);
    return !fs.existsSync(target) && !fs.existsSync(target + '.html') && !fs.existsSync(path.join(target, 'index.html'));
});
if (missingRefs.length) {
    console.error('Broken local references:\n- ' + missingRefs.join('\n- '));
    process.exit(1);
}

const htmlCache = new Map();
for (const fragment of fragments) {
    let target = fragment.target ? path.join(publicDir, decodeURIComponent(fragment.target)) : fragment.file;
    if (fs.existsSync(target) && fs.statSync(target).isDirectory()) target = path.join(target, 'index.html');
    if (!fs.existsSync(target) || !target.endsWith('.html')) continue;
    if (!htmlCache.has(target)) htmlCache.set(target, fs.readFileSync(target, 'utf8'));
    if (!htmlCache.get(target).includes('id="' + fragment.id + '"')) {
        console.error('Broken anchor: ' + path.relative(publicDir, fragment.file) + ' -> ' + fragment.target + '#' + fragment.id);
        process.exit(1);
    }
}

console.log(`CI checks passed: ${htmlFiles.length} HTML files, ${localRefs.size} local references, ${fragments.length} anchors.`);
}
