#!/usr/bin/env node
/**
 * generate-schemas.js
 *
 * Generates ~500 valid Avro .avsc files covering the full Avro 1.12.1 specification.
 * Reference: https://avro.apache.org/docs/++version++/specification/
 *
 * Each file contains one top-level schema as JSON.
 * Named types use unique namespaced fullnames to avoid collisions across files.
 */

'use strict';

const fs = require('fs');
const path = require('path');

const OUT = path.join(__dirname, '..', 'schemas');

function mkdir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function write(category, name, schema) {
  const dir = path.join(OUT, category);
  mkdir(dir);
  const file = path.join(dir, `${name}.avsc`);
  fs.writeFileSync(file, JSON.stringify(schema, null, 2) + '\n');
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. PRIMITIVES (~30 files)
// Spec §Primitive Types: null, boolean, int, long, float, double, bytes, string
// ─────────────────────────────────────────────────────────────────────────────

const PRIMITIVES = ['null', 'boolean', 'int', 'long', 'float', 'double', 'bytes', 'string'];

// 1a. Standalone primitive schemas (short form)
for (const p of PRIMITIVES) {
  write('primitives', `standalone_${p}`, p);
}

// 1b. Primitive schemas as objects {"type": "..."}
for (const p of PRIMITIVES) {
  write('primitives', `object_${p}`, { type: p });
}

// 1c. Records that wrap a single primitive field — tests all primitive field types
for (const p of PRIMITIVES) {
  const defaultVal = primitiveDefault(p);
  write('primitives', `record_field_${p}`, {
    type: 'record',
    name: `FieldOf${capitalize(p)}`,
    namespace: 'com.example.primitives',
    doc: `A record with a single ${p} field.`,
    fields: [
      { name: 'value', type: p, doc: `The ${p} value.`, default: defaultVal },
    ],
  });
}

function primitiveDefault(p) {
  switch (p) {
    case 'null':    return null;
    case 'boolean': return false;
    case 'int':     return 0;
    case 'long':    return 0;
    case 'float':   return 0.0;
    case 'double':  return 0.0;
    case 'bytes':   return '';
    case 'string':  return '';
    default:        return null;
  }
}

function capitalize(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. RECORDS (~120 files)
// Spec §Records: name, namespace, doc, aliases, fields (name, doc, type, order,
//               aliases, default), error type, self-referential
// ─────────────────────────────────────────────────────────────────────────────

// 2a. Minimal records
write('records', 'minimal_record', {
  type: 'record',
  name: 'MinimalRecord',
  namespace: 'com.example.records',
  fields: [],
});

// 2b. Record with all field-level attributes
write('records', 'full_field_attributes', {
  type: 'record',
  name: 'FullFieldAttributes',
  namespace: 'com.example.records',
  doc: 'Record demonstrating every field attribute from the spec.',
  aliases: ['com.example.records.FullFieldAttributesOld'],
  fields: [
    {
      name: 'ascendingInt',
      type: 'int',
      doc: 'An int field with ascending sort order.',
      order: 'ascending',
      default: 0,
    },
    {
      name: 'descendingLong',
      type: 'long',
      doc: 'A long field with descending sort order.',
      order: 'descending',
      default: 0,
    },
    {
      name: 'ignoredString',
      type: 'string',
      doc: 'A string field ignored in sort order.',
      order: 'ignore',
      aliases: ['oldIgnoredString', 'legacyIgnored'],
      default: '',
    },
  ],
});

// 2c. Error type (spec §Protocol Declaration: error = record with "type":"error")
write('records', 'error_type', {
  type: 'error',
  name: 'ApplicationError',
  namespace: 'com.example.records',
  doc: 'A reusable application error.',
  fields: [
    { name: 'message', type: 'string', doc: 'Human-readable error message.', default: '' },
    { name: 'code',    type: 'int',    doc: 'Numeric error code.', default: 0 },
  ],
});

// 2d. Self-referential schema (LongList — spec example)
write('records', 'self_referential_longlist', {
  type: 'record',
  name: 'LongList',
  namespace: 'com.example.records',
  aliases: ['com.example.records.LinkedLongs'],
  doc: 'A linked list of 64-bit values. Directly from the Avro spec.',
  fields: [
    { name: 'value', type: 'long',                          doc: 'The value at this node.' },
    { name: 'next',  type: ['null', 'com.example.records.LongList'], doc: 'The next node, or null.',  default: null },
  ],
});

// 2e. Self-referential binary tree
write('records', 'self_referential_tree', {
  type: 'record',
  name: 'BinaryTreeNode',
  namespace: 'com.example.records',
  doc: 'A binary tree node.',
  fields: [
    { name: 'value', type: 'string',  doc: 'Node value.' },
    { name: 'left',  type: ['null', 'com.example.records.BinaryTreeNode'], doc: 'Left child.',  default: null },
    { name: 'right', type: ['null', 'com.example.records.BinaryTreeNode'], doc: 'Right child.', default: null },
  ],
});

// 2f. Records with all field default types (spec table)
write('records', 'all_field_defaults', {
  type: 'record',
  name: 'AllFieldDefaults',
  namespace: 'com.example.records',
  doc: 'Tests every field default type from the spec table.',
  fields: [
    { name: 'nullField',    type: 'null',    default: null },
    { name: 'boolField',    type: 'boolean', default: true },
    { name: 'intField',     type: 'int',     default: 42 },
    { name: 'longField',    type: 'long',    default: 9999999 },
    { name: 'floatField',   type: 'float',   default: 1.5 },
    { name: 'doubleField',  type: 'double',  default: 3.14 },
    { name: 'bytesField',   type: 'bytes',   default: '\u00FF' },
    { name: 'stringField',  type: 'string',  default: 'hello' },
    {
      name: 'enumField',
      type: { type: 'enum', name: 'DefaultColor', namespace: 'com.example.records', symbols: ['RED', 'GREEN', 'BLUE'] },
      default: 'RED',
    },
    {
      name: 'arrayField',
      type: { type: 'array', items: 'int' },
      default: [],
    },
    {
      name: 'mapField',
      type: { type: 'map', values: 'string' },
      default: {},
    },
    {
      name: 'fixedField',
      type: { type: 'fixed', name: 'DefaultFixed4', namespace: 'com.example.records', size: 4 },
      default: '\u0000\u0000\u0000\u0000',
    },
    {
      name: 'recordField',
      type: {
        type: 'record',
        name: 'InnerRecord',
        namespace: 'com.example.records',
        fields: [{ name: 'x', type: 'int', default: 0 }],
      },
      default: { x: 1 },
    },
    {
      name: 'unionField',
      type: ['null', 'string'],
      default: null,
    },
  ],
});

// 2g. Records with nested records
write('records', 'nested_records', {
  type: 'record',
  name: 'Address',
  namespace: 'com.example.records',
  doc: 'A postal address.',
  fields: [
    { name: 'street', type: 'string', default: '' },
    { name: 'city',   type: 'string', default: '' },
    { name: 'zip',    type: 'string', default: '' },
  ],
});

write('records', 'nested_record_reference', {
  type: 'record',
  name: 'Person',
  namespace: 'com.example.records',
  doc: 'A person with a nested address.',
  fields: [
    { name: 'firstName', type: 'string', default: '' },
    { name: 'lastName',  type: 'string', default: '' },
    { name: 'age',       type: 'int',    default: 0 },
    {
      name: 'homeAddress',
      type: {
        type: 'record',
        name: 'HomeAddress',
        namespace: 'com.example.records',
        doc: 'Home address of the person.',
        fields: [
          { name: 'street', type: 'string', default: '' },
          { name: 'city',   type: 'string', default: '' },
          { name: 'country',type: 'string', default: 'US' },
        ],
      },
    },
    {
      name: 'workAddress',
      type: ['null', {
        type: 'record',
        name: 'WorkAddress',
        namespace: 'com.example.records',
        doc: 'Optional work address.',
        fields: [
          { name: 'building', type: 'string', default: '' },
          { name: 'street',   type: 'string', default: '' },
          { name: 'city',     type: 'string', default: '' },
        ],
      }],
      default: null,
    },
  ],
});

// 2h. Record with every sort order combination
write('records', 'all_sort_orders', {
  type: 'record',
  name: 'AllSortOrders',
  namespace: 'com.example.records',
  doc: 'Record with ascending, descending, and ignore order fields.',
  fields: [
    { name: 'asc1',  type: 'int',    order: 'ascending',  default: 0 },
    { name: 'desc1', type: 'long',   order: 'descending', default: 0 },
    { name: 'ign1',  type: 'string', order: 'ignore',     default: '' },
    { name: 'asc2',  type: 'double', order: 'ascending',  default: 0.0 },
    { name: 'desc2', type: 'float',  order: 'descending', default: 0.0 },
    { name: 'ign2',  type: 'bytes',  order: 'ignore',     default: '' },
  ],
});

// 2i. Large records (50+ fields each) — 5 of them
for (let r = 1; r <= 5; r++) {
  const fields = [];
  for (let i = 1; i <= 50; i++) {
    const types = ['string', 'int', 'long', 'boolean', 'double', 'float', 'bytes'];
    const t = types[(i - 1) % types.length];
    fields.push({ name: `field${i}`, type: t, doc: `Field number ${i} of type ${t}.`, default: primitiveDefault(t) });
  }
  write('records', `large_record_${String(r).padStart(2, '0')}`, {
    type: 'record',
    name: `LargeRecord${String(r).padStart(2, '0')}`,
    namespace: 'com.example.records',
    doc: `A large record with 50 fields (variant ${r}).`,
    fields,
  });
}

// 2j. Records with aliases
write('records', 'record_with_aliases', {
  type: 'record',
  name: 'RenamedRecord',
  namespace: 'com.example.records',
  doc: 'A record that has been renamed; old names are kept as aliases.',
  aliases: ['com.example.records.OldRecord', 'com.example.legacy.OldRecord'],
  fields: [
    { name: 'id',    type: 'string', aliases: ['uuid', 'identifier'], default: '' },
    { name: 'value', type: 'int',    aliases: ['amount'],             default: 0 },
  ],
});

// 2k. Deeply nested records (5 levels)
write('records', 'deeply_nested_5_levels', {
  type: 'record',
  name: 'Level1',
  namespace: 'com.example.records',
  doc: 'Top level of a 5-level nested record structure.',
  fields: [{
    name: 'l2',
    type: {
      type: 'record',
      name: 'Level2',
      namespace: 'com.example.records',
      fields: [{
        name: 'l3',
        type: {
          type: 'record',
          name: 'Level3',
          namespace: 'com.example.records',
          fields: [{
            name: 'l4',
            type: {
              type: 'record',
              name: 'Level4',
              namespace: 'com.example.records',
              fields: [{
                name: 'l5',
                type: {
                  type: 'record',
                  name: 'Level5',
                  namespace: 'com.example.records',
                  fields: [{ name: 'deepValue', type: 'string', default: '' }],
                },
              }],
            },
          }],
        },
      }],
    },
  }],
});

// 2l. Records with multiple namespaces
const domainRecords = ['User', 'Product', 'Order', 'Invoice', 'Payment',
  'Shipment', 'Review', 'Category', 'Inventory', 'Supplier'];
for (const name of domainRecords) {
  const ns = `com.example.domain.${name.toLowerCase()}`;
  write('records', `domain_${name.toLowerCase()}`, {
    type: 'record',
    name,
    namespace: ns,
    doc: `A ${name} domain record.`,
    fields: [
      { name: 'id',          type: 'string', doc: `Unique ${name} ID.`,          default: '' },
      { name: 'createdAt',   type: 'long',   doc: 'Creation timestamp (epoch ms).', default: 0 },
      { name: 'updatedAt',   type: 'long',   doc: 'Last update timestamp.',         default: 0 },
      { name: 'description', type: ['null', 'string'], doc: 'Optional description.', default: null },
      { name: 'active',      type: 'boolean', doc: 'Whether the record is active.', default: true },
    ],
  });
}

// 2m. Records demonstrating namespace inheritance (spec §Names)
write('records', 'namespace_inheritance', {
  type: 'record',
  name: 'OuterRecord',
  namespace: 'com.example.ns',
  doc: 'Demonstrates namespace inheritance for nested named types.',
  fields: [
    {
      name: 'innerEnum',
      type: {
        type: 'enum',
        name: 'Status',
        // No namespace — inherits com.example.ns → fullname com.example.ns.Status
        doc: 'Status enum inheriting namespace from OuterRecord.',
        symbols: ['ACTIVE', 'INACTIVE', 'PENDING'],
      },
      default: 'ACTIVE',
    },
    {
      name: 'explicitNsFixed',
      type: {
        type: 'fixed',
        name: 'Hash',
        namespace: 'com.example.hashing', // explicit namespace
        size: 32,
      },
    },
    {
      name: 'fullNameRecord',
      type: {
        type: 'record',
        name: 'a.b.InnerRecord', // fullname with dot — namespace attr ignored
        namespace: 'ignored',
        doc: 'Uses a dotted fullname; the namespace attribute is ignored.',
        fields: [
          {
            name: 'inheritedEnum',
            type: {
              type: 'enum',
              name: 'InheritedStatus',
              // No namespace — inherits a.b from InnerRecord → fullname a.b.InheritedStatus
              symbols: ['YES', 'NO'],
            },
            default: 'YES',
          },
        ],
      },
    },
  ],
});

// 2n. Various field combinations: 20 more records
const fieldCombos = [
  { name: 'EventRecord',    ns: 'com.example.events',  fields: [
    { name: 'eventId',   type: 'string',  default: '' },
    { name: 'eventType', type: 'string',  default: '' },
    { name: 'timestamp', type: 'long',    default: 0 },
    { name: 'payload',   type: ['null', 'string'], default: null },
  ]},
  { name: 'MetricRecord',   ns: 'com.example.metrics', fields: [
    { name: 'name',      type: 'string',  default: '' },
    { name: 'value',     type: 'double',  default: 0.0 },
    { name: 'unit',      type: 'string',  default: '' },
    { name: 'timestamp', type: 'long',    default: 0 },
    { name: 'tags',      type: { type: 'map', values: 'string' }, default: {} },
  ]},
  { name: 'LogEntry',       ns: 'com.example.logging', fields: [
    { name: 'level',   type: 'string',  default: 'INFO' },
    { name: 'message', type: 'string',  default: '' },
    { name: 'logger',  type: 'string',  default: '' },
    { name: 'thread',  type: ['null', 'string'], default: null },
    { name: 'ts',      type: 'long',    default: 0 },
  ]},
  { name: 'ConfigEntry',    ns: 'com.example.config',  fields: [
    { name: 'key',       type: 'string',  default: '' },
    { name: 'value',     type: 'string',  default: '' },
    { name: 'encrypted', type: 'boolean', default: false },
  ]},
  { name: 'GeoLocation',    ns: 'com.example.geo',     fields: [
    { name: 'latitude',  type: 'double', default: 0.0 },
    { name: 'longitude', type: 'double', default: 0.0 },
    { name: 'altitude',  type: ['null', 'double'], default: null },
    { name: 'accuracy',  type: ['null', 'float'],  default: null },
  ]},
  { name: 'SearchQuery',    ns: 'com.example.search',  fields: [
    { name: 'query',   type: 'string',  default: '' },
    { name: 'page',    type: 'int',     default: 0 },
    { name: 'size',    type: 'int',     default: 20 },
    { name: 'filters', type: { type: 'map', values: 'string' }, default: {} },
  ]},
  { name: 'AuditLog',       ns: 'com.example.audit',   fields: [
    { name: 'actor',    type: 'string',  default: '' },
    { name: 'action',   type: 'string',  default: '' },
    { name: 'resource', type: 'string',  default: '' },
    { name: 'success',  type: 'boolean', default: true },
    { name: 'ts',       type: 'long',    default: 0 },
    { name: 'details',  type: ['null', 'string'], default: null },
  ]},
  { name: 'FileMetadata',   ns: 'com.example.files',   fields: [
    { name: 'filename',  type: 'string', default: '' },
    { name: 'size',      type: 'long',   default: 0 },
    { name: 'mimeType',  type: 'string', default: '' },
    { name: 'checksum',  type: ['null', 'string'], default: null },
    { name: 'createdAt', type: 'long',   default: 0 },
  ]},
  { name: 'SessionRecord',  ns: 'com.example.sessions',fields: [
    { name: 'sessionId', type: 'string',  default: '' },
    { name: 'userId',    type: 'string',  default: '' },
    { name: 'startedAt', type: 'long',    default: 0 },
    { name: 'expiresAt', type: 'long',    default: 0 },
    { name: 'active',    type: 'boolean', default: true },
  ]},
  { name: 'NotificationRecord', ns: 'com.example.notifications', fields: [
    { name: 'id',        type: 'string',  default: '' },
    { name: 'recipient', type: 'string',  default: '' },
    { name: 'channel',   type: 'string',  default: 'email' },
    { name: 'subject',   type: 'string',  default: '' },
    { name: 'body',      type: 'string',  default: '' },
    { name: 'sentAt',    type: ['null', 'long'], default: null },
  ]},
  { name: 'RateLimitRecord',    ns: 'com.example.ratelimit',     fields: [
    { name: 'clientId',   type: 'string', default: '' },
    { name: 'endpoint',   type: 'string', default: '' },
    { name: 'requests',   type: 'int',    default: 0 },
    { name: 'windowMs',   type: 'long',   default: 60000 },
    { name: 'exceeded',   type: 'boolean',default: false },
  ]},
  { name: 'HealthCheck',        ns: 'com.example.health',        fields: [
    { name: 'service',   type: 'string',  default: '' },
    { name: 'status',    type: 'string',  default: 'UP' },
    { name: 'latencyMs', type: ['null', 'long'],   default: null },
    { name: 'checkedAt', type: 'long',    default: 0 },
  ]},
  { name: 'TokenRecord',        ns: 'com.example.tokens',        fields: [
    { name: 'token',     type: 'string',  default: '' },
    { name: 'type',      type: 'string',  default: 'bearer' },
    { name: 'issuedAt',  type: 'long',    default: 0 },
    { name: 'expiresAt', type: 'long',    default: 0 },
    { name: 'scopes',    type: { type: 'array', items: 'string' }, default: [] },
  ]},
  { name: 'PermissionRecord',   ns: 'com.example.permissions',   fields: [
    { name: 'subject',  type: 'string',  default: '' },
    { name: 'resource', type: 'string',  default: '' },
    { name: 'actions',  type: { type: 'array', items: 'string' }, default: [] },
    { name: 'granted',  type: 'boolean', default: false },
  ]},
  { name: 'PriceRecord',        ns: 'com.example.pricing',       fields: [
    { name: 'currency',  type: 'string',  default: 'USD' },
    { name: 'amount',    type: 'double',  default: 0.0 },
    { name: 'discount',  type: ['null', 'double'], default: null },
    { name: 'taxRate',   type: 'float',   default: 0.0 },
  ]},
  { name: 'TagRecord',          ns: 'com.example.tags',          fields: [
    { name: 'name',      type: 'string',  default: '' },
    { name: 'value',     type: ['null', 'string'], default: null },
    { name: 'system',    type: 'boolean', default: false },
  ]},
  { name: 'CounterRecord',      ns: 'com.example.counters',      fields: [
    { name: 'name',      type: 'string',  default: '' },
    { name: 'count',     type: 'long',    default: 0 },
    { name: 'resetAt',   type: ['null', 'long'], default: null },
  ]},
  { name: 'ErrorDetail',        ns: 'com.example.errors',        fields: [
    { name: 'code',      type: 'string',  default: '' },
    { name: 'message',   type: 'string',  default: '' },
    { name: 'path',      type: ['null', 'string'], default: null },
    { name: 'details',   type: { type: 'map', values: 'string' }, default: {} },
  ]},
  { name: 'FeatureFlag',        ns: 'com.example.flags',         fields: [
    { name: 'key',       type: 'string',  default: '' },
    { name: 'enabled',   type: 'boolean', default: false },
    { name: 'rollout',   type: 'float',   default: 0.0 },
    { name: 'description', type: ['null', 'string'], default: null },
  ]},
  { name: 'BatchRecord',        ns: 'com.example.batch',         fields: [
    { name: 'batchId',   type: 'string',  default: '' },
    { name: 'total',     type: 'int',     default: 0 },
    { name: 'processed', type: 'int',     default: 0 },
    { name: 'failed',    type: 'int',     default: 0 },
    { name: 'startedAt', type: 'long',    default: 0 },
    { name: 'finishedAt',type: ['null', 'long'], default: null },
  ]},
];

for (const r of fieldCombos) {
  write('records', `misc_${r.name.toLowerCase()}`, {
    type: 'record',
    name: r.name,
    namespace: r.ns,
    doc: `${r.name} record.`,
    fields: r.fields,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. ENUMS (~40 files)
// Spec §Enums: name, namespace, aliases, doc, symbols, default
// ─────────────────────────────────────────────────────────────────────────────

const enumDefs = [
  { name: 'CardSuit',         ns: 'com.example.enums', symbols: ['SPADES','HEARTS','DIAMONDS','CLUBS'],       default: 'CLUBS',    doc: 'Playing card suits. Spec example.' },
  { name: 'Direction',        ns: 'com.example.enums', symbols: ['NORTH','SOUTH','EAST','WEST'],              default: 'NORTH',    doc: 'Cardinal directions.' },
  { name: 'DayOfWeek',        ns: 'com.example.enums', symbols: ['MON','TUE','WED','THU','FRI','SAT','SUN'],  default: 'MON',      doc: 'Days of the week.' },
  { name: 'Month',            ns: 'com.example.enums', symbols: ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'], default: 'JAN', doc: 'Months of the year.' },
  { name: 'HttpMethod',       ns: 'com.example.enums', symbols: ['GET','POST','PUT','PATCH','DELETE','HEAD','OPTIONS','TRACE'], default: 'GET', doc: 'HTTP methods.' },
  { name: 'HttpStatus',       ns: 'com.example.http',  symbols: ['OK','CREATED','ACCEPTED','NO_CONTENT','BAD_REQUEST','UNAUTHORIZED','FORBIDDEN','NOT_FOUND','INTERNAL_SERVER_ERROR'], default: 'OK', doc: 'Common HTTP status codes.' },
  { name: 'LogLevel',         ns: 'com.example.enums', symbols: ['TRACE','DEBUG','INFO','WARN','ERROR','FATAL'], default: 'INFO',  doc: 'Logging levels.' },
  { name: 'Environment',      ns: 'com.example.enums', symbols: ['DEV','STAGING','PROD'],                    default: 'DEV',      doc: 'Deployment environments.' },
  { name: 'Currency',         ns: 'com.example.enums', symbols: ['USD','EUR','GBP','JPY','CHF','CAD','AUD'],  default: 'USD',      doc: 'Currency codes.' },
  { name: 'Gender',           ns: 'com.example.enums', symbols: ['MALE','FEMALE','NON_BINARY','UNSPECIFIED'], default: 'UNSPECIFIED', doc: 'Gender options.' },
  { name: 'Priority',         ns: 'com.example.enums', symbols: ['LOW','MEDIUM','HIGH','CRITICAL'],          default: 'MEDIUM',   doc: 'Priority levels.' },
  { name: 'Status',           ns: 'com.example.workflow', symbols: ['PENDING','IN_PROGRESS','DONE','CANCELLED','FAILED'], default: 'PENDING', doc: 'Workflow status.' },
  { name: 'Encoding',         ns: 'com.example.enums', symbols: ['UTF8','UTF16','ASCII','LATIN1'],            default: 'UTF8',     doc: 'Character encodings.' },
  { name: 'Protocol',         ns: 'com.example.net',   symbols: ['HTTP','HTTPS','FTP','SFTP','SMTP','IMAP'], default: 'HTTPS',    doc: 'Network protocols.' },
  { name: 'StorageClass',     ns: 'com.example.storage', symbols: ['STANDARD','REDUCED_REDUNDANCY','GLACIER','DEEP_ARCHIVE'], default: 'STANDARD', doc: 'Storage classes.' },
  { name: 'CompressionCodec', ns: 'com.example.enums', symbols: ['NONE','DEFLATE','SNAPPY','BZIP2','XZ','ZSTANDARD'], default: 'NONE', doc: 'Avro-supported compression codecs.' },
  { name: 'SortOrder',        ns: 'com.example.enums', symbols: ['ASCENDING','DESCENDING','IGNORE'],          default: 'ASCENDING',doc: 'Avro sort orders.' },
  { name: 'DataType',         ns: 'com.example.schema',symbols: ['STRING','INT','LONG','FLOAT','DOUBLE','BOOLEAN','BYTES','NULL'], default: 'STRING', doc: 'Avro primitive type names.' },
  { name: 'Visibility',       ns: 'com.example.enums', symbols: ['PUBLIC','PRIVATE','INTERNAL'],              default: 'PRIVATE',  doc: 'Visibility levels.' },
  { name: 'FileFormat',       ns: 'com.example.enums', symbols: ['AVRO','JSON','CSV','PARQUET','ORC','TSV'],  default: 'AVRO',     doc: 'File formats.' },
  { name: 'NotificationChannel', ns: 'com.example.enums', symbols: ['EMAIL','SMS','PUSH','WEBHOOK'],         default: 'EMAIL',    doc: 'Notification channels.' },
  { name: 'MatchType',        ns: 'com.example.enums', symbols: ['EXACT','PREFIX','SUFFIX','CONTAINS','REGEX'], default: 'EXACT', doc: 'Search match types.' },
  { name: 'AggregationType',  ns: 'com.example.analytics', symbols: ['SUM','AVG','MIN','MAX','COUNT','P50','P95','P99'], default: 'SUM', doc: 'Aggregation types.' },
  { name: 'CachePolicy',      ns: 'com.example.caching',   symbols: ['NO_CACHE','NO_STORE','PUBLIC','PRIVATE_CACHE','MAX_AGE'], default: 'NO_CACHE', doc: 'HTTP cache policies.' },
  { name: 'TLSVersion',       ns: 'com.example.security',  symbols: ['TLS_1_0','TLS_1_1','TLS_1_2','TLS_1_3'], default: 'TLS_1_3', doc: 'TLS versions.' },
  { name: 'DatabaseEngine',   ns: 'com.example.db',        symbols: ['POSTGRES','MYSQL','SQLITE','MONGODB','REDIS','CASSANDRA'], default: 'POSTGRES', doc: 'Database engines.' },
  { name: 'TransactionState', ns: 'com.example.db',        symbols: ['OPEN','COMMITTED','ROLLED_BACK','ABORTED'], default: 'OPEN', doc: 'Transaction states.' },
  { name: 'NetworkZone',      ns: 'com.example.net',       symbols: ['PUBLIC','DMZ','INTERNAL','RESTRICTED'],  default: 'INTERNAL', doc: 'Network security zones.' },
  { name: 'PaymentMethod',    ns: 'com.example.payments',  symbols: ['CARD','BANK_TRANSFER','PAYPAL','CRYPTO','INVOICE'], default: 'CARD', doc: 'Payment methods.' },
  { name: 'ShippingMethod',   ns: 'com.example.shipping',  symbols: ['STANDARD','EXPRESS','OVERNIGHT','PICKUP'], default: 'STANDARD', doc: 'Shipping methods.' },
  // Enum with aliases
  { name: 'RenamedEnum',      ns: 'com.example.enums', symbols: ['A','B','C'], default: 'A', doc: 'An enum that was renamed.', aliases: ['com.example.enums.OldEnum'] },
  // Single-symbol enum
  { name: 'Singleton',        ns: 'com.example.enums', symbols: ['ONLY'],      default: 'ONLY', doc: 'An enum with a single symbol.' },
  // Many symbols
  { name: 'ErrorCode', ns: 'com.example.errors', doc: 'Detailed error codes.', default: 'E_UNKNOWN',
    symbols: ['E_UNKNOWN','E_NOT_FOUND','E_FORBIDDEN','E_UNAUTHORIZED','E_BAD_REQUEST','E_CONFLICT',
              'E_INTERNAL','E_TIMEOUT','E_SERVICE_UNAVAILABLE','E_TOO_MANY_REQUESTS',
              'E_VALIDATION','E_PARSING','E_SERIALIZATION','E_NETWORK','E_DATABASE'] },
  // Enum as record field default
  { name: 'FeatureState', ns: 'com.example.features', symbols: ['ENABLED','DISABLED','DEPRECATED','EXPERIMENTAL'], default: 'DISABLED', doc: 'State of a feature flag.' },
  // Avro spec example
  { name: 'SpecSuit', ns: 'com.example.spec', symbols: ['SPADES','HEARTS','DIAMONDS','CLUBS'], default: 'CLUBS', doc: 'Exact example from Avro spec §Enums.' },
  // Enum with many-character symbol names
  { name: 'MediaType', ns: 'com.example.media', doc: 'MIME media types.', default: 'APPLICATION_JSON',
    symbols: ['TEXT_PLAIN','TEXT_HTML','TEXT_CSV','APPLICATION_JSON','APPLICATION_XML',
              'APPLICATION_OCTET_STREAM','IMAGE_PNG','IMAGE_JPEG','IMAGE_GIF','IMAGE_SVG',
              'AUDIO_MP3','VIDEO_MP4','MULTIPART_FORM_DATA'] },
  { name: 'LifecycleState', ns: 'com.example.lifecycle', doc: 'Entity lifecycle state.', default: 'DRAFT',
    symbols: ['DRAFT','REVIEW','APPROVED','PUBLISHED','DEPRECATED','ARCHIVED','DELETED'] },
  { name: 'IndexType', ns: 'com.example.db', doc: 'Database index types.', default: 'BTREE',
    symbols: ['BTREE','HASH','GIN','GIST','SPGIST','BRIN','FULLTEXT'] },
  { name: 'IsolationLevel', ns: 'com.example.db', doc: 'Transaction isolation levels.', default: 'READ_COMMITTED',
    symbols: ['READ_UNCOMMITTED','READ_COMMITTED','REPEATABLE_READ','SERIALIZABLE'] },
];

for (const e of enumDefs) {
  const schema = {
    type: 'enum',
    name: e.name,
    namespace: e.ns,
    doc: e.doc,
    symbols: e.symbols,
    default: e.default,
  };
  if (e.aliases) schema.aliases = e.aliases;
  write('enums', e.name.toLowerCase(), schema);
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. ARRAYS (~40 files)
// Spec §Arrays: items of any type
// ─────────────────────────────────────────────────────────────────────────────

// 4a. Arrays of all primitives
for (const p of PRIMITIVES) {
  write('arrays', `array_of_${p}`, { type: 'array', items: p });
}

// 4b. Arrays of complex types
write('arrays', 'array_of_records', {
  type: 'array',
  items: {
    type: 'record',
    name: 'ArrayItem',
    namespace: 'com.example.arrays',
    fields: [
      { name: 'id',    type: 'string',  default: '' },
      { name: 'value', type: 'double',  default: 0.0 },
    ],
  },
});

write('arrays', 'array_of_enums', {
  type: 'array',
  items: {
    type: 'enum',
    name: 'ArrayColor',
    namespace: 'com.example.arrays',
    symbols: ['RED', 'GREEN', 'BLUE'],
    default: 'RED',
  },
});

write('arrays', 'array_of_arrays', {
  type: 'array',
  items: { type: 'array', items: 'int' },
});

write('arrays', 'array_of_maps', {
  type: 'array',
  items: { type: 'map', values: 'string' },
});

write('arrays', 'array_of_unions', {
  type: 'array',
  items: ['null', 'string', 'int'],
});

write('arrays', 'array_of_fixed', {
  type: 'array',
  items: { type: 'fixed', name: 'ArrayFixed8', namespace: 'com.example.arrays', size: 8 },
});

write('arrays', 'array_of_bytes', {
  type: 'array',
  items: 'bytes',
});

// 4c. Array as a record field (with default)
write('arrays', 'record_with_array_fields', {
  type: 'record',
  name: 'RecordWithArrays',
  namespace: 'com.example.arrays',
  doc: 'Record demonstrating array fields with defaults.',
  fields: [
    { name: 'tags',    type: { type: 'array', items: 'string' }, default: [] },
    { name: 'counts',  type: { type: 'array', items: 'int'    }, default: [] },
    { name: 'scores',  type: { type: 'array', items: 'double' }, default: [] },
    { name: 'flags',   type: { type: 'array', items: 'boolean'}, default: [] },
  ],
});

// 4d. Nested arrays (3 deep)
write('arrays', 'triple_nested_array', {
  type: 'array',
  items: {
    type: 'array',
    items: {
      type: 'array',
      items: 'long',
    },
  },
});

// 4e. Array of nullable records
write('arrays', 'array_of_nullable_records', {
  type: 'array',
  items: ['null', {
    type: 'record',
    name: 'NullableArrayItem',
    namespace: 'com.example.arrays',
    fields: [{ name: 'data', type: 'string', default: '' }],
  }],
});

// 4f. More array record types
const arrayRecords = [
  'IntMatrix', 'StringMatrix', 'FloatVector', 'ByteSequences',
  'EventList', 'RecordBatch', 'TimeSeries', 'ErrorList',
  'TagList', 'SchemaList',
];
for (let i = 0; i < arrayRecords.length; i++) {
  const name = arrayRecords[i];
  const itemTypes = ['int', 'string', 'float', 'bytes', 'long', 'double', 'boolean', 'bytes', 'string', 'long'];
  write('arrays', `record_array_${name.toLowerCase()}`, {
    type: 'record',
    name,
    namespace: 'com.example.arrays',
    doc: `Record with an array of ${itemTypes[i]}.`,
    fields: [
      { name: 'items', type: { type: 'array', items: itemTypes[i] }, default: [] },
      { name: 'count', type: 'int', default: 0 },
    ],
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. MAPS (~40 files)
// Spec §Maps: values of any type; keys are always strings
// ─────────────────────────────────────────────────────────────────────────────

// 5a. Maps of all primitives
for (const p of PRIMITIVES) {
  write('maps', `map_of_${p}`, { type: 'map', values: p });
}

// 5b. Maps of complex types
write('maps', 'map_of_records', {
  type: 'map',
  values: {
    type: 'record',
    name: 'MapValueRecord',
    namespace: 'com.example.maps',
    fields: [
      { name: 'id',    type: 'string',  default: '' },
      { name: 'score', type: 'double',  default: 0.0 },
    ],
  },
});

write('maps', 'map_of_enums', {
  type: 'map',
  values: {
    type: 'enum',
    name: 'MapStatus',
    namespace: 'com.example.maps',
    symbols: ['ON', 'OFF'],
    default: 'OFF',
  },
});

write('maps', 'map_of_arrays', {
  type: 'map',
  values: { type: 'array', items: 'string' },
});

write('maps', 'map_of_maps', {
  type: 'map',
  values: { type: 'map', values: 'int' },
});

write('maps', 'map_of_unions', {
  type: 'map',
  values: ['null', 'string', 'int', 'boolean'],
});

write('maps', 'map_of_fixed', {
  type: 'map',
  values: { type: 'fixed', name: 'MapFixed16', namespace: 'com.example.maps', size: 16 },
});

// 5c. Map as a record field
write('maps', 'record_with_map_fields', {
  type: 'record',
  name: 'RecordWithMaps',
  namespace: 'com.example.maps',
  doc: 'Record demonstrating map fields with defaults.',
  fields: [
    { name: 'labels',    type: { type: 'map', values: 'string'  }, default: {} },
    { name: 'counters',  type: { type: 'map', values: 'long'    }, default: {} },
    { name: 'ratios',    type: { type: 'map', values: 'double'  }, default: {} },
    { name: 'flags',     type: { type: 'map', values: 'boolean' }, default: {} },
  ],
});

// 5d. Nested maps (3 deep)
write('maps', 'triple_nested_map', {
  type: 'map',
  values: {
    type: 'map',
    values: {
      type: 'map',
      values: 'string',
    },
  },
});

// 5e. Map of arrays
write('maps', 'map_of_int_arrays', {
  type: 'map',
  values: { type: 'array', items: 'int' },
});

// 5f. More map record types
const mapRecordDefs = [
  { name: 'LabelSet',       values: 'string'  },
  { name: 'CounterMap',     values: 'long'    },
  { name: 'ScoreMap',       values: 'double'  },
  { name: 'FlagMap',        values: 'boolean' },
  { name: 'ConfigMap',      values: 'string'  },
  { name: 'MetadataMap',    values: 'bytes'   },
  { name: 'IndexMap',       values: 'int'     },
  { name: 'WeightMap',      values: 'float'   },
  { name: 'PropertyMap',    values: 'string'  },
  { name: 'AttributeMap',   values: 'string'  },
];
for (const m of mapRecordDefs) {
  write('maps', `record_map_${m.name.toLowerCase()}`, {
    type: 'record',
    name: m.name,
    namespace: 'com.example.maps',
    doc: `Record with a map of ${m.values} values.`,
    fields: [
      { name: 'data', type: { type: 'map', values: m.values }, default: {} },
      { name: 'size', type: 'int', default: 0 },
    ],
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// 6. UNIONS (~50 files)
// Spec §Unions: JSON array; no two same types except named; no immediate nesting
// ─────────────────────────────────────────────────────────────────────────────

// 6a. Nullable primitives (["null", X])
for (const p of PRIMITIVES.filter(p => p !== 'null')) {
  write('unions', `nullable_${p}`, ['null', p]);
}

// 6b. Multi-type unions (no primitives repeated)
write('unions', 'null_string_int', ['null', 'string', 'int']);
write('unions', 'null_string_long_double', ['null', 'string', 'long', 'double']);
write('unions', 'string_int_boolean', ['string', 'int', 'boolean']);
write('unions', 'null_boolean_int_long_float_double_string', ['null', 'boolean', 'int', 'long', 'float', 'double', 'string']);
write('unions', 'null_bytes_string', ['null', 'bytes', 'string']);

// 6c. Unions with named types (multiple records/enums/fixed allowed)
write('unions', 'union_two_records', [
  'null',
  {
    type: 'record',
    name: 'UnionRecordA',
    namespace: 'com.example.unions',
    fields: [{ name: 'aField', type: 'string', default: '' }],
  },
  {
    type: 'record',
    name: 'UnionRecordB',
    namespace: 'com.example.unions',
    fields: [{ name: 'bField', type: 'int', default: 0 }],
  },
]);

write('unions', 'union_record_enum_fixed', [
  'null',
  {
    type: 'record',
    name: 'UnionRecord',
    namespace: 'com.example.unions',
    fields: [{ name: 'data', type: 'bytes', default: '' }],
  },
  {
    type: 'enum',
    name: 'UnionEnum',
    namespace: 'com.example.unions',
    symbols: ['X', 'Y', 'Z'],
    default: 'X',
  },
  {
    type: 'fixed',
    name: 'UnionFixed',
    namespace: 'com.example.unions',
    size: 4,
  },
]);

write('unions', 'union_multiple_records', [
  'null',
  { type: 'record', name: 'Cat', namespace: 'com.example.pets', fields: [{ name: 'breed', type: 'string', default: '' }] },
  { type: 'record', name: 'Dog', namespace: 'com.example.pets', fields: [{ name: 'breed', type: 'string', default: '' }] },
  { type: 'record', name: 'Bird', namespace: 'com.example.pets', fields: [{ name: 'species', type: 'string', default: '' }] },
]);

// 6d. Union as record fields
write('unions', 'record_with_union_fields', {
  type: 'record',
  name: 'RecordWithUnions',
  namespace: 'com.example.unions',
  doc: 'Record with various union field types.',
  fields: [
    { name: 'optString',  type: ['null', 'string'],  default: null },
    { name: 'optInt',     type: ['null', 'int'],     default: null },
    { name: 'optLong',    type: ['null', 'long'],    default: null },
    { name: 'optDouble',  type: ['null', 'double'],  default: null },
    { name: 'optBoolean', type: ['null', 'boolean'], default: null },
    { name: 'optBytes',   type: ['null', 'bytes'],   default: null },
    { name: 'multiType',  type: ['null', 'string', 'int', 'boolean'], default: null },
  ],
});

// 6e. Union with default matching first branch
write('unions', 'union_string_int_default_string', {
  type: 'record',
  name: 'UnionDefaultRecord',
  namespace: 'com.example.unions',
  doc: 'Demonstrates union field defaults matching first schema type.',
  fields: [
    {
      name: 'stringOrInt',
      type: ['string', 'int'],
      default: 'default_string_value',
      doc: 'Default matches first type (string).',
    },
    {
      name: 'nullOrString',
      type: ['null', 'string'],
      default: null,
      doc: 'Default matches first type (null).',
    },
    {
      name: 'intOrNull',
      type: ['int', 'null'],
      default: 42,
      doc: 'Default matches first type (int).',
    },
  ],
});

// 6f. Unions in array/map items
write('unions', 'array_of_nullable_strings', {
  type: 'array',
  items: ['null', 'string'],
});

write('unions', 'map_of_nullable_longs', {
  type: 'map',
  values: ['null', 'long'],
});

// 6g. 20 more union record variants
const unionVariants = [
  ['null', 'int', 'string'],
  ['null', 'long', 'double', 'string'],
  ['null', 'boolean', 'string'],
  ['string', 'bytes'],
  ['null', 'float', 'double'],
  ['null', 'int', 'long', 'float', 'double'],
  ['null', 'boolean', 'int'],
  ['null', 'string', 'boolean'],
  ['int', 'string', 'null'],
  ['null', 'bytes', 'int'],
  ['null', 'string'],
  ['null', 'int'],
  ['null', 'long'],
  ['null', 'float'],
  ['null', 'double'],
  ['null', 'boolean'],
  ['null', 'bytes'],
  ['string', 'int'],
  ['string', 'long'],
  ['int', 'long'],
];

for (let i = 0; i < unionVariants.length; i++) {
  write('unions', `union_variant_${String(i + 1).padStart(2, '0')}`, {
    type: 'record',
    name: `UnionVariant${String(i + 1).padStart(2, '0')}`,
    namespace: 'com.example.unions',
    doc: `Union variant ${i + 1}: ${unionVariants[i].join(' | ')}.`,
    fields: [
      { name: 'value', type: unionVariants[i], default: unionVariants[i][0] === 'null' ? null : (unionVariants[i][0] === 'string' ? '' : (unionVariants[i][0] === 'int' ? 0 : (unionVariants[i][0] === 'long' ? 0 : 0))) },
    ],
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// 7. FIXED (~30 files)
// Spec §Fixed: name, namespace, aliases, size
// ─────────────────────────────────────────────────────────────────────────────

const fixedDefs = [
  { name: 'MD5Hash',       ns: 'com.example.fixed', size: 16,  doc: 'MD5 hash (16 bytes).' },
  { name: 'SHA1Hash',      ns: 'com.example.fixed', size: 20,  doc: 'SHA-1 hash (20 bytes).' },
  { name: 'SHA256Hash',    ns: 'com.example.fixed', size: 32,  doc: 'SHA-256 hash (32 bytes).' },
  { name: 'SHA512Hash',    ns: 'com.example.fixed', size: 64,  doc: 'SHA-512 hash (64 bytes).' },
  { name: 'IPv4Address',   ns: 'com.example.fixed', size: 4,   doc: 'IPv4 address (4 bytes).' },
  { name: 'IPv6Address',   ns: 'com.example.fixed', size: 16,  doc: 'IPv6 address (16 bytes).' },
  { name: 'MacAddress',    ns: 'com.example.fixed', size: 6,   doc: 'MAC address (6 bytes).' },
  { name: 'UUIDBytes',     ns: 'com.example.fixed', size: 16,  doc: 'UUID as 16-byte fixed (RFC-4122).' },
  { name: 'Nonce32',       ns: 'com.example.fixed', size: 32,  doc: 'Cryptographic nonce (32 bytes).' },
  { name: 'AESKey128',     ns: 'com.example.fixed', size: 16,  doc: 'AES-128 key.' },
  { name: 'AESKey256',     ns: 'com.example.fixed', size: 32,  doc: 'AES-256 key.' },
  { name: 'AESKey192',     ns: 'com.example.fixed', size: 24,  doc: 'AES-192 key.' },
  { name: 'SyncMarker',    ns: 'com.example.fixed', size: 16,  doc: 'Avro container file sync marker (16 bytes).' },
  { name: 'MagicBytes',    ns: 'com.example.fixed', size: 4,   doc: 'Avro container file magic bytes (4 bytes).' },
  { name: 'CRC32Checksum', ns: 'com.example.fixed', size: 4,   doc: 'CRC-32 checksum.' },
  { name: 'CRC64Checksum', ns: 'com.example.fixed', size: 8,   doc: 'CRC-64 checksum.' },
  { name: 'Timestamp8',    ns: 'com.example.fixed', size: 8,   doc: 'Timestamp as 8-byte fixed.' },
  { name: 'SmallFixed1',   ns: 'com.example.fixed', size: 1,   doc: 'Minimal fixed: 1 byte.' },
  { name: 'SmallFixed2',   ns: 'com.example.fixed', size: 2,   doc: 'Small fixed: 2 bytes.' },
  { name: 'SmallFixed3',   ns: 'com.example.fixed', size: 3,   doc: 'Small fixed: 3 bytes.' },
  { name: 'DurationFixed', ns: 'com.example.fixed', size: 12,  doc: 'Duration: 3 little-endian uint32s (months, days, ms). Spec §Duration logical type.' },
  { name: 'LargeFixed128', ns: 'com.example.fixed', size: 128, doc: 'Large fixed: 128 bytes.' },
  { name: 'LargeFixed256', ns: 'com.example.fixed', size: 256, doc: 'Large fixed: 256 bytes.' },
  { name: 'RenamedFixed',  ns: 'com.example.fixed', size: 8,   doc: 'A fixed with an alias for schema evolution.', aliases: ['com.example.fixed.OldFixed8'] },
  { name: 'HMACKey',       ns: 'com.example.crypto', size: 32, doc: 'HMAC key (32 bytes).' },
  { name: 'ECPublicKey',   ns: 'com.example.crypto', size: 64, doc: 'EC public key (64 bytes, uncompressed).' },
  { name: 'ECPrivateKey',  ns: 'com.example.crypto', size: 32, doc: 'EC private key (32 bytes).' },
  { name: 'RSAFingerprint',ns: 'com.example.crypto', size: 20, doc: 'RSA key fingerprint (20 bytes).' },
  // Spec example
  { name: 'SpecMD5',       ns: 'com.example.spec',   size: 16,  doc: 'Exact example from Avro spec §Fixed: {"type":"fixed","size":16,"name":"md5"}' },
];

for (const f of fixedDefs) {
  const schema = { type: 'fixed', name: f.name, namespace: f.ns, size: f.size, doc: f.doc };
  if (f.aliases) schema.aliases = f.aliases;
  write('fixed', f.name.toLowerCase(), schema);
}

// ─────────────────────────────────────────────────────────────────────────────
// 8. LOGICAL TYPES (~70 files)
// Spec §Logical Types: all 15 types in Avro 1.12.1
// ─────────────────────────────────────────────────────────────────────────────

// 8a. decimal on bytes
const decimalBytesDefs = [
  { precision: 4,  scale: 2,  doc: 'Spec example: decimal(4,2) on bytes.' },
  { precision: 10, scale: 2,  doc: 'Monetary amount: decimal(10,2) on bytes.' },
  { precision: 18, scale: 6,  doc: 'High precision decimal(18,6) on bytes.' },
  { precision: 38, scale: 10, doc: 'Maximum precision decimal(38,10) on bytes.' },
  { precision: 5,  scale: 0,  doc: 'Integer-like decimal(5,0) — scale 0.' },
  { precision: 8,  scale: 8,  doc: 'Pure fractional decimal(8,8) — scale equals precision.' },
];
for (let i = 0; i < decimalBytesDefs.length; i++) {
  const d = decimalBytesDefs[i];
  write('logical-types', `decimal_bytes_p${d.precision}_s${d.scale}`, {
    type: 'bytes',
    logicalType: 'decimal',
    precision: d.precision,
    scale: d.scale,
    doc: d.doc,
  });
}

// 8b. decimal on fixed
const decimalFixedDefs = [
  { precision: 4,  scale: 2,  size: 3,  doc: 'decimal(4,2) on fixed(3): max 3 bytes = floor(log10(2^(8*3-1)-1)) = 6 digits.' },
  { precision: 9,  scale: 4,  size: 4,  doc: 'decimal(9,4) on fixed(4).' },
  { precision: 18, scale: 6,  size: 8,  doc: 'decimal(18,6) on fixed(8).' },
  { precision: 28, scale: 10, size: 12, doc: 'decimal(28,10) on fixed(12).' },
];
for (let i = 0; i < decimalFixedDefs.length; i++) {
  const d = decimalFixedDefs[i];
  write('logical-types', `decimal_fixed_p${d.precision}_s${d.scale}`, {
    type: 'fixed',
    name: `DecimalFixed_p${d.precision}_s${d.scale}`,
    namespace: 'com.example.logical',
    size: d.size,
    logicalType: 'decimal',
    precision: d.precision,
    scale: d.scale,
    doc: d.doc,
  });
}

// 8c. big-decimal on bytes (spec 1.12.1, Java/C++/Rust)
write('logical-types', 'big_decimal_bytes', {
  type: 'bytes',
  logicalType: 'big-decimal',
  doc: 'Scalable precision decimal (big-decimal) on bytes. Avro 1.12.1 §Logical Types. Supported in C++, Java, Rust.',
});

// 8d. uuid on string
write('logical-types', 'uuid_string', {
  type: 'string',
  logicalType: 'uuid',
  doc: 'UUID v4 as string (RFC-4122). Avro spec §UUID.',
});

// 8e. uuid on fixed (size 16)
write('logical-types', 'uuid_fixed', {
  type: 'fixed',
  name: 'UUIDFixed',
  namespace: 'com.example.logical',
  size: 16,
  logicalType: 'uuid',
  doc: 'UUID as 16-byte fixed (RFC-4122). Avro spec §UUID.',
});

// 8f. date on int
write('logical-types', 'date_int', {
  type: 'int',
  logicalType: 'date',
  doc: 'Date as days since unix epoch (1970-01-01). Avro spec §Date.',
});

// 8g. time-millis on int
write('logical-types', 'time_millis', {
  type: 'int',
  logicalType: 'time-millis',
  doc: 'Time of day in milliseconds after midnight. Avro spec §Time (millisecond precision).',
});

// 8h. time-micros on long
write('logical-types', 'time_micros', {
  type: 'long',
  logicalType: 'time-micros',
  doc: 'Time of day in microseconds after midnight. Avro spec §Time (microsecond precision).',
});

// 8i. timestamp-millis on long
write('logical-types', 'timestamp_millis', {
  type: 'long',
  logicalType: 'timestamp-millis',
  doc: 'Instant as milliseconds from unix epoch. Avro spec §Timestamps.',
});

// 8j. timestamp-micros on long
write('logical-types', 'timestamp_micros', {
  type: 'long',
  logicalType: 'timestamp-micros',
  doc: 'Instant as microseconds from unix epoch. Avro spec §Timestamps.',
});

// 8k. timestamp-nanos on long (added in Avro 1.12.0)
write('logical-types', 'timestamp_nanos', {
  type: 'long',
  logicalType: 'timestamp-nanos',
  doc: 'Instant as nanoseconds from unix epoch. Added in Avro 1.12.0. Avro spec §Timestamps.',
});

// 8l. local-timestamp-millis on long
write('logical-types', 'local_timestamp_millis', {
  type: 'long',
  logicalType: 'local-timestamp-millis',
  doc: 'Local timestamp in milliseconds (no timezone). Avro spec §Local Timestamps.',
});

// 8m. local-timestamp-micros on long
write('logical-types', 'local_timestamp_micros', {
  type: 'long',
  logicalType: 'local-timestamp-micros',
  doc: 'Local timestamp in microseconds (no timezone). Avro spec §Local Timestamps.',
});

// 8n. local-timestamp-nanos on long (added in Avro 1.12.0)
write('logical-types', 'local_timestamp_nanos', {
  type: 'long',
  logicalType: 'local-timestamp-nanos',
  doc: 'Local timestamp in nanoseconds (no timezone). Added in Avro 1.12.0. Avro spec §Local Timestamps.',
});

// 8o. duration on fixed(12) — three little-endian uint32s: months, days, ms
write('logical-types', 'duration_fixed', {
  type: 'fixed',
  name: 'Avroduration',
  namespace: 'com.example.logical',
  size: 12,
  logicalType: 'duration',
  doc: 'Duration: fixed(12) with 3 unsigned little-endian 32-bit ints (months, days, milliseconds). Avro spec §Duration.',
});

// 8p. Records using all logical types as fields
write('logical-types', 'record_all_logical_types', {
  type: 'record',
  name: 'AllLogicalTypes',
  namespace: 'com.example.logical',
  doc: 'Record with a field for every Avro 1.12.1 logical type.',
  fields: [
    { name: 'decimalBytes',          type: { type: 'bytes', logicalType: 'decimal', precision: 10, scale: 2 },   doc: 'decimal on bytes' },
    { name: 'decimalFixed',          type: { type: 'fixed', name: 'AllLogDecFixed', namespace: 'com.example.logical', size: 4, logicalType: 'decimal', precision: 9, scale: 4 }, doc: 'decimal on fixed' },
    { name: 'bigDecimal',            type: { type: 'bytes', logicalType: 'big-decimal' },                         doc: 'big-decimal on bytes' },
    { name: 'uuidStr',               type: { type: 'string', logicalType: 'uuid' },                              doc: 'uuid on string' },
    { name: 'uuidFixed',             type: { type: 'fixed', name: 'AllLogUUIDFixed', namespace: 'com.example.logical', size: 16, logicalType: 'uuid' }, doc: 'uuid on fixed(16)' },
    { name: 'date',                  type: { type: 'int',    logicalType: 'date' },                               doc: 'date' },
    { name: 'timeMillis',            type: { type: 'int',    logicalType: 'time-millis' },                        doc: 'time-millis' },
    { name: 'timeMicros',            type: { type: 'long',   logicalType: 'time-micros' },                        doc: 'time-micros' },
    { name: 'tsMillis',              type: { type: 'long',   logicalType: 'timestamp-millis' },                   doc: 'timestamp-millis' },
    { name: 'tsMicros',              type: { type: 'long',   logicalType: 'timestamp-micros' },                   doc: 'timestamp-micros' },
    { name: 'tsNanos',               type: { type: 'long',   logicalType: 'timestamp-nanos' },                    doc: 'timestamp-nanos (Avro 1.12+)' },
    { name: 'localTsMillis',         type: { type: 'long',   logicalType: 'local-timestamp-millis' },             doc: 'local-timestamp-millis' },
    { name: 'localTsMicros',         type: { type: 'long',   logicalType: 'local-timestamp-micros' },             doc: 'local-timestamp-micros' },
    { name: 'localTsNanos',          type: { type: 'long',   logicalType: 'local-timestamp-nanos' },              doc: 'local-timestamp-nanos (Avro 1.12+)' },
    { name: 'duration',              type: { type: 'fixed', name: 'AllLogDuration', namespace: 'com.example.logical', size: 12, logicalType: 'duration' }, doc: 'duration on fixed(12)' },
  ],
});

// 8q. Records with logical types as nullable union fields
write('logical-types', 'record_nullable_logical_types', {
  type: 'record',
  name: 'NullableLogicalTypes',
  namespace: 'com.example.logical',
  doc: 'Record with all logical types as nullable fields.',
  fields: [
    { name: 'optDate',          type: ['null', { type: 'int',    logicalType: 'date' }],                   default: null },
    { name: 'optTimeMillis',    type: ['null', { type: 'int',    logicalType: 'time-millis' }],            default: null },
    { name: 'optTimeMicros',    type: ['null', { type: 'long',   logicalType: 'time-micros' }],            default: null },
    { name: 'optTsMillis',      type: ['null', { type: 'long',   logicalType: 'timestamp-millis' }],       default: null },
    { name: 'optTsMicros',      type: ['null', { type: 'long',   logicalType: 'timestamp-micros' }],       default: null },
    { name: 'optTsNanos',       type: ['null', { type: 'long',   logicalType: 'timestamp-nanos' }],        default: null },
    { name: 'optLocalTsMillis', type: ['null', { type: 'long',   logicalType: 'local-timestamp-millis' }], default: null },
    { name: 'optLocalTsMicros', type: ['null', { type: 'long',   logicalType: 'local-timestamp-micros' }], default: null },
    { name: 'optLocalTsNanos',  type: ['null', { type: 'long',   logicalType: 'local-timestamp-nanos' }],  default: null },
    { name: 'optUuid',          type: ['null', { type: 'string', logicalType: 'uuid' }],                   default: null },
    { name: 'optDecimal',       type: ['null', { type: 'bytes',  logicalType: 'decimal', precision: 10, scale: 2 }], default: null },
  ],
});

// 8r. Event record with temporal fields (realistic example)
write('logical-types', 'event_with_temporal_fields', {
  type: 'record',
  name: 'TemporalEvent',
  namespace: 'com.example.logical',
  doc: 'An event record demonstrating all temporal logical types together.',
  fields: [
    { name: 'eventId',       type: { type: 'string', logicalType: 'uuid' },                        doc: 'UUID v4 event identifier.' },
    { name: 'occurredAt',    type: { type: 'long',   logicalType: 'timestamp-millis' },             doc: 'When the event occurred (UTC).' },
    { name: 'occurredAtUs',  type: { type: 'long',   logicalType: 'timestamp-micros' },             doc: 'When the event occurred (UTC, microseconds).' },
    { name: 'occurredAtNs',  type: { type: 'long',   logicalType: 'timestamp-nanos' },              doc: 'When the event occurred (UTC, nanoseconds, Avro 1.12+).' },
    { name: 'localOccurred', type: { type: 'long',   logicalType: 'local-timestamp-millis' },       doc: 'Local occurrence time (no timezone).' },
    { name: 'eventDate',     type: { type: 'int',    logicalType: 'date' },                         doc: 'Date of the event.' },
    { name: 'eventTime',     type: { type: 'int',    logicalType: 'time-millis' },                  doc: 'Time of day of the event.' },
    { name: 'eventTimeMicro',type: { type: 'long',   logicalType: 'time-micros' },                  doc: 'Time of day (microseconds).' },
    { name: 'retentionPeriod',type:{ type: 'fixed',  name: 'EventDuration', namespace: 'com.example.logical', size: 12, logicalType: 'duration' }, doc: 'How long to retain this event.' },
    { name: 'amount',        type: { type: 'bytes',  logicalType: 'decimal', precision: 18, scale: 4 }, doc: 'Monetary amount.' },
  ],
});

// 8s. 20 more records, each with one logical type field, covering date/time variety
const temporalFieldDefs = [
  { fname: 'CreatedDate',      ftype: { type: 'int',  logicalType: 'date' } },
  { fname: 'UpdatedDate',      ftype: { type: 'int',  logicalType: 'date' } },
  { fname: 'ExpiryDate',       ftype: { type: 'int',  logicalType: 'date' } },
  { fname: 'StartTime',        ftype: { type: 'int',  logicalType: 'time-millis' } },
  { fname: 'EndTime',          ftype: { type: 'int',  logicalType: 'time-millis' } },
  { fname: 'PreciseStartTime', ftype: { type: 'long', logicalType: 'time-micros' } },
  { fname: 'PreciseEndTime',   ftype: { type: 'long', logicalType: 'time-micros' } },
  { fname: 'CreatedAt',        ftype: { type: 'long', logicalType: 'timestamp-millis' } },
  { fname: 'UpdatedAt',        ftype: { type: 'long', logicalType: 'timestamp-millis' } },
  { fname: 'DeletedAt',        ftype: { type: 'long', logicalType: 'timestamp-millis' } },
  { fname: 'PublishedAt',      ftype: { type: 'long', logicalType: 'timestamp-micros' } },
  { fname: 'ProcessedAt',      ftype: { type: 'long', logicalType: 'timestamp-micros' } },
  { fname: 'ReceivedAt',       ftype: { type: 'long', logicalType: 'timestamp-nanos' } },
  { fname: 'SentAt',           ftype: { type: 'long', logicalType: 'timestamp-nanos' } },
  { fname: 'LocalCreatedAt',   ftype: { type: 'long', logicalType: 'local-timestamp-millis' } },
  { fname: 'LocalUpdatedAt',   ftype: { type: 'long', logicalType: 'local-timestamp-micros' } },
  { fname: 'LocalProcessedAt', ftype: { type: 'long', logicalType: 'local-timestamp-nanos' } },
  { fname: 'Price',            ftype: { type: 'bytes', logicalType: 'decimal', precision: 10, scale: 2 } },
  { fname: 'TaxAmount',        ftype: { type: 'bytes', logicalType: 'decimal', precision: 10, scale: 2 } },
  { fname: 'DiscountAmount',   ftype: { type: 'bytes', logicalType: 'decimal', precision: 10, scale: 2 } },
];

for (const d of temporalFieldDefs) {
  write('logical-types', `record_with_${d.fname.toLowerCase()}`, {
    type: 'record',
    name: `RecordWith${d.fname}`,
    namespace: 'com.example.logical',
    doc: `Record demonstrating a ${d.ftype.logicalType} logical type field.`,
    fields: [
      { name: 'id',   type: 'string', default: '' },
      { name: 'value', type: d.ftype, doc: `A ${d.ftype.logicalType} value.` },
    ],
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// 9. NAMES & NAMESPACES (~30 files)
// Spec §Names: fullname with dot, simple name + namespace, null namespace,
//              namespace inheritance, references across scopes
// ─────────────────────────────────────────────────────────────────────────────

// 9a. Null namespace (no namespace attribute)
write('names', 'null_namespace_record', {
  type: 'record',
  name: 'NullNamespaceRecord',
  doc: 'Record with null namespace — fullname is just "NullNamespaceRecord".',
  fields: [{ name: 'data', type: 'string', default: '' }],
});

write('names', 'null_namespace_enum', {
  type: 'enum',
  name: 'NullNamespaceEnum',
  doc: 'Enum with null namespace — fullname is just "NullNamespaceEnum".',
  symbols: ['A', 'B'],
  default: 'A',
});

write('names', 'null_namespace_fixed', {
  type: 'fixed',
  name: 'NullNamespaceFixed',
  doc: 'Fixed with null namespace — fullname is just "NullNamespaceFixed".',
  size: 8,
});

// 9b. Fullname specified via dotted name (namespace attr ignored)
write('names', 'dotted_fullname_record', {
  type: 'record',
  name: 'com.example.names.DottedFullname',
  namespace: 'ignored.namespace',
  doc: 'Fullname comes from the dotted name attribute; namespace attr is ignored.',
  fields: [{ name: 'x', type: 'int', default: 0 }],
});

// 9c. Empty string namespace (null namespace via explicit "")
write('names', 'empty_namespace_record', {
  type: 'record',
  name: 'EmptyNamespaceRecord',
  namespace: '',
  doc: 'Empty string namespace = null namespace. Spec: "The empty string may also be used as a namespace to indicate the null namespace."',
  fields: [{ name: 'y', type: 'string', default: '' }],
});

// 9d. Multi-level namespace records
const multiNsDefs = [
  { name: 'AlphaRecord', ns: 'com.example.a',          fields: [{ name: 'v', type: 'int', default: 0 }] },
  { name: 'BetaRecord',  ns: 'com.example.a.b',        fields: [{ name: 'v', type: 'int', default: 0 }] },
  { name: 'GammaRecord', ns: 'com.example.a.b.c',      fields: [{ name: 'v', type: 'int', default: 0 }] },
  { name: 'DeltaRecord', ns: 'com.example.a.b.c.d',    fields: [{ name: 'v', type: 'int', default: 0 }] },
  { name: 'EpsilonRecord',ns: 'org.apache.avro.test',  fields: [{ name: 'v', type: 'int', default: 0 }] },
  { name: 'ZetaRecord',  ns: 'io.example.zeta',        fields: [{ name: 'v', type: 'int', default: 0 }] },
  { name: 'EtaRecord',   ns: 'net.example.eta',        fields: [{ name: 'v', type: 'int', default: 0 }] },
  { name: 'ThetaRecord', ns: 'com.acme.core.schema',   fields: [{ name: 'v', type: 'int', default: 0 }] },
];
for (const r of multiNsDefs) {
  write('names', `multins_${r.name.toLowerCase()}`, {
    type: 'record', name: r.name, namespace: r.ns,
    doc: `Fullname: ${r.ns}.${r.name}`, fields: r.fields,
  });
}

// 9e. Spec §Names example: namespace inheritance
write('names', 'spec_namespace_example', {
  type: 'record',
  name: 'Example',
  doc: 'Reproduces the spec §Names namespace inheritance example.',
  fields: [
    {
      name: 'inheritNull',
      type: {
        type: 'enum',
        name: 'Simple',
        doc: 'Inherits null namespace from Example. Fullname: Simple.',
        symbols: ['a', 'b'],
      },
      default: 'a',
    },
    {
      name: 'explicitNamespace',
      type: {
        type: 'fixed',
        name: 'Simple',
        namespace: 'explicit',
        doc: 'Explicit namespace. Fullname: explicit.Simple (different from above).',
        size: 12,
      },
    },
    {
      name: 'fullName',
      type: {
        type: 'record',
        name: 'a.full.Name',
        namespace: 'ignored',
        doc: 'Dotted fullname; namespace ignored. Fullname: a.full.Name.',
        fields: [
          {
            name: 'inheritNamespace',
            type: {
              type: 'enum',
              name: 'Understanding',
              doc: 'Inherits a.full namespace. Fullname: a.full.Understanding.',
              symbols: ['d', 'e'],
            },
            default: 'd',
          },
        ],
      },
    },
  ],
});

// 9f. Records reusing a type name in different namespaces (legal)
write('names', 'same_name_different_namespace', {
  type: 'record',
  name: 'Container',
  namespace: 'com.example.names',
  doc: 'Shows same simple name used in two different namespaces — legal in Avro.',
  fields: [
    {
      name: 'ns1Value',
      type: {
        type: 'record',
        name: 'Item',
        namespace: 'com.example.names.ns1',
        fields: [{ name: 'x', type: 'int', default: 0 }],
      },
    },
    {
      name: 'ns2Value',
      type: {
        type: 'record',
        name: 'Item',
        namespace: 'com.example.names.ns2',
        fields: [{ name: 'y', type: 'string', default: '' }],
      },
    },
  ],
});

// 9g. Name validation patterns
const validNameRecords = [
  'UpperCase', 'lowerCase', '_underscoreStart', 'with_underscores',
  'CamelCase', 'PascalCase', 'ALLCAPS', 'mixed123Numbers',
  'a', '_', 'Z', 'number1',
];
for (const n of validNameRecords) {
  write('names', `valid_name_${n.replace(/[^a-zA-Z0-9]/g, '_')}`, {
    type: 'record',
    name: `ValidName_${n.replace(/[^a-zA-Z0-9_]/g, '_')}`,
    namespace: 'com.example.names.valid',
    doc: `Valid record name: ${n}`,
    fields: [{ name: 'v', type: 'int', default: 0 }],
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// 10. ALIASES (~20 files)
// Spec §Aliases: aliases on named types and fields; fully-qualified or relative
// ─────────────────────────────────────────────────────────────────────────────

// 10a. Record with type alias
write('aliases', 'record_type_alias', {
  type: 'record',
  name: 'NewRecordName',
  namespace: 'com.example.aliases',
  doc: 'Record renamed; old name kept as alias for schema evolution.',
  aliases: ['com.example.aliases.OldRecordName'],
  fields: [
    { name: 'id', type: 'string', default: '' },
    { name: 'data', type: 'bytes', default: '' },
  ],
});

// 10b. Record with relative alias (alias relative to its own namespace)
write('aliases', 'record_relative_alias', {
  type: 'record',
  name: 'CurrentRecord',
  namespace: 'com.example.aliases',
  doc: 'Record with a relative alias. Fully-qualified alias: com.example.aliases.LegacyRecord.',
  aliases: ['LegacyRecord'],
  fields: [
    { name: 'value', type: 'long', default: 0 },
  ],
});

// 10c. Record with multiple aliases
write('aliases', 'record_multiple_aliases', {
  type: 'record',
  name: 'CanonicalRecord',
  namespace: 'com.example.aliases',
  doc: 'Record with many aliases from multiple renames over time.',
  aliases: [
    'com.example.aliases.Version1Record',
    'com.example.aliases.Version2Record',
    'com.example.legacy.OldRecord',
    'AncientRecord',
  ],
  fields: [{ name: 'x', type: 'int', default: 0 }],
});

// 10d. Enum with alias
write('aliases', 'enum_with_alias', {
  type: 'enum',
  name: 'NewEnumName',
  namespace: 'com.example.aliases',
  doc: 'Enum renamed; old name as alias.',
  aliases: ['com.example.aliases.OldEnumName'],
  symbols: ['P', 'Q', 'R'],
  default: 'P',
});

// 10e. Fixed with alias
write('aliases', 'fixed_with_alias', {
  type: 'fixed',
  name: 'NewFixedName',
  namespace: 'com.example.aliases',
  doc: 'Fixed renamed; old name as alias.',
  aliases: ['com.example.aliases.OldFixedName'],
  size: 16,
});

// 10f. Record fields with aliases
write('aliases', 'field_aliases', {
  type: 'record',
  name: 'FieldAliasRecord',
  namespace: 'com.example.aliases',
  doc: 'Record where fields have aliases for schema evolution.',
  fields: [
    { name: 'userId',    type: 'string',  aliases: ['user_id', 'uid', 'id'],       default: '' },
    { name: 'firstName', type: 'string',  aliases: ['first_name', 'given_name'],   default: '' },
    { name: 'lastName',  type: 'string',  aliases: ['last_name', 'family_name'],   default: '' },
    { name: 'emailAddr', type: 'string',  aliases: ['email', 'emailAddress', 'e'], default: '' },
    { name: 'phoneNum',  type: ['null', 'string'], aliases: ['phone', 'phoneNumber'], default: null },
  ],
});

// 10g. Alias cross-namespace
write('aliases', 'cross_namespace_alias', {
  type: 'record',
  name: 'ModernRecord',
  namespace: 'com.example.v2',
  doc: 'Modern version of a record that used to live in a different namespace.',
  aliases: ['com.example.v1.LegacyRecord', 'com.acme.OldRecord'],
  fields: [
    { name: 'id',    type: 'string',  default: '' },
    { name: 'name',  type: 'string',  default: '' },
    { name: 'score', type: 'double',  default: 0.0 },
  ],
});

// 10h. Schema evolution: add field (has default), rename field (alias), remove field
write('aliases', 'schema_evolution_v2', {
  type: 'record',
  name: 'EvolvingSchema',
  namespace: 'com.example.aliases',
  doc: 'Demonstrates schema evolution: renamed field (alias), added field (default), changed namespace via record alias.',
  aliases: ['com.example.aliases.EvolvingSchemaV1'],
  fields: [
    { name: 'newName',    type: 'string', aliases: ['oldName'],   default: '', doc: 'Renamed from oldName to newName.' },
    { name: 'addedField', type: 'int',    default: 0,             doc: 'New field with default for backward compatibility.' },
    { name: 'kept',       type: 'boolean',default: false,         doc: 'Unchanged field.' },
  ],
});

// 10i. More alias records
for (let i = 1; i <= 12; i++) {
  write('aliases', `alias_misc_${String(i).padStart(2, '0')}`, {
    type: 'record',
    name: `AliasRecord${String(i).padStart(2, '0')}`,
    namespace: 'com.example.aliases.misc',
    doc: `Misc alias record ${i}.`,
    aliases: [`com.example.aliases.misc.Old${String(i).padStart(2, '0')}`, `LegacyAlias${i}`],
    fields: [
      { name: `field${i}`, type: 'string', aliases: [`old_field_${i}`], default: '' },
    ],
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// 11. COMPLEX / CROSS-REFERENCE SCHEMAS (~50 files)
// ─────────────────────────────────────────────────────────────────────────────

// 11a. Schema that references types defined in other schemas in the same invocation
// (avrodoc-plus ingests all schemas via --input folder, so all named types are visible)
write('complex', 'references_external_types', {
  type: 'record',
  name: 'CompositeRecord',
  namespace: 'com.example.complex',
  doc: 'Demonstrates referencing named types defined in other files in the same --input folder.',
  fields: [
    { name: 'id',        type: 'string',  default: '' },
    // References com.example.enums.LogLevel defined in enums/loglevel.avsc
    { name: 'logLevel',  type: 'com.example.enums.LogLevel',  doc: 'References LogLevel enum from enums/ folder.' },
    // References com.example.enums.Priority
    { name: 'priority',  type: 'com.example.enums.Priority',  doc: 'References Priority enum.' },
    // References com.example.fixed.MD5Hash
    { name: 'checksum',  type: ['null', 'com.example.fixed.MD5Hash'], doc: 'Optional MD5 checksum.', default: null },
  ],
});

// 11b. Complex unions with multiple named types
write('complex', 'polymorphic_event', {
  type: 'record',
  name: 'PolymorphicEvent',
  namespace: 'com.example.complex',
  doc: 'An event that can be one of several event types (polymorphism via union).',
  fields: [
    { name: 'eventId',   type: 'string',  default: '' },
    { name: 'timestamp', type: 'long',    default: 0 },
    {
      name: 'payload',
      type: [
        'null',
        { type: 'record', name: 'ClickEvent',    namespace: 'com.example.complex', fields: [{ name: 'url',    type: 'string', default: '' }, { name: 'element', type: 'string', default: '' }] },
        { type: 'record', name: 'PageViewEvent', namespace: 'com.example.complex', fields: [{ name: 'url',    type: 'string', default: '' }, { name: 'duration',type: 'long',   default: 0 }] },
        { type: 'record', name: 'PurchaseEvent', namespace: 'com.example.complex', fields: [{ name: 'itemId', type: 'string', default: '' }, { name: 'amount',  type: 'double', default: 0.0 }] },
        { type: 'record', name: 'ErrorEvent',    namespace: 'com.example.complex', fields: [{ name: 'code',   type: 'int',    default: 0 }, { name: 'message', type: 'string', default: '' }] },
      ],
      default: null,
    },
  ],
});

// 11c. Mutual reference (A references B in its field, B defined inline)
write('complex', 'mutual_reference_parent', {
  type: 'record',
  name: 'Parent',
  namespace: 'com.example.complex',
  doc: 'Parent record with an inline child definition.',
  fields: [
    { name: 'id',    type: 'string',   default: '' },
    { name: 'name',  type: 'string',   default: '' },
    {
      name: 'children',
      type: {
        type: 'array',
        items: {
          type: 'record',
          name: 'Child',
          namespace: 'com.example.complex',
          doc: 'Child record nested inside Parent.',
          fields: [
            { name: 'id',       type: 'string',  default: '' },
            { name: 'name',     type: 'string',  default: '' },
            { name: 'parentId', type: 'string',  default: '' },
          ],
        },
      },
      default: [],
    },
  ],
});

// 11d. Triple self-reference (graph node)
write('complex', 'graph_node', {
  type: 'record',
  name: 'GraphNode',
  namespace: 'com.example.complex',
  doc: 'A directed graph node with multiple outgoing edges.',
  fields: [
    { name: 'id',       type: 'string',  default: '' },
    { name: 'label',    type: 'string',  default: '' },
    { name: 'data',     type: ['null', 'string'],  default: null },
    {
      name: 'neighbors',
      type: {
        type: 'array',
        items: 'com.example.complex.GraphNode',
      },
      default: [],
    },
  ],
});

// 11e. Mixed: record containing all complex types
write('complex', 'kitchen_sink', {
  type: 'record',
  name: 'KitchenSink',
  namespace: 'com.example.complex',
  doc: 'One record containing every Avro complex type and a mix of logical types.',
  fields: [
    { name: 'str',     type: 'string',    default: '' },
    { name: 'num',     type: 'long',      default: 0 },
    { name: 'flag',    type: 'boolean',   default: false },
    { name: 'ratio',   type: 'double',    default: 0.0 },
    { name: 'raw',     type: 'bytes',     default: '' },
    {
      name: 'status',
      type: { type: 'enum', name: 'KSStatus', namespace: 'com.example.complex', symbols: ['OPEN','CLOSED'], default: 'OPEN' },
      default: 'OPEN',
    },
    {
      name: 'hash',
      type: { type: 'fixed', name: 'KSHash', namespace: 'com.example.complex', size: 16 },
    },
    { name: 'tags',    type: { type: 'array', items: 'string' }, default: [] },
    { name: 'attrs',   type: { type: 'map', values: 'string' },  default: {} },
    { name: 'optVal',  type: ['null', 'string'],  default: null },
    { name: 'date',    type: { type: 'int',  logicalType: 'date' } },
    { name: 'ts',      type: { type: 'long', logicalType: 'timestamp-millis' } },
    { name: 'price',   type: { type: 'bytes', logicalType: 'decimal', precision: 10, scale: 2 } },
    { name: 'uuid',    type: { type: 'string', logicalType: 'uuid' } },
  ],
});

// 11f. Schema with map of records
write('complex', 'map_of_typed_records', {
  type: 'record',
  name: 'TypedRegistry',
  namespace: 'com.example.complex',
  doc: 'A map from string keys to heterogeneous records (union values).',
  fields: [
    { name: 'name',    type: 'string',    default: '' },
    { name: 'version', type: 'int',       default: 1 },
    {
      name: 'entries',
      type: {
        type: 'map',
        values: ['null',
          { type: 'record', name: 'RegistryEntryA', namespace: 'com.example.complex', fields: [{ name: 'data', type: 'string', default: '' }] },
          { type: 'record', name: 'RegistryEntryB', namespace: 'com.example.complex', fields: [{ name: 'value', type: 'long', default: 0 }] },
        ],
      },
      default: {},
    },
  ],
});

// 11g. Protocol-style error record (spec §Protocol Declaration)
write('complex', 'protocol_error_record', {
  type: 'error',
  name: 'ProtocolError',
  namespace: 'com.example.complex',
  doc: 'An error type as used in Avro protocol definitions.',
  fields: [
    { name: 'code',    type: 'int',     default: 0 },
    { name: 'message', type: 'string',  default: '' },
    { name: 'details', type: { type: 'map', values: 'string' }, default: {} },
    { name: 'cause',   type: ['null', 'string'], default: null },
  ],
});

// 11h. Realistic Kafka-style event schemas
const kafkaEvents = [
  {
    name: 'UserCreatedEvent',
    ns: 'com.example.events',
    fields: [
      { name: 'userId',    type: { type: 'string', logicalType: 'uuid' } },
      { name: 'email',     type: 'string',  default: '' },
      { name: 'firstName', type: 'string',  default: '' },
      { name: 'lastName',  type: 'string',  default: '' },
      { name: 'createdAt', type: { type: 'long', logicalType: 'timestamp-millis' } },
    ],
  },
  {
    name: 'OrderPlacedEvent',
    ns: 'com.example.events',
    fields: [
      { name: 'orderId',   type: { type: 'string', logicalType: 'uuid' } },
      { name: 'userId',    type: { type: 'string', logicalType: 'uuid' } },
      { name: 'total',     type: { type: 'bytes', logicalType: 'decimal', precision: 10, scale: 2 } },
      { name: 'currency',  type: 'string',  default: 'USD' },
      { name: 'placedAt',  type: { type: 'long', logicalType: 'timestamp-millis' } },
    ],
  },
  {
    name: 'PaymentProcessedEvent',
    ns: 'com.example.events',
    fields: [
      { name: 'paymentId', type: { type: 'string', logicalType: 'uuid' } },
      { name: 'orderId',   type: { type: 'string', logicalType: 'uuid' } },
      { name: 'status',    type: 'string',  default: '' },
      { name: 'amount',    type: { type: 'bytes', logicalType: 'decimal', precision: 10, scale: 2 } },
      { name: 'processedAt', type: { type: 'long', logicalType: 'timestamp-millis' } },
    ],
  },
  {
    name: 'InventoryUpdatedEvent',
    ns: 'com.example.events',
    fields: [
      { name: 'productId', type: { type: 'string', logicalType: 'uuid' } },
      { name: 'delta',     type: 'int',     default: 0 },
      { name: 'reason',    type: 'string',  default: '' },
      { name: 'updatedAt', type: { type: 'long', logicalType: 'timestamp-millis' } },
    ],
  },
  {
    name: 'SessionStartedEvent',
    ns: 'com.example.events',
    fields: [
      { name: 'sessionId', type: { type: 'string', logicalType: 'uuid' } },
      { name: 'userId',    type: ['null', { type: 'string', logicalType: 'uuid' }], default: null },
      { name: 'ip',        type: 'string',  default: '' },
      { name: 'userAgent', type: ['null', 'string'], default: null },
      { name: 'startedAt', type: { type: 'long', logicalType: 'timestamp-millis' } },
    ],
  },
  {
    name: 'AlertTriggeredEvent',
    ns: 'com.example.events',
    fields: [
      { name: 'alertId',   type: { type: 'string', logicalType: 'uuid' } },
      { name: 'ruleId',    type: 'string',  default: '' },
      { name: 'severity',  type: 'string',  default: 'INFO' },
      { name: 'message',   type: 'string',  default: '' },
      { name: 'triggeredAt', type: { type: 'long', logicalType: 'timestamp-millis' } },
      { name: 'resolvedAt',  type: ['null', { type: 'long', logicalType: 'timestamp-millis' }], default: null },
    ],
  },
  {
    name: 'DataExportedEvent',
    ns: 'com.example.events',
    fields: [
      { name: 'exportId',  type: { type: 'string', logicalType: 'uuid' } },
      { name: 'format',    type: 'string',  default: 'AVRO' },
      { name: 'rowCount',  type: 'long',    default: 0 },
      { name: 'sizeBytes', type: 'long',    default: 0 },
      { name: 'checksum',  type: ['null', { type: 'bytes', logicalType: 'big-decimal' }], default: null },
      { name: 'exportedAt',type: { type: 'long', logicalType: 'timestamp-micros' } },
    ],
  },
  {
    name: 'ConfigChangedEvent',
    ns: 'com.example.events',
    fields: [
      { name: 'changeId',  type: { type: 'string', logicalType: 'uuid' } },
      { name: 'key',       type: 'string',  default: '' },
      { name: 'oldValue',  type: ['null', 'string'], default: null },
      { name: 'newValue',  type: 'string',  default: '' },
      { name: 'changedBy', type: 'string',  default: '' },
      { name: 'changedAt', type: { type: 'long', logicalType: 'timestamp-millis' } },
    ],
  },
  {
    name: 'ReportGeneratedEvent',
    ns: 'com.example.events',
    fields: [
      { name: 'reportId',  type: { type: 'string', logicalType: 'uuid' } },
      { name: 'type',      type: 'string',  default: '' },
      { name: 'period',    type: { type: 'fixed', name: 'ReportDuration', namespace: 'com.example.events', size: 12, logicalType: 'duration' } },
      { name: 'startDate', type: { type: 'int',  logicalType: 'date' } },
      { name: 'endDate',   type: { type: 'int',  logicalType: 'date' } },
      { name: 'generatedAt', type: { type: 'long', logicalType: 'timestamp-millis' } },
    ],
  },
  {
    name: 'ScheduledTaskEvent',
    ns: 'com.example.events',
    fields: [
      { name: 'taskId',    type: { type: 'string', logicalType: 'uuid' } },
      { name: 'name',      type: 'string',  default: '' },
      { name: 'scheduledFor', type: { type: 'long', logicalType: 'timestamp-millis' } },
      { name: 'repeatEvery',  type: ['null', { type: 'fixed', name: 'TaskDuration', namespace: 'com.example.events', size: 12, logicalType: 'duration' }], default: null },
      { name: 'createdAt', type: { type: 'long', logicalType: 'local-timestamp-millis' } },
    ],
  },
];

for (const e of kafkaEvents) {
  write('complex', `kafka_event_${e.name.replace(/Event$/, '').toLowerCase()}`, {
    type: 'record',
    name: e.name,
    namespace: e.ns,
    doc: `Kafka-style event: ${e.name}.`,
    fields: e.fields,
  });
}

// 11i. Spec-driven complex examples
// The HandshakeRequest from the spec
write('complex', 'spec_handshake_request', {
  type: 'record',
  name: 'HandshakeRequest',
  namespace: 'org.apache.avro.ipc',
  doc: 'Avro spec §Handshake: HandshakeRequest schema.',
  fields: [
    { name: 'clientHash',    type: { type: 'fixed', name: 'HandshakeMD5Client', namespace: 'org.apache.avro.ipc', size: 16 } },
    { name: 'clientProtocol',type: ['null', 'string'],  default: null },
    { name: 'serverHash',    type: 'org.apache.avro.ipc.HandshakeMD5Client' },
    { name: 'meta',          type: ['null', { type: 'map', values: 'bytes' }], default: null },
  ],
});

write('complex', 'spec_handshake_response', {
  type: 'record',
  name: 'HandshakeResponse',
  namespace: 'org.apache.avro.ipc',
  doc: 'Avro spec §Handshake: HandshakeResponse schema.',
  fields: [
    {
      name: 'match',
      type: {
        type: 'enum',
        name: 'HandshakeMatch',
        namespace: 'org.apache.avro.ipc',
        symbols: ['BOTH', 'CLIENT', 'NONE'],
        default: 'NONE',
      },
      default: 'NONE',
    },
    { name: 'serverProtocol', type: ['null', 'string'],  default: null },
    { name: 'serverHash',     type: ['null', { type: 'fixed', name: 'HandshakeMD5Server', namespace: 'org.apache.avro.ipc', size: 16 }], default: null },
    { name: 'meta',           type: ['null', { type: 'map', values: 'bytes' }], default: null },
  ],
});

// Avro container file Header schema (from spec)
write('complex', 'spec_file_header', {
  type: 'record',
  name: 'Header',
  namespace: 'org.apache.avro.file',
  doc: 'Avro spec §Object Container Files: file header schema.',
  fields: [
    { name: 'magic', type: { type: 'fixed', name: 'Magic', namespace: 'org.apache.avro.file', size: 4 } },
    { name: 'meta',  type: { type: 'map', values: 'bytes' } },
    { name: 'sync',  type: { type: 'fixed', name: 'FileSync', namespace: 'org.apache.avro.file', size: 16 } },
  ],
});

// 11j. Large union (8 named types)
write('complex', 'large_union_eight_types', [
  'null',
  { type: 'record', name: 'TypeA', namespace: 'com.example.complex.union8', fields: [{ name: 'v', type: 'string', default: '' }] },
  { type: 'record', name: 'TypeB', namespace: 'com.example.complex.union8', fields: [{ name: 'v', type: 'int',    default: 0 }] },
  { type: 'record', name: 'TypeC', namespace: 'com.example.complex.union8', fields: [{ name: 'v', type: 'long',   default: 0 }] },
  { type: 'record', name: 'TypeD', namespace: 'com.example.complex.union8', fields: [{ name: 'v', type: 'double', default: 0.0 }] },
  { type: 'enum',   name: 'TypeE', namespace: 'com.example.complex.union8', symbols: ['E1','E2','E3'], default: 'E1' },
  { type: 'fixed',  name: 'TypeF', namespace: 'com.example.complex.union8', size: 4 },
  { type: 'record', name: 'TypeG', namespace: 'com.example.complex.union8', fields: [{ name: 'v', type: 'boolean', default: false }] },
  { type: 'record', name: 'TypeH', namespace: 'com.example.complex.union8', fields: [{ name: 'v', type: 'bytes',   default: '' }] },
]);

// 11k. Multi-level complex nesting
write('complex', 'array_of_maps_of_arrays', {
  type: 'record',
  name: 'NestedCollections',
  namespace: 'com.example.complex',
  doc: 'Array of maps of arrays of records — complex nesting.',
  fields: [
    {
      name: 'data',
      type: {
        type: 'array',
        items: {
          type: 'map',
          values: {
            type: 'array',
            items: {
              type: 'record',
              name: 'LeafRecord',
              namespace: 'com.example.complex',
              fields: [
                { name: 'key',   type: 'string', default: '' },
                { name: 'value', type: 'double', default: 0.0 },
              ],
            },
          },
        },
      },
      default: [],
    },
  ],
});

// 11l. 20 additional complex schemas mixing features
for (let i = 1; i <= 20; i++) {
  write('complex', `complex_misc_${String(i).padStart(2, '0')}`, {
    type: 'record',
    name: `ComplexMisc${String(i).padStart(2, '0')}`,
    namespace: 'com.example.complex.misc',
    doc: `Miscellaneous complex schema ${i}, mixing primitives, collections, and logical types.`,
    fields: [
      { name: 'id',          type: { type: 'string', logicalType: 'uuid' } },
      { name: 'version',     type: 'int',     default: i },
      { name: 'name',        type: 'string',  default: '' },
      { name: 'optionalMsg', type: ['null', 'string'], default: null },
      { name: 'metadata',    type: { type: 'map', values: 'string' }, default: {} },
      { name: 'tags',        type: { type: 'array', items: 'string' }, default: [] },
      { name: 'createdAt',   type: { type: 'long', logicalType: 'timestamp-millis' } },
      {
        name: 'status',
        type: {
          type: 'enum',
          name: `MiscStatus${String(i).padStart(2, '0')}`,
          namespace: 'com.example.complex.misc',
          symbols: ['ACTIVE', 'INACTIVE', 'DELETED'],
          default: 'ACTIVE',
        },
        default: 'ACTIVE',
      },
    ],
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// 12. EXTRA RECORDS — to reach ~500 total
// ─────────────────────────────────────────────────────────────────────────────

// 12a. 30 extra record schemas covering diverse domains
const extraRecords = [
  { name: 'ApiRequest',       ns: 'com.example.api',       fields: [ { name: 'method', type: 'string', default: 'GET' }, { name: 'path', type: 'string', default: '/' }, { name: 'headers', type: { type: 'map', values: 'string' }, default: {} }, { name: 'body', type: ['null', 'bytes'], default: null } ] },
  { name: 'ApiResponse',      ns: 'com.example.api',       fields: [ { name: 'status', type: 'int', default: 200 }, { name: 'headers', type: { type: 'map', values: 'string' }, default: {} }, { name: 'body', type: ['null', 'bytes'], default: null } ] },
  { name: 'JobRecord',        ns: 'com.example.jobs',      fields: [ { name: 'jobId', type: 'string', default: '' }, { name: 'type', type: 'string', default: '' }, { name: 'status', type: 'string', default: 'QUEUED' }, { name: 'attempts', type: 'int', default: 0 }, { name: 'maxAttempts', type: 'int', default: 3 }, { name: 'scheduledAt', type: { type: 'long', logicalType: 'timestamp-millis' } }, { name: 'completedAt', type: ['null', { type: 'long', logicalType: 'timestamp-millis' }], default: null } ] },
  { name: 'WebhookPayload',   ns: 'com.example.webhooks',  fields: [ { name: 'id', type: 'string', default: '' }, { name: 'event', type: 'string', default: '' }, { name: 'data', type: { type: 'map', values: 'string' }, default: {} }, { name: 'deliveredAt', type: { type: 'long', logicalType: 'timestamp-millis' } } ] },
  { name: 'CacheEntry',       ns: 'com.example.cache',     fields: [ { name: 'key', type: 'string', default: '' }, { name: 'value', type: 'bytes', default: '' }, { name: 'ttlMs', type: 'long', default: 300000 }, { name: 'cachedAt', type: { type: 'long', logicalType: 'timestamp-millis' } } ] },
  { name: 'StreamRecord',     ns: 'com.example.streams',   fields: [ { name: 'streamId', type: 'string', default: '' }, { name: 'partition', type: 'int', default: 0 }, { name: 'offset', type: 'long', default: 0 }, { name: 'key', type: ['null', 'bytes'], default: null }, { name: 'value', type: 'bytes', default: '' }, { name: 'timestamp', type: { type: 'long', logicalType: 'timestamp-millis' } } ] },
  { name: 'PaginationInfo',   ns: 'com.example.api',       fields: [ { name: 'page', type: 'int', default: 0 }, { name: 'size', type: 'int', default: 20 }, { name: 'total', type: 'long', default: 0 }, { name: 'hasNext', type: 'boolean', default: false }, { name: 'hasPrev', type: 'boolean', default: false } ] },
  { name: 'SortSpec',         ns: 'com.example.api',       fields: [ { name: 'field', type: 'string', default: '' }, { name: 'direction', type: 'string', default: 'ASC' } ] },
  { name: 'FilterSpec',       ns: 'com.example.api',       fields: [ { name: 'field', type: 'string', default: '' }, { name: 'op', type: 'string', default: 'EQ' }, { name: 'value', type: 'string', default: '' } ] },
  { name: 'AggregateSpec',    ns: 'com.example.analytics', fields: [ { name: 'field', type: 'string', default: '' }, { name: 'function', type: 'string', default: 'COUNT' }, { name: 'alias', type: ['null', 'string'], default: null } ] },
  { name: 'DataSchema',       ns: 'com.example.schema',    fields: [ { name: 'name', type: 'string', default: '' }, { name: 'version', type: 'int', default: 1 }, { name: 'fields', type: { type: 'array', items: 'string' }, default: [] }, { name: 'registeredAt', type: { type: 'long', logicalType: 'timestamp-millis' } } ] },
  { name: 'TransformRule',    ns: 'com.example.etl',       fields: [ { name: 'id', type: 'string', default: '' }, { name: 'sourceField', type: 'string', default: '' }, { name: 'targetField', type: 'string', default: '' }, { name: 'expression', type: 'string', default: '' } ] },
  { name: 'PipelineConfig',   ns: 'com.example.etl',       fields: [ { name: 'name', type: 'string', default: '' }, { name: 'source', type: 'string', default: '' }, { name: 'sink', type: 'string', default: '' }, { name: 'rules', type: { type: 'array', items: 'string' }, default: [] }, { name: 'enabled', type: 'boolean', default: true } ] },
  { name: 'ClusterNode',      ns: 'com.example.cluster',   fields: [ { name: 'nodeId', type: 'string', default: '' }, { name: 'host', type: 'string', default: '' }, { name: 'port', type: 'int', default: 8080 }, { name: 'role', type: 'string', default: 'FOLLOWER' }, { name: 'joinedAt', type: { type: 'long', logicalType: 'timestamp-millis' } } ] },
  { name: 'CircuitBreaker',   ns: 'com.example.resilience',fields: [ { name: 'name', type: 'string', default: '' }, { name: 'state', type: 'string', default: 'CLOSED' }, { name: 'failures', type: 'int', default: 0 }, { name: 'threshold', type: 'int', default: 5 }, { name: 'lastFailure', type: ['null', { type: 'long', logicalType: 'timestamp-millis' }], default: null } ] },
  { name: 'RetryPolicy',      ns: 'com.example.resilience',fields: [ { name: 'maxAttempts', type: 'int', default: 3 }, { name: 'initialDelayMs', type: 'long', default: 1000 }, { name: 'multiplier', type: 'double', default: 2.0 }, { name: 'maxDelayMs', type: 'long', default: 30000 } ] },
  { name: 'Quota',            ns: 'com.example.limits',    fields: [ { name: 'resource', type: 'string', default: '' }, { name: 'limit', type: 'long', default: 0 }, { name: 'used', type: 'long', default: 0 }, { name: 'resetAt', type: { type: 'long', logicalType: 'timestamp-millis' } } ] },
  { name: 'CostRecord',       ns: 'com.example.billing',   fields: [ { name: 'service', type: 'string', default: '' }, { name: 'amount', type: { type: 'bytes', logicalType: 'decimal', precision: 10, scale: 4 } }, { name: 'currency', type: 'string', default: 'USD' }, { name: 'billedAt', type: { type: 'int', logicalType: 'date' } } ] },
  { name: 'SubscriptionPlan', ns: 'com.example.billing',   fields: [ { name: 'planId', type: 'string', default: '' }, { name: 'name', type: 'string', default: '' }, { name: 'pricePerMonth', type: { type: 'bytes', logicalType: 'decimal', precision: 10, scale: 2 } }, { name: 'features', type: { type: 'array', items: 'string' }, default: [] } ] },
  { name: 'UsageRecord',      ns: 'com.example.billing',   fields: [ { name: 'userId', type: 'string', default: '' }, { name: 'resource', type: 'string', default: '' }, { name: 'quantity', type: 'long', default: 0 }, { name: 'unit', type: 'string', default: '' }, { name: 'recordedAt', type: { type: 'long', logicalType: 'timestamp-millis' } } ] },
  { name: 'DeploymentRecord', ns: 'com.example.devops',    fields: [ { name: 'deployId', type: 'string', default: '' }, { name: 'service', type: 'string', default: '' }, { name: 'version', type: 'string', default: '' }, { name: 'environment', type: 'string', default: 'prod' }, { name: 'deployedAt', type: { type: 'long', logicalType: 'timestamp-millis' } }, { name: 'deployedBy', type: 'string', default: '' } ] },
  { name: 'BuildRecord',      ns: 'com.example.devops',    fields: [ { name: 'buildId', type: 'string', default: '' }, { name: 'commit', type: 'string', default: '' }, { name: 'branch', type: 'string', default: '' }, { name: 'status', type: 'string', default: 'PENDING' }, { name: 'startedAt', type: { type: 'long', logicalType: 'timestamp-millis' } }, { name: 'finishedAt', type: ['null', { type: 'long', logicalType: 'timestamp-millis' }], default: null } ] },
  { name: 'TestRun',          ns: 'com.example.devops',    fields: [ { name: 'runId', type: 'string', default: '' }, { name: 'suite', type: 'string', default: '' }, { name: 'passed', type: 'int', default: 0 }, { name: 'failed', type: 'int', default: 0 }, { name: 'skipped', type: 'int', default: 0 }, { name: 'durationMs', type: 'long', default: 0 } ] },
  { name: 'DependencyRecord', ns: 'com.example.devops',    fields: [ { name: 'name', type: 'string', default: '' }, { name: 'version', type: 'string', default: '' }, { name: 'scope', type: 'string', default: 'runtime' }, { name: 'vulnerable', type: 'boolean', default: false } ] },
  { name: 'ServiceHealth',    ns: 'com.example.ops',       fields: [ { name: 'service', type: 'string', default: '' }, { name: 'instance', type: 'string', default: '' }, { name: 'healthy', type: 'boolean', default: true }, { name: 'cpu', type: 'float', default: 0.0 }, { name: 'memMb', type: 'long', default: 0 }, { name: 'checkedAt', type: { type: 'long', logicalType: 'timestamp-millis' } } ] },
  { name: 'IncidentRecord',   ns: 'com.example.ops',       fields: [ { name: 'incidentId', type: 'string', default: '' }, { name: 'title', type: 'string', default: '' }, { name: 'severity', type: 'string', default: 'P3' }, { name: 'status', type: 'string', default: 'OPEN' }, { name: 'openedAt', type: { type: 'long', logicalType: 'timestamp-millis' } }, { name: 'resolvedAt', type: ['null', { type: 'long', logicalType: 'timestamp-millis' }], default: null } ] },
  { name: 'ChangeRequest',    ns: 'com.example.ops',       fields: [ { name: 'crId', type: 'string', default: '' }, { name: 'description', type: 'string', default: '' }, { name: 'approver', type: ['null', 'string'], default: null }, { name: 'scheduledAt', type: ['null', { type: 'long', logicalType: 'timestamp-millis' }], default: null }, { name: 'approved', type: 'boolean', default: false } ] },
  { name: 'BackupRecord',     ns: 'com.example.ops',       fields: [ { name: 'backupId', type: 'string', default: '' }, { name: 'resource', type: 'string', default: '' }, { name: 'sizeBytes', type: 'long', default: 0 }, { name: 'checksum', type: ['null', 'string'], default: null }, { name: 'createdAt', type: { type: 'long', logicalType: 'timestamp-millis' } }, { name: 'expiresAt', type: { type: 'long', logicalType: 'timestamp-millis' } } ] },
  { name: 'SLARecord',        ns: 'com.example.ops',       fields: [ { name: 'service', type: 'string', default: '' }, { name: 'metric', type: 'string', default: '' }, { name: 'target', type: 'double', default: 99.9 }, { name: 'actual', type: 'double', default: 0.0 }, { name: 'period', type: { type: 'int', logicalType: 'date' } } ] },
  { name: 'OnCallShift',      ns: 'com.example.ops',       fields: [ { name: 'shiftId', type: 'string', default: '' }, { name: 'engineer', type: 'string', default: '' }, { name: 'startAt', type: { type: 'long', logicalType: 'timestamp-millis' } }, { name: 'endAt', type: { type: 'long', logicalType: 'timestamp-millis' } } ] },
];

for (const r of extraRecords) {
  write('records', `extra_${r.name.toLowerCase()}`, {
    type: 'record',
    name: r.name,
    namespace: r.ns,
    doc: `${r.name} record.`,
    fields: r.fields,
  });
}

// 12b. 30 extra enum schemas
const extraEnums = [
  { name: 'OrderStatus',       ns: 'com.example.orders',   symbols: ['PENDING','CONFIRMED','PROCESSING','SHIPPED','DELIVERED','CANCELLED','RETURNED'],  default: 'PENDING' },
  { name: 'AlertSeverity',     ns: 'com.example.ops',      symbols: ['INFO','WARNING','ERROR','CRITICAL'],                                               default: 'INFO' },
  { name: 'SortDirection',     ns: 'com.example.api',      symbols: ['ASC','DESC'],                                                                      default: 'ASC' },
  { name: 'TokenType',         ns: 'com.example.auth',     symbols: ['ACCESS','REFRESH','API_KEY','ID_TOKEN'],                                           default: 'ACCESS' },
  { name: 'GrantType',         ns: 'com.example.auth',     symbols: ['AUTHORIZATION_CODE','CLIENT_CREDENTIALS','PASSWORD','REFRESH_TOKEN','IMPLICIT'],   default: 'AUTHORIZATION_CODE' },
  { name: 'WebSocketState',    ns: 'com.example.ws',       symbols: ['CONNECTING','OPEN','CLOSING','CLOSED'],                                            default: 'CLOSED' },
  { name: 'MigrationState',    ns: 'com.example.db',       symbols: ['PENDING','RUNNING','COMPLETED','FAILED','ROLLED_BACK'],                            default: 'PENDING' },
  { name: 'CronSchedule',      ns: 'com.example.jobs',     symbols: ['MINUTELY','HOURLY','DAILY','WEEKLY','MONTHLY','YEARLY'],                           default: 'DAILY' },
  { name: 'QueueStrategy',     ns: 'com.example.queues',   symbols: ['FIFO','LIFO','PRIORITY','RANDOM'],                                                 default: 'FIFO' },
  { name: 'EventType',         ns: 'com.example.events',   symbols: ['CREATE','UPDATE','DELETE','RESTORE','ARCHIVE','PUBLISH'],                          default: 'CREATE' },
  { name: 'HashAlgorithm',     ns: 'com.example.crypto',   symbols: ['MD5','SHA1','SHA256','SHA512','BLAKE2','ARGON2'],                                   default: 'SHA256' },
  { name: 'EncryptionAlgorithm',ns:'com.example.crypto',   symbols: ['AES_128','AES_192','AES_256','RSA_2048','RSA_4096','ECDSA'],                        default: 'AES_256' },
  { name: 'ContentType',       ns: 'com.example.content',  symbols: ['ARTICLE','VIDEO','PODCAST','IMAGE','DOCUMENT','CODE'],                             default: 'ARTICLE' },
  { name: 'PublishState',      ns: 'com.example.content',  symbols: ['DRAFT','SCHEDULED','PUBLISHED','UNLISTED','PRIVATE','DELETED'],                    default: 'DRAFT' },
  { name: 'ReactionType',      ns: 'com.example.social',   symbols: ['LIKE','LOVE','HAHA','WOW','SAD','ANGRY'],                                          default: 'LIKE' },
  { name: 'ConnectionStatus',  ns: 'com.example.social',   symbols: ['NONE','PENDING','CONNECTED','BLOCKED'],                                            default: 'NONE' },
  { name: 'NotificationType',  ns: 'com.example.notif',    symbols: ['SYSTEM','MENTION','REPLY','FOLLOW','LIKE','DM'],                                   default: 'SYSTEM' },
  { name: 'DeviceType',        ns: 'com.example.devices',  symbols: ['MOBILE','TABLET','DESKTOP','SMART_TV','IOT','WEARABLE'],                           default: 'DESKTOP' },
  { name: 'OSPlatform',        ns: 'com.example.devices',  symbols: ['ANDROID','IOS','WINDOWS','MACOS','LINUX','OTHER'],                                 default: 'OTHER' },
  { name: 'BrowserType',       ns: 'com.example.devices',  symbols: ['CHROME','FIREFOX','SAFARI','EDGE','OPERA','OTHER'],                                default: 'OTHER' },
  { name: 'RegionCode',        ns: 'com.example.geo',      symbols: ['US_EAST','US_WEST','EU_WEST','EU_CENTRAL','APAC','SA','AF','ME'],                  default: 'US_EAST' },
  { name: 'TimeZoneGroup',     ns: 'com.example.geo',      symbols: ['UTC_MINUS_12','UTC_MINUS_8','UTC_MINUS_5','UTC','UTC_PLUS_1','UTC_PLUS_8','UTC_PLUS_12'], default: 'UTC' },
  { name: 'ProductCategory',   ns: 'com.example.ecommerce',symbols: ['ELECTRONICS','CLOTHING','FOOD','FURNITURE','BOOKS','SPORTS','BEAUTY','AUTOMOTIVE'], default: 'ELECTRONICS' },
  { name: 'DiscountType',      ns: 'com.example.ecommerce',symbols: ['PERCENT','FIXED','FREE_SHIPPING','BUY_X_GET_Y'],                                   default: 'PERCENT' },
  { name: 'ReturnReason',      ns: 'com.example.ecommerce',symbols: ['DAMAGED','WRONG_ITEM','NOT_AS_DESCRIBED','CHANGED_MIND','DEFECTIVE','OTHER'],      default: 'OTHER' },
  { name: 'MLModelType',       ns: 'com.example.ml',       symbols: ['CLASSIFICATION','REGRESSION','CLUSTERING','GENERATION','EMBEDDING','DETECTION'],  default: 'CLASSIFICATION' },
  { name: 'FeatureType',       ns: 'com.example.ml',       symbols: ['NUMERIC','CATEGORICAL','TEXT','IMAGE','AUDIO','TIMESTAMP'],                        default: 'NUMERIC' },
  { name: 'TrainingStatus',    ns: 'com.example.ml',       symbols: ['QUEUED','PREPARING','TRAINING','EVALUATING','COMPLETED','FAILED'],                 default: 'QUEUED' },
  { name: 'DataQuality',       ns: 'com.example.data',     symbols: ['GOOD','ACCEPTABLE','POOR','UNKNOWN'],                                              default: 'UNKNOWN' },
  { name: 'SchemaEvolution',   ns: 'com.example.schema',   symbols: ['BACKWARD','FORWARD','FULL','NONE'],                                                default: 'BACKWARD',  doc: 'Schema compatibility types.' },
];

for (const e of extraEnums) {
  write('enums', `extra_${e.name.toLowerCase()}`, {
    type: 'enum',
    name: e.name,
    namespace: e.ns,
    doc: e.doc || `${e.name} enum.`,
    symbols: e.symbols,
    default: e.default,
  });
}

// 12c. 30 extra fixed schemas
const extraFixed = [
  { name: 'IBAN',           ns: 'com.example.banking',  size: 34,  doc: 'IBAN bank account number (max 34 chars).' },
  { name: 'SWIFT',          ns: 'com.example.banking',  size: 11,  doc: 'SWIFT/BIC code (11 bytes).' },
  { name: 'IBAN16',         ns: 'com.example.banking',  size: 16,  doc: 'Short IBAN variant (16 bytes).' },
  { name: 'Fingerprint32',  ns: 'com.example.crypto',   size: 32,  doc: '256-bit fingerprint.' },
  { name: 'Salt16',         ns: 'com.example.crypto',   size: 16,  doc: 'Cryptographic salt (16 bytes).' },
  { name: 'IV16',           ns: 'com.example.crypto',   size: 16,  doc: 'AES initialisation vector (16 bytes).' },
  { name: 'GCMTag16',       ns: 'com.example.crypto',   size: 16,  doc: 'GCM authentication tag (16 bytes).' },
  { name: 'Blake2b32',      ns: 'com.example.crypto',   size: 32,  doc: 'BLAKE2b-256 digest.' },
  { name: 'EtherAddress',   ns: 'com.example.crypto',   size: 20,  doc: 'Ethereum address (20 bytes).' },
  { name: 'BitcoinKey',     ns: 'com.example.crypto',   size: 33,  doc: 'Compressed Bitcoin public key (33 bytes).' },
  { name: 'ObjectId',       ns: 'com.example.db',       size: 12,  doc: 'MongoDB-style ObjectId (12 bytes).' },
  { name: 'RowVersion',     ns: 'com.example.db',       size: 8,   doc: 'SQL Server rowversion / timestamp (8 bytes).' },
  { name: 'GridFSChunk',    ns: 'com.example.db',       size: 255, doc: 'GridFS chunk identifier (255 bytes).' },
  { name: 'GeoHash8',       ns: 'com.example.geo',      size: 8,   doc: 'GeoHash encoded as 8-byte fixed.' },
  { name: 'CellId8',        ns: 'com.example.geo',      size: 8,   doc: 'S2 CellId (64-bit = 8 bytes).' },
  { name: 'PrimaryKey16',   ns: 'com.example.keys',     size: 16,  doc: 'Opaque 16-byte primary key.' },
  { name: 'ForeignKey16',   ns: 'com.example.keys',     size: 16,  doc: 'Opaque 16-byte foreign key.' },
  { name: 'CompositeKey32', ns: 'com.example.keys',     size: 32,  doc: 'Composite key (32 bytes).' },
  { name: 'SortKey8',       ns: 'com.example.keys',     size: 8,   doc: 'Sort key (8 bytes).' },
  { name: 'PartitionKey16', ns: 'com.example.keys',     size: 16,  doc: 'Partition key (16 bytes).' },
  { name: 'TraceId16',      ns: 'com.example.tracing',  size: 16,  doc: 'OpenTelemetry TraceId (128-bit = 16 bytes).' },
  { name: 'SpanId8',        ns: 'com.example.tracing',  size: 8,   doc: 'OpenTelemetry SpanId (64-bit = 8 bytes).' },
  { name: 'RequestId16',    ns: 'com.example.tracing',  size: 16,  doc: 'HTTP request correlation ID (16 bytes).' },
  { name: 'SessionToken32', ns: 'com.example.auth',     size: 32,  doc: 'Session token (32 bytes).' },
  { name: 'APIKey32',       ns: 'com.example.auth',     size: 32,  doc: 'API key (32 bytes).' },
  { name: 'CSRFToken32',    ns: 'com.example.auth',     size: 32,  doc: 'CSRF token (32 bytes).' },
  { name: 'SnowflakeId8',   ns: 'com.example.ids',      size: 8,   doc: 'Snowflake-style 64-bit ID (8 bytes).' },
  { name: 'ULID10',         ns: 'com.example.ids',      size: 10,  doc: 'ULID compact representation (10 bytes).' },
  { name: 'NanoId21',       ns: 'com.example.ids',      size: 21,  doc: 'NanoID (21 bytes).' },
  { name: 'XID12',          ns: 'com.example.ids',      size: 12,  doc: 'XID (12-byte globally unique ID).' },
];

for (const f of extraFixed) {
  write('fixed', `extra_${f.name.toLowerCase()}`, {
    type: 'fixed',
    name: f.name,
    namespace: f.ns,
    size: f.size,
    doc: f.doc,
  });
}

// 12d. 20 extra union record schemas covering edge cases
const extraUnionRecords = [
  { name: 'OptionalArray',      field: { name: 'value', type: ['null', { type: 'array', items: 'string' }], default: null } },
  { name: 'OptionalMap',        field: { name: 'value', type: ['null', { type: 'map', values: 'string' }], default: null } },
  { name: 'StringOrArray',      field: { name: 'value', type: ['string', { type: 'array', items: 'string' }], default: '' } },
  { name: 'IntOrDoubleField',   field: { name: 'value', type: ['int', 'double'], default: 0 } },
  { name: 'NullIntOrLong',      field: { name: 'value', type: ['null', 'int', 'long'], default: null } },
  { name: 'NullBytesOrString',  field: { name: 'value', type: ['null', 'bytes', 'string'], default: null } },
  { name: 'NullOrDate',         field: { name: 'value', type: ['null', { type: 'int', logicalType: 'date' }], default: null } },
  { name: 'NullOrUUID',         field: { name: 'value', type: ['null', { type: 'string', logicalType: 'uuid' }], default: null } },
  { name: 'NullOrDecimal',      field: { name: 'value', type: ['null', { type: 'bytes', logicalType: 'decimal', precision: 18, scale: 6 }], default: null } },
  { name: 'NullOrTimestamp',    field: { name: 'value', type: ['null', { type: 'long', logicalType: 'timestamp-millis' }], default: null } },
  { name: 'NullOrFixed',        field: { name: 'value', type: ['null', { type: 'fixed', name: 'ExtraUnionFixed', namespace: 'com.example.unions.extra', size: 16 }], default: null } },
  { name: 'NullOrEnum',         field: { name: 'value', type: ['null', { type: 'enum', name: 'ExtraUnionEnum', namespace: 'com.example.unions.extra', symbols: ['X','Y','Z'], default: 'X' }], default: null } },
  { name: 'NullOrArrayOfLong',  field: { name: 'value', type: ['null', { type: 'array', items: 'long' }], default: null } },
  { name: 'NullOrMapOfDouble',  field: { name: 'value', type: ['null', { type: 'map', values: 'double' }], default: null } },
  { name: 'NullOrArrayOfBytes', field: { name: 'value', type: ['null', { type: 'array', items: 'bytes' }], default: null } },
  { name: 'BooleanOrString',    field: { name: 'value', type: ['boolean', 'string'], default: false } },
  { name: 'FloatOrDouble',      field: { name: 'value', type: ['float', 'double'], default: 0.0 } },
  { name: 'NullOrFloat',        field: { name: 'value', type: ['null', 'float'], default: null } },
  { name: 'IntOrString',        field: { name: 'value', type: ['int', 'string'], default: 0 } },
  { name: 'NullBoolInt',        field: { name: 'value', type: ['null', 'boolean', 'int'], default: null } },
];

for (const u of extraUnionRecords) {
  write('unions', `extra_${u.name.toLowerCase()}`, {
    type: 'record',
    name: u.name,
    namespace: 'com.example.unions.extra',
    doc: `Union edge case: ${u.name}.`,
    fields: [{ name: 'id', type: 'string', default: '' }, u.field],
  });
}

// 12e. Final top-up — 25 more schemas to reach ~500
// Extra arrays
const topUpArrays = ['double','long','boolean','float','null'];
for (const t of topUpArrays) {
  write('arrays', `extra_array_of_${t}`, { type: 'array', items: t });
}
// Extra maps
const topUpMaps = ['double','long','boolean','float','null'];
for (const t of topUpMaps) {
  write('maps', `extra_map_of_${t}`, { type: 'map', values: t });
}
// Extra primitives (annotated as record fields with order variations)
const orderTypes = ['ascending','descending','ignore'];
for (const o of orderTypes) {
  write('primitives', `primitive_order_${o}`, {
    type: 'record',
    name: `PrimitiveOrder${capitalize(o)}`,
    namespace: 'com.example.primitives',
    doc: `Record with all primitives using order="${o}".`,
    fields: PRIMITIVES.filter(p => p !== 'null').map(p => ({
      name: `${p}Field`,
      type: p,
      order: o,
      default: primitiveDefault(p),
    })),
  });
}
// Extra name/namespace edge cases
write('names', 'all_primitive_type_names_as_record_names', {
  type: 'record',
  name: 'StringRecord',
  namespace: 'com.example.names.primitivenames',
  doc: 'Uses "string" as a simple name but inside a namespace — legal per spec.',
  fields: [{ name: 'v', type: 'string', default: '' }],
});
write('names', 'single_char_name', {
  type: 'record', name: 'X', namespace: 'com.example.names.single',
  doc: 'Minimal valid name: single character.',
  fields: [{ name: 'v', type: 'int', default: 0 }],
});
write('names', 'underscore_only_name', {
  type: 'record', name: '_', namespace: 'com.example.names.underscore',
  doc: 'Single underscore is a valid name per spec: starts with [A-Za-z_].',
  fields: [{ name: 'v', type: 'int', default: 0 }],
});
write('names', 'long_namespace', {
  type: 'record',
  name: 'DeepRecord',
  namespace: 'com.example.a.b.c.d.e.f.g',
  doc: 'Record with a very deeply nested namespace.',
  fields: [{ name: 'v', type: 'string', default: '' }],
});
// One more complex schema
write('complex', 'spec_object_container_data_block', {
  type: 'record',
  name: 'DataBlock',
  namespace: 'org.apache.avro.file',
  doc: 'Avro spec §Object Container Files: file data block schema.',
  fields: [
    { name: 'count', type: 'long' },
    { name: 'data',  type: 'bytes' },
    { name: 'sync',  type: { type: 'fixed', name: 'DataBlockSync', namespace: 'org.apache.avro.file', size: 16 } },
  ],
});
// Extra logical types: arrays and maps of logical type values
write('logical-types', 'array_of_dates', {
  type: 'record',
  name: 'DateList',
  namespace: 'com.example.logical',
  doc: 'Array of date logical type values.',
  fields: [{ name: 'dates', type: { type: 'array', items: { type: 'int', logicalType: 'date' } }, default: [] }],
});
write('logical-types', 'map_of_timestamps', {
  type: 'record',
  name: 'TimestampMap',
  namespace: 'com.example.logical',
  doc: 'Map of timestamp-millis logical type values.',
  fields: [{ name: 'timestamps', type: { type: 'map', values: { type: 'long', logicalType: 'timestamp-millis' } }, default: {} }],
});

// ─────────────────────────────────────────────────────────────────────────────
// Summary
// ─────────────────────────────────────────────────────────────────────────────

const allFiles = [];
function countFiles(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    if (e.isDirectory()) countFiles(path.join(dir, e.name));
    else if (e.name.endsWith('.avsc')) allFiles.push(path.join(dir, e.name));
  }
}
countFiles(OUT);

console.log(`✅ Generated ${allFiles.length} .avsc files in ${OUT}`);

const categories = {};
for (const f of allFiles) {
  const cat = path.relative(OUT, path.dirname(f));
  categories[cat] = (categories[cat] || 0) + 1;
}
for (const [cat, count] of Object.entries(categories).sort()) {
  console.log(`   ${count.toString().padStart(4)} files in schemas/${cat}/`);
}
