#!/usr/bin/env node
/**
 * validate-schemas.js
 *
 * Validates all .avsc files in the schemas/ directory using avro-js (the
 * official Apache Avro JavaScript implementation, version matching Avro 1.12.1).
 *
 * Each schema is parsed using a shared registry so that cross-file type
 * references (e.g. a record referencing an enum defined in another file) are
 * resolved correctly — exactly as avrodoc-plus processes them.
 *
 * A retry loop handles load-order dependencies: if a schema references a named
 * type not yet registered, it is queued for a second attempt after all other
 * schemas have been processed.
 *
 * Exit code 0 = all schemas valid.
 * Exit code 1 = one or more schemas failed validation.
 */

'use strict';

const avro = require('avro-js');
const fs   = require('fs');
const path = require('path');

const SCHEMAS_DIR = path.join(__dirname, '..', 'schemas');

// Avro primitive type names — valid as standalone string schemas per spec §Primitive Types.
// avro-js 1.12.1 has a known bug parsing the bare string 'null', so we validate
// all primitive strings directly instead of delegating to avro.parse().
const PRIMITIVE_NAMES = new Set(
  ['null', 'boolean', 'int', 'long', 'float', 'double', 'bytes', 'string']
);

// ── Collect all .avsc files ────────────────────────────────────────────────

function collectFiles(dir) {
  const results = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) results.push(...collectFiles(full));
    else if (entry.name.endsWith('.avsc')) results.push(full);
  }
  return results.sort();
}

const files = collectFiles(SCHEMAS_DIR);
console.log(`Found ${files.length} .avsc files in ${SCHEMAS_DIR}\n`);

// ── Read and pre-parse JSON ────────────────────────────────────────────────

const items = []; // { file, rel, schema } or { file, rel, error }

for (const file of files) {
  const rel = path.relative(process.cwd(), file);
  let raw;
  try {
    raw = fs.readFileSync(file, 'utf8');
  } catch (err) {
    items.push({ file, rel, error: `Cannot read file: ${err.message}` });
    continue;
  }
  try {
    items.push({ file, rel, schema: JSON.parse(raw) });
  } catch (err) {
    items.push({ file, rel, error: `Invalid JSON: ${err.message}` });
  }
}

// ── Validate with shared registry and retry loop ───────────────────────────
//
// Some schemas reference named types defined in other files.  We process
// them in alphabetical order and retry any that fail due to an unresolved
// type reference.  We repeat until no further progress is made.

const registry = {};
const readErrors  = items.filter(i => i.error);  // JSON / IO failures (terminal)
let   pending     = items.filter(i => !i.error);  // schemas to validate
const passed      = [];
const failed      = [];

let progress = true;
while (progress && pending.length > 0) {
  progress = false;
  const nextRound = [];

  for (const item of pending) {
    const { rel, schema } = item;

    // Primitive type name strings are always valid per spec and avoid an
    // avro-js 1.12.1 bug with the bare string 'null'.
    if (typeof schema === 'string' && PRIMITIVE_NAMES.has(schema)) {
      passed.push(rel);
      progress = true;
      continue;
    }

    // Snapshot registry before each attempt so a failed parse cannot leave
    // partial named-type registrations that corrupt subsequent retries.
    const snapshot = { ...registry };

    try {
      avro.parse(schema, { registry });
      passed.push(rel);
      progress = true;
    } catch (err) {
      // Restore registry to pre-attempt state
      for (const key of Object.keys(registry)) delete registry[key];
      Object.assign(registry, snapshot);
      // Might be a forward-reference that resolves in a later round
      nextRound.push({ ...item, lastError: err.message });
    }
  }

  pending = nextRound;
}

// Anything still pending after no more progress is a genuine failure
for (const item of pending) {
  failed.push({ file: item.rel, error: item.lastError });
}
for (const item of readErrors) {
  failed.push({ file: item.rel, error: item.error });
}

// ── Report ─────────────────────────────────────────────────────────────────

const total = passed.length + failed.length;

if (failed.length) {
  console.error('❌ Validation errors:\n');
  for (const { file, error } of failed) {
    console.error(`  ${file}\n     ${error}\n`);
  }
}

if (failed.length === 0) {
  console.log(`✅ All ${total} schemas valid (avro-js ${require('avro-js/package.json').version})`);
} else {
  console.error(`❌ ${failed.length} / ${total} schemas failed, ${passed.length} passed`);
  process.exit(1);
}
