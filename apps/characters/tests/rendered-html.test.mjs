import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import test from "node:test";

test("builds a static GitHub Pages application", async () => {
  const html = await readFile(new URL("../dist/index.html", import.meta.url), "utf8");
  const assets = await readdir(new URL("../dist/assets/", import.meta.url));

  assert.match(html, /<title>WSGuild — Character Vault<\/title>/i);
  assert.match(html, /<div id="root"><\/div>/i);
  assert.match(html, /src="\/assets\/[^"]+\.js"/i);
  assert.ok(assets.some((file) => file.endsWith(".js")));
  assert.ok(assets.some((file) => file.endsWith(".css")));
  assert.doesNotMatch(html, /chatgpt\.site|codex-preview/i);
});
