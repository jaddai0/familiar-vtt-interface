# Familiar VTT Interface

A compact interface for Foundry VTT v13, with personal tool pins, a quiet
map selector and an adjustable sidebar. Free and open source under MIT.

## Install

In Foundry Setup, choose **Add-on Modules → Install Module** and paste:

```text
https://github.com/jaddai0/familiar-vtt-interface/releases/latest/download/module.json
```

Then enable **Familiar VTT Interface** in your world's **Manage Modules** dialog.
Disable **Carolingian UI** first; the two interfaces conflict.

You can also download the ZIP from [Releases](https://github.com/jaddai0/familiar-vtt-interface/releases).
See [installation and recovery instructions](INSTALL.md).

## Features

- Pin sidebar tabs, map layers and tools to keep frequent actions close.
- Resize or collapse the sidebar, and choose comfortable or compact spacing.
- Keep map navigation small; view scene details and tool names on hover.
- Preserve native actions, right-click menus and world permissions.
- Save preferences per user and world in the current browser.

Tested with Foundry 13.351 and dnd5e 5.2.5. Other systems and UI-changing modules
may need additional testing. No server, subscription, AI service or external
account is required. No world documents are rewritten.

## Development

Use Node 20.19+ and Python 3:

```sh
npm ci
npm test
python3 -m unittest discover -s tests -p 'package_test.py'
python3 tools/package.py
```

The default build is a manual-install ZIP. For a public release, supply both
`--manifest-url` (the stable update address above) and `--download-url`
(the version-specific release ZIP URL). Upload the generated ZIP, module.json
and SHA256SUMS.txt as release assets. Never reuse an existing release version.
Only allowlisted runtime files, the license and install guide enter the ZIP.

This project was developed with AI assistance under human direction. It is an
independently distributed community module, not an official Foundry product or
a claim of acceptance into Foundry's official package directory.

[Report issues](https://github.com/jaddai0/familiar-vtt-interface/issues).
See [MIT license](LICENSE). Foundry itself and its runtime fonts/icons are not
included and remain subject to their own licenses.
