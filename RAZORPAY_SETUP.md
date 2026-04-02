# Razorpay Payment Integration Setup Guide

## 📋 Overview
This guide walks you through integrating Razorpay payment gateway into your e-commerce backend and frontend. You now have:

- **Backend Server** (`server.js`): Handles order creation and payment verification  
- **Frontend Payment Service** (`src/services/paymentService.js`): Manages payment flow  
- **Updated QuickShopModal**: Adds "Pay Now" button alongside WhatsApp ordering  
- **Environment Configuration**: All required variables set up

---

## 🔑 Step 1: Get Razorpay Credentials

1. **Sign up at Razorpay** 
   - Visit [https://razorpay.com](https://razorpay.com)
   - Create an account (Test mode available)
   - Switch to **Test Mode** (for development)

2. **Get Your Keys**
   - Navigate to **Settings → API Keys**
   - Copy:
     - **Key ID** (public key, safe to expose in frontend)
     - **Key Secret** (private key, NEVER expose in frontend)

3. **Update `.env` file** with your credentials:
   ```env
   # Frontend
   VITE_RAZORPAY_KEY_ID=your_test_key_id_here
   VITE_RAZORPAY_API_URL=http://localhost:5000

   # Backend
   RAZORPAY_KEY_ID=your_test_key_id_here
   RAZORPAY_KEY_SECRET=your_test_key_secret_here
   PORT=5000
   ```

⚠️ **SECURITY WARNING**: Never commit `.env` with real credentials. The `.env` file is in `.gitignore`.

---

## 📦 Step 2: Install Dependencies

### Backend Dependencies
Your `package.json` already includes the required backend dependencies:
- `express`: Web server
- `razorpay`: Razorpay SDK
- `cors`: Cross-origin requests
- `dotenv`: Environment variables

### Frontend
No additional frontend SDK needed (Razorpay script loaded via CDN in `index.html`)

### Install all dependencies:
```bash
npm install
```

---

## 🚀 Step 3: Run Backend & Frontend

### Terminal 1: Start Backend Server
```bash
npm run server:dev
```

Output should show:
```
Server running on http://localhost:5000
Razorpay Key ID: Configured
```

### Terminal 2: Start Frontend Dev Server
```bash
npm run dev
```

Your app will be available at `http://localhost:5173` (or the port shown)

---

## 🧪 Step 4: Test Payment Flow

1. **Open Product Details** in your app
2. **Click "Quick Shop"** button
3. **Fill customer details**
4. **Click "💳 Pay Now with Razorpay"**
5. **Razorpay Checkout Modal** will open with test card options

### Test Card Details (Test Mode)
Use these to test payments without real charges:

| Card Number | Expiry | CVV | Status |
|------------|--------|-----|--------|
| 4111 1111 1111 1111 | 12/25 | 123 | Success |
| 4111 1111 1111 1112 | 12/25 | 123 | Failure |

### Test Flow
1. Enter card details and OTP (use any 6 digits in test mode)
2. Payment should complete successfully for valid test card
3. See success message and modal closes

---

## 🏗️ Architecture & Flow

```
User fills form → Validates form → Clicks "Pay Now"
    ↓
Frontend calls backend /create-order
    ↓
Backend creates Razorpay order and returns order_id
    ↓
Frontend opens Razorpay Checkout modal
    ↓
User completes payment
    ↓
Razorpay returns: order_id, payment_id, signature
    ↓
Frontend calls backend /verify-payment
    ↓
Backend verifies signature using HMAC-SHA256
    ↓
If verified: Payment successful ✓
    ↓
Frontend shows success message
Customer details saved to localStorage
```

---

## 📁 File Structure

```
E-Commerce/
├── server.js                          # Backend server with Razorpay
├── .env                               # Environment variables (your creds here)
├── .env.example                       # Template
├── package.json                       # Updated with backend deps
├── index.html                         # Razorpay script added
├── src/
│   ├── services/
│   │   ├── paymentService.js          # NEW: Payment logic
│   │   ├── productService.js          # Existing
│   │   └── authService.js             # Existing
│   └── components/
│       └── QuickShopModal.jsx         # UPDATED: "Pay Now" button added
```

---

## 🔐 Security Considerations

### ✅ What's Secure
- **Key Secret**: Only on backend (never exposed to client)
- **Order Creation**: Backend-only (prevents price manipulation)
- **Payment Verification**: Backend verifies cryptographic signature
- **Environment Variables**: Loaded from `.env` (not in git)

### ⚠️ Best Practices
1. **Never expose `RAZORPAY_KEY_SECRET`** in frontend code or `.env.example`
2. **Always verify payment on backend** before granting items/access
3. **Use HTTPS in production** (Razorpay enforces this)
4. **Store orders in database** after verification
5. **Handle token expiration** for long sessions

---

## 🎯 Backend Endpoints

### 1. Create Order
```
POST /api/create-order

Request:
{
  "amount": 999,          // Amount in rupees
  "currency": "INR",      // Optional, defaults to INR
  "productName": "Blue Shirt"
}

Response (Success):
{
  "success": true,
  "orderId": "order_ABC123",
  "amount": 99900,        // In paise
  "currency": "INR"
}
```

### 2. Verify Payment
```
POST /api/verify-payment

Request:
{
  "razorpay_order_id": "order_ABC123",
  "razorpay_payment_id": "pay_ABC123",
  "razorpay_signature": "signature_hash"
}

Response (Success):
{
  "success": true,
  "message": "Payment verified successfully",
  "paymentId": "pay_ABC123",
  "orderId": "order_ABC123"
}
```

### 3. Health Check
```
GET /health

Response:
{
  "status": "Server is running"
}
```

---

## 🔄 Next Steps (Optional Features)

### 1. Store Orders in Firestore
After successful payment, save order data:
```javascript
// In productService.js or new orderService.js
async function saveOrder(orderData) {
  const ordersCollection = collection(db, 'orders');
  await addDoc(ordersCollection, {
    ...orderData,
    timestamp: new Date(),
    status: 'completed'
  });
}
```

### 2. Show Success Page
```javascript
// After payment success
navigate('/order-success', { 
  state: { paymentId, orderId, amount } 
});
```

### 3. Send WhatsApp Confirmation
```javascript
// Call WhatsApp API after payment verification
const message = `Your order #${orderId} of ₹${amount} has been confirmed. Thank you!`;
// Use your WhatsApp API to send
```

### 4. Email Confirmation
```javascript
// Send email with order details
const emailData = {
  to: customerEmail,
  subject: `Order Confirmation #${orderId}`,
  body: generateEmailTemplate(orderData)
};
```

---

## 🐛 Troubleshooting

### Issue: "Razorpay script not loaded"
- **Check**: Razorpay script in `index.html` 
- **Fix**: Ensure CDN URL is correct: `https://checkout.razorpay.com/v1/checkout.js`

### Issue: Backend 404 errors
- **Check**: Backend running on `http://localhost:5000`
- **Check**: `VITE_RAZORPAY_API_URL` in `.env`
- **Fix**: Start backend with `npm run server:dev`

### Issue: "Payment verification failed"
- **Check**: `RAZORPAY_KEY_SECRET` is correct
- **Fix**: Verify secret matches Razorpay dashboard
- **Debug**: Check server console for signature mismatch error

### Issue: "Key not configured"
- **Check**: `VITE_RAZORPAY_KEY_ID` in `.env`
- **Fix**: Add valid Razorpay Key ID from dashboard

### Issue: Test payments not working
- **Check**: You're in Razorpay **Test Mode**
- **Fix**: Use test card: `4111 1111 1111 1111`
- **Check**: Backend is running and accessible

---

## 📦 Production Deployment

### Before Going Live:

1. **Switch to Production Mode** in Razorpay
2. **Update Environment Variables**
   ```env
   VITE_RAZORPAY_KEY_ID=your_live_key_id
   RAZORPAY_KEY_ID=your_live_key_id
   RAZORPAY_KEY_SECRET=your_live_key_secret
   ```

3. **Update Backend URL**
   ```env
   VITE_RAZORPAY_API_URL=https://your-api-domain.com
   ```

4. **Enable HTTPS** (Required by Razorpay)

5. **Test Again** with live credentials

6. **Monitor Orders** in Razorpay Dashboard

---

## 📚 Useful Resources

- [Razorpay Documentation](https://razorpay.com/docs)
- [Razorpay Test Cards](https://razorpay.com/docs/payments/payments/test-card-details/)
- [Server.js Implementation](./server.js)
- [Payment Service](./src/services/paymentService.js)
- [QuickShopModal Updates](./src/components/QuickShopModal.jsx)

---

## ✅ Checklist

- [ ] Razorpay account created
- [ ] Keys obtained and added to `.env`
- [ ] `npm install` completed
- [ ] Backend running: `npm run server:dev`
- [ ] Frontend running: `npm run dev`
- [ ] Test payment completed successfully
- [ ] Order data saved (optional enhancement)
- [ ] Production credentials ready
- [ ] HTTPS enabled in production
- [ ] Monitoring set up

---

**You're all set! 🎉 Your e-commerce app now accepts online payments through Razorpay.**

For questions or issues, check the troubleshooting section or refer to [Razorpay Documentation](https://razorpay.com/docs).
