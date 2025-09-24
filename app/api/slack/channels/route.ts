import { NextResponse } from "next/server";

export async function GET() {
  const SLACK_TOKEN = process.env.SLACK_TOKEN;

  if (!SLACK_TOKEN) {
    console.error("[ERROR] SLACK_TOKEN 누락");
    return NextResponse.json(
      {
        error:
          "SLACK_TOKEN이 설정되지 않았습니다. .env.local 파일을 확인해주세요.",
      },
      { status: 500 }
    );
  }

  try {
    const response = await fetch(
      "https://slack.com/api/conversations.list?limit=999",
      {
        headers: { Authorization: `Bearer ${SLACK_TOKEN}` },
      }
    );

    const data = await response.json();

    console.log("[API] Slack conversations.list 결과:", data);

    if (!data.ok) {
      return NextResponse.json(
        { error: data.error || "Slack API 호출 실패" },
        { status: 500 }
      );
    }

    // 채널 목록 가공
    return NextResponse.json({
      channels: (data.channels ?? []).map((ch: any) => ({
        code: ch.id,
        name: ch.name,
      })),
    });
  } catch (err) {
    console.error("[ERROR] Slack API 호출 예외:", err);
    return NextResponse.json(
      { error: "Slack API 호출 중 예외가 발생했습니다." },
      { status: 500 }
    );
  }
}
