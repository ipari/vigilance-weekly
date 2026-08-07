import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const projectRoot = new URL("../", import.meta.url);

async function source(path) {
  return readFile(new URL(path, projectRoot), "utf8");
}

test("home renders region cards from the latest completed report", async () => {
  const [page, publicReports] = await Promise.all([
    source("app/page.tsx"),
    source("db/public-reports.ts"),
  ]);

  assert.match(page, /currentReport\.regions/);
  assert.match(page, /regions\.map\(\(region\)/);
  assert.match(page, /region\.highCount/);
  assert.doesNotMatch(page, /const regions\s*=\s*\[/);

  assert.match(publicReports, /regionSummaries\(regulatory\)/);
  assert.match(publicReports, /MFDS · KIDS/);
  assert.match(publicReports, /EMA · PRAC/);
});

test("report exposes regulatory classification, priority and assessment", async () => {
  const [page, css] = await Promise.all([
    source("app/reports/[week]/page.tsx"),
    source("app/globals.css"),
  ]);

  assert.match(page, /item\.actionType/);
  assert.match(page, /우선순위 \{item\.priority\}/);
  assert.match(page, /item\.assessment/);
  assert.match(page, /item\.matchedTerms\.join/);
  assert.match(page, /공식 자료 보기/);
  assert.match(css, /\.regulatoryBadges/);
  assert.match(css, /\.priority\.high/);
  assert.match(css, /\.statusDot\.urgent/);
});
