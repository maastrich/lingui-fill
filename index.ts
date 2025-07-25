#! /usr/bin/env bun
import { glob } from "glob";
import { join, dirname, basename } from "node:path";

const files = await glob(join(process.cwd(), "**/locales/*.json"), {
  ignore: ["**/node_modules/**", "**/locales/messages.json"],
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

for await (const file of files) {
  const project = dirname(file);
  const lang = basename(file, ".json");
  projects[project] ??= {};
  projects[project][lang] = {
    path: file,
    catalog: await Bun.file(file).json(),
  };
}

for (const project in projects) {
  const messages = new Map<string, string>();
  const translations: Record<string, Array<string>> = {};
  for (const lang in projects[project]) {
    translations[lang] = [];
    const catalog = projects[project][lang].catalog;
    for (const key in catalog) {
      messages.set(key, catalog[key].message);
      translations[lang].push(catalog[key].translation);
    }
  }

  let overrides = new Array<{
    hash: string;
    lang: string;
    translation: string;
  }>();

  for (const [hash, message] of messages) {
    const translated: Array<{
      lang: string;
      translation: string;
    }> = [];
    const missing = [];
    for (const lang in projects[project]) {
      const catalog = projects[project][lang].catalog;
      const translation = catalog[hash].translation;
      if (translation) {
        translated.push({ lang, translation });
      } else {
        missing.push(lang);
      }
    }
    if (!missing.length) {
      continue;
    }
    console.log(`[${hash}] ${message}`);
    console.group();
    for (const { lang, translation } of translated) {
      console.log(`${lang}: ${translation}`);
    }
    console.groupEnd();
    for (const lang of missing) {
      const translation = prompt(`Enter translation for [${lang}]:`);
      if (translation) {
        overrides.push({ hash, lang, translation });
      }
    }
    for (const { hash, lang, translation } of overrides) {
      projects[project][lang].catalog[hash].translation = translation;
    }
    for (const lang in projects[project]) {
      const catalog = projects[project][lang].catalog;
      await Bun.write(
        projects[project][lang].path,
        `${JSON.stringify(catalog, null, 2)}\n`
      );
    }
    overrides = [];
    console.clear();
  }
}
