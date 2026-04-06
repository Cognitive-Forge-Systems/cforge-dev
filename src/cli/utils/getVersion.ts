import fs from "fs";
import path from "path";

export function getVersion(): string {
  const pkgPath = path.resolve(__dirname, "../../../package.json");
  const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8")) as { version: string };
  return pkg.version;
}
