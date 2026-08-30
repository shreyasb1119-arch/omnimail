# Shreyas Mail Pro

Build an ultra-sleek, modern, Apple-esque web email client named "Shreyas Mail" powered by the Google Gmail API and Google Identity Services.

Authentication & Session Persistence:

Implement Google OAuth 2.0 with offline access (access_type: 'offline', prompt: 'consent').

Save access tokens, refresh tokens, and user profile data securely in localStorage.

On app load or tab reload, automatically check localStorage and silently restore/refresh the session so the user stays logged in indefinitely without seeing repetitive sign-in prompts.

AI Features:

AI Email Writer & Assistant: An inline AI assistant inside the compose window that generates full email drafts, improves tone (Professional, Casual, Cold Email outreach), and auto-completes sentences.

AI Inbox Smart Triage: An AI button to automatically scan incoming emails and mark/categorize them into High Importance, Low Priority, or Cold Outreach.

AI Spam Cleanout: A one-click "AI Auto-Purge" button that detects promotional clutter and cold outreach spam, automatically moving them to the Trash.

Trash & Bulk Management:

Add an "Empty Trash Now" button at the top of the Trash view that permanently purges all trashed items in a single click with confirmation.

Full bulk selection support (Select All, Delete All, Archive All).

UI Design & Aesthetic (Apple-Esque / Modern):

Clean, minimal, high-end Apple-esque aesthetics (smooth rounded corners, subtle translucent glassmorphism, crisp typography, intuitive micro-interactions).

Floating Command Palette: Pressing Cmd + K or Ctrl + K opens a centered, floating Spotlight-style search modal with a heavy glass backdrop blur.

Insane Customizability: Built-in settings drawer allowing users to switch themes (Superhuman Dark, Nordic Light, OLED Midnight, Cyberpunk Glass, Forest Green, Ocean Blue), set custom wallpaper background image URLs or uploaded files with opacity and blur sliders, and adjust panel transparency.

Responsive layout with keyboard shortcuts (J/K navigation, C compose, E archive, # delete, S star, / search).

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://omnimail.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/3d7524f8-4668-4f97-80cb-eb2c8c37a77d).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
