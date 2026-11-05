import { defineConfig } from 'vitest/config';

// Explicit opt-in: real Gemini HTTP, in-memory database fixture, no Supabase
// requests or business records. The normal suite skips the paid provider case.
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/fets-ai/handler.test.ts'],
    setupFiles: [],
  },
});
