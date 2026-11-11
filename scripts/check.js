"use strict";
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const vm = require("node:vm");
const root = path.resolve(__dirname, "..");
const files = ["MMM-Life360-BODK.js", "node_helper.js", "translations.js",
  ...["lib", "scripts", "test"].flatMap(dir => fs.readdirSync(path.join(root, dir)).filter(name => name.endsWith(".js")).map(name => `${dir}/${name}`))];
for (const file of files) {
  const result = spawnSync(process.execPath, ["--check", path.join(root, file)], { encoding: "utf8" });
  if (result.status !== 0) { process.stderr.write(result.stderr); process.exit(1); }
}
new vm.Script(`(${fs.readFileSync(path.join(root, "config.example.js"), "utf8")}\n)`);
console.log(`Syntax OK: ${files.length} JavaScript files and configuration example`);
