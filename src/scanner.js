const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const IGNORE_DIRS = new Set([
  'node_modules', '.git', '__pycache__', 'dist', '.next', 'build', '.cache',
  '.venv', 'venv', '.tox', '.mypy_cache', '.pytest_cache', 'coverage',
  '.turbo', '.parcel-cache', '.svelte-kit',
]);

const KEY_FILES = [
  'README.md', 'readme.md', 'package.json', 'requirements.txt',
  'pyproject.toml', 'Cargo.toml', 'go.mod', 'Makefile',
];

function buildFileTree(dirPath, depth = 0, maxDepth = 3) {
  if (depth >= maxDepth) return [];

  let entries;
  try {
    entries = fs.readdirSync(dirPath, { withFileTypes: true });
  } catch {
    return [];
  }

  const result = [];
  for (const entry of entries) {
    if (entry.name.startsWith('.') && depth > 0) continue;
    if (IGNORE_DIRS.has(entry.name)) continue;

    const entryPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      const children = buildFileTree(entryPath, depth + 1, maxDepth);
      result.push({ name: entry.name, type: 'dir', children });
    } else {
      result.push({ name: entry.name, type: 'file' });
    }
  }
  return result;
}

function treeToString(tree, indent = '') {
  let out = '';
  for (const item of tree) {
    if (item.type === 'dir') {
      out += `${indent}${item.name}/\n`;
      if (item.children) {
        out += treeToString(item.children, indent + '  ');
      }
    } else {
      out += `${indent}${item.name}\n`;
    }
  }
  return out;
}

function readKeyFiles(dirPath) {
  const contents = {};

  // Read standard key files
  for (const fname of KEY_FILES) {
    const fpath = path.join(dirPath, fname);
    try {
      if (fs.existsSync(fpath)) {
        const content = fs.readFileSync(fpath, 'utf-8');
        contents[fname] = content.slice(0, 3000); // Cap at 3k chars
      }
    } catch {
      // skip
    }
  }

  // Read any .md files in root
  try {
    const rootFiles = fs.readdirSync(dirPath);
    for (const f of rootFiles) {
      if (f.endsWith('.md') && !contents[f]) {
        const fpath = path.join(dirPath, f);
        try {
          const stat = fs.statSync(fpath);
          if (stat.isFile()) {
            contents[f] = fs.readFileSync(fpath, 'utf-8').slice(0, 3000);
          }
        } catch {
          // skip
        }
      }
    }
  } catch {
    // skip
  }

  return contents;
}

function getGitLog(dirPath) {
  try {
    const result = execSync('git log --oneline -10', {
      cwd: dirPath,
      timeout: 5000,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    return result.trim();
  } catch {
    return '';
  }
}

async function scanProject(folderPath) {
  if (!folderPath || !fs.existsSync(folderPath)) {
    return { fileTree: '', fileContents: {}, gitLog: '', tree: [] };
  }

  const tree = buildFileTree(folderPath);
  const fileTree = treeToString(tree);
  const fileContents = readKeyFiles(folderPath);
  const gitLog = getGitLog(folderPath);

  return { fileTree, fileContents, gitLog, tree };
}

module.exports = { scanProject, buildFileTree };
