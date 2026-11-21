# Neon Tower — CrazyGames Basic Launch build

This branch is an isolated CrazyGames adaptation of the game.

## Isolation rule

- Branch: `crazygames-basic`
- The published GitHub Pages game remains on `main`.
- Do not merge this branch into `main` as part of CrazyGames preparation.
- Do not change GitHub Pages settings or the live site's deployment source.
- Create any CrazyGames upload from this branch only.
- No code or assets in this branch are deployed to the existing site by this work.

## Changes in this branch

- Removed the manual device chooser; device layout is selected from CrazyGames System Info, with a responsive fallback for local preview.
- Removed GoatCounter and the Supabase CDN script from this build.
- Removed email/password account, public-profile and third-party leaderboard screens. The game is playable by guests and has no external sign-in options.
- Added a branch-only storage adapter. It routes existing save keys through the CrazyGames SDK Data module when the SDK is enabled, and falls back to browser storage outside CrazyGames.
- Added CrazyGames SDK v3 initialization before game scripts are loaded.
- Added gameplay start/stop events for runs, resumes, milestone pauses and game-over.
- Applied CrazyGames `muteAudio` settings with priority over the in-game sound toggle.
- Removed service-worker registration from this build.
- No advertising calls are included; Basic Launch does not allow external ads and CrazyGames monetization is disabled.

## Submission settings and requirements

- Upload and test this build in the CrazyGames Developer Portal Preview tool.
- If using the SDK Data module, enable the matching **Progress Save** option in the submission flow. The Data module has a 1 MB save-data limit and debounces writes (normally 1 second, sometimes up to 30 seconds).
- Keep players able to play as guests. Do not expose email, Google, Facebook or other external sign-in flows.
- Configure supported orientations to match the game: desktop landscape and mobile portrait. Verify the actual submission settings.
- Do not add an in-game fullscreen button. CrazyGames supplies fullscreen.
- Do not add external advertisements or cross-promotion to other playable sites/platforms.
- Ensure the game is PEGI 12 compliant.
- Check readability and gameplay at the required iframe sizes, including 907x510 desktop and 800x450 mobile.
- Keep initial download size at or below 50 MB; 20 MB is needed for mobile-homepage eligibility. Total size must stay at or below 250 MB, with at most 1,500 files.
- Keep bundled file references relative. The SDK is loaded from CrazyGames' CDN; the current stylesheet also imports Orbitron from Google Fonts. Verify external-resource load time and fallback behaviour in Preview.
- Preview and QA are still required. Code changes alone do not prove CrazyGames approval.

## Full Launch work (not included yet)

Only implement these after CrazyGames invites the game to Full Launch:

- CrazyGames account integration using the User module, automatic sign-in and CrazyGames profile identity.
- Full progress-save verification and any required migration.
- CrazyGames ad integration for midgame/rewarded ads, following ad rules and correctly pausing the game.
- Any CrazyGames leaderboard integration selected for the full version.
- Final full QA, including AdBlock, account changes and cross-device data sync.

## Pre-submission checklist

- [ ] Load the build in CrazyGames Preview and verify SDK environment is `crazygames`.
- [ ] Check the browser console for runtime errors.
- [ ] Test first-time gameplay, Infinite Mode and Level Mode.
- [ ] Test new run, interrupted-wave resume, game-over and level completion.
- [ ] Test save persistence across reloads and CrazyGames guest/account state.
- [ ] Test mobile portrait and desktop landscape, including safe areas.
- [ ] Test readability at documented iframe sizes and DPR 1.
- [ ] Test performance on a 4 GB Chromebook and high-refresh-rate displays.
- [ ] Test audio mute settings and browser audio restrictions.
- [ ] Prepare 3 cover images and 2 silent preview videos to CrazyGames specifications.
- [ ] Confirm no external login, advertising or cross-promotion remains.
- [ ] Have a parent/guardian help review Developer Portal terms and any identity, tax or payment steps before submission.

## Important

This is the **Basic Launch preparation branch**, not a submitted or approved CrazyGames game. Do not claim approval or monetization until CrazyGames has reviewed the upload and explicitly advanced it.
