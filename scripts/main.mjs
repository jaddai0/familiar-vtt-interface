import {registerAssetFolders, showAssetFolders, closeAssetFolders} from './asset-folders.mjs';
import {DEFAULTS, clampWidth, loadPreferences, savePreferences} from './preferences.mjs';

const MODULE_ID = 'familiar-vtt-interface';
const ROOT_CLASS = MODULE_ID;
let preferences;
let preferenceKey;
let observer;
let queued = false;
let enabled = false;
let lifetime;
const disclosures = new Map();
const restoredAttributes = new Map();
const movedNodes = [];
const OWNED = '[data-fvtt-owned]';

function own(element) { element.dataset.fvttOwned = ''; return element; }
function element(tag, className, text) {
  const node = own(document.createElement(tag));
  node.className = className;
  if (text) node.textContent = text;
  return node;
}
function button(label, icon, className = '') {
  const node = element('button', `fvtt-button ${className}`);
  node.type = 'button'; node.dataset.keyboardFocus = 'true'; node.setAttribute('aria-label', label); node.title = label;
  if (icon) { const glyph = document.createElement('i'); glyph.className = `fa-solid ${icon}`; glyph.setAttribute('aria-hidden', 'true'); node.append(glyph); }
  return node;
}
function rememberAttribute(node, name, value) {
  if (!restoredAttributes.has(node)) restoredAttributes.set(node, new Map());
  const attributes = restoredAttributes.get(node);
  if (!attributes.has(name)) attributes.set(name, node.getAttribute(name));
  node.setAttribute(name, value);
}
function labelOf(node) { return node.getAttribute('aria-label') || node.title || node.dataset.tooltip || 'Foundry control'; }
function persist() {
  if (!savePreferences(localStorage, preferenceKey, preferences)) ui.notifications?.warn('Your interface preferences could not be saved in this browser.');
  queueEnhancements();
}
function queueEnhancements() {
  if (queued || !enabled) return;
  queued = true;
  queueMicrotask(() => { queued = false; if (enabled) enhance(); });
}
function closeAll(except) { for (const [root, disclosure] of disclosures) if (root !== except) disclosure.close(false); }

