import {
  ADMIN_GOLD_LIMIT,
  ADMIN_ITEM_LIMIT,
  type AdminAdventurersState,
  type AdminCharacterAction,
  type AdminCharacterLogEntry,
  type AdminCharacterModes,
  type AdminCharacterPlayer,
  type AdminCharacterReply,
  readAdminAdventurersState,
} from '../admin_character_wire';
import type { AdminSelfPreview } from '../game/admin_self_preview';
import { ITEMS } from '../sim/data';
import { MAX_LEVEL } from '../sim/types';
import { itemDisplayName } from './entity_i18n';
import { searchAdminItems } from './admin_item_catalog';
import { formatNumber, t } from './i18n';
import '../styles/admin_self_preview.css';
import '../styles/admin_item_catalog.css';

export interface AdminCharacterConnection {
  canAccess(): boolean;
  canTeleportOnMap?(): boolean;
  realm?(): string;
  player(): { name: string; level: number };
  copper(): number;
  request(action: AdminCharacterAction): Promise<AdminCharacterReply | null>;
}

const sections = ['self', 'players', 'world', 'inventory', 'log'] as const;

const crown =
  '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m3 7 4.3 4L12 4l4.7 7L21 7l-2 11H5L3 7Z" fill="currentColor"/><path d="M6 20h12M8 15h8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><path d="m12 9 1.6 2-1.6 2-1.6-2L12 9Z" fill="#552911"/></svg>';

interface PanelFocus {
  captureFocus(): HTMLElement | null;
  restoreFocus(target: HTMLElement | null): void;
}

interface AdminTabViews {
  location(): { zone: string; x: number; y: number; z: number };
  bags(): { used: number; capacity: number };
  openMap(): void;
  openBags(): void;
}

const actionLabel = {
  level: 'level',
  gold: 'gold',
  giveItem: 'giveItem',
  flight: 'flight',
  flightSpeed: 'flightSpeed',
  runSpeed: 'runSpeed',
  heal: 'heal',
  resource: 'resource',
  cooldowns: 'cooldowns',
  god: 'god',
  oneHit: 'oneHit',
  visit: 'visit',
  summon: 'summon',
  mapTeleport: 'mapTeleport',
  adventurers: 'adventurers',
} as const satisfies Record<AdminCharacterLogEntry['kind'], string>;

