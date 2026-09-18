import {connectionPlan} from './folder-connection.mjs';
const MODULE_ID = 'familiar-vtt-interface';
let manager;
const openDialogs = new Set();
const pickerClass = () => foundry.applications.apps.FilePicker;
function makeDialog(content, options) {
  // DialogV2 serializes content; insert live controls after its native form renders.
  class FolderDialog extends foundry.applications.api.DialogV2 {
    async _renderHTML(context, renderOptions) {
      const form = await super._renderHTML(context, renderOptions);
      form.querySelector('.dialog-content').replaceChildren(content);
      return form;
    }
  }
  const dialog = new FolderDialog({...options, content: '<div></div>'});
  openDialogs.add(dialog);
  dialog.addEventListener('close', () => openDialogs.delete(dialog), {once: true});
  return dialog;
}
const node = (tag, text, className) => {
  const el = document.createElement(tag);
  if (text) el.textContent = text;
  if (className) el.className = className;
  return el;
};
function action(label, callback) {
  const el = node('button', label); el.type = 'button';
  el.addEventListener('click', async () => {
    el.disabled = true;
    try { await callback(); }
    catch (error) { ui.notifications.error(`Image folders: ${error.message}`); }
    finally { el.disabled = false; }
  });
  return el;
}
export function normalizeFolders(value) {
  if (!Array.isArray(value)) return [];
  const seen = new Set();
  return value.filter(item => {
    if (!item || !['data', 'public', 's3'].includes(item.source) || typeof item.path !== 'string'
      || !item.path || item.path.startsWith('/') || item.path.split('/').includes('..')
      || (item.source === 's3' && !item.bucket)) return false;
    const key = JSON.stringify([item.source, item.bucket || '', item.path]);
    if (seen.has(key)) return false;
    seen.add(key); return true;
  }).map(item => ({source: item.source, path: item.path,
    bucket: typeof item.bucket === 'string' ? item.bucket : '',
    label: typeof item.label === 'string' ? item.label : item.path.split('/').at(-1)}));
}
const folders = () => normalizeFolders(game.settings.get(MODULE_ID, 'assetFolders'));
async function save(items) {
  if (!game.user.isGM) throw new Error('Only the GM can change image folder shortcuts.');
  await game.settings.set(MODULE_ID, 'assetFolders', normalizeFolders(items));
}
async function openPicker(folder, type, callback) {
  if (!game.user.isGM) return;
  const Picker = pickerClass();
  if (folder) await Picker.browse(folder.source, folder.path, {bucket: folder.bucket});
  const picker = new Picker({type, current: folder?.path || '', displayMode: 'tiles', callback,
    allowUpload: false, window: {title: type === 'folder' ? 'Choose an image folder' : 'Choose a map image'}});
  if (folder) {
    picker.activeSource = folder.source;
    picker.sources[folder.source].target = folder.path;
    if (folder.bucket) picker.sources[folder.source].bucket = folder.bucket;
  }
  await picker.browse(folder?.path || '');
}
export async function browseMapImages(folder) {
  return openPicker(folder, 'image', async path => {
    if (!game.user.isGM) return;
    try {
      let name = path.split('/').at(-1).replace(/\.[^.]+$/, '');
      try { name = decodeURIComponent(name); } catch { /* Keep literal file name. */ }
      await Scene.createDialog({name, background: {src: path}, active: false, navigation: false});
    } catch (error) { ui.notifications.error(`Could not create map: ${error.message}`); }
  });
}
export async function showConnectionGuide(onSave = () => {}) {
  if (!game.user.isGM) return;
  const content = node('div', null, 'fvtt-asset-folders');
  content.append(node('p', 'Link a folder without copying its images. Run the generated command once on the computer hosting Foundry, then check the connection below.'));
  const platform = node('select'); platform.name = 'platform';
  for (const [value, text] of [['mac', 'Mac'], ['windows', 'Windows'], ['linux', 'Linux']]) {
    const option = node('option', text); option.value = value; platform.append(option);
  }
  const source = node('input'); source.name = 'source'; source.placeholder = '/full/path/to/Battlemaps';
  const data = node('input'); data.name = 'data'; data.value = '~/Library/Application Support/FoundryVTT/Data';
  const name = node('input'); name.name = 'name'; name.value = 'battlemaps';
  for (const [title, input] of [['Foundry server', platform], ['Image folder path', source], ['Foundry Data folder path', data], ['Connection name', name]]) {
    const label = node('label', title); label.append(input); content.append(label);
  }
  platform.addEventListener('change', () => { data.value = ''; source.placeholder = platform.value === 'windows' ? 'D:\\Battlemaps' : '/full/path/to/Battlemaps'; });
  content.append(node('p', 'Find User Data Path in Foundry Setup → Configuration, then add /Data (or \\Data on Windows). Connect only images you intend to make available to your game.'));
  const result = node('textarea'); result.readOnly = true; result.rows = 5; result.setAttribute('aria-label', 'Folder connection command');
  const status = node('p'); status.setAttribute('role', 'status');
  let plan;
  const invalidate = () => { plan = undefined; result.value = ''; status.textContent = ''; copy.disabled = check.disabled = true; };
  const copy = action('Copy command', async () => {
    await navigator.clipboard.writeText(plan.command); status.textContent = 'Copied. Paste into Terminal on Mac/Linux, or PowerShell on Windows, on the Foundry server.';
  }); copy.disabled = true;
  let dialog;
  const check = action('Check connection and save', async () => {
    const response = await pickerClass().browse('data', plan.relative);
    if (response.target.replace(/\/$/, '') !== plan.relative) throw new Error('The connection is not available yet. Run the command on the Foundry server, then retry.');
    await save([...folders(), {source: 'data', path: plan.relative, label: name.value.trim(), bucket: ''}]);
    onSave(); await dialog.close(); ui.notifications.info('Image folder connected. Choose map to browse it.');
  }); check.disabled = true;
  for (const input of [platform, source, data, name]) input.addEventListener('input', invalidate);
  content.append(action('Create connection command', () => {
    plan = connectionPlan({platform: platform.value, source: source.value, data: data.value, name: name.value});
    result.value = plan.command; copy.disabled = check.disabled = false;
    status.textContent = 'This creates a folder link. It does not move or copy images. After running it, check the connection below.';
  }), result, copy, check, status);
  dialog = makeDialog(content, {window: {title: 'Connect external image folder'}, position: {width: 640},
    buttons: [{action: 'close', label: 'Cancel'}]});
  await dialog.render({force: true});
}
export async function showAssetFolders() {
  if (!game.user.isGM) return;
  if (manager?.rendered) { manager.bringToFront(); return; }
  const content = node('div', null, 'fvtt-asset-folders');
  content.append(node('p', 'Save shortcuts to image folders, then choose an image to create a map. Your original files stay where they are.'));
  const toolbar = node('div', null, 'fvtt-asset-actions');
  const list = node('div', null, 'fvtt-asset-list');
  const redraw = () => {
    list.replaceChildren();
    const items = folders();
    if (!items.length) list.append(node('p', 'No folders saved yet. Choose a folder below to get started.'));
    for (const folder of items) {
      const row = node('div', null, 'fvtt-asset-row');
      const label = node('div', null, 'fvtt-asset-label');
      label.append(node('strong', folder.label), node('small', `${folder.source}${folder.bucket ? ` / ${folder.bucket}` : ''} / ${folder.path}`));
      row.append(label, action('Choose map', () => browseMapImages(folder)), action('Remove shortcut', async () => {
        await save(folders().filter(item => JSON.stringify(item) !== JSON.stringify(folder))); redraw();
      }));
      list.append(row);
    }
  };
  toolbar.append(action('Choose a folder', () => openPicker(null, 'folder', async (path, picker) => {
    try {
      const folder = {path, source: picker.activeSource, bucket: picker.source.bucket || '', label: path.split('/').filter(Boolean).at(-1) || 'Images'};
      if (!normalizeFolders([folder]).length) throw new Error('Choose a named subfolder, not the storage root.');
      await save([...folders(), folder]); redraw();
    } catch (error) { ui.notifications.error(error.message); }
  })), action('Browse all images', () => browseMapImages(null)));
  toolbar.append(action('Connect external folder', () => showConnectionGuide(redraw)));
  content.append(list, toolbar);
  const help = node('details'); help.append(node('summary', 'My folder is on my computer or another drive'));
  help.append(node('p', 'Foundry can only browse files available to the computer hosting the game. The folder chooser shows that server’s storage, not every folder on your device.'));
  help.append(node('p', 'On your own computer: put an image folder inside Foundry’s User Data → Data folder, or use a folder link to keep a large collection on its existing drive. Then choose that folder above.'));
  help.append(node('p', 'On a hosted server: upload the images using your host’s file manager, or connect storage supported by your host. A path on your laptop will not work for a remote server.'));
  const link = node('a', 'Folder-link instructions'); link.href = 'https://github.com/jaddai0/familiar-vtt-interface/blob/main/ASSET-FOLDERS.md'; link.target = '_blank'; link.rel = 'noopener noreferrer'; help.append(link);
  help.append(node('p', 'Only connect folders you intend to share with your game. Removing a shortcut here never deletes images or disconnects the server folder.'));
  content.append(help); redraw();
  manager = makeDialog(content, {window: {title: 'Image folders'}, position: {width: 640},
    buttons: [{action: 'close', label: 'Done', default: true}]});
  await manager.render({force: true});
}
export function registerAssetFolders() {
  game.settings.register(MODULE_ID, 'assetFolders', {scope: 'world', config: false, type: Array, default: []});
}
export function closeAssetFolders() { for (const dialog of openDialogs) dialog.close(); openDialogs.clear(); manager = undefined; }
