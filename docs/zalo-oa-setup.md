# Zalo OA Setup Guide

## Zalo Bot Configuration

### 1. Set Webhook URL in Zalo OA

Call the Zalo API to register your webhook URL:

```bash
curl -X POST "https://bot-api.zaloplatforms.com/bot4301556490455089646:eKbxLdsqDQwrgpkqYmfokxwTbDKjPCzBonitsmbktwPRtbuhsefECzLGowBBvBUc/setWebhook" \
  -H "Authorization: Bearer 4301556490455089646:eKbxLdsqDQwrgpkqYmfokxwTbDKjPCzBonitsmbktwPRtbuhsefECzLGowBBvBUc" \
  -H "Content-Type: application/json" \
  -d '{"webhook_url": "https://jzhxdwriskdxcivirbip.supabase.co/functions/v1/zalo-bot"}'
```

### 2. Configure Environment Variables in Supabase

Go to Supabase Dashboard → Edge Functions → Secrets and add:

```
ZALO_BOT_TOKEN=4301556490455089646:eKbxLdsqDQwrgpkqYmfokxwTbDKjPCzBonitsmbktwPRtbuhsefECzLGowBBvBUc
ZALO_BOT_SECRET_TOKEN=your-webhook-secret-token
CRON_SECRET=your-cron-secret
SUPABASE_URL=https://jzhxdwriskdxcivirbip.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

### 3. Deploy Edge Functions

```bash
# Login to Supabase
supabase login

# Link to project
supabase link --project-ref jzhxdwriskdxcivirbip

# Deploy zalo-bot function
supabase functions deploy zalo-bot

# Deploy zalo-scheduler function
supabase functions deploy zalo-scheduler
```

### 4. Test Webhook

Use ngrok or Supabase's built-in function invoke to test:

```bash
# Test zalo-bot webhook
supabase functions invoke zalo-bot --method POST \
  --body '{"event":"follow","sender_id":"123456789","message":{"msg_type":"text","content":"help","message_id":"test123"},"timestamp":1234567890}'
```

## Zalo OA Features to Enable

In your Zalo OA dashboard (https://oa.zalo.me), enable:

1. **Follow event** - Allows bot to receive private messages from users who follow the OA
2. **Group message event** - Allows bot to respond when tagged in groups
3. **Get user info** - Allows bot to fetch user profile data

## Adding Bot to Group

1. Open Zalo group settings
2. Add the OA bot as a member
3. When someone tags the bot (@bot), it will receive group_message events

## Testing Commands

### Private message (follow event):
Send "help" directly to the OA in Zalo app.

### Group message:
Send "@bot thống kê tuần này" in a group where the bot is added.

## Troubleshooting

- **Bot not responding**: Check webhook verification with GET request
- **Group messages not working**: Ensure msg_type is "reply" (bot was tagged/replied to)
- **Cron not working**: Verify pg_cron extension is enabled and cron job is scheduled
