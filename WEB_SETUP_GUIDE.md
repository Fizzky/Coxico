# Web App Setup Guide for coxico.xyz

This guide covers setting up your web app with your domain and payment system.

---

## Part 1: Domain Setup for coxico.xyz

### Current Status
✅ Your domain `coxico.xyz` is already configured in your backend CORS settings (see `backend/server.js`)

### Step 1: Point Domain to Your Server

**Option A: If using a hosting service (Vercel, Netlify, etc.)**

1. **Get your hosting URL:**
   - Vercel: `your-app.vercel.app`
   - Netlify: `your-app.netlify.app`
   - Or your server IP

2. **Update DNS records in your domain registrar (OnlyDomains):**
   - Log in to OnlyDomains: https://www.onlydomains.com
   - Go to Domain Management → DNS Settings
   - Add these records:

   **For Vercel/Netlify:**
   - Type: `CNAME`
   - Name: `@` (or blank)
   - Value: `your-app.vercel.app` (or netlify.app)
   - TTL: `3600`

   **For your own server:**
   - Type: `A`
   - Name: `@` (or blank)
   - Value: `YOUR_SERVER_IP`
   - TTL: `3600`

   - Type: `A`
   - Name: `www`
   - Value: `YOUR_SERVER_IP`
   - TTL: `3600`

3. **Wait for DNS propagation** (5 minutes to 48 hours, usually 15-30 minutes)

**Option B: Staging subdomain setup (Recommended for beta)**

Set up `staging.coxico.xyz` or `beta.coxico.xyz`:

1. **Add DNS record:**
   - Type: `CNAME`
   - Name: `staging` (or `beta`)
   - Value: Your staging server URL
   - TTL: `3600`

2. **Update backend CORS:**
   ```javascript
   // backend/server.js
   const allowedOrigins = [
     'http://localhost:3000',
     'http://127.0.0.1:3000',
     'https://www.coxico.xyz',
     'https://coxico.xyz',
     'https://staging.coxico.xyz',  // Add this
     'https://beta.coxico.xyz'      // Or this
   ];
   ```

3. **Update frontend axios base URL:**
   ```javascript
   // frontend/src/App.jsx (line 20)
   // For staging:
   axios.defaults.baseURL = process.env.NODE_ENV === 'production' 
     ? 'https://api.coxico.xyz' 
     : 'https://staging-api.coxico.xyz';
   ```

---

## Part 2: Payment Setup for Web App

### Current Situation
- ✅ You have **RevenueCat** set up (for mobile apps)
- ❌ **No web payment system** currently configured

### Recommendation: Add Stripe for Web Payments

Stripe is the most popular payment solution for web apps. Here's why:
- Easy to integrate
- Handles subscriptions well
- Test mode for beta testing
- Supports web, mobile, and more
- Good documentation

---

### Step 1: Set Up Stripe Account

1. **Sign up for Stripe:**
   - Go to: https://stripe.com
   - Create account (free)
   - Complete business verification

2. **Get API Keys:**
   - Dashboard → Developers → API keys
   - Copy **Publishable key** (starts with `pk_test_` for test mode)
   - Copy **Secret key** (starts with `sk_test_` for test mode)

3. **For beta testing:** Use **Test Mode** (toggle in Stripe dashboard)
   - Test cards: https://stripe.com/docs/testing
   - Example: `4242 4242 4242 4242` (any future expiry, any CVC)

---

### Step 2: Install Stripe in Backend

```bash
cd backend
npm install stripe
```

---

### Step 3: Create Stripe Routes

Create `backend/routes/stripe.js`:

