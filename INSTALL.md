# Install Familiar VTT Interface

Requires a licensed copy of Foundry VTT v13. Tested with Foundry 13.351 and
D&D5e 5.2.5. Other systems and interface-changing modules may need further testing.

## From the ZIP

1. Extract the ZIP. It contains a folder named `familiar-vtt-interface`.
2. Place that folder in your Foundry User Data folder under `Data/modules/`.
   The resulting path must be `Data/modules/familiar-vtt-interface/module.json`.
   On hosted services, use the host's file manager or module upload feature.
3. Restart Foundry, open your world, then open **Game Settings → Manage Modules**.
4. Enable **Familiar VTT Interface**. Disable **Carolingian UI** if it is enabled.
5. Save and reload when prompted.

## From a public manifest link

Open Foundry Setup → Add-on Modules → Install Module. Paste this address into
**Manifest URL**, then click **Install**:

```text
https://github.com/jaddai0/familiar-vtt-interface/releases/latest/download/module.json
```

Enable the module in each world as described above. Use Foundry's normal module
update check to get new versions. Manual ZIP installations can be updated by
replacing the module folder with a newer release.

## Use and recovery

Open the three-line button on the left to pin tools. Open the three-dot button
on the right to pin sidebar tabs or change row spacing. Drag the sidebar edge
to resize it. Scene details and tool names appear on hover.

Preferences are stored per user and world in the current browser. They do not
travel between browsers. There are no external services or subscriptions.

To restore the standard interface, turn off **Enable Familiar VTT Interface**
in Configure Settings, or disable the module in Manage Modules and reload.
The module does not rewrite world documents. If controls overlap, disable other
interface themes before reporting a problem.

This is an independent community module, not an official Foundry product.
The included MIT license covers this module, not Foundry itself or its assets.
Foundry supplies the fonts and icons at runtime; none are redistributed here.
