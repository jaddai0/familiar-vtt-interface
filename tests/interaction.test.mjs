import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {DEFAULTS, clampWidth, loadPreferences, savePreferences} from '../scripts/preferences.mjs';

const dom = new JSDOM('<body></body>', {url: 'http://localhost/'});
for (const key of ['window', 'document', 'localStorage', 'MutationObserver', 'AbortController', 'MouseEvent', 'KeyboardEvent']) globalThis[key] = dom.window[key];
globalThis.innerWidth = 1440;
const callbacks = {};
globalThis.Hooks = {once: (key, fn) => callbacks[key] = fn, on: () => {}};
let on = true;
globalThis.game = {world: {id: 'test-world'}, user: {id: 'gm'}, settings: {get: () => on, register: () => {}}};
globalThis.ui = {notifications: {warn: () => {}, info: () => {}}};
const mod = await import('../scripts/main.mjs');
const tick = () => new Promise(resolve => setTimeout(resolve, 0));
const tab = (name, pressed = false) => `<li><button data-action="tab" data-tab="${name}" aria-label="${name}" aria-pressed="${pressed}">${name}</button></li>`;
function fixture() {
  mod.cleanup(); localStorage.clear(); on = true;
  // Reset enabled through the public settings transition.
  on = false; mod.applyInterfaceState(); on = true;
  document.body.innerHTML = `<div id="interface"><div id="ui-right"><aside id="sidebar"><nav id="sidebar-tabs"><menu>${['chat','combat','scenes','actors','journal','compendium','settings','files'].map(name => tab(name, name === 'chat')).join('')}<li><button data-action="toggleState" aria-label="Collapse">collapse</button></li></menu></nav><div id="sidebar-content" class="expanded"><section id="actors"><button data-action="createEntry">Create Actor</button><input type="search"><ol class="directory-list"></ol></section></div></aside></div><div id="scene-controls"><menu id="scene-controls-layers"><li><button data-action="control" data-control="tokens" aria-pressed="true" aria-label="Token controls">tokens</button></li><li><button data-action="control" data-control="walls" aria-label="Walls">walls</button></li></menu><menu id="scene-controls-tools"><li><button data-action="tool" data-tool="select" aria-label="Select" aria-pressed="true">select</button></li><li><button data-action="tool" data-tool="visibility" aria-label="Visibility">visibility</button></li></menu></div><nav id="scene-navigation"><li class="scene view">Prep</li><li class="scene active">Live</li></nav></div>`;
  for(const button of document.querySelectorAll('button')) button.getClientRects = () => [{width:30,height:30}];
}

