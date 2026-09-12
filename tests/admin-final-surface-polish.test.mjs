import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [profilePage, profileCss, surfaceCss, layout] = await Promise.all([
  readFile(new URL("../app/(admin)/ogl/rep-profiles/page.tsx", import.meta.url), "utf8"),
  readFile(new URL("../components/rep-profile-final-polish.module.css", import.meta.url), "utf8"),
  readFile(new URL("../app/admin-final-surface-polish.css", import.meta.url), "utf8"),
  readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
]);

test("representative profile behavior contracts are unchanged", () => {
  assert.match(profilePage, /action=\{saveOglRepProfileAction\}/);
  assert.match(profilePage, /action=\{uploadOglRepPhotoAction\}/);
  assert.match(profilePage, /action=\{clearOglRepPhotoAction\}/);
  assert.match(profilePage, /name="profileActive"/);
  assert.match(profilePage, /name="repCode"/);
  assert.match(profilePage, /accept="image\/jpeg,image\/png,image\/webp"/);
});

test("representative profiles use the final polish layer", () => {
  assert.match(profilePage, /rep-profile-final-polish\.module\.css/);
  assert.match(profilePage, /polish\.cardGrid/);
  assert.match(profilePage, /polish\.profileForm/);
  assert.match(profilePage, /polish\.mediaActions/);
  assert.match(profileCss, /minmax\(min\(100%, 34rem\), 1fr\)/);
  assert.match(profileCss, /::file-selector-button/);
  assert.match(profileCss, /Profile photo/);
});

test("company directory and overview final polish is scoped to existing contracts", () => {
  assert.match(surfaceCss, /\.company-directory-toolbar/);
  assert.match(surfaceCss, /\.company-group-row/);
  assert.match(surfaceCss, /\.company-overview-stats/);
  assert.match(surfaceCss, /\.company-overview-panel/);
  assert.match(surfaceCss, /\.company-detail-tree-panel/);
});

test("the global final surface polish is loaded after prior Admin layers", () => {
  const finalIndex = layout.indexOf('./admin-final-surface-polish.css');
  const policyIndex = layout.indexOf('./admin-policy-interactions.css');
  assert.ok(finalIndex > policyIndex);
});
