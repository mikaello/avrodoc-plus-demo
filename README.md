# avrodoc-plus-demo

A stress-test and validation demo for [`@mikaello/avrodoc-plus`](https://github.com/mikaello/avrodoc-plus) — a documentation tool for Apache Avro schemas.

🌐 **Live docs:** https://mikaello.github.io/avrodoc-plus-demo/

---

## What's in here

- **497 generated Avro schemas** covering every feature of the [Avro 1.12.1 specification](https://avro.apache.org/docs/++version++/specification/)
- A Node.js generator script (`scripts/generate-schemas.js`) with no external dependencies
- GitHub Actions CI/CD:
  - Pushes to `main` → published to GitHub Pages
  - Pull requests → preview site deployed to `https://mikaello.github.io/avrodoc-plus-demo/pr-<N>/`

## Schema categories

| Category        | Files | Spec features covered |
|-----------------|-------|-----------------------|
| `primitives/`   | 27    | All 8 primitive types, standalone and as record fields, all field `order` values |
| `records/`      | 77    | All field attributes (doc, aliases, order, default), error type, self-referential, deeply nested, large (50 fields), domain records, namespace inheritance |
| `enums/`        | 69    | name, namespace, doc, aliases, symbols, default symbol |
| `arrays/`       | 32    | Items of all types, nested arrays, arrays of unions/records/maps |
| `maps/`         | 32    | Values of all types, nested maps, maps of unions/records/arrays |
| `unions/`       | 59    | Nullable, multi-type, named-type unions, union field defaults, edge cases |
| `fixed/`        | 59    | Various sizes, namespace, aliases, crypto/ID/geo use-cases |
| `logical-types/`| 48    | All 15 Avro 1.12.1 logical types incl. `timestamp-nanos`, `local-timestamp-*`, `big-decimal` |
| `names/`        | 31    | Fullname resolution, namespace inheritance, null namespace, valid name patterns |
| `aliases/`      | 20    | Type and field aliases, cross-namespace, schema evolution |
| `complex/`      | 43    | Cross-schema references, polymorphic events, self-referential, spec examples, Kafka-style events |

## Running locally

```bash
# Install dependencies (just avrodoc-plus)
npm install

# Generate all schemas
npm run generate

# Build the HTML documentation
npm run build

# Or do both in one step
npm run generate:build

# The output is dist/index.html — open it in any browser
```

## GitHub Actions setup

Two workflows are included:

### `deploy.yml` — Publish to GitHub Pages
Triggers on every push to `main`. Generates schemas, builds the HTML, and deploys to GitHub Pages using the official `actions/deploy-pages` action.

**One-time setup required:** Enable GitHub Pages in the repository settings:
- Go to **Settings → Pages**
- Set **Source** to **GitHub Actions**

### `preview.yml` — PR previews
On every PR push, builds the docs and deploys them to the `gh-pages` branch under `pr-<number>/`. Posts (or updates) a comment on the PR with the preview link. Cleans up the subdirectory when the PR is closed.

> **Note:** The main site (deployed by `deploy.yml`) and PR previews (deployed by `preview.yml`) coexist in the `gh-pages` branch — the main site at the root, previews under `pr-<N>/` subdirectories.

## Avro spec reference

All schemas are valid per the [Apache Avro 1.12.1 specification](https://avro.apache.org/docs/++version++/specification/).

Notable 1.12.x additions covered:
- `timestamp-nanos` logical type
- `local-timestamp-nanos` logical type
- `big-decimal` logical type (C++, Java, Rust)

