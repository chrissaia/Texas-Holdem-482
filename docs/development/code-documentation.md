# Code documentation conventions

Source files describe their responsibility in a module header. Python uses module, class and function docstrings; TypeScript uses block/JSDoc descriptions for components, helpers, classes and callbacks. Existing detailed explanations remain authoritative. CSS headers identify the styling scope, and shell/Docker/configuration files use their supported comment syntax.

Descriptions explain intent, input validation, state changes or observable results. Keep them current when behavior changes. API contracts, permissions, atomicity and privacy details belong in the relevant feature guide and `contracts.md` as well as near the code that enforces them. Test descriptions identify the scenario rather than claiming instructor acceptance.

## Files that need different treatment

- JSON manifests, TypeScript configuration and lockfiles must remain valid for their consumers. They do not receive unsupported JSON comments. `frontend/package.json` defines scripts/dependencies; the `tsconfig*.json` files define compiler projects; `.oxlintrc.json` configures linting; `.mcp.json` configures tools. Lockfiles record dependency resolution.
- Applied Django migrations are generated historical schema operations. Their original generated headers and operation declarations remain intact; this documentation pass does not rewrite applied migrations.
- Coverage JSON/XML, evidence manifests, screenshots and historical branch snapshots are measured artifacts. Do not modify them merely to add prose; their scope and provenance are explained in `quality/README.md` and adjacent guides.
- SVGs, images, PDFs, fonts and the user-story workbook are assets, not source modules. Their use is described by the importing modules and feature guides.
- Markdown files already use document headings. Licenses retain their original terms; environment examples contain explanatory comments without real credentials.

## Verification

For this documentation pass, compare Python syntax trees after removing docstrings, and TypeScript syntax trees after excluding comments and source locations. These checks must show the same executable structure. Run the frontend build, lint and tests, and Django checks after editing. These checks establish a documentation-only change; they do not replace a new coverage run for a later functional release.
