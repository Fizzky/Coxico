# RevenueCat Webhook Setup Guide

## Overview
This webhook endpoint syncs subscription status from RevenueCat to your backend database automatically.

## Webhook Endpoint
- **URL**: `https://your-domain.com/api/webhooks/revenuecat`
- **Method**: `POST`
- **Content-Type**: `application/json`

## Setup Steps

### 1. Get Your Webhook Secret
1. Log into [RevenueCat Dashboard](https://app.revenuecat.com)
2. Go to **Project Settings** → **Webhooks**
3. Copy your **Webhook Authorization Header** (this is your secret)

### 2. Add Secret to Environment Variables
Add this to your `.env` file:
```env
REVENUECAT_WEBHOOK_SECRET=your_webhook_secret_here
```

### 3. Configure Webhook in RevenueCat Dashboard
1. Go to **Project Settings** → **Webhooks**
2. Click **Add Webhook**
3. Enter your webhook URL: `https://your-domain.com/api/webhooks/revenuecat`
4. Select the events you want to receive:
   - ✅ INITIAL_PURCHASE
   - ✅ RENEWAL
   - ✅ CANCELLATION
   - ✅ UNCANCELLATION
   - ✅ EXPIRATION
   - ✅ BILLING_ISSUE
   - ✅ PRODUCT_CHANGE
5. Save the webhook

### 4. Test the Webhook
You can test the webhook endpoint:
```bash
curl http://localhost:5000/api/webhooks/revenuecat/health
```

## How It Works

### Event Types Handled

1. **INITIAL_PURCHASE** / **RENEWAL** / **BILLING_ISSUE** / **PRODUCT_CHANGE**
   - Sets user to `premium` status
   - Updates subscription dates
   - Sets status to `active`

2. **CANCELLATION**
   - Marks subscription as `cancelled`
   - User keeps access until expiration date

3. **EXPIRATION**
   - Sets user to `free` status
   - Sets status to `expired`
   - Revokes premium access

4. **UNCANCELLATION**
   - Reactivates subscription
   - Sets user back to `premium` status

### User ID Mapping
The webhook uses `app_user_id` from RevenueCat events to find users in your database.
Make sure you're setting the user ID correctly when initializing RevenueCat:
```dart
await RevenueCatService.setUserId(user.id);
```

## Security
- Webhook signature verification ensures requests are from RevenueCat
- In development mode, verification is optional (for testing)
- In production, signature verification is required

## Troubleshooting

### Webhook Not Receiving Events
1. Check RevenueCat dashboard → Webhooks → Check delivery status
2. Verify your server is accessible from the internet
3. Check server logs for errors

### Signature Verification Failing
1. Verify `REVENUECAT_WEBHOOK_SECRET` is set correctly in `.env`
2. Make sure you're using the correct secret from RevenueCat dashboard
3. Check that the webhook URL is correct

### User Not Found
1. Ensure `app_user_id` in RevenueCat matches your user's `_id` in MongoDB
2. Verify you're calling `RevenueCatService.setUserId(user.id)` on login

## Testing Locally

For local testing, you can use a tool like [ngrok](https://ngrok.com) to expose your local server:

```bash
# Install ngrok
# Then run:
ngrok http 5000

# Use the ngrok URL in RevenueCat webhook settings:
# https://your-ngrok-url.ngrok.io/api/webhooks/revenuecat
```

## Production Checklist
- [ ] Webhook secret added to production `.env`
- [ ] Webhook URL configured in RevenueCat dashboard
- [ ] Webhook events selected
- [ ] Test webhook delivery
- [ ] Monitor webhook logs

