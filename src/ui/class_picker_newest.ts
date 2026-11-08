import type { PlayerClass } from '../sim/types';
import { t } from './i18n';

// Move this marker to the newest class when a new playable class is introduced.
export const NEWEST_PLAYER_CLASS: PlayerClass = 'dreamdancer';

export function decorateNewestClass(button: HTMLElement, cls: PlayerClass): void {
  if (cls !== NEWEST_PLAYER_CLASS) return;
  const badge = document.createElement('span');
  badge.className = 'mini-class-new-badge';
  badge.id = `${button.closest('.cs-wow')?.id ?? 'class-picker'}-new-class`;
  badge.dataset.i18n = 'classes.newBadge';
  badge.textContent = t('classes.newBadge');
  button.dataset.newestClass = 'true';
  button.setAttribute('aria-describedby', badge.id);
  button.appendChild(badge);
}
