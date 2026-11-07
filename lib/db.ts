import { MongoClient, type Db } from "mongodb";

const uri = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DB || "price_tracker";

declare global {
  var _mongoClientPromise: Promise<MongoClient> | undefined;
}

let clientPromise: Promise<MongoClient> | undefined;

export async function getMongoClient(): Promise<MongoClient> {
  if (!uri) {
    throw new Error("MONGODB_URI is not configured.");
  }

  if (process.env.NODE_ENV === "development") {
    if (!global._mongoClientPromise) {
      const client = new MongoClient(uri);
      global._mongoClientPromise = client.connect();
    }
    return global._mongoClientPromise;
  }

  if (!clientPromise) {
    const client = new MongoClient(uri);
    clientPromise = client.connect();
  }

  return clientPromise;
}

export async function getDb(): Promise<Db> {
  const client = await getMongoClient();
  return client.db(dbName);
}

export async function ensureIndexes() {
  const db = await getDb();
  const products = db.collection("products");

  const indexes = await products.listIndexes().toArray();
  if (indexes.some((index) => index.name === "normalizedUrl_1")) {
    await products.dropIndex("normalizedUrl_1");
  }

  await Promise.all([
    products.createIndex({ userId: 1, normalizedUrl: 1 }, { unique: true }),
    products.createIndex({ active: 1, nextScanAt: 1 }),
    products.createIndex({ userId: 1, updatedAt: -1 }),
    db.collection("price_samples").createIndex({ productId: 1, capturedAt: -1 }),
    db.collection("price_samples").createIndex({ productId: 1, price: 1 }),
    db.collection("alert_events").createIndex({ userId: 1, observedAt: -1 }),
    db.collection("alert_events").createIndex(
      { productId: 1, target: 1, observedAt: 1 },
      { unique: true }
    )
  ]);
}
