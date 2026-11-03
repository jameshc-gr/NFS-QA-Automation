import type { Comparison, Difference, InquiryResponse, Offer, WorkbookScenario, UiCard } from './contracts';

export const productTitles = {
  HELOAN: 'HELOAN', FIXED_RATE_HELOC: 'Fixed Rate HELOC',
  VARIABLE_RATE_HELOC: 'Variable Rate HELOC', CES: 'Closed End Second'
} as const;
const generatedIds = new Set(['inquiryId', 'offerId', 'extAppUuid', 'internalAppId']);
const record = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const text = (value: string) => value.replace(/\s+/g, ' ').trim();
const money = (value: number, places = 0) => new Intl.NumberFormat('en-US', {
  style: 'currency', currency: 'USD', minimumFractionDigits: places, maximumFractionDigits: places
}).format(value);

function sameAprTenths(actual: unknown, expected: unknown) {
  return typeof actual === 'number' && typeof expected === 'number' &&
    Number.isFinite(actual) && Number.isFinite(expected) && actual >= 0 && expected >= 0 &&
    Math.trunc(actual * 10) === Math.trunc(expected * 10);
}

export function normalizeResponse(value: unknown, key = ''): unknown {
  if (Array.isArray(value)) {
    const items = value.map(item => normalizeResponse(item));
    if (key === 'offers') return items.sort((a, b) => {
      const productOrder = record(a) && record(b) ? String(a.productType).localeCompare(String(b.productType)) : 0;
      return productOrder || JSON.stringify(a).localeCompare(JSON.stringify(b));
    });
    if (key === 'ineligibleReasons') return items.sort();
    return items;
  }
  if (record(value)) return Object.fromEntries(Object.keys(value).sort()
    .filter(field => !generatedIds.has(field))
    .map(field => [field, normalizeResponse(value[field], field)]));
  return value;
}

export function differences(actual: unknown, expected: unknown, path = 'response'): Difference[] {
  if (Object.is(actual, expected)) return [];
  if (/^response\.offers\[\d+\]\.apr$/.test(path) && sameAprTenths(actual, expected)) return [];
  if (Array.isArray(actual) && Array.isArray(expected)) {
    if (actual.length !== expected.length) return [{ path, actual, expected }];
    return expected.flatMap((item, index) => differences(actual[index], item, `${path}[${index}]`));
  }
  if (record(actual) && record(expected)) {
    return [...new Set([...Object.keys(actual), ...Object.keys(expected)])].sort()
      .flatMap(key => differences(actual[key], expected[key], `${path}.${key}`));
  }
  return [{ path, actual, expected }];
}

function normalizedHeader(value: string) {
  const ficoNormalized = value.replace(/FICO:([\s\S]*?)(?=Requested Amount:)/, (_, fico: string) => {
    const pattern = /\b(TU|TransUnion|Experian|EX)\s+(\d{3}|Unknown)\b/gi;
    const scores = [...fico.matchAll(pattern)]
      .map(match => `${/^(TU|TransUnion)$/i.test(match[1]) ? 'TU' : 'EX'} ${match[2]}`).sort();
    const residual = fico.replace(pattern, '').replace(/[|\s]/g, '');
    return scores.length && !residual ? `FICO: ${scores.join(' | ')} ` : `FICO:${fico}`;
  });
  return text(ficoNormalized.replace(/Estimated Value:([\s\S]*?)(?=DTI:)/, (_, values: string) => {
    const pattern = /\b(House Canary|Figure AVM|Corelogic)\s+(\$[\d,]+(?:\.\d+)?)\b/g;
    const estimates = [...values.matchAll(pattern)].map(match => `${match[1]} ${match[2]}`).sort();
    const residual = values.replace(pattern, '').replace(/[|\s]/g, '');
    return estimates.length && !residual ? `Estimated Value: ${estimates.join(' | ')} ` : `Estimated Value:${values}`;
  }));
}

