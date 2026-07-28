const ROOT = new URL("../", import.meta.url);
const SKIPPED_DIRECTORIES = new Set([
  ".git",
  ".local",
  ".obsidian",
  ".svelte-kit",
  "node_modules",
  "dist",
  "build",
  "coverage",
  "playwright-report",
  "test-results",
  "cache",
]);
const TEXT_EXTENSIONS = new Set([
  ".css",
  ".html",
  ".js",
  ".json",
  ".md",
  ".mjs",
  ".py",
  ".sql",
  ".svelte",
  ".ts",
  ".txt",
  ".yaml",
  ".yml",
]);
const FORBIDDEN_DASHES = new Map([
  ["\u2013", "en dash"],
  ["\u2014", "em dash"],
]);

const failures: string[] = [];
await inspectDirectory(ROOT);

if (failures.length > 0) {
  console.error("Text style check failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  Deno.exit(1);
}

console.log("Text style check passed.");

async function inspectDirectory(directory: URL): Promise<void> {
  for await (const entry of Deno.readDir(directory)) {
    if (entry.isDirectory && SKIPPED_DIRECTORIES.has(entry.name)) continue;
    const url = new URL(entry.name + (entry.isDirectory ? "/" : ""), directory);
    if (entry.isDirectory) {
      await inspectDirectory(url);
      continue;
    }
    if (!entry.isFile || !isTextFile(entry.name)) continue;
    const content = await Deno.readTextFile(url);
    for (const [character, name] of FORBIDDEN_DASHES) {
      if (!content.includes(character)) continue;
      const lines = content.split("\n");
      lines.forEach((line, index) => {
        if (line.includes(character)) {
          failures.push(`${relativePath(url)}:${index + 1} contains an ${name}; use '-'`);
        }
      });
    }
  }
}

function isTextFile(name: string) {
  if (name === "Dockerfile" || name === "Caddyfile") return true;
  const dot = name.lastIndexOf(".");
  return dot >= 0 && TEXT_EXTENSIONS.has(name.slice(dot));
}

function relativePath(url: URL) {
  return decodeURIComponent(url.href.slice(ROOT.href.length));
}
