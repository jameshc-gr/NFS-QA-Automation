import fs from 'fs';
import path from 'path';

function usage() {
  console.log('Usage: node wdio-codegen-to-wdio-generator.js <input-file> <out-spec-path> <out-page-path>');
}

if (process.argv.length < 5) {
  usage();
  process.exit(1);
}

const inputFile = process.argv[2];
const outSpec = process.argv[3];
const outPage = process.argv[4];

const recorded = fs.readFileSync(inputFile, 'utf8');

// Simple wrapper: place recorded commands into a WDIO async test body
const specContent = `import RecordedPage from '../../src/pages/generated/recorded.page';

describe('Generated: Recorded flow', () => {
  it('runs recorded steps', async () => {
    const page = new RecordedPage();
    // Paste recorded code below (adapter may be required)

${recorded.split('\n').map(l => '    ' + l).join('\n')}

  });
});
`;

const pageContent = `export default class RecordedPage {
  constructor() {}

  // Move selectors and helpers here as you refactor
}
`;

// Ensure directories exist
fs.mkdirSync(path.dirname(outSpec), { recursive: true });
fs.mkdirSync(path.dirname(outPage), { recursive: true });

fs.writeFileSync(outSpec, specContent, 'utf8');
fs.writeFileSync(outPage, pageContent, 'utf8');

console.log('Generated spec:', outSpec);
console.log('Generated page:', outPage);
`