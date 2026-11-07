import { ObjectId } from "mongodb";
import { NextResponse } from "next/server";
import { deleteAlertEventsForProduct } from "@/lib/alerts";
import { calculatePriceStats, OBSERVED_SOURCES } from "@/lib/analytics";
import { getDb } from "@/lib/db";
import { getViewer } from "@/lib/viewer";
import type { PriceSampleDocument, ProductDocument } from "@/lib/types";

type Params = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, { params }: Params) {
  const { id } = await params;
  if (!ObjectId.isValid(id)) {
    return NextResponse.json({ error: "Invalid product id." }, { status: 400 });
  }
  const viewer = await getViewer();
  if (!viewer.userId) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  const db = await getDb();
  const productId = new ObjectId(id);
  const product = await db.collection<ProductDocument>("products").findOne({
    _id: productId,
    userId: viewer.userId
  });

  if (!product) {
    return NextResponse.json({ error: "Product not found." }, { status: 404 });
  }

  const samples = await db
    .collection<PriceSampleDocument>("price_samples")
    .find({ productId, source: { $in: [...OBSERVED_SOURCES] } })
    .sort({ capturedAt: 1 })
    .limit(1000)
    .toArray();

  return NextResponse.json({
    product: {
      ...product,
      _id: product._id?.toString()
    },
    samples: samples.map((sample) => ({
      ...sample,
      _id: sample._id?.toString(),
      productId: sample.productId.toString()
    })),
    stats: calculatePriceStats(samples, product.mrp)
  });
}

export async function PATCH(request: Request, { params }: Params) {
  const { id } = await params;
  if (!ObjectId.isValid(id)) {
    return NextResponse.json({ error: "Invalid product id." }, { status: 400 });
  }
  const viewer = await getViewer();
  if (!viewer.userId) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  const db = await getDb();
  const productId = new ObjectId(id);
  const product = await db.collection<ProductDocument>("products").findOne({
    _id: productId,
    userId: viewer.userId
  });

  if (!product) {
    return NextResponse.json({ error: "Product not found." }, { status: 404 });
  }

  let body: { targetPrice?: number | null; targetAlertEnabled?: boolean };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const updateFields: Partial<ProductDocument> = {
    updatedAt: new Date()
  };
  const unsetFields: Partial<Record<keyof ProductDocument, "" | true | 1>> = {};

  if (body.targetPrice === null || (typeof body.targetPrice === "number" && body.targetPrice <= 0)) {
    unsetFields.targetPrice = "";
    unsetFields.targetPriceReached = "";
    unsetFields.targetAlertEnabled = "";
  } else if (typeof body.targetPrice === "number" && body.targetPrice > 0) {
    updateFields.targetPrice = Math.round(body.targetPrice);
    updateFields.targetPriceReached =
      product.lastPrice != null ? product.lastPrice <= updateFields.targetPrice : false;
    updateFields.targetAlertEnabled = true;
  }

  if (typeof body.targetAlertEnabled === "boolean") {
    updateFields.targetAlertEnabled = body.targetAlertEnabled;
  }

  const updateOperation: {
    $set?: Partial<ProductDocument>;
    $unset?: Partial<Record<keyof ProductDocument, "" | true | 1>>;
  } = {};
  if (Object.keys(updateFields).length > 0) {
    updateOperation.$set = updateFields;
  }
  if (Object.keys(unsetFields).length > 0) {
    updateOperation.$unset = unsetFields;
  }

  await db.collection<ProductDocument>("products").updateOne({ _id: productId }, updateOperation);

  const updatedProduct = await db.collection<ProductDocument>("products").findOne({ _id: productId });

  return NextResponse.json({
    ok: true,
    product: updatedProduct ? { ...updatedProduct, _id: updatedProduct._id?.toString() } : null
  });
}

export async function DELETE(_request: Request, { params }: Params) {
  const { id } = await params;
  if (!ObjectId.isValid(id)) {
    return NextResponse.json({ error: "Invalid product id." }, { status: 400 });
  }
  const viewer = await getViewer();
  if (!viewer.userId) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  const db = await getDb();
  const productId = new ObjectId(id);

  const deleted = await db.collection<ProductDocument>("products").deleteOne({
    _id: productId,
    userId: viewer.userId
  });

  if (deleted.deletedCount === 0) {
    return NextResponse.json({ error: "Product not found." }, { status: 404 });
  }

  await db.collection<PriceSampleDocument>("price_samples").deleteMany({ productId });
  await deleteAlertEventsForProduct(productId);

  return NextResponse.json({ ok: true });
}

