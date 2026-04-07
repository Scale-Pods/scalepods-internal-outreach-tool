const fs = require('fs');
const path = require('path');

const replacements = [
    { from: /ScalePods/gi, to: "ScalePods" },
    { from: /ScalePods/gi, to: "ScalePods" },
    { from: /ScalePods/gi, to: "ScalePods" },
    { from: /ScalePods\.ae/gi, to: "scalepods.com" },
    { from: /ScalePods\.me/gi, to: "scalepods.com" },
    { from: /ScalePods/gi, to: "scalepods" },
    { from: /SPLoader/g, to: "SPLoader" },
    { from: /sp-loader/g, to: "sp-loader" },
    { from: /https:\/\/ScalePods\.ae\/logoheader\.webp/gi, to: "/SP_logo.png" },
    { from: /\/LM logo\.jpeg/gi, to: "/SP_logo.png" },
    { from: /\/logoheader\.webp/gi, to: "/SP_logo.png" }
];

function processPath(currentPath) {
    const stats = fs.statSync(currentPath);
    if (stats.isDirectory()) {
        const basename = path.basename(currentPath);
        if (['node_modules', '.git', '.next', '.vscode'].includes(basename)) return;
        
        fs.readdirSync(currentPath).forEach(file => {
            processPath(path.join(currentPath, file));
        });
    } else {
        const ext = path.extname(currentPath);
        // Only process specific files to avoid breaking binaries like images
        if (['.json', '.js', '.jsx', '.ts', '.tsx', '.css', '.md', '.txt', '.env'].includes(ext)) {
            // Check if file size is reasonable, skip large files just in case
            if (stats.size > 10 * 1024 * 1024) return;
            
            try {
                let content = fs.readFileSync(currentPath, 'utf8');
                let originalContent = content;
                replacements.forEach(({from, to}) => {
                    content = content.replace(from, to);
                });
                if (content !== originalContent) {
                    fs.writeFileSync(currentPath, content, 'utf8');
                    console.log(`Updated ${currentPath}`);
                }
            } catch (err) {
                console.error(`Failed to process ${currentPath}`, err);
            }
        }
    }
}

const basePath = 'c:/ScalePods/scalepods-internal-outreach';

const lmLoaderPath = path.join(basePath, 'components', 'sp-loader.tsx');
const spLoaderPath = path.join(basePath, 'components', 'sp-loader.tsx');

if (fs.existsSync(lmLoaderPath)) {
    fs.renameSync(lmLoaderPath, spLoaderPath);
    console.log(`Renamed sp-loader.tsx to sp-loader.tsx`);
}

processPath(basePath);
console.log('Done');