export function normalizeUi(value: string) {
  const lines = value.split('\n').map(line => line.trim()).filter(Boolean);
  const titles = new Set<string>(Object.values(productTitles));
  const cards: Record<string, string> = {};
  const header: string[] = [];
  let title = '';
  for (const line of lines) {
    if (titles.has(line)) {
      title = line;
      if (title in cards) throw new Error(`Duplicate UI product heading: ${title}`);
      cards[title] = title;
    } else if (title) cards[title] += ` ${line}`;
    else header.push(line);
  }
  return {
    header: normalizedHeader(header.join('\n')),
    cards: Object.fromEntries(Object.entries(cards).map(([name, content]) => [
      name, content.replace(/\b(\d+(?:\.\d+)?)% APR\b/g, (_, apr: string) => `${Math.trunc(Number(apr) * 10) / 10}% APR`)
    ]))
  };
}

export function uiSnapshot(body: string, cards: UiCard[]) {
  const start = body.indexOf('Inquiry summary');
  if (start < 0 || !cards.length) throw new Error('Offer page must show an inquiry summary and product cards.');
  const end = body.indexOf(cards[0].title, start);
  if (end <= start) throw new Error('Unable to isolate the visible inquiry summary.');
  const banner = body.split('\n').find(line => line.startsWith('Due to Licensing requirements,'));
  return [banner, body.slice(start, end).trim(), ...cards.map(card => card.text)].filter(Boolean).join('\n\n');
}

