export { resolveFirstVisible, platformSelectorPath } from './selector-engine';
export type { SelectorList } from './selector-engine';

import { authSelectors as androidAuthSelectors } from './android/auth.selectors';
import { authSelectors as iosAuthSelectors } from './ios/auth.selectors';
import { resolveMobilePlatform } from '../config/mobile.config';

export function authSelectors() {
  return resolveMobilePlatform() === 'ios' ? iosAuthSelectors : androidAuthSelectors;
}
