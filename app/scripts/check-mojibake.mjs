import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();

const ignoredDirectories = new Set([
  ".git",
  ".next",
  ".turbo",
  "coverage",
  "node_modules",
  "public/uploads",
]);

const scannedExtensions = new Set([
  ".css",
  ".html",
  ".js",
  ".json",
  ".jsx",
  ".md",
  ".mjs",
  ".prisma",
  ".ts",
  ".tsx",
  ".txt",
  ".yaml",
  ".yml",
]);

const suspiciousPatterns = [
  { name: "replacement character", pattern: /\uFFFD/u },
  { name: "private-use mojibake marker", pattern: /\uF8FF/u },
  {
    name: "shift-jis decoded utf-8 fragment",
    pattern: /[\u7E67\u7E5D\u7E3A\u8373\u8C7A]/u,
  },
  {
    name: "latin-1 decoded utf-8 fragment",
    pattern: new RegExp(
      `(?:${String.fromCodePoint(0x00c3)}|${String.fromCodePoint(0x00c2)}|` +
        `${String.fromCodePoint(0x00e3)}\\u0081|` +
        `${String.fromCodePoint(0x00e3)}\\u0082|` +
        `${String.fromCodePoint(0x00e3)}\\u0083)`,
      "u"
    ),
  },
  { name: "halfwidth kana mojibake cluster", pattern: /[\uFF66-\uFF9F]{3,}/u },
];

function isIgnoredDirectory(relativePath) {
  const normalized = relativePath.split(path.sep).join("/");
  return [...ignoredDirectories].some(
    (ignored) => normalized === ignored || normalized.startsWith(`${ignored}/`)
  );
}

async function collectFiles(directory, files = []) {
  const entries = await readdir(directory, { withFileTypes: true });

  for (const entry of entries) {
    const absolutePath = path.join(directory, entry.name);
    const relativePath = path.relative(root, absolutePath);

    if (entry.isDirectory()) {
      if (!isIgnoredDirectory(relativePath)) {
        await collectFiles(absolutePath, files);
      }
      continue;
    }

    if (entry.isFile() && scannedExtensions.has(path.extname(entry.name))) {
      files.push(absolutePath);
    }
  }

  return files;
}

function findSuspiciousLines(content) {
  const findings = [];
  const lines = content.split(/\r?\n/u);

  lines.forEach((line, index) => {
    for (const { name, pattern } of suspiciousPatterns) {
      if (pattern.test(line)) {
        findings.push({
          line: index + 1,
          name,
          text: line.trim().slice(0, 160),
        });
      }
    }
  });

  return findings;
}

const files = await collectFiles(root);
const findings = [];

for (const file of files) {
  const content = await readFile(file, "utf8");
  const fileFindings = findSuspiciousLines(content);

  if (fileFindings.length > 0) {
    findings.push({
      file: path.relative(root, file),
      findings: fileFindings,
    });
  }
}

if (findings.length > 0) {
  console.error("Mojibake-like text was found:");

  for (const finding of findings) {
    for (const item of finding.findings) {
      console.error(
        `${finding.file}:${item.line} [${item.name}] ${item.text}`
      );
    }
  }

  process.exitCode = 1;
} else {
  console.log(`No mojibake-like text found in ${files.length} files.`);
}