export function compareUiToApi(cards: UiCard[], response: InquiryResponse): Difference[] {
  const diffs: Difference[] = [];
  const add = (path: string, actual: unknown, expected: unknown) => {
    if (!Object.is(actual, expected)) diffs.push({ path, actual, expected });
  };
  const byTitle = new Map<string, UiCard>();
  for (const card of cards) {
    if (byTitle.has(card.title)) diffs.push({ path: `ui.${card.title}.count`, actual: 2, expected: 1 });
    byTitle.set(card.title, card);
  }
  const apiTitles = new Set<string>(response.offers.map(offer => productTitles[offer.productType]));
  for (const card of cards.filter(card => !apiTitles.has(card.title))) {
    add(`ui.${card.title}.placeholderReason`, card.text.includes('No offer was returned for this product.'), true);
    add(`ui.${card.title}.placeholderAmount`, card.text.includes('Loan Amount'), false);
    add(`ui.${card.title}.placeholderAction`, /(?:Send|Resend) offer to client/.test(card.text), false);
  }
  const seenProducts = new Set<string>();
  for (const offer of response.offers) {
    const title = productTitles[offer.productType];
    if (seenProducts.has(offer.productType)) diffs.push({ path: `api.${offer.productType}.count`, expected: 1, actual: 2 });
    seenProducts.add(offer.productType);
    const card = byTitle.get(title);
    if (!card) { diffs.push({ path: `ui.${title}`, expected: 'one matching product card', actual: 'missing' }); continue; }
    const lines = card.text.split('\n').map(line => line.trim()).filter(Boolean);
    const after = (label: string) => { const index = lines.indexOf(label); return index < 0 ? undefined : lines[index + 1]; };
    const before = (label: string) => { const index = lines.indexOf(label); return index < 1 ? undefined : lines[index - 1]; };
    if (offer.ineligibleReasons?.length) {
      add(`ui.${title}.ineligibleHeading`, card.text.includes('No offers were found for this product'), true);
      for (const reason of offer.ineligibleReasons) add(`ui.${title}.reason.${reason}`, card.text.includes(reason), true);
      add(`ui.${title}.declinedAction`, /(?:Send|Resend) offer to client/.test(card.text), false);
      add(`ui.${title}.declinedAmount`, card.text.includes('Loan Amount'), false);
      continue;
    }
    if (offer.loanAmount == null) {
      diffs.push({ path: `api.${title}.eligibility`, expected: 'loan amount or explicit ineligible reasons', actual: offer });
      continue;
    }
    add(`ui.${title}.action`, /(?:Send|Resend) offer to client/.test(card.text), true);
    add(`ui.${title}.loanAmount`, after('Loan Amount'), money(offer.loanAmount));
    add(`ui.${title}.term`, after('Term'), `${offer.term} years`);
    add(`ui.${title}.apr`, before('APR'), offer.apr == null ? 'Unknown' : `${offer.apr.toFixed(3)}%`);
    add(`ui.${title}.monthlyPayment`, after('Monthly payment'),
      offer.apr == null || offer.monthlyPayment == null ? 'Unknown' : money(offer.monthlyPayment, 2));
    if (offer.productType === 'HELOAN' && offer.rate != null) add(`ui.${title}.rate`, before('Rate'), `${offer.rate.toFixed(3)}%`);
    if (offer.badge) add(`ui.${title}.badge`, card.text.includes(offer.badge), true);
    const details = offer.offerDetails;
    if (!details) continue;
    if (details.closingCostsMin != null) add(`ui.${title}.closingCostsMin`, after('Closing Costs:')?.includes(money(details.closingCostsMin)), true);
    if (details.closingCostsMax != null) add(`ui.${title}.closingCostsMax`, after('Closing Costs:')?.includes(money(details.closingCostsMax)), true);
    if (details.minCreditScore != null) add(`ui.${title}.minCreditScore`, after('Credit Score Required:'), `${details.minCreditScore}+`);
    if (details.maxLtv != null) add(`ui.${title}.maxCltv`, after('Max CLTV:'), `${details.maxLtv}%`);
    if (details.rateType) add(`ui.${title}.rateType`, after('Rate Type:')?.toLowerCase(), details.rateType.toLowerCase());
    if (details.earlyPayoffPenalty) add(`ui.${title}.earlyPayoffPenalty`, after('Early Payoff Penalty:'), details.earlyPayoffPenalty);
    if (details.processingTimeMinDays != null && details.processingTimeMaxDays != null) {
      const range = details.processingTimeMinDays === details.processingTimeMaxDays
        ? `${details.processingTimeMinDays}` : `${details.processingTimeMinDays}-${details.processingTimeMaxDays}`;
      add(`ui.${title}.processingTime`, after('Processing Time:'), `${range} days`);
    }
    if (!offer.offerId) diffs.push({ path: `api.${title}.offerId`, expected: 'non-empty run-generated offer ID', actual: offer.offerId });
  }
  return diffs;
}

export function compareRun(response: InquiryResponse, cards: UiCard[], ui: string, scenario: WorkbookScenario): Comparison {
  return {
    apiBaseline: differences(normalizeResponse(responseSubset(response)), normalizeResponse(responseSubset(scenario.expectedResponse))),
    uiApi: compareUiToApi(cards, response),
    uiBaseline: differences(normalizeUi(ui), normalizeUi(scenario.expectedUi), 'uiBaseline')
  };
}

function responseSubset(response: InquiryResponse) {
  return { offers: response.offers, summary: response.summary, inquiryId: response.inquiryId };
}

