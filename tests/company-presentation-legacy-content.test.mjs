import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("legacy Page Builder content is detected and reduced to safe readable text", () => {
  const helper = source("lib/company-presentation-content.ts");

  assert.match(helper, /data-content-type/);
  assert.match(helper, /data-pb-style/);
  assert.match(helper, /pagebuilder-/);
  assert.match(helper, /\\\{\\\{\\s\*media/);
  assert.match(helper, /<style\\b/);
  assert.match(helper, /<script\\b/);
  assert.match(helper, /replace\(\/<\[\^>\]\+>\/g, " "\)/);
  assert.doesNotMatch(helper, /dangerouslySetInnerHTML/);
});

test("Admin personalisation preserves legacy source and previews readable content", () => {
  const page = source("app/(admin)/companies/[id]/personalisation/page.tsx");
  const styles = source("components/company-personalisation-workspace.module.css");

  assert.match(page, /presentationText\(presentation\.welcome_text\)/);
  assert.match(page, /presentationText\(presentation\.company_description\)/);
  assert.match(page, /Legacy Magento Page Builder content detected/);
  assert.match(page, /View legacy source/);
  assert.match(page, /welcomeContent\.text/);
  assert.match(page, /descriptionContent\.text/);
  assert.doesNotMatch(page, /dangerouslySetInnerHTML/);

  assert.match(styles, /\.legacySource/);
  assert.match(styles, /\.legacyPreviewText/);
});

test("saving unrelated presentation settings omits hidden legacy Fluid fields", () => {
  const actions = source("app/(admin)/companies/[id]/personalisation/actions.ts");

  assert.match(actions, /formData\.has\("welcomeText"\)/);
  assert.match(actions, /formData\.has\("companyDescription"\)/);
  assert.match(actions, /input\.welcome_text = nullableString/);
  assert.match(actions, /input\.company_description = nullableString/);
  assert.match(actions, /must not rewrite[\s\S]*canonical Fluid values/);
});

test("customer Portal renders the same cleaned presentation text", () => {
  const portal = source("app/(portal)/portal/company-profile/page.tsx");

  assert.match(portal, /presentationText\(presentation\.welcome_text\)/);
  assert.match(portal, /presentationText\(presentation\.company_description\)/);
  assert.match(portal, /welcomeContent\.text/);
  assert.match(portal, /descriptionContent\.text/);
  assert.doesNotMatch(portal, /presentation\.welcome_text \? <p>/);
  assert.doesNotMatch(portal, /dangerouslySetInnerHTML/);
});