test('preferences isolate users, survive reload, tolerate corrupt storage and constrain width', () => {
  const p = {...DEFAULTS, width: 500, density: 'compact', tabs: ['chat', 'combat']};
  assert.equal(savePreferences(localStorage, 'world:gm', p), true);
  assert.equal(loadPreferences(localStorage, 'world:gm').width, 500);
  assert.deepEqual(loadPreferences(localStorage, 'world:player').tabs, DEFAULTS.tabs);
  localStorage.setItem('bad', 'no json'); assert.deepEqual(loadPreferences(localStorage, 'bad').tabs, DEFAULTS.tabs);
  assert.equal(clampWidth(900), 600); assert.equal(clampWidth(10), 300); assert.equal(clampWidth(600, 900), 540);
  assert.equal(savePreferences({setItem() {throw Error('denied');}}, 'x', p), false);
});
test('overflow uses original native nodes, preserves clicks, right-click, disabled and pressed states', async () => {
  fixture(); const source = document.querySelector('[data-tab="settings"]'); let clicked = 0, right = 0;
  source.addEventListener('click', () => clicked++); source.addEventListener('contextmenu', () => right++);
  source.disabled = true; source.setAttribute('aria-pressed', 'true'); mod.applyInterfaceState();
  assert.equal(document.querySelector('[data-tab="settings"]'), source); assert.equal(source.disabled, true);
  assert.equal(source.getAttribute('aria-pressed'), 'true'); source.disabled = false;
  source.dispatchEvent(new MouseEvent('contextmenu', {bubbles: true, button: 2})); source.click(); await tick();
  assert.equal(clicked, 1); assert.equal(right, 1); assert.equal(document.querySelectorAll('[data-tab="settings"]').length, 1);
});
test('Escape restores opener focus and outside click closes the disclosure', async () => {
  fixture(); mod.applyInterfaceState(); const opener = document.querySelector('.fvtt-sidebar-more'); opener.click();
  const native = document.querySelector('[data-tab="chat"]'); native.focus();
  native.dispatchEvent(new KeyboardEvent('keydown', {key:'Escape',bubbles:true}));
  assert.equal(opener.getAttribute('aria-expanded'), 'false'); assert.equal(document.activeElement, opener);
  opener.click(); document.body.dispatchEvent(new MouseEvent('pointerdown',{bubbles:true}));
  assert.equal(opener.getAttribute('aria-expanded'),'false'); await tick();
});
test('arrow navigation reaches original controls', () => {
  fixture(); mod.applyInterfaceState(); document.querySelector('.fvtt-sidebar-more').click();
  const first = document.querySelector('[data-tab="chat"]'); first.focus();
  first.dispatchEvent(new KeyboardEvent('keydown',{key:'End',bubbles:true}));
  assert.notEqual(document.activeElement,first); assert.ok(document.querySelector('#sidebar-tabs').contains(document.activeElement));
});
test('pin changes persist without changing native button identity', async () => {
  fixture(); mod.applyInterfaceState(); const source = document.querySelector('[data-tab="chat"]');
  source.parentElement.querySelector('.fvtt-pin').click(); await tick();
  assert.ok(source.parentElement.classList.contains('fvtt-secondary'));
  assert.ok(!loadPreferences(localStorage,'familiar-vtt-interface:test-world:gm').tabs.includes('chat'));
  assert.equal(document.querySelector('[data-tab="chat"]'),source);
});
test('disable restores original collapse placement and removes every owned control; reenable is idempotent', () => {
  fixture(); const collapse = document.querySelector('[data-action="toggleState"]'); const parent = collapse.parentElement.parentElement;
  mod.applyInterfaceState(); mod.applyInterfaceState(); assert.equal(document.querySelectorAll('.fvtt-sidebar-more').length,1);
  on = false; mod.applyInterfaceState();
  assert.equal(document.querySelectorAll('[data-fvtt-owned]').length,0); assert.equal(collapse.parentElement.parentElement,parent);
  assert.equal(document.querySelectorAll('.fvtt-secondary').length,0); assert.equal(collapse.getAttribute('aria-label'),'Collapse');
  on = true; mod.applyInterfaceState(); assert.equal(document.querySelectorAll('.fvtt-sidebar-more').length,1);
});
test('native part rerender replaces old pin rows without duplicated or stale actions', async () => {
  fixture(); mod.applyInterfaceState(); const menu = document.querySelector('#scene-controls-tools');
  const fresh = document.createElement('menu'); fresh.id=menu.id; fresh.innerHTML='<li><button data-action="tool" data-tool="rectangle" aria-label="Rectangle">rectangle</button></li>';
  menu.replaceWith(fresh); await tick();
  assert.equal(document.querySelectorAll('#scene-controls-tools .fvtt-pin').length,1);
  assert.equal(document.querySelector('[data-tool="visibility"]'),null);
});
test('tool pins follow the final native layer after the tools render before the layer state updates', async () => {
  fixture(); mod.applyInterfaceState();
  const menu = document.querySelector('#scene-controls-tools');
  menu.innerHTML='<li><button data-tool="walls" aria-label="Draw Walls">walls</button></li>';
  await tick(); // Foundry replaces tools before updating the layer buttons.
  document.querySelector('[data-control="tokens"]').setAttribute('aria-pressed','false');
  document.querySelector('[data-control="walls"]').setAttribute('aria-pressed','true');
  await tick(); menu.querySelector('.fvtt-pin').click(); await tick();
  const saved=loadPreferences(localStorage,'familiar-vtt-interface:test-world:gm');
  assert.deepEqual(saved.tools.walls,['walls']); assert.equal(saved.tools.tokens,undefined);
});
test('empty guidance opens the native creator and disappears for populated/search/permission states', async () => {
  fixture(); const create=document.querySelector('#actors [data-action="createEntry"]');let clicked=0;create.addEventListener('click',()=>clicked++);
  mod.applyInterfaceState();document.querySelector('.fvtt-start-action').click();assert.equal(clicked,1);
  document.querySelector('.directory-list').innerHTML='<li class="document" data-document-id="test">Goblin</li>';await tick();assert.equal(document.querySelector('.fvtt-starter'),null);
  document.querySelector('.directory-list').innerHTML='';create.remove();await tick();assert.equal(document.querySelector('.fvtt-starter'),null);
});
test('map status distinguishes GM preparation from active player map', () => {
  fixture();mod.applyInterfaceState();const labels=[...document.querySelectorAll('.fvtt-scene-state')].map(n=>n.textContent);
  assert.deepEqual(labels,['You are viewing','Players are here']);
});
test('dragging follows the pointer beyond the handle at scaled UI sizes, persists and ends cleanly', async () => {
  fixture(); const sidebar = document.querySelector('#ui-right');
  Object.defineProperty(sidebar, 'offsetWidth', {value: 360});
  sidebar.getBoundingClientRect = () => ({width:270});
  mod.applyInterfaceState(); const handle = document.querySelector('.fvtt-sidebar-resize');
  const pointer = (target, type, x) => target.dispatchEvent(new MouseEvent(type, {bubbles:true, clientX:x, button:0}));
  pointer(handle,'pointerdown',1000); pointer(window,'pointermove',940); pointer(window,'pointerup',940); await tick();
  assert.equal(handle.getAttribute('aria-valuenow'),'440');
  assert.equal(loadPreferences(localStorage,'familiar-vtt-interface:test-world:gm').width,440);
  pointer(window,'pointermove',850); assert.equal(handle.getAttribute('aria-valuenow'),'440');
});
test.after(()=>{on=false;mod.applyInterfaceState();dom.window.close();});
