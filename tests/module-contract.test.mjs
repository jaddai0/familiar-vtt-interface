import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('manifest targets Foundry v13 and loads the module assets', () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'module.json'), 'utf8'));

  assert.equal(manifest.id, 'familiar-vtt-interface');
  assert.equal(manifest.compatibility.minimum, '13');
  assert.equal(manifest.compatibility.verified, '13');
  assert.deepEqual(manifest.esmodules, ['scripts/main.mjs']);
  assert.deepEqual(manifest.styles, ['styles/tokens.css', 'styles/familiar-vtt-interface.css']);
  assert.deepEqual(manifest.relationships.conflicts.map((entry) => entry.id), ['crlngn-ui']);

  for (const asset of [...manifest.esmodules, ...manifest.styles]) {
    assert.equal(fs.existsSync(path.join(root, asset)), true, `${asset} must exist`);
  }
});

test('module owns one root class and a client-side enable setting', () => {
  const source = fs.readFileSync(path.join(root, 'scripts/main.mjs'), 'utf8');

  assert.match(source, /const ROOT_CLASS = MODULE_ID/);
  assert.match(source, /scope: 'client'/);
  assert.match(source, /default: true/);
  assert.match(source, /classList\.toggle\(ROOT_CLASS, enabled\)/);
});

test('visual rules cover every screenshot-backed interface region', () => {
  const css = fs.readFileSync(path.join(root, 'styles/familiar-vtt-interface.css'), 'utf8');
  const requiredSelectors = [
    '#ui-left',
    '#scene-controls',
    '#scene-navigation',
    '#ui-right',
    '#sidebar-tabs',
    '#sidebar-content',
    '.directory-header',
    '.directory-item',
    '#chat',
    '.window-content',
  ];

  for (const selector of requiredSelectors) assert.ok(css.includes(selector), `${selector} must be styled`);
  assert.match(css, /:focus-visible/);
  assert.match(css, /prefers-reduced-motion/);
});
