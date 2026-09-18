# Image folder verification — 2026-09-18

Design guidance used: frontend-design-pack:frontend-build 1.3.7
Target worktree/branch: standalone familiar-vtt-interface / main
Verified surface target: installed Foundry 13.351; isolated browser GM test campaign
Operator-fit quick check: native dialogs, flat folder rows, map stays dominant when closed
Gate evidence: empty/saved states, real image selection, copy/setup validation, missing-folder error, removal, native reload, source tests and design lint

## Checked

- Installed application: Scenes exposes Image folders; native folder picker saves a world shortcut.
- Actual large collection: image thumbnails load; search narrows the collection; selecting an image opens native scene creation with its name populated. Cancel leaves the campaign unchanged.
- Installed application: external-folder guide generates a correctly quoted Mac command. Copy reports success. Check connection verifies server access before saving.
- Isolated browser campaign: Browse all images selects a fixture. Confirming Create Scene and Save Changes produces a scene with the chosen background image and Show in Navigation off; the player-active scene is unchanged.
- Isolated campaign: unavailable connection produces a visible error and does not save a shortcut. Removing a shortcut returns to the empty state.
- Shell test: paths containing spaces, apostrophes and shell metacharacters are handled literally. Existing connections are refused rather than overwritten.
- Final installed-app reload retains both collection shortcuts. Full-width connection fields fit the native window; Escape dismisses the guide.
- Source tests cover non-GM access, invalid paths, source/bucket identity, package contents and the existing interface workflows.
- 18 JavaScript tests and 3 packaging tests pass; full design lint and whitespace checks pass.

## Limits

Windows command generation is tested but execution needs a Windows host. Remote-host and S3 browsing depend on the host's native Foundry configuration. This module does not provide cloud synchronization or a recursive asset index. External connections expose a server folder; they are not read-only mounts.

The 0.3.0 source and local package are ready for review. The published 0.2.1 release is unchanged pending approval of this new interface.
