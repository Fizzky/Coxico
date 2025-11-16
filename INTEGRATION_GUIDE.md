# Quick Integration Guide: Adding Feedback to Your Apps

This guide shows you how to quickly integrate the feedback components into your Coxico apps.

## Backend Setup

✅ **Already Done!** The feedback routes and model are already added to your backend.

### Verify Backend Setup

1. **Check that the Feedback model exists:**
   ```bash
   ls backend/models/Feedback.js
   ```

2. **Check that feedback routes are registered in server.js:**
   - The route should be at: `app.use('/api/feedback', feedbackRoutes);`

3. **Restart your backend server:**
   ```bash
   cd backend
   npm start
   ```

4. **Test the endpoint:**
   ```bash
   curl -X POST http://localhost:5000/api/feedback \
     -H "Content-Type: application/json" \
     -d '{
       "rating": 5,
       "category": "general",
       "message": "Test feedback message"
     }'
   ```

---

## Web App Integration (React)

### Step 1: Add Feedback Button to Your App

You can add a feedback button in your header, profile menu, or as a floating button.

#### Option A: Add to Header Menu (Recommended)

1. **Open `frontend/src/App.jsx`**

2. **Import the FeedbackModal:**
   ```jsx
   import FeedbackModal from './components/FeedbackModal';
   ```

3. **Add state for modal:**
   ```jsx
   const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);
   ```

4. **Add feedback button in your menu (where you have User, History, etc.):**
   ```jsx
   <button onClick={() => setIsFeedbackOpen(true)}>
     <MessageSquare /> {/* from lucide-react */}
     Send Feedback
   </button>
   ```

5. **Add the modal component:**
   ```jsx
   <FeedbackModal 
     isOpen={isFeedbackOpen} 
     onClose={() => setIsFeedbackOpen(false)} 
   />
   ```

#### Option B: Floating Feedback Button

Add this to your main App component:

```jsx
{/* Floating Feedback Button */}
<button
  onClick={() => setIsFeedbackOpen(true)}
  style={{
    position: 'fixed',
    bottom: '20px',
    right: '20px',
    width: '60px',
    height: '60px',
    borderRadius: '50%',
    background: '#E50914',
    color: 'white',
    border: 'none',
    cursor: 'pointer',
    boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
    zIndex: 1000,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  }}
>
  <MessageSquare size={24} />
</button>
```

---

## Flutter App Integration

### Step 1: Add Required Dependencies

1. **Open `pubspec.yaml`**

2. **Add these dependencies:**
   ```yaml
   dependencies:
     device_info_plus: ^10.1.0
     package_info_plus: ^8.0.0
   ```

3. **Run:**
   ```bash
   flutter pub get
   ```

### Step 2: Add Feedback Button to Profile Screen

1. **Open `lib/profile_screen.dart`**

2. **Import the feedback screen:**
   ```dart
   import 'feedback_screen.dart';
   ```

3. **Add a "Send Feedback" button in your profile actions list:**

   Find where you have other action buttons (like Logout, Premium Upgrade, etc.) and add:

   ```dart
   ListTile(
     leading: const Icon(Icons.feedback, color: Colors.white),
     title: const Text('Send Feedback', style: TextStyle(color: Colors.white)),
     onTap: () {
       Navigator.push(
         context,
         MaterialPageRoute(builder: (context) => const FeedbackScreen()),
       );
     },
   ),
   ```

### Step 3: Fix API Service Import

Make sure `feedback_screen.dart` can access your API base URL. Check your `api_service.dart` and ensure it has a `baseUrl` constant:

```dart
// In api_service.dart
class ApiService {
  static const String baseUrl = 'http://localhost:5000'; // or your server URL
  // ... rest of your API service
}
```

If your API service structure is different, update the import in `feedback_screen.dart`:

```dart
// Change this line in feedback_screen.dart:
import 'api_service.dart';

// To match your actual API service structure
```

---

## Testing the Integration

### Web App

1. Start your frontend: `npm run dev` (or whatever command you use)
2. Open your app in the browser
3. Click the feedback button
4. Fill out the form and submit
5. Check your MongoDB database for the feedback entry

### Flutter App

1. Run your Flutter app: `flutter run`
2. Navigate to Profile screen
3. Tap "Send Feedback"
4. Fill out the form and submit
5. Check your MongoDB database for the feedback entry

---

## Viewing Feedback (Admin Only)

### Option 1: API Endpoints

You can create a simple admin panel to view feedback, or use these endpoints directly:

**Get all feedback:**
```bash
GET /api/feedback
Authorization: Bearer <admin_token>
```

**Get feedback stats:**
```bash
GET /api/feedback/stats
Authorization: Bearer <admin_token>
```

### Option 2: MongoDB Query

Connect to your MongoDB and query:

```javascript
// All feedback
db.feedbacks.find().sort({ timestamp: -1 }).limit(50)

// Critical bugs
db.feedbacks.find({ category: 'bug', rating: { $lte: 2 } })

// Low ratings
db.feedbacks.find({ rating: { $lte: 2 } })
```

### Option 3: Simple Admin Panel (Quick Setup)

Create a simple admin page to view feedback. Add this to your admin panel:

```jsx
// In your AdminPanel.jsx or create AdminFeedback.jsx
import { useState, useEffect } from 'react';
import axios from 'axios';

const AdminFeedback = () => {
  const [feedback, setFeedback] = useState([]);
  
  useEffect(() => {
    axios.get('/api/feedback', {
      headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
    }).then(res => setFeedback(res.data.feedback));
  }, []);
  
  return (
    <div>
      <h2>User Feedback</h2>
      {feedback.map(f => (
        <div key={f._id}>
          <div>Rating: {f.rating}/5</div>
          <div>Category: {f.category}</div>
          <div>Message: {f.message}</div>
          <div>Date: {new Date(f.timestamp).toLocaleString()}</div>
          <hr />
        </div>
      ))}
    </div>
  );
};
```

---

## Troubleshooting

### Web App: "Cannot find module"
- Make sure `FeedbackModal.jsx` is in `frontend/src/components/`
- Check your import path is correct

### Flutter: "Undefined name 'ApiService'"
- Update the import in `feedback_screen.dart` to match your actual API service file
- Or define `baseUrl` directly in `feedback_screen.dart` if needed

### Backend: "Feedback is not a constructor"
- Make sure you're using ES modules (import/export) consistently
- Check that `Feedback.js` uses `export default`

### Feedback not submitting
- Check browser/device console for errors
- Verify your API endpoint: `http://localhost:5000/api/feedback`
- Check CORS settings if submitting from a different origin
- Verify MongoDB connection is working

---

## Next Steps

1. ✅ Integrate feedback components into your apps
2. ✅ Test the feedback submission flow
3. ✅ Set up admin view for feedback
4. ✅ Deploy to staging/beta environment
5. ✅ Recruit beta testers
6. ✅ Monitor feedback regularly

Good luck with your beta testing! 🚀

