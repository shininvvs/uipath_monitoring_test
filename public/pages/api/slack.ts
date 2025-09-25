// pages/api/slack.ts

import type { NextApiRequest, NextApiResponse } from 'next'

const SLACK_TOKEN = process.env.SLACK_TOKEN;
const SLACK_WEBHOOK_URL = process.env.SLACK_WEBHOOK_URL;

// [1] SLACK 메시지 조회 API (conversations.history)
async function fetchSlackChannelMessages(channel: string, startDate?: string, endDate?: string) {
  if (!SLACK_TOKEN || !channel) {
    throw new Error("Slack token or channel ID is not set");
  }

  const response = await fetch(
    `https://slack.com/api/conversations.history?channel=${channel}&limit=200`,
    { headers: { Authorization: `Bearer ${SLACK_TOKEN}` } }
  );

  const data = await response.json();
  if (!data.ok) throw new Error(data.error);

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

  // 기간 필터링
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

  return messages;
}

// [2] SLACK Webhook 메시지 전송 API
async function sendSlackWebhook(text: string): Promise<{ ok: boolean, error?: string }> {
  if (!SLACK_WEBHOOK_URL) {
    return { ok: false, error: "Slack webhook URL is not set" };
  }

  const response = await fetch(
    SLACK_WEBHOOK_URL,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text })
    }
  );
  if (!response.ok) {
    return { ok: false, error: "Failed to send Slack webhook" };
  }
  return { ok: true };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const channel = req.query.channel as string;
  const startDate = req.query.startDate as string; // YYYY-MM-DD 형식
  const endDate = req.query.endDate as string;     // YYYY-MM-DD 형식

  if (req.method === 'POST') {
    // Webhook 메시지 전송
    const { text } = req.body;
    if (!text) {
      return res.status(400).json({ error: "Message text is required" });
    }
    const result = await sendSlackWebhook(text);
    if (result.ok) {
      res.status(200).json({ ok: true, message: 'Sent via webhook' });
    } else {
      res.status(500).json({ ok: false, error: result.error });
    }
    return;
  }

  if (req.method === 'GET') {
    // 슬랙 채널 메시지 조회
    try {
      const messages = await fetchSlackChannelMessages(channel, startDate, endDate);
      res.status(200).json({ messages });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
    return;
  }

  res.status(405).end();
}
