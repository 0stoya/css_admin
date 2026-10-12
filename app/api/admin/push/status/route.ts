import { cookies } from "next/headers";
import { currentStaffJobIdentity } from "@/lib/admin-job-auth";
import { publicPushConfig, pushSubscribedOnDevice, PUSH_DEVICE_COOKIE } from "@/lib/staff-push";

export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store, max-age=0" };

export async function GET() {
  try {
    const actor = await currentStaffJobIdentity();
    const config = publicPushConfig();
    const device = (await cookies()).get(PUSH_DEVICE_COOKIE)?.value ?? null;
    const subscribed = config.enabled
      ? await pushSubscribedOnDevice(actor.user_id, device)
      : false;
    return Response.json({ ...config, subscribed }, { headers });
  } catch {
    // Never disclose Magento identities, session tokens or crypto settings.
    return Response.json(
      { error: "Notification status unavailable." },
      { status: 401, headers },
    );
  }
}
