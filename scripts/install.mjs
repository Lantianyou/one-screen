import { copyFile, mkdir, readFile, stat } from "node:fs/promises";
import { resolve, join } from "node:path";
import { fileURLToPath } from "node:url";

const vault = process.argv[2];
if (!vault) throw new Error("Usage: pnpm install:local /absolute/path/to/vault");
const root = fileURLToPath(new URL("../", import.meta.url));
const config = resolve(vault, ".obsidian");
if (!(await stat(config)).isDirectory())
  throw new Error("The vault must already have an .obsidian directory.");
const manifest = JSON.parse(await readFile(join(root, "dist/manifest.json"), "utf8"));
const destination = join(config, "plugins", manifest.id);
await mkdir(destination, { recursive: true });
for (const file of ["main.js", "styles.css", "manifest.json"]) {
  await copyFile(join(root, "dist", file), join(destination, file));
}
console.log("Installed: " + destination);
