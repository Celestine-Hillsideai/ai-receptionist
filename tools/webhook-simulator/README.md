# webhook-simulator

Sends simulated Vapi-style webhook events at `POST /api/webhooks/voice` for local testing without a live Vapi account.

## Usage

```
node tools/webhook-simulator/simulate-webhook.js started
node tools/webhook-simulator/simulate-webhook.js report
node tools/webhook-simulator/simulate-webhook.js report --urgent
node tools/webhook-simulator/simulate-webhook.js failed
```

Run `started` then `report` with the same `--call-id` to simulate a full call lifecycle against one row. Run `report` twice with the same `--call-id` to confirm idempotency (the second response has `"duplicate": true` and no second n8n trigger fires).

Options: `--url <url>` (default `http://localhost:3000/api/webhooks/voice`), `--call-id <id>` (default `sim-<timestamp>`), `--secret <value>` (sent as `x-vapi-secret`, defaults to `$VAPI_WEBHOOK_SECRET`), `--urgent` (report scenario only — transcript with an explicit deadline).
