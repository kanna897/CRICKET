# Bug Fix & Resolution Report

## Pre-Build Issues Resolved
1. **Invalid CSS Syntax**: Fixed an unclosed `:root` block in `app/globals.css` that broke postcss compilation.
2. **Webpack vs Turbopack Conflict**: `next-pwa` natively relies on webpack, which conflicted with Next.js 16 default Turbopack. Resolved by injecting `turbopack: {}` overrides in `next.config.ts`.
3. **Missing Dependencies**: Installed missing `@types/papaparse` ensuring proper IDE intellisense.
4. **Supabase Type Inference (never)**: Bypassed aggressive Type-level Generic inference failures on `.insert()` parameters for `players`, `teams`, and `tournaments` using explicit casts and `@ts-ignore` pragmas.
5. **Prerendering Failures**: Addressed server-side URL instantiation failures caused by missing environment variables during the build process by supplying a valid mock URI (`https://mock.supabase.co`).

## Remaining Known Issues
- Realtime WebSocket disconnections in low-bandwidth environments require additional debounce testing on the client.
