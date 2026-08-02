# Task Tracking — Chat History Buffer Surgical Build

- [x] Add `ChatMessage` model to `schema.prisma`.
- [x] Run `npx prisma generate` and `npx prisma db push`.
- [x] Implement 6-message rolling buffer in `processTelegramMessageWithLLM`.
- [x] Map role schema (`model` for Gemini native, `assistant` for Groq).
- [x] Implement non-blocking background saves to `ChatMessage`.
- [x] Pass `chatId` from `route.ts`.
