import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { currentStaffJobIdentity } from "@/lib/admin-job-auth";
import {
  newStaffPushDevice, PUSH_DEVICE_COOKIE, registerStaffPush,
  revokeStaffPushDevice, staffPushAvailable, staffPushCookieOptions, staffPushPublicOrigin,
  validStaffPushDevice,
} from "@/lib/staff-push";

export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store, max-age=0" };

function sameOriginMutation(request: Request) {
  const origin = request.headers.get("origin");
  const site = request.headers.get("sec-fetch-site");
  const expected = staffPushPublicOrigin();
  // Reverse proxies may forward Next.js an internal HTTP URL. Never use that
  // or untrusted X-Forwarded-* client headers as the browser's CSRF origin.
  if (!expected || !origin || origin !== expected) return false;
  if (site && site !== "same-origin" && site !== "none") return false;
  return true;
}

async function parseLimitedJson(request: Request) {
  const reader = request.body?.getReader();
  if (!reader) throw new Error("Empty subscription request.");
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > 8192) throw new Error("Subscription request exceeds 8 KiB.");
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  if (length === 0) throw new Error("Empty subscription request.");
  return JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown;
}

export async function POST(request: Request) {
  if (!sameOriginMutation(request)) {
    return Response.json({ error: "Origin rejected." }, { status: 403, headers });
  }
  if (!staffPushAvailable()) {
    return Response.json({ error: "Push is not enabled." }, { status: 503, headers });
  }
  if (!request.headers.get("content-type")?.startsWith("application/json") ||
      Number(request.headers.get("content-length") || "0") > 8192) {
    return Response.json({ error: "Invalid subscription request." }, { status: 415, headers });
  }
  try {
    const actor = await currentStaffJobIdentity();
    // Bound request memory during streaming, not only after reading the body.
    const input = await parseLimitedJson(request);
    const cookieStore = await cookies();
    const oldDeviceId = cookieStore.get(PUSH_DEVICE_COOKIE)?.value;
    const deviceId = validStaffPushDevice(oldDeviceId) ? oldDeviceId : newStaffPushDevice();
    await registerStaffPush(actor.user_id, deviceId, input);
    const response = NextResponse.json({ enabled: true, subscribed: true }, { headers });
    if (!validStaffPushDevice(oldDeviceId)) {
      // The per-browser opaque cookie is never exposed to JavaScript.
      response.cookies.set(PUSH_DEVICE_COOKIE, deviceId, staffPushCookieOptions());
    }
    return response;
  } catch {
    return Response.json({ error: "Could not register this notification device." }, { status: 400, headers });
  }
}

export async function DELETE(request: Request) {
  if (!sameOriginMutation(request)) {
    return Response.json({ error: "Origin rejected." }, { status: 403, headers });
  }
  try {
    const actor = await currentStaffJobIdentity();
    const cookieStore = await cookies();
    const deviceId = cookieStore.get(PUSH_DEVICE_COOKIE)?.value ?? null;
    await revokeStaffPushDevice(actor.user_id, deviceId);
    const res = new NextResponse(null, { status: 204, headers });
    res.cookies.set(PUSH_DEVICE_COOKIE, "", { ...staffPushCookieOptions(), maxAge: 0 });
    return res;
  } catch {
    return Response.json({ error: "Could not revoke this notification device." }, { status: 503, headers });
  }
}