```javascript
import express from 'express';
import Stripe from 'stripe';
import User from '../models/User.js';

const router = express.Router();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// Create checkout session
router.post('/create-checkout-session', async (req, res) => {
  try {
    const { userId, priceId } = req.body;

    if (!userId || !priceId) {
      return res.status(400).json({ error: 'Missing userId or priceId' });
    }

    // Find user
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Create Stripe checkout session
    const session = await stripe.checkout.sessions.create({
      customer_email: user.email,
      client_reference_id: userId,
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId, // Get this from Stripe dashboard (Products → Prices)
          quantity: 1,
        },
      ],
      mode: 'subscription', // or 'payment' for one-time
      success_url: `${process.env.FRONTEND_URL}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.FRONTEND_URL}/cancel`,
      metadata: {
        userId: userId.toString(),
      },
    });

    res.json({ sessionId: session.id, url: session.url });
  } catch (error) {
    console.error('Error creating checkout session:', error);
    res.status(500).json({ error: error.message });
  }
});

// Stripe webhook handler
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Handle the event
  switch (event.type) {
    case 'checkout.session.completed':
      const session = event.data.object;
      const userId = session.client_reference_id;
      
      if (session.mode === 'subscription') {
        // Update user to premium
        const user = await User.findById(userId);
        if (user) {
          user.subscriptionType = 'premium';
          user.subscriptionStatus = 'active';
          user.subscriptionStartDate = new Date();
          // Calculate end date based on subscription period
          const subscription = await stripe.subscriptions.retrieve(session.subscription);
          user.subscriptionEndDate = new Date(subscription.current_period_end * 1000);
          await user.save();
          console.log(`✅ User ${userId} upgraded to premium via Stripe`);
        }
      }
      break;

    case 'customer.subscription.updated':
    case 'customer.subscription.deleted':
      // Handle subscription updates/cancellations
      const subscription = event.data.object;
      const customerId = subscription.customer;
      // You'll need to store Stripe customer ID in User model
      // Then update user subscription status
      break;

    default:
      console.log(`Unhandled event type: ${event.type}`);
  }

  res.json({ received: true });
});

// Get subscription status
router.get('/subscription/:userId', async (req, res) => {
  try {
    const user = await User.findById(req.params.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      subscriptionType: user.subscriptionType || 'free',
      subscriptionStatus: user.subscriptionStatus || 'inactive',
      subscriptionEndDate: user.subscriptionEndDate,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
```

---

### Step 4: Add Stripe Route to Server

Update `backend/server.js`:

```javascript
import stripeRoutes from './routes/stripe.js';

// ... existing code ...

app.use('/api/stripe', stripeRoutes);
```

---

### Step 5: Create Subscription Plans in Stripe Dashboard

1. Go to Stripe Dashboard → Products
2. Click "Add product"
3. Create your premium plan:
   - Name: "Coxico Premium"
   - Description: "Unlimited downloads and premium features"
   - Pricing: Set monthly/annual price
   - Save the **Price ID** (starts with `price_`)

---

### Step 6: Add Stripe Checkout to Frontend

Install Stripe.js in frontend:

```bash
cd frontend
npm install @stripe/stripe-js
```

Create `frontend/src/components/StripeCheckout.jsx`:

```jsx
import React from 'react';
import { loadStripe } from '@stripe/stripe-js';
import axios from 'axios';

const stripePromise = loadStripe(process.env.REACT_APP_STRIPE_PUBLISHABLE_KEY);

const StripeCheckout = ({ userId, priceId, onSuccess, onError }) => {
  const handleCheckout = async () => {
    try {
      // Create checkout session
      const response = await axios.post('/api/stripe/create-checkout-session', {
        userId,
        priceId, // e.g., 'price_1234567890' from Stripe dashboard
      });

      const { sessionId } = response.data;

      // Redirect to Stripe Checkout
      const stripe = await stripePromise;
      const { error } = await stripe.redirectToCheckout({
        sessionId,
      });

      if (error) {
        onError(error.message);
      }
    } catch (error) {
      console.error('Error creating checkout session:', error);
      onError(error.response?.data?.error || 'Failed to create checkout session');
    }
  };

  return (
    <button
      onClick={handleCheckout}
      className="bg-[#E50914] text-white px-6 py-3 rounded-lg font-semibold hover:opacity-90"
    >
      Upgrade to Premium
    </button>
  );
};

export default StripeCheckout;
```

---

### Step 7: Set Up Environment Variables

