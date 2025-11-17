// backend/routes/webhooks.js
import express from 'express';
import crypto from 'crypto';
import User from '../models/User.js';

const router = express.Router();

// RevenueCat webhook secret (get this from RevenueCat dashboard)
const REVENUECAT_WEBHOOK_SECRET = process.env.REVENUECAT_WEBHOOK_SECRET || '';

// Verify RevenueCat webhook signature
const verifyWebhookSignature = (req, res, next) => {
  if (!REVENUECAT_WEBHOOK_SECRET) {
    console.warn('⚠️ REVENUECAT_WEBHOOK_SECRET not set in environment variables');
    // In development, allow without verification
    if (process.env.NODE_ENV === 'development') {
      return next();
    }
    return res.status(500).json({ error: 'Webhook secret not configured' });
  }

  const signature = req.headers['authorization'];
  if (!signature) {
    return res.status(401).json({ error: 'Missing authorization header' });
  }

  // RevenueCat sends signature as "Bearer <signature>"
  const receivedSignature = signature.replace('Bearer ', '');
  
  // Calculate expected signature
  const bodyString = JSON.stringify(req.body);
  const expectedSignature = crypto
    .createHmac('sha256', REVENUECAT_WEBHOOK_SECRET)
    .update(bodyString)
    .digest('hex');

  // Compare signatures (constant-time comparison)
  if (receivedSignature !== expectedSignature) {
    console.error('❌ Invalid webhook signature');
    return res.status(401).json({ error: 'Invalid signature' });
  }

  next();
};

// Handle RevenueCat webhook events
// Note: We need raw body for signature verification, so we parse JSON manually
router.post('/revenuecat', express.raw({ type: 'application/json' }), verifyWebhookSignature, async (req, res) => {
  try {
    // Parse the webhook body
    let event;
    try {
      const bodyString = req.body.toString();
      event = JSON.parse(bodyString);
    } catch (e) {
      console.error('Error parsing webhook body:', e);
      return res.status(400).json({ error: 'Invalid JSON' });
    }

    console.log('📥 RevenueCat webhook received:', event.type);

    // Extract user information from the event
    const appUserId = event.event?.app_user_id || event.event?.aliases?.app_user_id;
    if (!appUserId) {
      console.warn('⚠️ No app_user_id found in webhook event');
      return res.status(400).json({ error: 'Missing app_user_id' });
    }

    // Find user by ID
    const user = await User.findById(appUserId);
    if (!user) {
      console.warn(`⚠️ User not found: ${appUserId}`);
      return res.status(404).json({ error: 'User not found' });
    }

    // Handle different event types
    switch (event.type) {
      case 'INITIAL_PURCHASE':
      case 'RENEWAL':
      case 'BILLING_ISSUE':
      case 'PRODUCT_CHANGE':
        await handleSubscriptionActive(user, event);
        break;

      case 'CANCELLATION':
        await handleSubscriptionCancelled(user, event);
        break;

      case 'EXPIRATION':
        await handleSubscriptionExpired(user, event);
        break;

      case 'UNCANCELLATION':
        await handleSubscriptionUncancelled(user, event);
        break;

      case 'NON_RENEWING_PURCHASE':
        // One-time purchase, treat as premium for now
        await handleSubscriptionActive(user, event);
        break;

      default:
        console.log(`ℹ️ Unhandled event type: ${event.type}`);
    }

    // Always respond with 200 to acknowledge receipt
    res.status(200).json({ received: true });
  } catch (error) {
    console.error('❌ Error processing webhook:', error);
    // Still return 200 to prevent RevenueCat from retrying
    res.status(200).json({ error: 'Webhook processing failed' });
  }
});

// Handle active subscription (purchase, renewal, etc.)
async function handleSubscriptionActive(user, event) {
  const entitlement = event.event?.entitlements?.['Coxico Pro'] || 
                      event.event?.entitlements?.premium ||
                      event.event?.entitlements?.[Object.keys(event.event?.entitlements || {})[0]];

  if (entitlement && entitlement.expires_date) {
    const expiresDate = new Date(entitlement.expires_date);
    const now = new Date();

    if (expiresDate > now) {
      user.subscriptionType = 'premium';
      user.subscriptionStatus = 'active';
      user.subscriptionStartDate = user.subscriptionStartDate || new Date();
      user.subscriptionEndDate = expiresDate;
      
      await user.save();
      console.log(`✅ User ${user._id} subscription activated/updated. Expires: ${expiresDate}`);
    }
  } else {
    // If no expiration date, assume lifetime subscription
    user.subscriptionType = 'premium';
    user.subscriptionStatus = 'active';
    user.subscriptionStartDate = user.subscriptionStartDate || new Date();
    user.subscriptionEndDate = null; // Lifetime
    
    await user.save();
    console.log(`✅ User ${user._id} subscription activated (lifetime)`);
  }
}

// Handle subscription cancellation
async function handleSubscriptionCancelled(user, event) {
  // Don't immediately revoke access - let them use until expiration
  // Just mark as cancelled so it won't renew
  user.subscriptionStatus = 'cancelled';
  await user.save();
  console.log(`⚠️ User ${user._id} subscription cancelled (active until expiration)`);
}

// Handle subscription expiration
async function handleSubscriptionExpired(user, event) {
  user.subscriptionType = 'free';
  user.subscriptionStatus = 'expired';
  user.subscriptionEndDate = new Date();
  await user.save();
  console.log(`❌ User ${user._id} subscription expired`);
}

// Handle subscription uncancellation (user resubscribed)
async function handleSubscriptionUncancelled(user, event) {
  await handleSubscriptionActive(user, event);
  console.log(`✅ User ${user._id} subscription uncancelled`);
}

// Health check for webhook endpoint
router.get('/revenuecat/health', (req, res) => {
  res.json({ 
    status: 'Webhook endpoint is ready',
    secretConfigured: !!REVENUECAT_WEBHOOK_SECRET,
    timestamp: new Date().toISOString()
  });
});

export default router;

