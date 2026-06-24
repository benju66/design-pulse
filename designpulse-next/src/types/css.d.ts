// Ambient declaration for global CSS side-effect imports (e.g. `import "./globals.css"`).
//
// Next.js normally supplies this through the generated `next-env.d.ts`
// (`/// <reference types="next" />`), but that file is gitignored and is only
// created by `next dev` / `next build`. CI runs `tsc --noEmit` on a clean checkout
// without it, so the side-effect CSS import has no type declaration and fails with
// TS2882. This committed declaration makes the typecheck self-sufficient in CI while
// remaining compatible with Next's own types locally.
declare module '*.css';
