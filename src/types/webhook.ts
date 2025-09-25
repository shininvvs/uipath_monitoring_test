export interface SlackWebhookPayload {
    token: string;
    team_id: string;
    team_domain: string;
    channel_id: string;
    channel_name: string;
    user_id: string;
    user_name: string;
    text: string;
    timestamp: string;
    trigger_word?: string;
  }
  
  export interface WebhookResponse {
    success: boolean;
    message?: string;
    channelUpdate?: {
      channelName: string;
      status: string;
      count: number;
    };
  }
  
  export interface APIResponse<T = any> {
    success: boolean;
    data?: T;
    error?: string;
    timestamp: Date;
  }