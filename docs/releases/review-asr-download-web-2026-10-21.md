# Review-screen speech model download — October 21, 2026

## Current release: October 21, 2026 — review-screen speech download

Production is **`dpl_56arhXzJqpYiTjZ1uc7GZGUosDd8`**, at https://kakehashi-2quttjpnv-portego-00s-projects.vercel.app, promoted to https://kakehashiapp.com. When the on-device ASR model is missing, the shared review control now offers **Download and enable · 241 MB** directly in the review screen. It shows progress, supports cancellation and retry, preserves the current answer, and saves the voice-answer preference when complete. The control then becomes **Start voice answers**; downloading alone does not start the microphone. The existing Portego-only, non-demo gate and on-device recognition remain in place.

The complete **1,240-file** source snapshot is `/Volumes/XcodeBuildCache/ProjectArtifacts/2026-10-21/Kakehashi/review-asr-inline-download-prod/upload`. It preserves the verified previous production source and changes only the shared voice control, its unit tests, and its browser test. Build, typecheck, and targeted lint passed. **62 speech tests**, **11 local browser checks**, **11 hosted checks**, and **10 live desktop/mobile checks** passed. The real-model browser scenario now downloads from the review screen, checks draft preservation and saved enablement, then verifies automatic Japanese and English voice submission. All uploaded source hashes were verified before promotion; temporary staging credentials were removed afterward.

The immediate rollback is **`dpl_762x3KnqTQQPiCn5sLi3KstQLZpN`**, with source in `/Volumes/XcodeBuildCache/ProjectArtifacts/2026-10-21/Kakehashi/review-handsfree-asr-prod/upload`. No environment changes, database migrations, native release, Git commit, or Git push were performed.
