# GitHub Release Walkthrough For Forge

## What a GitHub Release Is

A GitHub Release is:

- a named version on GitHub
- usually attached to a git tag like `v0.5.24`
- a page where people can download built files such as installers

For Forge, the important idea is:

- the repo contains the source code
- the GitHub Release contains the Windows installer files

Most testers should use the Release, not the source code.

## Recommended First Release Model

For this repo, use this simple model:

1. Make sure the code you want to share is committed and pushed to `main`.
2. Run `release.bat` locally.
3. Find the generated installer files.
4. Create a GitHub Release in the browser.
5. Upload the installer files to that Release.
6. Send testers the Release page link.

## Before You Create A Release

Do this first:

1. Confirm the repo is pushed to GitHub.
2. Confirm the app version is the one you want to share.
3. Build locally with `release.bat`.
4. Install the built app yourself once before sharing it.

For Forge, `release.bat` does two important things:

- bumps the version
- builds reinstallable desktop artifacts

## Where Forge Release Files Should Be

Per the current project notes, the Tauri build artifacts are expected under:

- `~/.forge-build/target/release/bundle/nsis/`
- `~/.forge-build/target/release/bundle/msi/`

The exact filenames should include the app name and version.

For a small batch, the NSIS installer is usually the main thing to upload.
You can also upload the MSI if you want a second Windows installer option.

## Exact GitHub Website Flow

Once the build is done:

1. Open the repo on GitHub:
- `https://github.com/usersteen/forge-v2`

2. Click the `Releases` section on the right side of the repo page.

3. Click `Draft a new release`.

4. In `Choose a tag`, create a new tag.
- Use the app version, for example: `v0.5.24`

5. In `Release title`, use the same version or a readable label.
- Example: `Forge v0.5.24`

6. In the description, write short release notes.
- what Forge is
- who this release is for
- what changed
- known limitations

7. Drag the installer files into the asset upload area.

8. If this is a test release, you can mark it as a pre-release.
- This is a good idea for early external testers.

9. Click `Publish release`.

## Good First Release Notes

Keep the first release notes practical.

Suggested shape:

- Forge is an early Windows preview for managing multiple AI coding terminals
- install using the attached Windows installer
- current focus is repo binding, terminal attention routing, and day-to-day stability
- known limitations: Windows-first, early UX, not yet hardened for broad public use
- feedback requested: install issues, first-run confusion, crashes, repo binding problems

## What Testers Actually Need

For the first batch, testers only need:

- the Release page link
- one sentence on what Forge is
- one sentence on how to install it
- one sentence on what feedback you want

They should not need:

- Rust
- Node
- Visual Studio
- source build steps

## Recommended Order For Your First Public Share

1. Add a `README.md`.
2. Build a release with `release.bat`.
3. Test the installer yourself.
4. Draft a GitHub Release and upload the installer.
5. Mark it as a pre-release.
6. Share that Release URL with 3-5 testers.

## Important Distinction

These are different things:

- making the repo public
- creating a GitHub Release

You can do either one first, but for external testers the Release matters more than the repo.

If people are not expected to read code or build from source, the Release page is the real delivery surface.

## Minimal First Release Checklist

- code committed
- code pushed
- version confirmed
- installer built
- installer tested once
- release drafted
- assets uploaded
- pre-release checked
- published

## What I Recommend Next

The cleanest next sequence is:

1. create `README.md`
2. run one release-candidate build
3. create your first GitHub pre-release

After that, the repo is in a much better state for sharing.
