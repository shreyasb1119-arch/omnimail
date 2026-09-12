# Where to see your saved settings, and one thing worth fixing

## Where to look

In Lovable, open the **Cloud** view (desktop: the Cloud icon in the row of view icons above the preview, or Cmd+K and type "Cloud"; mobile: the "..." menu at the bottom right -> Cloud). Inside:

- **Database** -> the `user_settings` table: one row per signed-in person, holding their email, their saved preferences, and when they last synced.
- **Users** -> who has signed in, plus sign-in method settings.
- **Secrets** -> the keys the app uses on the server.

## What I found in your data right now

Three people have synced settings:

| Email | Last synced | Size of saved settings |
| --- | --- | --- |
| shreyasb1119@gmail.com | Sep 12, 2026 | about 5 MB |
| joyonline1986@gmail.com | Aug 15, 2026 | about 0.5 KB |
| soumi.1911@gmail.com | Aug 15, 2026 | about 0.5 KB |

Your own row is roughly **10,000 times larger** than the others. Almost certainly a custom wallpaper image is being saved inside the settings themselves rather than referenced. That makes every sync slow, and it sits above the 256 KB limit added during the recent hardening pass, so new saves from that account are likely being rejected.

## Proposed fix

1. Confirm what is taking the space by inspecting which setting holds the bulk of that row.
2. Stop saving uploaded wallpaper images inside the synced settings. Keep the picture on the device it was uploaded on, and sync only the choice of wallpaper (preset name, blur, brightness) so a phone and a laptop still match on everything that matters.
3. Shrink the existing oversized row so syncing works again for that account, without losing any real preferences.
4. Show a short, clear message if someone's settings ever exceed the sync limit, instead of a silent failure.

## Technical notes

- `settings` is a single `jsonb` blob written by `pushSettings` in `src/lib/sync.functions.ts`, already capped at `MAX_SETTINGS_BYTES = 256 * 1024`.
- Add a key-level exclusion for base64/data-URL wallpaper fields alongside the existing `DENY_KEYS` credential filter, so image payloads never enter the blob.
- Clean the existing 5 MB row with a targeted update that strips only the image keys, preserving the rest.
- No schema change or new table required; row-level security stays exactly as it is.
