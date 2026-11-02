'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { randomUUID } = require('node:crypto');
process.env.SF_LAB_PORTABLE = '1';
const { createLabServer } = require('../scripts/solution-finder/lab/server.js');

const lab = createLabServer({
  launch(directory) {
    const request = JSON.parse(fs.readFileSync(path.join(directory, 'input.json'))).request;
    const input = request.applicationInquiryInput;
    const artifacts = path.join(directory, 'artifacts/offline-portable-verification');
    fs.mkdirSync(artifacts, { recursive: true });
    const response = {
      inquiryId: randomUUID(),
      offers: ['HELOAN', 'FIXED_RATE_HELOC', 'VARIABLE_RATE_HELOC'].map(productType => ({
        productType, applicationType: productType === 'HELOAN' ? 'HELOAN' : 'FIGURE_HELOC',
        ineligibleReasons: ['Offline portable-package fixture; not a live eligibility result.']
      })),
      summary: {
        name: input.basicInfoInput.name, address: input.propertyInputHeloc.address,
        requestedAmount: input.propertyInputHeloc.requestedLoanAmount,
        fico: { TRANSUNION: null, EXPERIAN: null }, estimatedPropertyValues: {}
      }
    };
    const write = (name, value) => fs.writeFileSync(path.join(artifacts, name), JSON.stringify(value));
    write('run-result.json', { status: 'PASS', comparisonMode: 'actual-ui-api',
      inquiryId: response.inquiryId, email: input.basicInfoInput.emailId });
    write('actual-inquiry-request.json', request);
    write('actual-inquiry-response.json', response);
    write('actual-ui-offers.json', { fixture: 'Offline portability verification only' });
    write('comparison.json', { uiApi: [], apiBaseline: [], uiBaseline: [] });
    fs.writeFileSync(path.join(artifacts, 'offers.png'),
      Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a2ioAAAAASUVORK5CYII=', 'base64'));
    return spawn(process.execPath, ['-e', 'console.log("Offline package worker");setTimeout(()=>process.exit(0),100)'],
      { stdio: ['ignore', 'pipe', 'pipe'], env: process.env });
  }
});
lab.server.listen(0, '127.0.0.1', () => process.send({ port: lab.server.address().port }));
process.once('message', async message => {
  if (message !== 'close') throw new Error('Unknown verification-server command.');
  await lab.close();
  process.disconnect();
});
