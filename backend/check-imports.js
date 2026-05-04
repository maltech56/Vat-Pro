const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "src");

function walk(dir, files = []) {
  for (const item of fs.readdirSync(dir)) {
    const full = path.join(dir, item);
    if (fs.statSync(full).isDirectory()) {
      walk(full, files);
    } else if (full.endsWith(".js")) {
      files.push(full);
    }
  }
  return files;
}

const files = walk(root);
let problems = 0;

for (const file of files) {
  const content = fs.readFileSync(file, "utf8");

  const matches = [...content.matchAll(/require\(["'](\.\.?\/[^"']+)["']\)/g)];

  for (const match of matches) {
    const importPath = match[1];
    const resolved = path.resolve(path.dirname(file), importPath);
    const expectedFile = resolved.endsWith(".js") ? resolved : `${resolved}.js`;

    if (!fs.existsSync(expectedFile)) {
      problems++;
      console.log("\n❌ Missing or casing mismatch:");
      console.log("File:", path.relative(root, file));
      console.log("Require:", importPath);
      console.log("Expected:", path.relative(root, expectedFile));
    }
  }
}

if (problems === 0) {
  console.log("✅ All local require paths resolved correctly.");
} else {
  console.log(`\nFound ${problems} problem(s). Fix these before deploying.`);
}