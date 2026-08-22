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
  assert.match(page, /#regulatory-\$\{region\.code\}/);
  assert.match(page, /regionCardLink/);
  assert.doesNotMatch(page, /const regions\s*=\s*\[/);

  assert.match(publicReports, /regionSummaries\(regulatory\)/);
  assert.match(publicReports, /rows\.map\(\(row\) => toPublicReport\(row\)\)/);
  assert.doesNotMatch(publicReports, /rows\.map\(toPublicReport\)/);
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
  assert.match(page, /regulatoryComparison/);
  assert.match(page, /item\.officialDocumentName/);
  assert.match(page, /item\.change\.summary/);
  assert.match(page, /href=\{`#regulatory-\$\{region\.code\}`\}/);
  assert.match(page, /id=\{`regulatory-\$\{region\.code\}`\}/);
  assert.match(page, /regulatory\.filter/);
  assert.match(css, /\.regionCardLink:hover/);
  assert.match(css, /\.regulatoryRegionGroup/);
  assert.match(css, /\.regulatoryBadges/);
  assert.match(css, /\.regulatoryComparison/);
  assert.match(css, /\.regulatorySourceMatch/);
  assert.match(css, /\.priority\.high/);
  assert.match(css, /\.statusDot\.urgent/);
});

test("external regulatory requests apply source-compatible request rules", async () => {
  const worker = await source("worker/monitoring.ts");

  assert.match(worker, /monitorSearchTerms\(monitor\)\.filter\(isFdaSearchTerm\)/);
  assert.match(worker, /VigilanceWeekly\/1\.0/);
  assert.match(worker, /"user-agent"/);
});

test("stored PubMed text is decoded before public rendering", async () => {
  const publicReports = await source("db/public-reports.ts");

  assert.match(publicReports, /decodeHtmlEntities\(item\.authors\)/);
  assert.match(publicReports, /decodeHtmlEntities\(item\.abstract\)/);
});
