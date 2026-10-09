const fs = require('node:fs');
const path = require('node:path');
const yauzl = require('yauzl');
const YAML = require('yaml');

const outputPath = path.resolve(
  process.cwd(),
  'test-data/solution-finder/test_account.yaml',
);

function readTraceFiles(zipPath) {
  return new Promise((resolve, reject) => {
    yauzl.open(zipPath, { lazyEntries: true }, (openError, archive) => {
      if (openError || !archive) {
        reject(openError || new Error('Unable to open Playwright trace.'));
        return;
      }

      const traceFiles = [];
      let settled = false;

      const finish = (error) => {
        if (settled) return;
        settled = true;
        archive.close();
        if (error) reject(error);
        else resolve(traceFiles);
      };

      archive.on('error', finish);
      archive.on('end', () => finish());
      archive.on('entry', (entry) => {
        if (!entry.fileName.endsWith('.trace')) {
          archive.readEntry();
          return;
        }

        archive.openReadStream(entry, (streamError, stream) => {
          if (streamError || !stream) {
            finish(streamError || new Error('Unable to read trace entry.'));
            return;
          }

          const chunks = [];
          stream.on('data', (chunk) => chunks.push(chunk));
          stream.on('error', finish);
          stream.on('end', () => {
            traceFiles.push(Buffer.concat(chunks).toString('utf8'));
            archive.readEntry();
          });
        });
      });

      archive.readEntry();
    });
  });
}

function parseTraceEvents(traceFiles) {
  return traceFiles.flatMap((contents) =>
    contents
      .split(/\r?\n/)
      .filter(Boolean)
      .flatMap((line) => {
        try {
          return [JSON.parse(line)];
        } catch {
          return [];
        }
      }),
  );
}

function getAction(event) {
  const metadata = event.metadata || {};
  return {
    method: event.method || metadata.method || '',
    params: event.params || metadata.params || {},
  };
}

function getEnteredValue(method, params) {
  if (method === 'fill' || method === 'type' || method === 'pressSequentially') {
    return params.value ?? params.text;
  }
  if (method === 'selectOption') {
    return params.options ?? params.values ?? params.value;
  }
  if (method === 'check') return true;
  if (method === 'uncheck') return false;
  return undefined;
}

function collectStrings(value, strings = []) {
  if (typeof value === 'string') {
    strings.push(value);
  } else if (Array.isArray(value)) {
    value.forEach((item) => collectStrings(item, strings));
  } else if (value && typeof value === 'object') {
    Object.values(value).forEach((item) => collectStrings(item, strings));
  }
  return strings;
}

function findInquiryIds(events) {
  const ids = [];
  for (const value of collectStrings(events)) {
    const candidates = value.match(/(?:https?:\/\/|\/)\S+/g) || [];
    for (const candidate of candidates) {
      try {
        const url = new URL(
          candidate.replace(/[),.;"'<>\]}]+$/, ''),
          'https://trace.local',
        );
        if (!url.pathname.includes('/inquiry/prequalify')) continue;
        const id = url.searchParams.get('id');
        if (id && !ids.includes(id)) ids.push(id);
      } catch {
        // Ignore non-URL strings from trace snapshots.
      }
    }
  }
  return ids;
}

function extractRecord(test, result, events, runId) {
  const enteredFields = new Map();

  for (const event of events) {
    const { method, params } = getAction(event);
    const selector = params.selector || event.selector;
    const value = getEnteredValue(method, params);
    if (
      typeof selector === 'string' &&
      /(?:input|textarea|select)/i.test(selector) &&
      value !== undefined
    ) {
      enteredFields.set(selector, value);
    }
  }

  const fields = [...enteredFields].map(([selector, value]) => ({
    selector,
    value,
  }));
  const emailField = fields.find(({ selector }) => /email/i.test(selector));
  const email =
    emailField?.value ??
    fields.find(
      ({ value }) =>
        typeof value === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value),
    )?.value ??
    null;
  const password =
    fields.find(({ selector }) => /password/i.test(selector))?.value ?? null;
  const inquiryIds = findInquiryIds(events);

  if (!fields.length && !inquiryIds.length) return null;

  return {
    runId,
    testId: test.id,
    retry: result.retry,
    test: test.title,
    spec: path.relative(process.cwd(), test.location.file),
    status: result.status,
    recordedAt: new Date().toISOString(),
    account: {
      email,
      password,
      passwordCaptured: password !== null,
    },
    inquiryId: inquiryIds.at(-1) || null,
    inquiryIds,
    fields,
  };
}

class SolutionFinderAccountRecorder {
  constructor() {
    this.runId = process.env.RUN_ID || new Date().toISOString();
    this.pending = [];
  }

  onTestEnd(test, result) {
    const trace = result.attachments.find(
      (attachment) =>
        attachment.path &&
        (attachment.name === 'trace' || attachment.path.endsWith('.zip')),
    );
    if (!trace || !fs.existsSync(trace.path)) return;

    this.pending.push(
      readTraceFiles(trace.path)
        .then((files) => {
          const record = extractRecord(
            test,
            result,
            parseTraceEvents(files),
            this.runId,
          );
          if (record) this.records.push(record);
        })
        .catch((error) => {
          console.warn(
            `Solution Finder recorder could not read trace for ${test.title}: ${error.message}`,
          );
        }),
    );
    this.records ||= [];
  }

  async onEnd() {
    await Promise.all(this.pending);
    if (!this.records?.length) return;

    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    let existingRecords = [];
    if (fs.existsSync(outputPath)) {
      try {
        existingRecords = YAML.parse(fs.readFileSync(outputPath, 'utf8'))?.records || [];
      } catch {
        console.warn(`Could not parse existing Solution Finder records at ${outputPath}`);
      }
    }

    const recordsByRun = new Map(
      existingRecords.map((record) => [
        `${record.runId}:${record.testId}:${record.retry}`,
        record,
      ]),
    );
    for (const record of this.records) {
      recordsByRun.set(
        `${record.runId}:${record.testId}:${record.retry}`,
        record,
      );
    }

    fs.writeFileSync(
      outputPath,
      YAML.stringify({ records: [...recordsByRun.values()] }),
      { mode: 0o600 },
    );
    fs.chmodSync(outputPath, 0o600);
    console.log(`Solution Finder account data recorded in ${outputPath}`);
  }
}

module.exports = SolutionFinderAccountRecorder;