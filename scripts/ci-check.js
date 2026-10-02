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
    'archives/index.html',
    'categories/index.html',
    'tags/index.html',
    '404.html',
    'code/check_pwd.py.txt',
    'code/c-language-week1.c.txt',
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
for (const file of htmlFiles) {
    const html = fs.readFileSync(file, 'utf8');
    if (!/<title>\s*[^<]+<\/title>/i.test(html)) {
        console.error('Missing or empty title: ' + path.relative(publicDir, file));
        process.exit(1);
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

console.log(`CI checks passed: ${htmlFiles.length} HTML files, ${localRefs.size} local references.`);
}