/** A disclosure of original Foundry controls, never copies of native actions. */
function disclosure(root, toggle, panels, openClass) {
  if (disclosures.has(root)) return disclosures.get(root);
  const controller = new AbortController();
  const opts = {signal: controller.signal};
  const controls = () => panels.flatMap(panel => [...panel.querySelectorAll('button:not(:disabled)')])
    .filter(node => node.getClientRects().length && !node.closest('[hidden]'));
  const close = (restoreFocus = false) => {
    const focused = panels.some(panel => panel.contains(document.activeElement));
    root.classList.remove(openClass); toggle.setAttribute('aria-expanded', 'false');
    if (restoreFocus && focused) toggle.focus();
  };
  const open = (focus = false) => {
    closeAll(root); root.classList.add(openClass); toggle.setAttribute('aria-expanded', 'true');
    if (focus) controls()[0]?.focus();
  };
  toggle.setAttribute('aria-expanded', 'false');
  toggle.addEventListener('click', event => { event.stopPropagation(); root.classList.contains(openClass) ? close(true) : open(event.detail === 0); }, opts);
  toggle.addEventListener('keydown', event => {
    if (event.key === 'ArrowDown') { event.preventDefault(); event.stopPropagation(); open(true); }
  }, opts);
  root.addEventListener('keydown', event => {
    if (!root.classList.contains(openClass)) return;
    if (event.key === 'Tab') {
      setTimeout(() => { if (!root.contains(document.activeElement)) close(false); }, 0); return;
    }
    if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close(true); toggle.focus(); return; }
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
    const items = controls(), current = items.indexOf(document.activeElement);
    if (current < 0 || !items.length) return;
    event.preventDefault(); event.stopPropagation();
    const index = event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1
      : (current + (event.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
    items[index].focus();
  }, opts);
  root.addEventListener('click', event => {
    const native = event.target.closest('.fvtt-native-row > button:not([data-fvtt-owned])');
    if (native && !native.matches(OWNED)) queueMicrotask(() => close(event.detail === 0));
  }, opts);
  document.addEventListener('pointerdown', event => { if (!root.contains(event.target)) close(false); }, opts);
  const state = {close, dispose: () => { close(false); controller.abort(); }};
  disclosures.set(root, state); return state;
}

function pinRows(menu, kind, selected, max) {
  for (const row of menu.children) {
    if (row.matches(OWNED)) continue;
    const source = row.querySelector(':scope > button:not([data-fvtt-owned])');
    if (!source) continue;
    rememberAttribute(source, 'data-keyboard-focus', 'true');
    const key = source.dataset.tab || source.dataset.control || source.dataset.tool || `module:${labelOf(source)}`;
    if (!key) continue;
    const pinned = selected.includes(key);
    row.classList.toggle('fvtt-secondary', !pinned);
    row.classList.add('fvtt-native-row');
    // Native nodes retain tooltips, pressed/disabled state, right-click and delegated actions.
    let pin = row.querySelector(':scope > .fvtt-pin');
    if (!pin) {
      pin = button('', 'fa-thumbtack', 'fvtt-pin'); row.append(pin);
      pin.addEventListener('click', event => {
        event.stopPropagation();
        const group = pin.dataset.fvttPinKind;
        const values = group === 'tabs' ? preferences.tabs : group === 'layers' ? preferences.layers
          : (preferences.tools[group] ?? defaultTools(menu));
        const next = values.includes(key) ? values.filter(value => value !== key) : [...values, key];
        if (next.length > max) { ui.notifications?.info(`Unpin a control first. You can pin up to ${max} here.`); return; }
        if (group === 'tabs' || group === 'layers') preferences[group] = next;
        else preferences.tools[group] = next;
        persist();
      });
    }
    pin.dataset.fvttPinKind = kind;
    const label = `${pinned ? 'Unpin' : 'Pin'} ${labelOf(source)}`;
    pin.setAttribute('aria-label', label); pin.title = label; pin.setAttribute('aria-pressed', String(pinned));
  }
}
function defaultTools(menu) {
  const preferred = ['select', 'target', 'ruler', 'measure', 'draw', 'rectangle', 'ellipse', 'polygon', 'text'];
  const available = [...menu.querySelectorAll(':scope > li > button[data-tool]')].map(node => node.dataset.tool);
  return preferred.filter(key => available.includes(key)).slice(0, 5);
}

function enhanceSidebarTabs() {
  const nav = document.querySelector('#sidebar-tabs');
  const menu = nav?.querySelector(':scope > menu');
  if (!menu) return;
  let heading = nav.querySelector('.fvtt-sidebar-heading');
  if (!heading) {
    heading = element('div', 'fvtt-sidebar-heading');
    heading.append(element('span', 'fvtt-panel-label'));
    const toggle = button('All sidebar tabs and pins', 'fa-ellipsis', 'fvtt-sidebar-more');
    heading.append(toggle); nav.prepend(heading);
    const collapse = menu.querySelector('button[data-action="toggleState"]')?.closest('li');
    if (collapse) {
      const marker = document.createComment('Familiar VTT restore collapse'); collapse.before(marker);
      movedNodes.push({node: collapse, marker}); heading.append(collapse);
    }
    const density = element('li', 'fvtt-density-row');
    density.append(element('span', '', 'Row spacing'));
    const control = button('Use compact rows', null, 'fvtt-density'); density.append(control); menu.append(density);
    control.addEventListener('click', event => {
      event.stopPropagation(); preferences.density = preferences.density === 'compact' ? 'comfortable' : 'compact'; persist();
    });
    disclosure(nav, toggle, [menu], 'fvtt-tabs-open');
  }
  const active = menu.querySelector('button[data-tab][aria-pressed="true"]');
  heading.querySelector('.fvtt-panel-label').textContent = active ? labelOf(active) : 'Sidebar';
  const density = menu.querySelector('.fvtt-density');
  density.textContent = preferences.density === 'compact' ? 'Compact' : 'Comfortable';
  density.setAttribute('aria-label', `Use ${preferences.density === 'compact' ? 'comfortable' : 'compact'} rows`);
  density.title = density.getAttribute('aria-label');
  pinRows(menu, 'tabs', preferences.tabs, 6);
  const isCollapsed = !document.querySelector('#sidebar-content')?.classList.contains('expanded');
  document.body.classList.toggle('fvtt-sidebar-collapsed', isCollapsed);
  const collapse = heading.querySelector('button[data-action="toggleState"]');
  if (collapse) {
    rememberAttribute(collapse, 'aria-label', isCollapsed ? 'Expand sidebar' : 'Collapse sidebar');
    rememberAttribute(collapse, 'data-keyboard-focus', 'true');
  }
  enhanceResize();
}

function enhanceSceneControls() {
  const root = document.querySelector('#scene-controls');
  const layers = root?.querySelector('#scene-controls-layers');
  const tools = root?.querySelector('#scene-controls-tools');
  if (!root || !layers || !tools) return;
  let toggle = root.querySelector('.fvtt-controls-more');
  if (!toggle) {
    toggle = button('All map tools and pins', 'fa-bars', 'fvtt-controls-more'); root.prepend(toggle);
    disclosure(root, toggle, [layers, tools], 'fvtt-controls-open');
  }
  // Tools are a replaceable Foundry render part: update the disclosure's current panel references.
  const current = disclosures.get(root);
  if (current.tools !== tools) {
    current.dispose(); disclosures.delete(root);
    disclosure(root, toggle, [layers, tools], 'fvtt-controls-open').tools = tools;
  }
  pinRows(layers, 'layers', preferences.layers, 5);
  const layer = layers.querySelector('[data-control][aria-pressed="true"]')?.dataset.control || 'tokens';
  pinRows(tools, layer, preferences.tools[layer] ?? defaultTools(tools), 5);
}

function enhanceResize() {
  const sidebar = document.querySelector('#ui-right');
  if (!sidebar || sidebar.querySelector('.fvtt-sidebar-resize')) return;
  const handle = element('div', 'fvtt-sidebar-resize');
  handle.tabIndex = 0; handle.dataset.keyboardFocus = 'true'; handle.setAttribute('role', 'separator'); handle.setAttribute('aria-orientation', 'vertical');
  handle.setAttribute('aria-label', 'Sidebar width'); handle.title = 'Drag to resize. Arrow keys adjust width. Home resets.';
  sidebar.prepend(handle);
  const setWidth = width => {
    preferences.width = clampWidth(width, innerWidth);
    document.body.style.setProperty('--fvtt-sidebar-width', `${preferences.width}px`);
    handle.setAttribute('aria-valuenow', String(preferences.width));
    handle.setAttribute('aria-valuemin', '300'); handle.setAttribute('aria-valuemax', String(clampWidth(600, innerWidth)));
  };
  setWidth(preferences.width);
  let drag;
  const dragOptions = {signal: lifetime.signal};
  handle.addEventListener('pointerdown', event => {
    if (event.button !== 0) return;
    event.preventDefault(); event.stopPropagation();
    drag = {id: event.pointerId, x: event.clientX, width: preferences.width,
      scale: sidebar.getBoundingClientRect().width / sidebar.offsetWidth || 1};
  });
  // Follow the pointer outside the narrow handle, as Foundry's own window resizer does.
  window.addEventListener('pointermove', event => {
    if (drag && drag.id === event.pointerId) setWidth(drag.width + (drag.x - event.clientX) / drag.scale);
  }, dragOptions);
  const finishDrag = event => { if (drag && (!event || drag.id === event.pointerId)) { drag = null; persist(); } };
  window.addEventListener('pointerup', finishDrag, dragOptions);
  window.addEventListener('pointercancel', finishDrag, dragOptions);
  window.addEventListener('blur', () => finishDrag(), dragOptions);
  handle.addEventListener('keydown', event => {
    if (!['ArrowLeft', 'ArrowRight', 'Home'].includes(event.key)) return;
    event.preventDefault(); event.stopPropagation();
    setWidth(event.key === 'Home' ? DEFAULTS.width : preferences.width + (event.key === 'ArrowLeft' ? 20 : -20)); persist();
  });
  handle.addEventListener('dblclick', () => { setWidth(DEFAULTS.width); persist(); });
}
function enhanceScenes() {
  for (const scene of document.querySelectorAll('#scene-navigation .scene')) {
    let state = scene.querySelector('.fvtt-scene-state');
    const words = [scene.classList.contains('view') && 'You are viewing', scene.classList.contains('active') && 'Players are here'].filter(Boolean).join(' · ');
    const name = scene.querySelector('.scene-name')?.textContent.trim() || '';
    rememberAttribute(scene, 'data-tooltip-text', [name, words].filter(Boolean).join(' — '));
    if (!words) { state?.remove(); continue; }
    if (!state) { state = element('span', 'fvtt-scene-state'); scene.append(state); }
    state.textContent = words;
  }
}
const STARTERS = {
  scenes: {title: 'Add your first map', detail: 'Scenes are playable maps. Add an image, then set its grid.', action: 'Add a map'},
  actors: {title: 'Add a character or monster', detail: 'Actors hold character and monster sheets. Drag one onto a map to place its token.', action: 'Add a character or monster', browse: 'Browse creatures in Compendium Packs'},
  journal: {title: 'Create a handout', detail: 'Journal entries hold notes and handouts. Use Show Players in an entry to share it.', action: 'Create a handout'},
};
function enhanceAssetAccess() {
  const scenes = document.querySelector('#sidebar-content #scenes');
  if (!scenes || !game.user.isGM || scenes.querySelector('.fvtt-image-folders')) return;
  const entry = button('Image folders', 'fa-folder-open', 'fvtt-image-folders');
  entry.append(document.createTextNode('Image folders'));
  entry.addEventListener('click', showAssetFolders);
  const list = scenes.querySelector('.directory-list');
  if (list) list.before(entry); else scenes.append(entry);
}
function enhanceStarters() {
  for (const [id, copy] of Object.entries(STARTERS)) {
    const tab = document.querySelector(`#sidebar-content #${id}`);
    if (!tab) continue;
    const create = tab.querySelector('button[data-action="createEntry"], button.create-entry');
    const entries = tab.querySelector('.directory-list .document, .directory-list [data-document-id], .directory-list [data-entry-id]');
    const search = tab.querySelector('input[type="search"]');
    let starter = tab.querySelector('.fvtt-starter');
    if (!create || create.disabled || entries || search?.value.trim()) { starter?.remove(); continue; }
    if (starter) continue;
    starter = element('section', 'fvtt-starter'); starter.append(element('h3', '', copy.title), element('p', '', copy.detail));
    const action = button(copy.action, 'fa-plus', 'fvtt-start-action'); action.append(document.createTextNode(copy.action));
    action.addEventListener('click', () => create.click()); starter.append(action);
    if (copy.browse) {
      const browse = button(copy.browse, 'fa-book-atlas', 'fvtt-start-action'); browse.append(document.createTextNode('Browse creatures'));
      browse.addEventListener('click', () => document.querySelector('#sidebar-tabs button[data-tab="compendium"]')?.click()); starter.append(browse);
    }
    const list = tab.querySelector('.directory-list'); if (list) list.before(starter); else tab.append(starter);
  }
}
function enhance() {
  observer?.disconnect();
  for (const [root, state] of disclosures) if (!root.isConnected) { state.dispose(); disclosures.delete(root); }
  for (const node of restoredAttributes.keys()) if (!node.isConnected) restoredAttributes.delete(node);
  document.body.dataset.fvttDensity = preferences.density;
  document.body.style.setProperty('--fvtt-sidebar-width', `${clampWidth(preferences.width, innerWidth)}px`);
  enhanceSidebarTabs(); enhanceSceneControls(); enhanceScenes(); enhanceStarters(); enhanceAssetAccess();
  observer?.observe(document.querySelector('#interface') || document.body, {childList: true, subtree: true, attributes: true, attributeFilter: ['aria-pressed', 'disabled', 'class']});
}
function cleanup() {
  closeAssetFolders();
  observer?.disconnect(); lifetime?.abort();
  for (const state of disclosures.values()) state.dispose(); disclosures.clear();
  for (const {node, marker} of movedNodes.splice(0)) { if (marker.isConnected) { marker.replaceWith(node); } }
  for (const [node, attributes] of restoredAttributes) for (const [key, value] of attributes) {
    if (value === null) node.removeAttribute(key); else node.setAttribute(key, value);
  }
  restoredAttributes.clear();
  document.querySelectorAll(OWNED).forEach(node => node.remove());
  document.querySelectorAll('.fvtt-secondary, .fvtt-native-row').forEach(node => node.classList.remove('fvtt-secondary', 'fvtt-native-row'));
  document.body.classList.remove(ROOT_CLASS, 'fvtt-sidebar-collapsed');
  delete document.body.dataset.fvttDensity; document.body.style.removeProperty('--fvtt-sidebar-width');
}
function applyInterfaceState() {
  const next = game.settings.get(MODULE_ID, 'enabled');
  if (!next) { enabled = false; cleanup(); return; }
  if (!enabled) {
    enabled = true; lifetime = new AbortController();
    preferenceKey = `${MODULE_ID}:${game.world.id}:${game.user.id}`;
    preferences = loadPreferences(localStorage, preferenceKey);
    observer = new MutationObserver(queueEnhancements);
    window.addEventListener('resize', queueEnhancements, {signal: lifetime.signal});
    document.addEventListener('input', event => {
      if (event.target.matches('#sidebar-content input[type="search"]')) queueEnhancements();
    }, {signal: lifetime.signal});
  }
  document.body.classList.toggle(ROOT_CLASS, enabled); enhance();
}
Hooks.once('init', () => {
  registerAssetFolders();
  game.settings.register(MODULE_ID, 'enabled', {
    name: 'Enable Familiar VTT Interface', hint: 'Use compact tools, personal pins and an adjustable sidebar in this browser.',
    scope: 'client', config: true, type: Boolean, default: true, requiresReload: false, onChange: applyInterfaceState,
  });
});
Hooks.once('ready', applyInterfaceState);
for (const hook of ['renderSidebar', 'renderSceneControls', 'renderSceneNavigation', 'changeSidebarTab', 'collapseSidebar', 'renderActorDirectory', 'renderSceneDirectory', 'renderJournalDirectory']) Hooks.on(hook, queueEnhancements);
Hooks.once('shutdown', () => { enabled = false; cleanup(); });
export {MODULE_ID, ROOT_CLASS, applyInterfaceState, enhanceSidebarTabs, enhanceSceneControls, cleanup};
