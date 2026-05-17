export interface ZaloWebhookPayload {
  event: string;
  sender_id: string;
  group_id?: string;
  message: {
    msg_type: string;
    content: string;
    message_id: string;
  };
  timestamp: number;
}

export interface ZaloGroupConfig {
  group_id: string;
  group_name: string;
  notify_types: string[];
  class_id: string | null;
}

export interface ViolationStats {
  totalViolations: number;
  totalAchievements: number;
  topStudents: { name: string; classId: string; points: number }[];
  topClasses: { name: string; grade: number; avgScore: number }[];
  periodLabel: string;
}