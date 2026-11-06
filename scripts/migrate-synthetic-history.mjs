#!/usr/bin/env node
/**
 * Migration: remove synthetic price history created by the retired
 * `generateHistoricalBaseline()` generator (lib/history.ts, removed in 2.0.2).
 *
 * The generator inserted price_samples with source "historical" or "mrp-baseline".
 * Real scans only ever write source "direct" or "proxy", so the source label is the
 * generator's signature. A record is only deleted when it matches ALL of:
 *   - source is "historical" or "mrp-baseline"
 *   - price is a number > 0
 *   - capturedAt is a valid Date in the past
 * Records with source "direct" or "proxy" are NEVER touched.
 *
 * Modes:
 *   node scripts/migrate-synthetic-history.mjs
 *       Dry run (default). Reports counts by source; writes nothing.
 *   node scripts/migrate-synthetic-history.mjs --execute
 *       Export a JSON backup, delete matching samples, unset the retired
 *       historyBackfilled / historyBackfilledAt flags on affected products.
 *   node scripts/migrate-synthetic-history.mjs --restore=<backup-file>
 *       Rollback: re-insert the backed-up sample documents (original _ids kept).
 *   Optional flags: --uri=<mongodb-uri> --db=<name> --export=<file>
 *
 * Env: MONGODB_URI (required unless --uri), MONGODB_DB (default "price_tracker").
 *
 * Idempotent: after a successful run, re-running --execute deletes 0 documents.
 */
import { MongoClient } from "mongodb";
import { readFileSync, writeFileSync, existsSync } from "node:fs";

const SYNTHETIC_SOURCES = ["historical", "mrp-baseline"];
const OBSERVED_SOURCES = ["direct", "proxy"];

const args = process.argv.slice(2);
const flag = (name) => args.find((arg) => arg === name) !== undefined;
const optValue = (name) => {
  const hit = args.find((arg) => arg.startsWith(`${name}=`));
  return hit ? hit.slice(name.length + 1) : undefined;
};

const execute = flag("--execute");
const restoreFile = optValue("--restore");
const uri = optValue("--uri") || process.env.MONGODB_URI;
const dbName = optValue("--db") || process.env.MONGODB_DB || "price_tracker";
const exportFile = optValue("--export");

if (restoreFile) {
  await restore(restoreFile);
  process.exit(0);
}

if (!uri) {
  console.error("MONGODB_URI is not set. Pass --uri=<mongodb-uri> or set MONGODB_URI.");
  process.exit(1);
}

const client = new MongoClient(uri);
await client.connect();
const db = client.db(dbName);
const samples = db.collection("price_samples");
const products = db.collection("products");

const matchFilter = {
  source: { $in: SYNTHETIC_SOURCES },
  price: { $type: "number", $gt: 0 },
  capturedAt: { $type: "date", $lt: new Date() }
};

const countsBySource = await samples
  .aggregate([{ $group: { _id: "$source", count: { $sum: 1 } } }])
  .toArray();
const sourceCounts = Object.fromEntries(countsBySource.map((row) => [row._id, row.count]));

const matched = await samples.find(matchFilter).project({ productId: 1 }).toArray();
const affectedProductIds = [...new Set(matched.map((doc) => String(doc.productId)))];

console.log("== Synthetic history migration ==");
console.log(`Database: ${dbName}`);
console.log("Counts by source:", sourceCounts);
console.log(`Matched synthetic samples: ${matched.length}`);
console.log(`Affected products: ${affectedProductIds.length}`);
const observedTotal = OBSERVED_SOURCES.reduce((sum, key) => sum + (sourceCounts[key] || 0), 0);
console.log(`Observed samples that will NOT be touched (direct/proxy): ${observedTotal}`);

if (!execute) {
  console.log("\nDry run — nothing written. Re-run with --execute to back up and delete.");
  await client.close();
  process.exit(0);
}

const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
const backupPath = exportFile || `backup-synthetic-history-${timestamp}.json`;
if (existsSync(backupPath)) {
  console.error(`Refusing to overwrite existing backup file: ${backupPath}`);
  await client.close();
  process.exit(1);
}

const docs = await samples.find(matchFilter).toArray();
const serialized = docs.map((doc) => ({
  ...doc,
  _id: doc._id,
  capturedAt: doc.capturedAt,
  createdAt: doc.createdAt
}));
writeFileSync(backupPath, JSON.stringify(serialized, null, 2), "utf8");
console.log(`Backup written: ${backupPath} (${docs.length} documents)`);

const deleteResult = await samples.deleteMany(matchFilter);
const unsetResult = await products.updateMany(
  { _id: { $in: docs.map((doc) => doc.productId) } },
  { $unset: { historyBackfilled: "", historyBackfilledAt: "" } }
);

console.log("== Execute complete ==");
console.log(`Deleted samples: ${deleteResult.deletedCount}`);
console.log(`Products unset of historyBackfilled flags: ${unsetResult.modifiedCount}`);
console.log("Rollback: node scripts/migrate-synthetic-history.mjs --restore=<backup-file>");

await client.close();

async function restore(file) {
  if (!existsSync(file)) {
    console.error(`Backup file not found: ${file}`);
    process.exit(1);
  }
  if (!uri) {
    console.error("MONGODB_URI is not set. Pass --uri=<mongodb-uri> or set MONGODB_URI.");
    process.exit(1);
  }
  const rows = JSON.parse(readFileSync(file, "utf8"), (key, value) =>
    key === "capturedAt" || key === "createdAt" ? new Date(value) : value
  );
  const client = new MongoClient(uri);
  await client.connect();
  const collection = client.db(dbName).collection("price_samples");
  let restored = 0;
  for (const row of rows) {
    const { _id, ...rest } = row;
    const result = await collection.replaceOne({ _id }, { _id, ...rest }, { upsert: true });
    restored += result.upsertedCount + result.modifiedCount;
  }
  console.log(`Restored ${restored} of ${rows.length} sample documents from ${file}`);
  await client.close();
}
