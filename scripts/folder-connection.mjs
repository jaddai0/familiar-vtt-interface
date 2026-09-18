const quote = text => `'${text.replaceAll("'", "'\\''")}'`;
const psQuote = text => `'${text.replaceAll("'", "''")}'`;
export function connectionPlan({platform, source, data, name}) {
  source = source.trim(); data = data.trim(); name = name.trim();
  if (!/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,63}$/.test(name)) throw new Error('Use a short folder name with letters, numbers, hyphens or underscores.');
  if (![source, data].every(path => path && !/[\r\n\0]/.test(path))) throw new Error('Enter both full folder paths.');
  const relative = `familiar-assets/${name}`;
  if (platform === 'windows') {
    if (![source, data].every(path => /^[A-Za-z]:[\\/]/.test(path) && !/[\[\]*?]/.test(path))) throw new Error('Use full drive paths, such as D:\\Maps, without wildcard characters.');
    const parent = data.replace(/[\\/]$/, '') + '\\familiar-assets';
    const target = parent + '\\' + name;
    return {relative, command: `$source = ${psQuote(source)}; $parent = ${psQuote(parent)}; $target = ${psQuote(target)}; if (!(Test-Path -LiteralPath $source -PathType Container)) { throw 'Source folder not found' }; if (Test-Path -LiteralPath $target) { throw 'Connection already exists; choose another name' }; New-Item -ItemType Directory -Path $parent -Force | Out-Null; New-Item -ItemType Junction -Path $target -Target $source`};
  }
  if (!['mac', 'linux'].includes(platform)) throw new Error('Choose your server operating system.');
  if (![source, data].every(path => path.startsWith('/') || path.startsWith('~/'))) throw new Error('Use a full path beginning with / or ~/.');
  const shellPath = path => path.startsWith('~/') ? '"$HOME"/' + quote(path.slice(2)) : quote(path);
  const parent = data.replace(/\/$/, '') + '/familiar-assets';
  const target = parent + '/' + name;
  return {relative, command: `source=${shellPath(source)}; parent=${shellPath(parent)}; target=${shellPath(target)}; if [ ! -d "$source" ]; then printf '%s\\n' 'Source folder not found'; elif [ -e "$target" ] || [ -L "$target" ]; then printf '%s\\n' 'Connection already exists; choose another name'; else mkdir -p "$parent" && ln -s "$source" "$target"; fi`};
}