**Backend `.env`:**
```env
# Stripe
STRIPE_SECRET_KEY=sk_test_... (from Stripe dashboard)
STRIPE_WEBHOOK_SECRET=whsec_... (get from Stripe webhook endpoint)

# Domain
FRONTEND_URL=https://coxico.xyz
# Or for staging:
# FRONTEND_URL=https://staging.coxico.xyz
```

**Frontend `.env`:**
```env
REACT_APP_STRIPE_PUBLISHABLE_KEY=pk_test_... (from Stripe dashboard)
```

---

### Step 8: Set Up Stripe Webhook (Important!)

1. **For local testing:** Use Stripe CLI
   ```bash
   # Install Stripe CLI: https://stripe.com/docs/stripe-cli
   stripe listen --forward-to localhost:5000/api/stripe/webhook
   ```
   Copy the webhook secret it gives you → add to `.env`

2. **For production:**
   - Go to Stripe Dashboard → Developers → Webhooks
   - Click "Add endpoint"
   - URL: `https://api.coxico.xyz/api/stripe/webhook`
   - Events to listen: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`
   - Copy webhook secret → add to production `.env`

---

## Part 3: Quick Start - Minimal Setup for Beta

### For Beta Testing (Test Mode Only)

1. **Set up Stripe test account** (5 minutes)
   - Sign up at https://stripe.com
   - Get test API keys

2. **Add Stripe to backend** (30 minutes)
   - Install `stripe` package
   - Create `backend/routes/stripe.js` (copy code above)
   - Add route to `server.js`

3. **Add checkout button to frontend** (30 minutes)
   - Install `@stripe/stripe-js`
   - Create `StripeCheckout.jsx` component
   - Add to your profile/premium page

4. **Test with test card** (5 minutes)
   - Use card: `4242 4242 4242 4242`
   - Any future expiry, any CVC
   - Any ZIP

**Total time:** ~1.5 hours for basic setup

---

## Part 4: Domain Deployment Options

### Option 1: Vercel (Easiest, Free Tier)

1. **Install Vercel CLI:**
   ```bash
   npm install -g vercel
   ```

2. **Deploy frontend:**
   ```bash
   cd frontend
   vercel
   ```

3. **Link domain:**
   - Vercel Dashboard → Your Project → Settings → Domains
   - Add `coxico.xyz` and `www.coxico.xyz`
   - Update DNS records as instructed

4. **Deploy backend:**
   - Use separate service (Railway, Render, etc.)
   - Or deploy backend separately

---

### Option 2: Netlify (Free Tier)

1. **Deploy frontend:**
   ```bash
   cd frontend
   npm run build
   # Drag and drop dist/ folder to Netlify
   ```

2. **Link domain:**
   - Netlify Dashboard → Site Settings → Domain Management
   - Add custom domain

---

### Option 3: Your Own Server

1. **Deploy backend:**
   - SSH to your server
   - Clone repo
   - Install dependencies
   - Use PM2 or similar to run: `pm2 start server.js`

2. **Deploy frontend:**
   - Build: `npm run build`
   - Serve with Nginx or similar
   - Point domain DNS to server IP

---

## Summary: What You Need to Do

### Immediate (For Beta):
1. ✅ **Domain:** Point `staging.coxico.xyz` (or `beta.coxico.xyz`) to your staging server
2. ✅ **Payment:** Set up Stripe test mode (follow Part 2, Steps 1-7)
3. ✅ **Deploy:** Deploy web app to staging URL
4. ✅ **Test:** Test payment flow with Stripe test card

### Before Production:
1. Switch Stripe to live mode
2. Point `coxico.xyz` to production server
3. Set up production Stripe webhook
4. Test with real payment (small amount)

---

## Need Help?

**Stripe Documentation:**
- Quickstart: https://stripe.com/docs/payments/checkout
- Testing: https://stripe.com/docs/testing

**DNS Setup:**
- OnlyDomains help: https://www.onlydomains.com/help

**Domain issues?** Test DNS propagation: https://dnschecker.org

Good luck! 🚀

