export type DmxEnvironment = 'DEV' | 'PROD';

export interface DmxEntryTarget {
  id: string;
  environment: DmxEnvironment;
  tenant: string;
  label: string;
  url: string;
  appHost: string;
  brand: string;
  routePattern: string;
  flowVariant?: string;
  supportsLoanCreation: boolean;
  available: boolean;
}

export const DMX_ENTRY_TARGETS: DmxEntryTarget[] = [
  { id: 'dev-certainty', environment: 'DEV', tenant: 'Certainty', label: 'Certainty · DEV', url: 'https://apply-certainty.dev.saas.rate.com/?emp-id=100000073', appHost: 'apply-certainty.dev.saas.rate.com', brand: 'Certainty Home Lending', routePattern: '^/apply/loan-purpose$', supportsLoanCreation: false, available: true },
  { id: 'dev-citywide', environment: 'DEV', tenant: 'Citywide', label: 'Citywide · DEV', url: 'https://apply-cwhm.dev.saas.rate.com/?emp-id=100000088', appHost: 'apply-cwhm.dev.saas.rate.com', brand: 'Citywide Home Mortgage', routePattern: '^/apply/loan-purpose$', supportsLoanCreation: false, available: true },
  { id: 'dev-gra', environment: 'DEV', tenant: 'GRA', label: 'GRA · DEV', url: 'https://apply-gra.dev.saas.rate.com/?emp-id=12075', appHost: 'apply-gra.dev.saas.rate.com', brand: 'Guaranteed Rate Affinity', routePattern: '^/apply/loan-purpose$', supportsLoanCreation: false, available: true },
  { id: 'dev-gri-original', environment: 'DEV', tenant: 'GRI', label: 'GRI Original Flow · DEV', url: 'https://apply-gri.dev.saas.rate.com/?emp-id=4723&ef=0', appHost: 'apply-gri.dev.saas.rate.com', brand: 'Rate', routePattern: '^/apply/loan-purpose$', flowVariant: 'Original Flow (ef=0)', supportsLoanCreation: false, available: true },
  { id: 'dev-gri-enhanced', environment: 'DEV', tenant: 'GRI', label: 'GRI Enhanced Flow · DEV', url: 'https://apply-gri.dev.saas.rate.com/?emp-id=4723', appHost: 'apply-gri.dev.saas.rate.com', brand: 'Rate', routePattern: '^/apply/loan-purpose$', flowVariant: 'Enhanced Flow', supportsLoanCreation: true, available: true },
  { id: 'dev-gri-pvp', environment: 'DEV', tenant: 'GRI', label: 'GRI EF - PVP LO · DEV', url: 'https://apply-gri.dev.saas.rate.com/?emp-id=12657', appHost: 'apply-gri.dev.saas.rate.com', brand: 'Rate', routePattern: '^/apply/(loan-purpose|express-loan)$', flowVariant: 'Enhanced Flow - PVP LO', supportsLoanCreation: false, available: true },
  { id: 'dev-kbhs', environment: 'DEV', tenant: 'KBHS', label: 'KBHS · DEV', url: 'https://apply-kbhs.dev.saas.rate.com/?emp-id=921', appHost: 'apply-kbhs.dev.saas.rate.com', brand: 'KBHS Home Loans', routePattern: '^/apply/loan-purpose$', supportsLoanCreation: false, available: true },
  { id: 'dev-onq', environment: 'DEV', tenant: 'OnQ', label: 'OnQ · DEV', url: 'https://apply-qhl.dev.saas.rate.com/?emp-id=100000090', appHost: 'apply-qhl.dev.saas.rate.com', brand: 'On Q Home Loans', routePattern: '^/apply/loan-purpose$', supportsLoanCreation: false, available: true },
  { id: 'dev-op', environment: 'DEV', tenant: 'OP', label: 'OriginPoint · DEV', url: 'https://apply-op.dev.saas.rate.com/apply/loan-purpose?emp-id=921', appHost: 'apply-op.dev.saas.rate.com', brand: 'OriginPoint', routePattern: '^/apply/loan-purpose$', supportsLoanCreation: false, available: true },
  { id: 'dev-owning', environment: 'DEV', tenant: 'Owning', label: 'Owning · DEV', url: 'https://apply-owning.dev.saas.rate.com/apply/loan-purpose?emp-id=100000029', appHost: 'apply-owning.dev.saas.rate.com', brand: 'Owning', routePattern: '^/apply/(loan-purpose|express-loan)$', supportsLoanCreation: false, available: true },
  { id: 'dev-premia', environment: 'DEV', tenant: 'Premia', label: 'Premia · DEV', url: 'https://apply-premia.dev.saas.rate.com?emp-id=921', appHost: 'apply-premia.dev.saas.rate.com', brand: 'Premia Mortgage', routePattern: '^/apply/loan-purpose$', supportsLoanCreation: false, available: true },
  { id: 'prod-certainty', environment: 'PROD', tenant: 'Certainty', label: 'Certainty · PROD', url: 'https://apply.certaintyhomelending.com/apply/loan-purpose?emp-id=33117', appHost: 'apply.certaintyhomelending.com', brand: 'Certainty Home Lending', routePattern: '^/apply/loan-purpose$', supportsLoanCreation: false, available: true },
  { id: 'prod-citywide', environment: 'PROD', tenant: 'Citywide', label: 'Citywide · PROD', url: 'https://apply.citywidehm.com/?emp-id=36067', appHost: 'apply.citywidehm.com', brand: 'Citywide Home Mortgage', routePattern: '^/apply/loan-purpose$', supportsLoanCreation: false, available: true },
  { id: 'prod-gri-original', environment: 'PROD', tenant: 'GRI', label: 'GRI Original Flow · PROD', url: 'https://apply.rate.com/?emp-id=4723&ef=0', appHost: 'apply.rate.com', brand: 'Rate', routePattern: '^/apply/loan-purpose$', flowVariant: 'Original Flow (ef=0)', supportsLoanCreation: false, available: true },
  { id: 'prod-gri-enhanced', environment: 'PROD', tenant: 'GRI', label: 'GRI Enhanced Flow · PROD', url: 'https://apply.rate.com/apply/loan-purpose?emp-id=4723', appHost: 'apply.rate.com', brand: 'Rate', routePattern: '^/apply/express-loan$', flowVariant: 'Enhanced Flow', supportsLoanCreation: false, available: true },
  { id: 'prod-kbhs', environment: 'PROD', tenant: 'KBHS', label: 'KBHS · PROD', url: 'https://apply.kbhshomeloans.com/apply/loan-purpose?emp-id=921', appHost: 'apply.kbhshomeloans.com', brand: 'KBHS Home Loans', routePattern: '^/apply/loan-purpose$', supportsLoanCreation: false, available: true },
  { id: 'prod-onq', environment: 'PROD', tenant: 'OnQ', label: 'OnQ · PROD', url: 'https://apply.onqhomeloans.com/?emp-id=36704', appHost: 'apply.onqhomeloans.com', brand: 'On Q Home Loans', routePattern: '^/apply/loan-purpose$', supportsLoanCreation: false, available: true },
  { id: 'prod-op', environment: 'PROD', tenant: 'OP', label: 'OriginPoint · PROD', url: 'https://apply.originpoint.com/?emp-id=927', appHost: 'apply.originpoint.com', brand: 'OriginPoint', routePattern: '^/apply/loan-purpose$', supportsLoanCreation: false, available: true },
  { id: 'prod-owning', environment: 'PROD', tenant: 'Owning', label: 'Owning · PROD', url: 'https://apply.owning.com/?emp-id=32873', appHost: 'apply.owning.com', brand: 'Owning', routePattern: '^/apply/express-loan$', supportsLoanCreation: false, available: true },
  { id: 'prod-premia', environment: 'PROD', tenant: 'Premia', label: 'Premia · PROD', url: 'https://apply.premiarelocationmortgage.com/?emp-id=927', appHost: 'apply.premiarelocationmortgage.com', brand: 'Premia Mortgage', routePattern: '^/apply/loan-purpose$', supportsLoanCreation: false, available: true },
];

for (const target of DMX_ENTRY_TARGETS) {
  const parsed = new URL(target.url);
  if (parsed.protocol !== 'https:' || parsed.hostname !== target.appHost || !parsed.searchParams.has('emp-id')) {
    throw new Error(`Invalid DMX entry target configuration: ${target.id}`);
  }
}

export const dmxEntryTarget = (id: string) => DMX_ENTRY_TARGETS.find(target => target.id === id);
