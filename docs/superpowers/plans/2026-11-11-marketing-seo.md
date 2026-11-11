# Marketing SEO and AI Discovery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Make public Aatmyam content discoverable while preserving the existing design and private app.
**Architecture:** Shared pure SEO catalog; build-time React rendering of existing public components; Express serves generated documents and a separate private shell. Client metadata stays synchronized with navigation.
**Tech Stack:** Existing React19, Vite6, Express4, TypeScript and Vitest; no added dependencies.
**Spec:** docs/superpowers/specs/2026-11-11-marketing-seo-design.md

## Global Constraints
- Origin https://aatmyam-marketing-preview.onrender.com; no deployment or database changes.
- Preserve visual styling/layout and auth flows. No ranking/citation promises or invented reviews.
- Existing isolated checkout; do not create a worktree.

## Review Focus
- Encoded/unknown/private query URLs must not leak an indexable public document.
- Build output and HTTP metadata agree with client navigation and cache revalidation.
- Direct links, modifier clicks, browser Back/Forward and legal/app transitions remain usable.
- SSR cannot read browser state, session data, localStorage or backend configuration.
- Sitemap, structured data and AI summary contain accurate public URLs only.

## Tasks
1. Public rendering and links: tests first for browser-free rendering and href navigation, then SSR-safe routing and shared SiteLink preserving current styles. Verify targeted tests and screenshots.
2. SEO documents: tests first for distinct metadata, canonical/noindex/query behavior and truthful schema; implement pure shared catalog, client metadata updates and build renderer. Build and assert generated HTML/content/resources without JavaScript.
3. HTTP and validation: regression tests for generated public pages, private shell,404/HEAD, caching and crawler files; implement static routing, retain cache validators and API boundaries. Run full lint/test/build and desktop/mobile regressions. Document Search Console/AI limitations, review once, fix important findings, commit/push feature branch and prepare PR against integration/aatmyam-v1.

Progress: user approved implementation and current hostname. Native execution; independent final reviewer. No additional approval/deployment implied.

## Completion evidence
- [x] Public-only browser-free rendering and crawlable links.
- [x] Unique metadata, noindex/private-view handling and generated discovery documents.
- [x] Real static404/HEAD, canonical aliases and cache behavior.
- [x] Lint, build and562 tests pass (original511 plus51 regressions).
- [x] Eleven real public pages work without JavaScript;22 desktop/mobile before/after cases have identical text/dimensions. Twenty-one screenshot pairs are pixel-identical; mobile About differs by29 pixels (0.0019%), without layout/text changes.
- [x] Independent review: four important indexing/navigation edge cases fixed with seven red-to-green regressions; minor double-slash normalization also corrected. Final private-session and query-only navigation browser checks pass with no page exceptions. No deferred findings.

Ruling: preserve the existing private SPA and public component design; render public content at build time rather than introducing runtime server rendering or changing authentication. No external ranking, Search Console submission, AI citations or deployment is claimed by this PR.
