# User Testing Guide for Coxico

A comprehensive guide to conducting user testing for your manga/comics platform before deployment.

## Table of Contents
1. [Pre-Testing Setup](#pre-testing-setup)
2. [Platform-Specific Beta Testing](#platform-specific-beta-testing)
3. [Testing Methods](#testing-methods)
4. [What to Test](#what-to-test)
5. [Collecting Feedback](#collecting-feedback)
6. [Test Environment Setup](#test-environment-setup)
7. [Sample Test Scenarios](#sample-test-scenarios)
8. [Feedback Analysis](#feedback-analysis)

---

## Pre-Testing Setup

### 1. Define Your Goals
- **What are you testing?** (e.g., core reading flow, payment flow, downloads, UI/UX)
- **Who are your testers?** (target demographics, tech-savvy vs. casual users)
- **How many testers?** (Recommended: 10-20 for initial beta, 50+ for broader testing)
- **Testing duration?** (Minimum 1-2 weeks for meaningful feedback)

### 2. Prepare Test Documentation
- Create a test script with key scenarios
- Prepare a feedback form (Google Forms, Typeform, or SurveyMonkey)
- Set up analytics tracking (see Analytics section)

### 3. Set Up Analytics & Monitoring
**For Web App:**
- Google Analytics or Mixpanel
- Error tracking: Sentry or Rollbar
- User session recording: Hotjar or LogRocket

**For Flutter App:**
- Firebase Analytics (if using Firebase)
- Crash reporting: Firebase Crashlytics
- User feedback in-app: Instabug or Apptentive

---

## Platform-Specific Beta Testing

### Web App Beta Testing

#### Option 1: Staging Environment (Recommended)
1. **Deploy to a staging URL** (e.g., `staging.coxico.com` or `beta.coxico.com`)
2. **Features needed:**
   - Separate database (or sandboxed test data)
   - Same infrastructure as production
   - Environment variables for testing (payment testing mode, etc.)

#### Option 2: Password-Protected Beta
- Deploy to production subdomain with password protection
- Use basic auth or invite-only access
- Easy to share with testers

#### Option 3: Closed Beta with Invite Codes
- Implement invite code system in your auth flow
- Only users with valid codes can sign up
- Track which tester used which code

### Flutter Mobile App Beta Testing

#### Android: Google Play Internal Testing
1. **Steps:**
   - Build a release APK or AAB: `flutter build appbundle --release`
   - Go to Google Play Console → Your App → Testing → Internal testing
   - Create an internal testing track
   - Upload your build
   - Add testers by email (up to 100 testers)
   - Share the opt-in link with testers

2. **Benefits:**
   - Easy distribution
   - Automatic updates
   - No sideloading required
   - Testers use real Play Store

#### Android: Firebase App Distribution (Alternative)
1. **Steps:**
   - Set up Firebase project
   - Add `firebase_app_distribution` to `pubspec.yaml`
   - Configure: `firebase_app_distribution`
   - Build: `flutter build apk --release`
   - Distribute: `flutter pub run firebase_app_distribution:release`

#### iOS: TestFlight (Recommended)
1. **Prerequisites:**
   - Apple Developer Account ($99/year)
   - App Store Connect access

2. **Steps:**
   - Build: `flutter build ipa --release`
   - Upload to App Store Connect (via Xcode or `xcrun altool`)
   - Go to TestFlight → Internal Testing
   - Add testers (up to 100 internal testers)
   - Share TestFlight link

3. **External Testing (Optional):**
   - Requires App Review
   - Up to 10,000 external testers

---

## Testing Methods

### 1. **Unmoderated Testing** (Asynchronous)
- **Best for:** Large number of testers, convenience
- **Process:** Send testers a link/build → They use app on their own time → Submit feedback
- **Tools:** Beta platforms (TestFlight, Play Console), Google Forms

### 2. **Moderated Testing** (Synchronous)
- **Best for:** In-depth feedback, complex features
- **Process:** Screen share session (Zoom, Google Meet) → Watch user interact → Ask questions
- **Duration:** 30-60 minutes per session

### 3. **Hybrid Approach** (Recommended)
- Start with unmoderated for broad feedback
- Follow up with moderated sessions for 5-10 key testers

---

## What to Test

### Critical User Flows (Priority 1)
1. **Onboarding & Authentication**
   - Sign up process
   - Login/logout
   - Password reset
   - Profile creation

2. **Core Reading Experience**
   - Browse manga/comics
   - Search functionality
   - View manga details
   - Read chapters/pages
   - Navigation (next/previous page)

3. **Account Features**
   - Profile management
   - Reading history
   - Bookmarks/favorites

4. **Download Functionality** (Mobile)
   - Download chapters
   - Offline reading
   - Storage management

5. **Premium Features**
   - Subscription signup (RevenueCat)
   - Payment flow
   - Premium feature access

### Secondary Flows (Priority 2)
- Admin features (if applicable)
- Upload functionality (if testers have access)
- Settings/preferences
- Notifications

### Edge Cases & Stress Testing
- Slow internet connection
- Offline mode
- Large file downloads
- Multiple devices per account
- Payment failures

---

## Collecting Feedback

### Feedback Channels

#### 1. **In-App Feedback Form**
Create a feedback button in your app:
- **Web:** Modal or side panel
- **Flutter:** Floating action button or settings menu

**Sample feedback form fields:**
- Overall rating (1-5 stars)
- What did you like?
- What needs improvement?
- Bugs encountered
- Feature requests
- Device/OS information

#### 2. **External Survey Form**
Use Google Forms, Typeform, or SurveyMonkey:
- Send link after 1 week of testing
- Include structured questions + open-ended feedback
- **Sample questions:**
  - How easy was it to find and start reading a comic?
  - Rate the reading experience (1-10)
  - Did you encounter any bugs? Describe them.
  - What features are missing?
  - Would you recommend this app? Why/why not?

#### 3. **Direct Communication**
- Discord server for testers
- Slack channel
- Email thread
- WhatsApp group (small groups)

#### 4. **Analytics Data**
Track:
- User engagement metrics
- Feature usage
- Drop-off points
- Error rates
- Performance metrics

---

## Test Environment Setup

### Web App Staging Setup

#### 1. Environment Variables
Create `.env.staging` file:
```env
NODE_ENV=staging
MONGODB_URI=mongodb://... (separate test DB)
S3_BUCKET=coxico-staging-bucket
JWT_SECRET=your-staging-secret
FRONTEND_URL=https://staging.coxico.com
PAYMENT_MODE=test (use sandbox/test mode)
```

#### 2. Separate Database
- Use a separate MongoDB database/cluster
- Or use MongoDB collections with `_staging` suffix
- Seed with test data (not production data)

#### 3. Staging Deployment Script
Create deployment script or use CI/CD:
```bash
# Example: deploy-staging.sh
npm run build:staging
pm2 restart coxico-staging --update-env
```

### Flutter App Testing Setup

#### 1. Testing Configuration
Create `lib/config/app_config.dart`:
```dart
class AppConfig {
  static const String apiUrl = kDebugMode 
    ? 'https://staging.coxico.com/api'
    : 'https://api.coxico.com';
    
  static const bool enableLogging = kDebugMode;
  static const bool enablePremium = true; // Use test mode in RevenueCat
}
```

#### 2. Beta Build Configuration
Modify `android/app/build.gradle`:
```gradle
android {
    flavorDimensions "version"
    productFlavors {
        beta {
            dimension "version"
            applicationIdSuffix ".beta"
            versionNameSuffix "-beta"
        }
        production {
            dimension "version"
        }
    }
}
```

#### 3. RevenueCat Test Mode
Ensure RevenueCat is in test mode:
```dart
PurchasesConfiguration configuration = PurchasesConfiguration(
  'your_api_key'
)
  ..appUserID = null // Let RevenueCat generate
  ..observerMode = false
  ..usesStoreKit2IfAvailable = true;
  
// Use sandbox testers for iOS
// Use test accounts for Android
```

---

## Sample Test Scenarios

### Scenario 1: New User Onboarding
**Instructions for testers:**
1. Sign up with a new account
2. Complete your profile
3. Browse the library
4. Select a manga to read
5. Read at least 2 chapters

**What to observe:**
- Is the signup process clear?
- Any confusion during onboarding?
- Easy to find content?
- Reading flow intuitive?

### Scenario 2: Download & Offline Reading (Mobile)
**Instructions:**
1. Connect to WiFi
2. Download 3 chapters of a manga
3. Turn off WiFi/put phone in airplane mode
4. Open the app and read downloaded chapters

**What to observe:**
- Download works correctly?
- Offline reading smooth?
- Clear indication of downloaded vs. online content?

### Scenario 3: Premium Upgrade Flow
**Instructions:**
1. Browse app as free user
2. Try to access a premium feature
3. Go through the upgrade flow
4. Complete payment (use test card)
5. Verify premium features unlock

**What to observe:**
- Clear value proposition?
- Payment flow smooth?
- Premium features work after purchase?

---

## Feedback Analysis

### Organizing Feedback

#### 1. **Categorize Issues**
- **Critical Bugs:** App crashes, payment failures, data loss
- **Major Bugs:** Feature doesn't work as expected
- **Minor Bugs:** Cosmetic issues, typos
- **UX Issues:** Confusing flow, unclear UI
- **Feature Requests:** New functionality suggestions
- **Performance Issues:** Slow loading, lag

#### 2. **Priority Matrix**
Use a 2x2 matrix:
- **High Impact + Easy Fix** → Do immediately
- **High Impact + Hard Fix** → Plan for next release
- **Low Impact + Easy Fix** → Fix when time permits
- **Low Impact + Hard Fix** → Consider for future

#### 3. **Track Feedback**
Use tools like:
- **GitHub Issues:** Create labels for beta feedback
- **Jira/Trello:** Project management board
- **Notion:** Shared database of feedback
- **Spreadsheet:** Simple but effective

### Sample Feedback Tracker Template

| Issue ID | Category | Priority | Description | Reported By | Status | Fix Version |
|----------|----------|----------|-------------|-------------|--------|-------------|
| BETA-001 | Critical Bug | P0 | App crashes on login | Tester A | Fixed | v1.0.1 |
| BETA-002 | UX Issue | P1 | Download button not visible | Tester B | In Progress | v1.0.2 |
| BETA-003 | Feature Request | P2 | Add dark mode | Multiple | Backlog | Future |

---

## Action Items After Testing

1. **Fix Critical Issues First**
   - Address all P0 (Critical) bugs before launch
   - Fix all payment-related issues

2. **Document Known Issues**
   - Create a "Known Issues" document
   - Inform users about temporary limitations

3. **Thank Your Testers**
   - Send thank you email/message
   - Consider early access or credits for active testers

4. **Create Release Notes**
   - Document what was fixed
   - Highlight improvements based on feedback

5. **Plan Follow-Up Testing**
   - Schedule another round after fixes
   - Continuous improvement cycle

---

## Tools & Resources

### Feedback Collection
- **Google Forms** (Free, easy)
- **Typeform** (Better UX, free tier)
- **SurveyMonkey** (Advanced features, paid)
- **Airtable** (Structured feedback database)

### Beta Testing Platforms
- **TestFlight** (iOS, free with Apple Developer)
- **Google Play Console** (Android, free)
- **Firebase App Distribution** (Free, cross-platform)
- **TestFairy** (Paid, advanced features)

### Analytics & Monitoring
- **Sentry** (Error tracking, free tier)
- **Firebase Analytics** (Free, comprehensive)
- **Mixpanel** (Product analytics, free tier)
- **Hotjar** (Session recording, free tier)

### Communication
- **Discord** (Community, free)
- **Slack** (Team communication, free tier)
- **Telegram** (Quick updates, free)

---

## Quick Start Checklist

- [ ] Set up staging environment (web) or beta track (mobile)
- [ ] Create feedback form/survey
- [ ] Set up analytics and error tracking
- [ ] Prepare test scenarios and instructions
- [ ] Recruit 10-20 initial testers
- [ ] Deploy beta version
- [ ] Share builds/links with testers
- [ ] Monitor feedback channels daily
- [ ] Organize and prioritize feedback
- [ ] Fix critical issues
- [ ] Deploy fixes and iterate
- [ ] Thank testers and gather final feedback

---

## Next Steps

1. **Choose your beta testing method** based on your timeline and resources
2. **Set up your staging/beta environment** (follow setup sections)
3. **Create your feedback form** (use provided examples)
4. **Recruit testers** (friends, family, online communities)
5. **Deploy and monitor** (watch analytics and feedback)

Good luck with your beta testing! 🚀

