# Kakehashi Web Port Plan

## Architecture

- Mobile: Expo app in `apps/mobile`
- Web: Next.js app in `apps/web`
- Shared logic: platform-agnostic TypeScript in `packages/core`

## Feature Matrix

| Feature | Mobile | Web foundation | Later web |
|---|---|---|---|
| Reviews | Native screen | Route shell + shared types/helpers | Full desktop review session |
| Lessons | Native screen | Route shell + shared types/helpers | Full desktop lesson session |
| Search | Native modal/screens | Text search shell | Full search with shared ranking |
| WaniKani auth | SecureStore token | Browser-local token validation | Optional server session if needed |
| OCR | Vision Camera / ML Kit | Paste text only | Image upload OCR |
| Audio | Expo/native media | Disabled or basic browser audio | HTML audio/web player |
| Apple Music | Native integration | Disabled | Web provider integration if feasible |
| Notifications | Expo notifications | Disabled | Browser notifications |
| Widgets | iOS widgets | N/A | N/A |
| IAP | Expo IAP | N/A | Stripe/other web billing only if needed |
| Haptics | Expo haptics | N/A | N/A |
| Speech recognition | Native/browser-dependent | Disabled | Browser Speech API if useful |

## Core Extraction Rules

`packages/core` may contain:
- types
- pure utilities
- WaniKani API types/client code if fetch-based and platform-neutral
- review/lesson/search logic
- Japanese text logic
- schemas and pure helpers

`packages/core` must not contain:
- Expo
- React Native
- Next.js
- native storage
- native camera/OCR
- native notifications/widgets/IAP/media
- app screens/components
