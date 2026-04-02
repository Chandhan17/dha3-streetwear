# Firestore Security Rules Setup

## 🔴 Problem

You're getting this error when trying to save orders:
```
FirebaseError: Missing or insufficient permissions.
```

This happens because **Firestore security rules are denying writes** to the `orders` collection.

---

## ✅ Solution

### **Option 1: Deploy Rules via Firebase CLI (Recommended)**

#### **Step 1: Install Firebase CLI**
```bash
npm install -g firebase-tools
```

#### **Step 2: Login to Firebase**
```bash
firebase login
```

A browser window will open → Choose your email → Authorize

#### **Step 3: Initialize Firebase Project**
```bash
firebase init
```

Choose:
- ✅ Firestore
- ✅ Hosting (optional)

When asked for project, select your project: **e-commerce-fa97b**

#### **Step 4: Deploy Rules**
```bash
firebase deploy --only firestore:rules
```

Output should show:
```
✔ Deploy complete!
✔ Firestore Security Rules have been updated.
```

---

### **Option 2: Manual Setup in Firebase Console**

#### **Step 1: Go to Firebase Console**
- Open [https://console.firebase.google.com](https://console.firebase.google.com)
- Select your project: **e-commerce-fa97b**
- Go to **Firestore Database** → **Rules** tab

#### **Step 2: Replace the Rules**

Clear existing rules and paste:

```firestore
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Allow anyone to read products (public collection)
    match /products/{product=**} {
      allow read: if true;
    }

    // Orders collection - secure access
    match /orders/{document=**} {
      // Allow anyone to create an order
      allow create: if true;
      
      // Allow anyone to read orders
      allow read: if true;
      
      // Allow updates to orders
      allow update: if true;
      
      // Allow deletion only if authenticated
      allow delete: if request.auth != null;
    }
  }
}
```

#### **Step 3: Click "Publish"**

---

## 📋 What These Rules Allow

| Operation | Rule | Who | Reason |
|-----------|------|-----|--------|
| Create Order | `allow create` | Anyone | Orders from guests or logged-in users |
| Read Orders | `allow read` | Anyone | Admin dashboard needs to read orders |
| Update Status | `allow update` | Anyone | Admin can update order status |
| Delete Order | `allow delete` | Authenticated only | Only logged-in admins can delete |
| Read Products | `allow read` | Anyone | Products are public |

---

## ⚠️ Security Considerations

This setup prioritizes **functionality** while maintaining basic security:

### **Current Rules (Development)**
- ✅ Orders collection is publicly readable/writable
- ✅ Fast development iteration
- ⚠️ Not ideal for production

### **Production Rules (Recommended Later)**

For better security, use these rules in production:

```firestore
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Public - anyone can read products
    match /products/{product=**} {
      allow read: if true;
    }

    // Orders - authenticated users only
    match /orders/{document=**} {
      // Only authenticated users can create orders
      allow create: if request.auth != null;
      
      // Only admins can read all orders
      allow read: if request.auth.token.admin == true;
      
      // Only admins can update status
      allow update: if request.auth.token.admin == true;
      
      // Only admins can delete
      allow delete: if request.auth.token.admin == true;
      
      // Users can read their own orders
      allow read: if request.auth.uid == resource.data.userId;
    }
  }
}
```

**To implement production rules:**
1. Set Firebase custom claims for admin users (see Firestore documentation)
2. Store `userId` in each order document
3. Deploy updated rules

---

## 🔧 Detailed Setup Instructions

### **Using Firebase CLI**

#### **1. Check if Firebase CLI is installed**
```bash
firebase --version
```

If not installed:
```bash
npm install -g firebase-tools
```

#### **2. Login**
```bash
firebase login
```

#### **3. Initialize project in your app directory**
```bash
cd C:\Users\annap\OneDrive\Desktop\E-Commerce
firebase init
```

**When prompted:**
```
? Which Firebase CLI features do you want to set up?
  ✅ Firestore: Configure security rules and indexes
  (other options - optional)

? Select a default Firebase project
  → e-commerce-fa97b

? File firestore.rules already exists. Overwrite?
  → Yes

? File firestore.indexes.json already exists. Overwrite?
  → No (or Yes if you want to reset)
```

#### **4. Deploy**
```bash
firebase deploy --only firestore:rules
```

---

## ✅ Verification

### **After Deploying Rules:**

1. **Go to your app** → Random product
2. **Click "Quick Shop"** → Fill details
3. **Click "💳 Pay Now"** (test with: `4111 1111 1111 1111`)
4. **Complete payment**
5. **Should see**: "Payment successful! Your order has been placed."
   - ❌ If you see error: Rules still not deployed properly

### **Alternative Test: WhatsApp Order**

1. **Go to product** → "Quick Shop"
2. **Fill details**
3. **Click "Send on WhatsApp"**
4. **No error should appear**
5. Order should appear in **Admin → Orders tab**

---

## 📊 Firestore Collections

After deployment, you should have:

```
Database: (default)
├── products/
│   ├── product_1/
│   ├── product_2/
│   └── ...
└── orders/
    ├── order_doc_id_1/
    │   ├── customerName: "John Doe"
    │   ├── paymentStatus: "paid"
    │   └── ...
    ├── order_doc_id_2/
    └── ...
```

---

## 🐛 Troubleshooting

### **Error: "Missing or insufficient permissions"**
- ❌ Rules not deployed
- ✅ Solution: Run `firebase deploy --only firestore:rules`

### **Error: "Permission denied for default"**
- ❌ Rules file has syntax error
- ✅ Solution: Check `firestore.rules` for typos, redeploy

### **Orders not appearing after payment**
- ❌ Rules deployed but still failing
- ✅ Solution: Check browser console for exact error, check Firestore in Firebase Console

### **Can't access Firebase console**
- ❌ Not logged in to Firebase
- ✅ Solution: Go to https://console.firebase.google.com, login with Google

---

## 📝 Files

- **Firestore Rules**: `firestore.rules` (in project root)
- **Firebase Config**: `firebase.json` (updated)
- **.firebaserc**: Stores project ID (auto-created)

---

## 🔗 Resources

- [Firestore Rules Documentation](https://firebase.google.com/docs/firestore/security/start)
- [Firebase CLI Reference](https://firebase.google.com/docs/cli)
- [Security Rules Cheat Sheet](https://firebase.google.com/docs/firestore/security/rules-query)

---

## 📌 Next Steps

1. **Deploy rules** using one of the methods above
2. **Reload app** in browser
3. **Test payment** → Should see success
4. **Check Admin → Orders** tab for placed orders
5. (Optional) Later: Move to production security rules

---

**Once deployed, the error will disappear and orders will save successfully!** ✅
