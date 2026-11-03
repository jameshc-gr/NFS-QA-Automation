import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import type { FullConfig, FullResult, Reporter, TestCase, TestResult } from '@playwright/test/reporter';
import { assertNewSolutionFinderOutputPath } from './new-solution-finder-environment';
import { scenarios } from '../tests/projects/solution-finder/workbook-scenarios/helpers/contracts';

type Row = {
  id: string; name: string; status: string; durationMs: number; qaComment: string;
  errors: string[]; artifacts: { name: string; path: string }[];
  comparisonMode: string; profileId: string | null;
};
const html = (value: string) => value.replace(/[&<>"']/g, character => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[character] || character));

export default class NewSolutionFinderReporter implements Reporter {
  private readonly rows: Row[] = [];
  private readonly errors: string[] = [];
  private metadata: Record<string, unknown> = {};
  private selectedTests = 0;
  private outputDirectory: string;

  constructor(options: { outputDirectory: string }) {
    this.outputDirectory = assertNewSolutionFinderOutputPath(resolve(__dirname, '..'), options.outputDirectory);
  }

  onBegin(config: FullConfig, suite: import('@playwright/test/reporter').Suite) {
    this.metadata = config.metadata;
    this.selectedTests = suite.allTests().length;
  }

  onError(error: import('@playwright/test/reporter').TestError) {
    this.errors.push(error.message || String(error));
  }

  onTestEnd(test: TestCase, result: TestResult) {
    const comment = result.attachments.find(attachment => attachment.name === 'qa-comment');
    const qaComment = comment?.body?.toString('utf8') ||
      (comment?.path ? readFileSync(comment.path, 'utf8') : 'No QA comment produced: investigate setup, interruption or worker failure.');
    const artifacts = result.attachments.filter(attachment => attachment.path).map(attachment => {
      const path = attachment.path;
      if (!path) throw new Error('Artifact path disappeared.');
      assertNewSolutionFinderOutputPath(resolve(__dirname, '..'), path);
      return { name: attachment.name, path: relative(this.outputDirectory, path) };
    });
    this.rows.push({
      id: test.title.match(/NSF-\d{3}/)?.[0] || test.id,
      name: test.title, status: result.status, durationMs: result.duration,
      qaComment, errors: result.errors.map(error => error.message || String(error)), artifacts,
      ...this.scenarioMetadata(test.title)
    });
  }

  private scenarioMetadata(title: string) {
    const scenario = scenarios.find(value => value.id === title.match(/NSF-\d{3}/)?.[0]);
    if (!scenario) throw new Error('Report test does not match an active Solution Finder scenario.');
    return {
      comparisonMode: scenario.comparisonMode,
      profileId: scenario.comparisonMode === 'actual-ui-api' ? scenario.provenance.profileId : null
    };
  }

  onEnd(result: FullResult) {
    mkdirSync(this.outputDirectory, { recursive: true });
    const counts = this.rows.reduce<Record<string, number>>((values, row) => {
      values[row.status] = (values[row.status] || 0) + 1;
      return values;
    }, {});
    const summary = { status: result.status, selectedTests: this.selectedTests, counts, metadata: this.metadata, errors: this.errors, scenarios: this.rows };
    writeFileSync(join(this.outputDirectory, 'run-summary.json'), `${JSON.stringify(summary, null, 2)}\n`);
    const entries = [...this.rows].sort((a, b) => a.id.localeCompare(b.id)).map(row => {
      const links = row.artifacts.map(artifact => `<a href="${html(artifact.path)}">${html(artifact.name)}</a>`).join(' · ');
      const screenshot = row.artifacts.find(artifact => artifact.name === 'offers-screenshot');
      return `<tr><td>${html(row.id)}</td><td>${html(row.name)}</td><td>${html(row.comparisonMode)}${row.profileId ? `<br>${html(row.profileId)}<br>Variant baseline pending approval` : '<br>GRI workbook baseline'}</td><td class="${row.status === 'passed' ? 'pass' : 'fail'}">${html(row.status)}</td><td><pre>${html(row.qaComment)}</pre><details><summary>Evidence and differences</summary>${links}${row.errors.length ? `<pre>${html(row.errors.join('\n\n'))}</pre>` : ''}${screenshot ? `<a href="${html(screenshot.path)}"><img loading="lazy" src="${html(screenshot.path)}" alt="Final offers for ${html(row.id)}"></a>` : ''}</details></td></tr>`;
    }).join('\n');
    const report = `<!doctype html><html lang="en"><meta charset="utf-8"><title>New Solution Finder run</title><style>body{font:15px system-ui;margin:24px;color:#17233a}table{border-collapse:collapse;width:100%}th,td{border:1px solid #ccd5e2;padding:10px;vertical-align:top}th{background:#edf2f8;text-align:left}pre{white-space:pre-wrap;overflow-wrap:anywhere;font:13px system-ui}.pass{color:#087038;font-weight:bold}.fail{color:#b52121;font-weight:bold}img{max-width:100%;width:720px}details{margin-top:12px}a{color:#1258a0}</style><h1>New Solution Finder</h1><p>Tenant: <strong>${html(String(this.metadata.tenantLabel))}</strong> · Status: ${html(result.status)} · Selected: ${this.selectedTests} · Results: ${html(JSON.stringify(counts))}</p><p>NSF-001–050 compare GRI workbook baselines; other tenants require independently reviewed expectations. NSF-051–102 use Tri-Bureau IR profiles and actual UI/API comparison only: a pass does not approve eligibility or pricing. Product ordering is not assessed; generated IDs are recorded, not compared for equality.</p>${this.errors.length ? `<h2>Run errors</h2><pre>${html(this.errors.join('\n'))}</pre>` : ''}<table><thead><tr><th>Case</th><th>Scenario</th><th>Comparison / profile</th><th>Status</th><th>QA comment and evidence</th></tr></thead><tbody>${entries}</tbody></table></html>`;
    writeFileSync(join(this.outputDirectory, 'index.html'), report);
    console.log(`New Solution Finder report: ${join(this.outputDirectory, 'index.html')}`);
  }
}