export function mountAdminSelfPanel(
  panel: AdminSelfPreview | AdminCharacterConnection,
  rail: HTMLElement,
  ui: HTMLElement,
  focus: PanelFocus,
  clearTransientUi: () => void,
  views?: AdminTabViews,
) {
  const online = 'request' in panel ? panel : undefined;
  const preview = 'command' in panel ? panel : undefined;
  const label = (
    key: keyof typeof import('./i18n.catalog/hud_chrome').hudChromeStrings.adminCharacter,
  ) => t(`hudChrome.adminCharacter.${key}`);
  let modes: AdminCharacterModes | undefined;
  let waiting = false;
  let adventurers: AdminAdventurersState | undefined;
  let adventurersRefreshQueued = false;
  document.getElementById('mm-admin-self')?.remove();
  document.getElementById('admin-self-window')?.remove();

  const launcher = document.createElement('button');
  launcher.id = 'mm-admin-self';
  launcher.className = 'micro-btn ui-icon-btn ui-icon-btn--micro';
  launcher.type = 'button';
  launcher.title = label('title');
  launcher.setAttribute('aria-label', label('title'));
  launcher.setAttribute('aria-haspopup', 'dialog');
  launcher.setAttribute('aria-expanded', 'false');
  launcher.setAttribute('aria-controls', 'admin-self-window');
  launcher.innerHTML = crown;

  const root = document.createElement('section');
  root.id = 'admin-self-window';
  root.className = 'window panel ui-window';
  root.tabIndex = -1;
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-labelledby', 'admin-self-title');
  root.innerHTML = `
    <header class="admin-preview-head panel-title">
      <span class="admin-preview-emblem">${crown}</span>
      <div><span class="admin-preview-kicker">FANTASY ARENA MMO</span><h2 id="admin-self-title">${label('title')}</h2></div>
      ${preview ? `<span class="admin-preview-badge">${label('local')}</span>` : ''}
      <button type="button" class="admin-preview-close" data-act="close" aria-label="${label('close')}">×</button>
    </header>
    <nav class="admin-preview-tabs" aria-label="${label('sections')}">
      ${sections.map((id) => `<button type="button" data-section="${id}" aria-pressed="${id === 'self'}">${label(id)}</button>`).join('')}
    </nav>
    <div class="admin-preview-body" data-self>
      <div class="admin-preview-identity"><div><span class="admin-preview-kicker">${label('self')}</span><strong data-name></strong></div><span data-level></span></div>
      <div class="admin-preview-grid">
        <section><h3>${label('level')}</h3><div class="admin-preview-row">
          <button type="button" data-act="level-down" aria-label="${label('lower')}">−</button>
          <output data-level-number aria-label="${label('level')}"></output>
          <button type="button" data-act="level-up" aria-label="${label('raise')}">+</button>
        </div></section>
        <section><h3>${label('gold')} <small data-gold></small></h3><div class="admin-preview-row">
          <input data-amount type="number" min="1" max="${ADMIN_GOLD_LIMIT}" step="1" value="10" aria-label="${label('gold')}">
          <button type="button" data-act="gold">${label('grant')}</button>
        </div></section>
        <section><h3>${label('flight')}</h3><div class="admin-preview-row">
          <button type="button" data-act="fly" aria-pressed="false">${label('takeoff')}</button>
          <select data-flight-speed aria-label="${label('flightSpeed')}"><option value="1">1×</option><option value="1.5">1.5×</option><option value="2">2×</option><option value="3">3×</option></select>
        </div><p>${label('flightHelp')}</p></section>
        <section><h3>${label('runSpeed')}</h3><select data-run-speed aria-label="${label('runSpeed')}">
          <option value="1">1×</option><option value="1.5">1.5×</option><option value="2">2×</option><option value="3">3×</option>
        </select></section>
      </div>
      <div class="admin-preview-tools">
        <button type="button" data-act="heal">${label('heal')}</button>
        <button type="button" data-act="resource">${label('resource')}</button>
        <button type="button" data-act="cooldowns">${label('cooldowns')}</button>
        ${
          online
            ? `<button type="button" data-act="god" aria-pressed="false">${label('god')}</button>
        <button type="button" data-act="oneHit" aria-pressed="false">${label('oneHit')}</button>`
            : ''
        }
      </div>
    </div>
    <div class="admin-preview-body admin-preview-placeholder" data-placeholder hidden>
      <h3></h3><p>${label('placeholder')}</p>
    </div>
    <div class="admin-preview-body" data-players hidden>
      <button type="button" data-act="players">${label('reload')}</button>
      <p>${label('rosterHelp')}</p><div data-roster></div>
    </div>
    <div class="admin-preview-body" data-world hidden>
      <h3>${label('world')}</h3>
      <p data-world-location></p>
      <p data-world-position></p>
      <button type="button" data-act="map">${label('openMap')}</button>
      <p data-map-help>${label('mapWorldSummary')}</p>
      ${online && views ? `<section aria-labelledby="admin-adventurers-title">
        <h3 id="admin-adventurers-title">${label('adventurers')}</h3>
        <div class="admin-preview-row">
          <button type="button" data-act="adventurers" role="switch" aria-checked="false"
            aria-labelledby="admin-adventurers-title" aria-describedby="admin-adventurers-status" disabled>${label('adventurersOff')}</button>
          <button type="button" data-act="adventurers-refresh">${label('adventurersRefresh')}</button>
        </div>
        <p id="admin-adventurers-status" role="status">${label('adventurersUnknown')}</p>
      </section>` : ''}
    </div>
    <div class="admin-preview-body" data-inventory hidden>
      <h3>${label('inventory')}</h3>
      <p data-bag-slots></p>
      <button type="button" data-act="bags">${label('openBags')}</button>
      ${online ? `<div class="admin-item-catalog">
        <label>${label('itemSearch')}<input type="search" data-item-search maxlength="128" autocomplete="off"></label>
        <p data-item-help>${label('itemSearchHelp')}</p>
        <select data-item-results size="7" aria-label="${label('itemResults')}"></select>
        <p role="status" data-item-count></p>
        <div class="admin-item-grant">
          <label>${label('itemQuantity')}<input data-item-quantity type="number" min="1" max="${ADMIN_ITEM_LIMIT}" step="1" value="1"></label>
          <button type="button" data-act="give-item">${label('giveItem')}</button>
        </div>
      </div>` : ''}
    </div>
    <div class="admin-preview-body" data-log hidden>
      <h3>${label('log')}</h3>
      <p>${label('logHelp')}</p>
      <button type="button" data-act="log">${label('reloadLog')}</button>
      <p data-log-empty>${label('logNotLoaded')}</p>
      <ol data-log-entries hidden></ol>
    </div>
    <footer class="admin-preview-footer"><span role="status" data-status></span></footer>`;
  rail.prepend(launcher);
  ui.append(root);

  function part<T extends Element = HTMLElement>(selector: string): T {
    const element = root.querySelector<T>(selector);
    if (!element) throw new Error(`Missing admin preview element: ${selector}`);
    return element;
  }

  const self = part<HTMLElement>('[data-self]');
  const players = part<HTMLElement>('[data-players]');
  const placeholder = part<HTMLElement>('[data-placeholder]');
  const worldTab = part('[data-world]');
  const inventoryTab = part('[data-inventory]');
  const logTab = part('[data-log]');
  const worldLocation = part('[data-world-location]');
  const worldPosition = part('[data-world-position]');
  const bagSlots = part('[data-bag-slots]');
  const logEmpty = part('[data-log-empty]');
  const logEntries = part('[data-log-entries]');
  const mapHelp = part('[data-map-help]');
  const status = part<HTMLElement>('[data-status]');
  const adventurersSwitch = root.querySelector<HTMLButtonElement>('[data-act=adventurers]');
  const adventurersStatus = root.querySelector<HTMLElement>('#admin-adventurers-status');
  const amount = part<HTMLInputElement>('[data-amount]');
  const flight = part<HTMLButtonElement>('[data-act=fly]');
  const lower = part<HTMLButtonElement>('[data-act=level-down]');
  const raise = part<HTMLButtonElement>('[data-act=level-up]');
  let opener: HTMLElement | null = null;
  let nextPaint = 0;
  const itemSearch = root.querySelector<HTMLInputElement>('[data-item-search]');
  const itemResults = root.querySelector<HTMLSelectElement>('[data-item-results]');
  const itemQuantity = root.querySelector<HTMLInputElement>('[data-item-quantity]');

  function writeText(element: HTMLElement, value: string): void {
    if (element.textContent !== value) element.textContent = value;
  }

  function refresh(): void {
    if (views && !worldTab.hidden) {
      const { zone, x, y, z } = views.location();
      writeText(worldLocation, online?.realm?.() ? `${online.realm()} · ${zone}` : zone);
      writeText(worldPosition, t('hudChrome.adminCharacter.position', {
        x: String(Math.round(x)), y: String(Math.round(y)), z: String(Math.round(z)),
      }));
      mapHelp.hidden = !online?.canTeleportOnMap?.();
      if (adventurersSwitch && adventurersStatus) {
        const checked = String(adventurers?.enabled === true);
        if (adventurersSwitch.getAttribute('aria-checked') !== checked) {
          adventurersSwitch.setAttribute('aria-checked', checked);
        }
        const disabled = waiting || !adventurers || !online?.canAccess();
        if (adventurersSwitch.disabled !== disabled) adventurersSwitch.disabled = disabled;
        writeText(adventurersSwitch, label(adventurers?.enabled ? 'adventurersOn' : 'adventurersOff'));
        writeText(adventurersStatus, adventurers
          ? t('hudChrome.adminCharacter.adventurersCount', { count: formatNumber(adventurers.active) })
          : label('adventurersUnknown'));
      }
    }
    if (views && !inventoryTab.hidden) {
      const { used, capacity } = views.bags();
      writeText(bagSlots, t('hudChrome.adminCharacter.bagSlots', { used: String(used), capacity: String(capacity) }));
    }
    const player = panel.player();
    part('[data-name]').textContent = player.name;
    part('[data-level]').textContent = `${label('level')} ${player.level}`;
    part('[data-level-number]').textContent = String(player.level);
    part('[data-gold]').textContent = `${Math.floor(panel.copper() / 10_000)} G`;
    lower.disabled = waiting || player.level <= 1;
    raise.disabled = waiting || player.level >= MAX_LEVEL;
    const give = root.querySelector<HTMLButtonElement>('[data-act=give-item]');
    if (give) give.disabled = waiting || !itemResults?.value;
    const flying = preview?.flight() ?? modes?.flight ?? false;
    flight.textContent = flying ? label('land') : label('takeoff');
    flight.setAttribute('aria-pressed', String(flying));
    if (online) {
      part('[data-act=god]').setAttribute('aria-pressed', String(modes?.god ?? false));
      part('[data-act=oneHit]').setAttribute('aria-pressed', String(modes?.oneHit ?? false));
    }
  }

  function showPlayers(roster: AdminCharacterPlayer[]): void {
    const list = part('[data-roster]');
    list.replaceChildren();
    for (const player of roster) {
      const row = document.createElement('details');
      const name = document.createElement('summary');
      name.textContent = `${player.name} · ${label('level')} ${player.level}`;
      row.append(name);
      for (const kind of ['visit', 'summon'] as const) {
        const button = document.createElement('button');
        button.type = 'button';
        button.textContent = label(kind);
        button.addEventListener('click', () => {
          if (kind === 'summon' && !window.confirm(label('confirmSummon'))) return;
          void request({ kind, value: player.pid });
        });
        row.append(button);
      }
      list.append(row);
    }
    if (roster.length === 0) list.textContent = label('noPlayers');
  }

  function showItems(): void {
    if (!itemSearch || !itemResults) return;
    const previous = itemResults.value;
    const result = searchAdminItems(ITEMS, itemSearch.value, itemDisplayName);
    itemResults.replaceChildren();
    for (const item of result.items) {
      const option = document.createElement('option');
      option.value = item.id;
      option.textContent = item.name + ' · ' + item.id;
      itemResults.append(option);
    }
    if (result.items.some(item => item.id === previous)) itemResults.value = previous;
    else itemResults.selectedIndex = result.items.length ? 0 : -1;
    part('[data-item-count]').textContent = result.total
      ? t('hudChrome.adminCharacter.itemMatches', { shown: String(result.items.length), count: String(result.total) })
      : label('itemNoResults');
    part<HTMLButtonElement>('[data-act=give-item]').disabled = waiting || !itemResults.value;
  }
  itemSearch?.addEventListener('input', showItems);

  function showLog(entries?: AdminCharacterLogEntry[]): void {
    logEntries.replaceChildren();
    for (const { kind, at, itemId, count } of entries ?? []) {
      const row = document.createElement('li');
      const actionText = kind === 'giveItem' && itemId && Object.hasOwn(ITEMS, itemId)
        ? t('hudChrome.adminCharacter.itemGranted', { count: String(count ?? 1), item: itemDisplayName(ITEMS[itemId]) })
        : label(actionLabel[kind]);
      row.textContent = new Date(at).toLocaleTimeString() + ' · ' + actionText;
      logEntries.append(row);
    }
    logEntries.hidden = !logEntries.childElementCount;
    logEmpty.hidden = !logEntries.hidden;
    logEmpty.textContent = label(entries ? 'logEmpty' : 'logNotLoaded');
  }

  async function request(action: AdminCharacterAction): Promise<void> {
    if (!online?.canAccess()) return;
    const adventurerAction = action.kind === 'adventurers' || action.kind === 'adventurersState';
    if (waiting) {
      if (action.kind === 'adventurersState') {
        adventurersRefreshQueued = true;
        return;
      }
      status.textContent = label('busy');
      return;
    }
    waiting = true;
    status.textContent = label('waiting');
    refresh();
    const reply = await online.request(action).catch(() => null);
    // The realm guards every admin request for 350 ms from receipt.
    // Keep controls pending through that interval even when the acknowledgement is immediate.
    await new Promise<void>((resolve) => window.setTimeout(resolve, 400));
    waiting = false;
    if (!online.canAccess()) return;
    status.textContent = label(reply?.status ?? 'noReply');
    if (reply?.players) showPlayers(reply.players);
    if (reply?.log) showLog(reply.log);
    if (reply?.modes) {
      modes = reply.modes;
      part<HTMLSelectElement>('[data-flight-speed]').value = String(modes.flightSpeed);
      part<HTMLSelectElement>('[data-run-speed]').value = String(modes.runSpeed);
    }
    if (adventurerAction) {
      adventurers = reply?.status === 'ok' ? readAdminAdventurersState(reply.adventurers) : undefined;
      if (reply?.status === 'ok' && !adventurers) status.textContent = label('adventurersUnknown');
    }
    refresh();
    if (adventurersRefreshQueued) {
      adventurersRefreshQueued = false;
      if (!worldTab.hidden && root.classList.contains('open')) {
        void request({ kind: 'adventurersState' });
      }
    }
  }

  function refreshAdventurers(): void {
    if (!adventurersSwitch) return;
    adventurers = undefined;
    refresh();
    void request({ kind: 'adventurersState' });
  }

  function close(): void {
    if (!root.classList.contains('open')) return;
    root.classList.remove('open');
    launcher.setAttribute('aria-expanded', 'false');
    focus.restoreFocus(opener);
    opener = null;
  }

  launcher.addEventListener('click', () => {
    if (root.classList.contains('open')) return close();
    opener = focus.captureFocus();
    clearTransientUi();
    refresh();
    root.classList.add('open');
    launcher.setAttribute('aria-expanded', 'true');
    root.focus();
    if (online && !players.hidden) void request({ kind: 'players' });
    if (online && !self.hidden) void request({ kind: 'state' });
    if (!worldTab.hidden) refreshAdventurers();
  });

  const actions: Record<string, () => void> = {
    close,
    'level-down': () =>
      preview
        ? preview.command(`/dev level ${Math.max(1, preview.player().level - 1)}`)
        : void request({ kind: 'level', value: -1 }),
    'level-up': () =>
      preview
        ? preview.command(`/dev level ${Math.min(MAX_LEVEL, preview.player().level + 1)}`)
        : void request({ kind: 'level', value: 1 }),
    gold: () => {
      if (!amount.reportValidity() || !Number.isInteger(amount.valueAsNumber)) return;
      if (preview) preview.command(`/dev gold ${amount.valueAsNumber}`);
      else void request({ kind: 'gold', value: amount.valueAsNumber });
    },
    fly: () =>
      preview
        ? preview.setFlight(!preview.flight())
        : void request({ kind: 'flight', value: !modes?.flight }),
    heal: () => (preview ? preview.command('/dev heal') : void request({ kind: 'heal' })),
    resource: () =>
      preview ? preview.command('/dev resource') : void request({ kind: 'resource' }),
    cooldowns: () =>
      preview ? preview.command('/dev cooldowns') : void request({ kind: 'cooldowns' }),
    god: () => void request({ kind: 'god', value: !modes?.god }),
    oneHit: () => void request({ kind: 'oneHit', value: !modes?.oneHit }),
    players: () => void request({ kind: 'players' }),
    log: () => void request({ kind: 'log' }),
    adventurers: () => {
      if (adventurers && !waiting) void request({ kind: 'adventurers', value: !adventurers.enabled });
    },
    'adventurers-refresh': refreshAdventurers,
    map: () => { close(); views?.openMap(); },
    bags: () => { close(); views?.openBags(); },
    'give-item': () => {
      if (!itemResults?.value || !itemQuantity?.reportValidity() || !Number.isInteger(itemQuantity.valueAsNumber)) return;
      void request({ kind: 'giveItem', itemId: itemResults.value, count: itemQuantity.valueAsNumber });
    },
  };

  root.addEventListener('click', (event) => {
    if (!(event.target instanceof Element)) return;
    const button = event.target.closest<HTMLButtonElement>('button');
    if (!button || (online && !online.canAccess())) return;
    if (button.dataset.section) {
      const isSelf = button.dataset.section === 'self';
      const isPlayers = !!online && button.dataset.section === 'players';
      for (const tab of root.querySelectorAll('[data-section]')) {
        tab.setAttribute('aria-pressed', String(tab === button));
      }
      self.hidden = !isSelf;
      players.hidden = !isPlayers;
      worldTab.hidden = !(views && button.dataset.section === 'world');
      inventoryTab.hidden = !(views && button.dataset.section === 'inventory');
      logTab.hidden = !(online && button.dataset.section === 'log');
      placeholder.hidden = isSelf || isPlayers || !worldTab.hidden || !inventoryTab.hidden || !logTab.hidden;
      if (isSelf && online) void request({ kind: 'state' });
      if (!inventoryTab.hidden) showItems();
      part('[data-placeholder] h3').textContent = button.textContent;
      if (isPlayers) void request({ kind: 'players' });
      if (!worldTab.hidden) refreshAdventurers();
    }
    if (button.dataset.act) actions[button.dataset.act]?.();
    refresh();
  });
  root.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    event.stopPropagation();
    close();
  });

  part<HTMLSelectElement>('[data-flight-speed]').addEventListener('change', (event) => {
    const value = Number((event.currentTarget as HTMLSelectElement).value);
    if (preview) preview.setFlightSpeed(value);
    else void request({ kind: 'flightSpeed', value });
  });
  part<HTMLSelectElement>('[data-run-speed]').addEventListener('change', (event) => {
    const value = Number((event.currentTarget as HTMLSelectElement).value);
    if (preview) preview.setRunSpeed(value);
    else void request({ kind: 'runSpeed', value });
  });

  function sync(): void {
    if (online) {
      const hidden = !online.canAccess();
      if (launcher.hidden !== hidden) {
        launcher.hidden = hidden;
        if (hidden) {
          adventurers = undefined;
          adventurersRefreshQueued = false;
          showLog();
          worldLocation.textContent = worldPosition.textContent = bagSlots.textContent = '';
        }
      }
      if (hidden) {
        close();
        return;
      }
    }
    if (!root.classList.contains('open') || performance.now() < nextPaint) return;
    nextPaint = performance.now() + 250;
    refresh();
  }
  sync();
  return { close, sync };
}
