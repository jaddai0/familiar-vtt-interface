# Connect image folders

Open the **Scenes** sidebar (the map icon), then **Image folders**.

- **Choose a folder** opens Foundry's own folder chooser. Browse into a folder and select it to save a shortcut for the GMs in this world.
- **Choose map** opens that folder as image thumbnails. Choose an image and confirm the new scene's name to make a map. Creating a scene does not activate it for players.
- **Browse all images** opens Foundry storage without a saved shortcut.
- **Remove shortcut** removes only the saved entry. It does not delete images, remove the server connection or break existing scenes.

## A collection outside Foundry

Choose **Connect external folder**. Select the operating system of the computer
running Foundry. Enter the full image folder path, Foundry's Data folder path,
and a short connection name. Click **Create connection command**, then **Copy
command**. Run it once in Terminal (Mac/Linux) or PowerShell (Windows) on the
Foundry server. Return and click **Check connection and save**.

This creates a symbolic link on Mac/Linux or a directory junction on Windows.
Images are not copied or moved. Foundry sees the folder under
`Data/familiar-assets/<connection-name>`. The check must succeed before the
shortcut is saved. A browser cannot create these server-side links itself.

Connect only folders you intend to make available to the game, not an entire
home directory or a workspace containing credentials or private documents.
The link exposes that folder's contents through Foundry and is not a read-only
mount. Foundry file permissions and other modules still apply. This module's
picker disables uploads, but that does not make the source read-only elsewhere.

If the drive is unplugged or the folder moves, browsing fails. Reconnect the
drive or restore the original folder location. To change the source, make a
new connection with a different name, then remove the old shortcut. Existing
maps still reference the old connection; keep it available until their image
paths have been updated. Removing a server link must remove the link itself,
not its target folder. No source folder deletion is performed by this module.

## Hosted Foundry

The paths must exist on the host, not on a player's laptop. Use your host's
upload or storage integration, then **Choose a folder**. If the host does not
allow server folder links, the local connection command cannot help. Foundry's
native chooser also supports its configured S3 storage; saved shortcuts retain
the selected bucket.

## Support boundaries

Folder linking is not synchronization, a recursive image index, or an upload
service. Use subfolders for large collections. Local Mac folder linking is
exercised in the installed application. Linux commands are shell-tested;
Windows command generation is tested, but Windows execution is not yet verified.
