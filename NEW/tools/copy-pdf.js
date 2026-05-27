#!/usr/bin/env node
/**
 * Copy a generated PDF from the LaTeX outDir to the repo docs folder.
 * Args: [outDir, docFile, repoDocs]
 */
const fs = require("fs");
const path = require("path");

const [, , outDir, docFile, repoDocs] = process.argv;

if (!outDir || !docFile || !repoDocs) {
  console.error("copy-pdf: missing args", { outDir, docFile, repoDocs });
  process.exit(0); // don't fail the build
}

const src = path.resolve(outDir, `${docFile}.pdf`);
const dst = path.resolve(repoDocs, `${docFile}.pdf`);

if (!fs.existsSync(src)) {
  console.error(`copy-pdf: source missing ${src}`);
  process.exit(0);
}

fs.mkdirSync(path.dirname(dst), { recursive: true });
fs.copyFileSync(src, dst);
console.log(`copy-pdf: ${src} -> ${dst}`);
