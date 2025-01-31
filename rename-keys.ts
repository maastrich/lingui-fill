#! /usr/bin/env bun
// create backup of all locales/*.json files

import { glob } from "glob";
import { unlinkSync } from "node:fs";
import { join, dirname, basename } from "node:path";

const [to, from, project] = Bun.argv.reverse();

if (!project) {
  console.error("Project is required");
  process.exit(1);
}

const files = await glob(join(process.cwd(), `${project}/src/locales/*.json`), {
  ignore: ["**/node_modules/**"],
});

type Message = {
  translation: string;
  message: string;
  comments: string[];
};

type Catalog = Record<string, Message>;

const projects: Record<
  string,
  Record<
    string,
    {
      path: string;
      catalog: Catalog;
    }
  >
> = {};

if (!from || !to) {
  console.error("Both keys are required");
  process.exit(1);
}

for await (const file of files) {
  const backupfilename = `${file.replace(".json", ".bak.json")}`;
  const content = await Bun.file(file).text();
  await Bun.write(backupfilename, content.replaceAll(from, to));
}

Bun.spawnSync(["pnpm", "extract", project.split("/")[1]]);

// find all missing keys and retieve them from the backup files
const missingKeys = new Set<string>();

for (const file of files) {
  const content = await Bun.file(file).json();
  const backup = await Bun.file(file.replace(".json", ".bak.json")).json();

  for (const key in content) {
    if (content[key].translation) {
      continue;
    }
    const previous = Object.values(backup).find<any>(
      (v) => v.message === content[key].message
    );
    if (previous) {
      content[key].translation = previous.translation;
    }
  }
  Bun.write(file, JSON.stringify(content, null, 2));
  unlinkSync(file.replace(".json", ".bak.json"));
}
