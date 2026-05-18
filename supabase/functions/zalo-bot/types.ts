export interface ZaloWebhookPayload {
  ok: boolean;
  result: {
    event_name: string;
    message: {
      message_id: string;
      date: number;
      from: {
        id: string;
        display_name: string;
        is_bot: boolean;
      };
      chat: {
        id: string;
        chat_type: 'PRIVATE' | 'GROUP';
      };
      text?: string;
    };
  };
}

export interface ViolationStats {
  totalViolations: number;
  totalAchievements: number;
  topStudents: { name: string; classId: string; points: number }[];
  topClasses: { name: string; grade: number; avgScore: number }[];
  periodLabel: string;
}

export interface ZaloGroupConfig {
  group_id: string;
  group_name: string;
  notify_types: string[];
  class_id: string | null;
}