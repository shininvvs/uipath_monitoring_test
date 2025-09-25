import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

// Slack 요청 검증
function verifySlackRequest(req: NextRequest, body: string) {
  const timestamp = req.headers.get("x-slack-request-timestamp");
  const slackSignature = req.headers.get("x-slack-signature");

  if (!timestamp || !slackSignature) return false;

  const sigBasestring = `v0:${timestamp}:${body}`;
  const mySignature =
    "v0=" +
    crypto
      .createHmac("sha256", process.env.SLACK_SIGNING_SECRET!)
      .update(sigBasestring, "utf8")
      .digest("hex");

  return crypto.timingSafeEqual(
    Buffer.from(mySignature, "utf8"),
    Buffer.from(slackSignature, "utf8")
  );
}

export async function POST(req: NextRequest) {
  const bodyText = await req.text();
  const body = JSON.parse(bodyText);

  // 1. Slack URL 검증 (앱 등록할 때 최초 요청)
  if (body.type === "url_verification") {
    return NextResponse.json(body.challenge);
  }

  // 2. 요청 검증
  if (!verifySlackRequest(req, bodyText)) {
    return new NextResponse("Invalid signature", { status: 400 });
  }

  // 3. 메시지 이벤트 처리
  const event = body.event;
  if (event?.type === "message" && !event.subtype) {
    console.log("✅ Slack 메시지 이벤트 수신:");
    console.log({
      channel: event.channel,
      user: event.user,
      text: event.text,
      ts: event.ts,
    });
  }

  // Slack은 반드시 200 응답 필요
  return new NextResponse("ok", { status: 200 });
}
