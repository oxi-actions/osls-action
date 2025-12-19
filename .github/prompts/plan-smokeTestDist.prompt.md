---
description: Plan + implement stronger `dist/` smoke test for `osls-action`.
---

## Goal

Strengthen the `dist/` smoke test by exercising the *real* bundled `osls` CLI against the included Serverless fixture (`print` + `package`), while keeping the existing wrapper-creation check intact.

## Constraints

- Keep changes minimal and focused on `scripts/smoke-test-dist.mjs`.
- Preserve the existing “wrapper creation” validation (running `dist/index.*` in a temp `@actions/*` runtime, asserting `tmp/bin/osls` exists and works).
- Add a second phase that runs the real `dist/osls_bundle.*` + extracted `dist/osls_node_modules.tgz` (matching the composite action layout).
- Ensure determinism: delete `scripts/sls-integration-tests/.serverless` before running `package`.
- Zip-content validation must be conditional:
  - If `unzip` exists on PATH, validate zip contents.
  - If `unzip` is missing, skip zip inspection without failing.
- No Windows-specific branching is needed for this smoke-test script.

## Required behavior to implement

1. Keep the current wrapper creation validation in `scripts/smoke-test-dist.mjs`.
2. Add a “real bundle” phase:
	- Create a temp `bin/` directory.
	- Copy `dist/osls_bundle.*` into it.
	- Extract `dist/osls_node_modules.tgz` into that same `bin/` directory (so `bin/node_modules` exists).
3. Run the fixture `print` step:
	- Execute `node <tmp>/bin/osls_bundle.* print`.
	- Use `cwd = scripts/sls-integration-tests`.
	- Assert output contains key substrings like `service:`, `provider:`, and `functions:`.
4. Before `package`, delete `scripts/sls-integration-tests/.serverless` if it exists (recursive + force).
5. Run the fixture `package` step:
	- Execute `node <tmp>/bin/osls_bundle.* package` with the same fixture `cwd`.
6. Assert `package` outputs:
	- The fixture `.serverless/` folder exists.
	- It contains the expected files documented in `scripts/sls-integration-tests/README.md`.
7. Conditionally validate zip contents:
	- If `unzip` exists, run `unzip -l` for the produced zip(s) and assert only `handler.js` is included.
	- Otherwise, skip this validation.

## Success criteria

- `npm run build` then `npm run test:dist` passes locally.
- The smoke test fails with clear error messages when:
  - `dist/` artifacts are missing,
  - `print`/`package` fails,
  - expected `.serverless` files are missing,
  - zip contents are unexpected (when `unzip` is available).

## Output format

- First: provide a short, ordered plan (suitable to translate into a TODO list).
- Then: implement the changes.
- Finally: run `npm run test:dist` (and include output/error details if it fails).