export function qaComments(scenario: WorkbookScenario, tenant: string, response?: InquiryResponse, comparison?: Comparison, failure?: string) {
  const comments: string[] = [
    `${scenario.id}: ${scenario.name}. Baseline: GRI workbook row ${scenario.workbookRow}; execution tenant: ${tenant}.`
  ];
  if (tenant !== 'gri') comments.push('This tenant has no independently approved baseline. GRI differences are reported strictly and require tenant-specific requirement review, not automatic classification as defects.');
  if (failure) comments.push(`FAILED CHECKPOINT: ${failure.split('\n')[0]}. No subsequent form steps were attempted; full failure details are attached.`);
  if (!response) comments.push('No validated inquiry response was available; offer eligibility could not be assessed.');
  else {
    const eligible = response.offers.filter(offer => offer.loanAmount != null && !offer.ineligibleReasons?.length);
    comments.push(`Actual API: ${eligible.length} eligible offers, ${response.offers.length - eligible.length} declined products. Product order is not assessed.`);
    if (comparison) {
      comments.push(`Comparison differences: API/baseline ${comparison.apiBaseline.length}; UI/API ${comparison.uiApi.length}; UI/baseline ${comparison.uiBaseline.length}.`);
      comments.push('APR baseline policy: ignore hundredths/thousandths without rounding; UI/API APR equality remains exact.');
      const ignoredApr = response.offers.flatMap(offer => {
        const expected = scenario.expectedResponse.offers.find(value => value.productType === offer.productType)?.apr;
        return !Object.is(offer.apr, expected) && sameAprTenths(offer.apr, expected)
          ? [`${productTitles[offer.productType]} expected ${expected}%, actual ${offer.apr}%`] : [];
      });
      if (ignoredApr.length) comments.push(`IGNORED APR PRECISION: ${ignoredApr.join('; ')}.`);
      comments.push(comparison.uiApi.length ? 'UI/API inconsistencies require investigation.' : 'Displayed product identities, values and decline reasons agree with the actual API.');
      if (comparison.apiBaseline.length || comparison.uiBaseline.length) comments.push('Observed output differs from the saved workbook. Baselines were not rewritten; inspect attached expected/actual and field-level differences.');
      const pricing = comparison.apiBaseline.filter(diff => /\.(apr|rate|monthlyPayment)$/.test(diff.path));
      if (pricing.length) {
        comments.push(`PRICING BASELINE DIFFERENCES: ${pricing.map(diff => `${diff.path}: expected ${JSON.stringify(diff.expected)}, actual ${JSON.stringify(diff.actual)}`).join('; ')}.`);
        if (!comparison.uiApi.length) comments.push('The UI correctly displays the current API quote. Review pricing/fee/date assumptions behind the changed quote before classifying this as a UI defect; the saved expectation remains unchanged.');
      }
    }
    if ((response.summary.highestDti ?? response.summary.lowestDti ?? 0) > 50 && eligible.some(offer => offer.productType === 'HELOAN')) {
      comments.push('REVIEW: summary DTI exceeds 50% while HELOAN is offered. Exact ECS debt/representative DTI is unavailable, so FAL-3356 violation is not confirmed.');
    }
    if (eligible.some(offer => offer.apr == null)) comments.push('Missing APR requires BOTH APR and monthly payment to display Unknown (FAL-3753/FAL-3757), regardless of a numeric API payment.');
    if (eligible.some(offer => offer.offerDetails?.processingTimeMinDays === 30 && offer.offerDetails.processingTimeMaxDays === 35)) {
      comments.push('REVIEW: observed 30-35 day processing time matches the historical snapshot but differs from the later 25-30 day FAL-3660 requirement.');
    }
    if (scenario.notes.some(note => note.includes('Exact ECS debt') || note.includes('Income sensitivity probe'))) {
      comments.push('DTI displayed to two decimals does not prove an exact source-debt threshold; use actual ratios and provider evidence.');
    }
    if (scenario.notes.some(note => note.includes('calculated combined-ratio probe'))) {
      comments.push('CLTV probes use returned HouseCanary AVM; Figure may use different AVM/lien data. Max LTV/visible Max CLTV is not a universal approval guarantee.');
    }
    for (const offer of eligible) {
      const minimum = offer.offerDetails?.minCreditScore;
      const scores = Object.values(response.summary.fico).filter((score): score is number => score != null);
      if (minimum != null && scores.length && scores.every(score => score < minimum)) {
        comments.push(`REVIEW: all displayed credit scores are below ${productTitles[offer.productType]}'s ${minimum} minimum; representative score/provider decision needs review.`);
      }
    }
  }
  return comments;
}
