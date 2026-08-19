const fs = require('fs');
const path = require('path');

class DateTypeReporter {
  constructor() {
    this.results = [];
  }

  onTestEnd(test, result) {
    this.results.push({ test, result });
  }

  onEnd() {
    try {
      const now = new Date();
      const yyyy = now.getFullYear();
      const mm = String(now.getMonth() + 1).padStart(2, '0');
      const dd = String(now.getDate()).padStart(2, '0');
      const date = `${yyyy}-${mm}-${dd}`;

      const testProject = (process.env.TEST_PROJECT || 'misc').toLowerCase();
      const dir = path.join(process.cwd(), 'test-results', date, testProject);
      fs.mkdirSync(dir, { recursive: true });

      const summary = this._buildSummary();
      const filename = `playwright-summary-${Date.now()}.md`;
      const outPath = path.join(dir, filename);
      fs.writeFileSync(outPath, summary, 'utf8');
      console.log(`Playwright reporter wrote summary to ${outPath}`);
    } catch (err) {
      console.error('DateTypeReporter error writing report:', err);
    }
  }

  _buildSummary() {
    const total = this.results.length;
    const passed = this.results.filter(r => r.result.status === 'passed').length;
    const failed = this.results.filter(r => r.result.status === 'failed').length;
    const skipped = this.results.filter(r => r.result.status === 'skipped').length;

    const lines = [];
    lines.push('# Playwright Test Summary');
    lines.push('');
    lines.push(`**Date:** ${new Date().toISOString()}`);
    lines.push(`**Project:** ${process.env.TEST_PROJECT || 'unspecified'}`);
    lines.push('');
    lines.push('| Result | Count |');
    lines.push('|---|---:|');
    lines.push(`| Passed | ${passed} |`);
    lines.push(`| Failed | ${failed} |`);
    lines.push(`| Skipped | ${skipped} |`);
    lines.push(`| Total | ${total} |`);
    lines.push('');
    lines.push('## Failures');
    lines.push('');

    this.results.filter(r => r.result.status === 'failed').forEach((r, idx) => {
      const title = r.test.title;
      const file = r.test.location && r.test.location.file ? r.test.location.file : 'unknown';
      const error = (r.result.error && r.result.error.message) || 'no message';
      lines.push(`### ${idx + 1}. ${title}`);
      lines.push('');
      lines.push(`- **Spec:** ${file}`);
      lines.push(`- **Error:** ${error}`);
      lines.push('');
    });

    return lines.join('\n');
  }
}

module.exports = DateTypeReporter;
