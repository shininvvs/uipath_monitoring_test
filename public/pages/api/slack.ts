import type { NextApiRequest, NextApiResponse } from 'next'

const SLACK_TOKEN = process.env.SLACK_TOKEN;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const channel = req.query.channel as string;
  const startDate = req.query.startDate as string; // YYYY-MM-DD 형식
  const endDate = req.query.endDate as string; // YYYY-MM-DD 형식

  if (!SLACK_TOKEN || !channel) {
    return res.status(500).json({ error: "Slack token or channel ID is not set" });
  }

  try {
    const response = await fetch(
      `https://slack.com/api/conversations.history?channel=${channel}&limit=200`,
      { headers: { Authorization: `Bearer ${SLACK_TOKEN}` } }
    );

    const data = await response.json();
    if (!data.ok) return res.status(500).json({ error: data.error });

    // 모든 메시지 반환 (에러 필터링 제거)
    let messages = data.messages.map((msg: any) => ({
      text: msg.text || "",
      ts: msg.ts,
      user: msg.user || "unknown",
      type: msg.type || "message",
      bot_id: msg.bot_id,
      username: msg.username,
      thread_ts: msg.thread_ts,
      reply_count: msg.reply_count || 0,
    }));

    // 기간 필터링만 적용
    if (startDate && endDate) {
      const startDateObj = new Date(startDate);
      startDateObj.setHours(0, 0, 0, 0);
      const startTimestamp = startDateObj.getTime() / 1000;
      
      const endDateObj = new Date(endDate);
      endDateObj.setHours(23, 59, 59, 999);
      const endTimestamp = endDateObj.getTime() / 1000;

      messages = messages.filter((msg: any) => {
        if (!msg.ts) return false;
        const msgTimestamp = parseFloat(msg.ts);
        return msgTimestamp >= startTimestamp && msgTimestamp <= endTimestamp;
      });
    }

    res.status(200).json({ messages });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}