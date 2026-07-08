# Render पर Deployment की Step-by-Step मार्गदर्शिका (Deployment Guide)

यह गाइड आपको अपने Veggie POS SaaS एप्लीकेशन को **Render** पर बिल्कुल मुफ्त (Free Tier) में होस्ट करने में मदद करेगी।

---

## 📋 Pre-Deployment Check (तैनाती से पहले की तैयारी)

हमने आपके कोडबेस को Render के अनुकूल बना दिया है:
1. **Dynamic Port Fix:** `server.ts` में dynamic `process.env.PORT` सपोर्ट जोड़ दिया गया है, ताकि Render अपने आप सही पोर्ट (जैसे `10000`) असाइन कर सके।
2. **Production Optimized Build:** `package.json` और Vite/esbuild बंडलिंग को बिल्कुल सही तरीके से सेट कर दिया गया है।
3. **Tests Verify:** सभी 11 यूनिट टेस्ट अब पूरी तरह पास हो चुके हैं और पूरी तरह से ऑफलाइन (In-Memory) चलते हैं।

---

## 🚀 Step-by-Step Deployment Steps (कदम-दर-कदम प्रक्रिया)

### Step 1: Code को GitHub पर Push करें
चूंकि Render सीधे आपके GitHub रिपोजिटरी से जुड़कर डिप्लॉय करता है, इसलिए:
1. अपने कोडबेस को एक नए GitHub Repository में push करें।

### Step 2: Render पर Account बनाएं
1. [Render.com](https://render.com/) पर जाएं और अपने GitHub अकाउंट का उपयोग करके Sign Up करें।

### Step 3: New Web Service बनाएं
1. Render Dashboard पर जाएं और **"New +"** बटन पर क्लिक करके **"Web Service"** चुनें।
2. अपने GitHub अकाउंट को कनेक्ट करें और अपनी Repository को सिलेक्ट करें।

### Step 4: Settings Configure करें
Render अपने आप `render.yaml` फ़ाइल से सेटिंग्स पहचान लेगा, फिर भी आप इन सेटिंग्स को क्रॉस-चेक कर सकते हैं:
- **Language/Runtime:** `Node`
- **Build Command:** `npm install && npm run build`
- **Start Command:** `npm run start`
- **Plan:** `Free`

### Step 5: Environment Variables (गुप्त चाबियां) जोड़ें
Render में **Environment Variables** सेक्शन में जाकर निम्नलिखित वेरिएबल्स जोड़ें:
- `NODE_ENV` = `production`
- `PORT` = `10000`
- `GEMINI_API_KEY` = *(आपकी Google AI Studio API Key)*
- `SUPABASE_URL` = *(आपकी Supabase Project URL)*
- `SUPABASE_ANON_KEY` = *(आपकी Supabase Anon Public Key)*
- `SAAS_OWNER_PASSWORD_HASH` = *(SaaS Owner लॉगिन के लिए bcrypt पासवर्ड हैश)*

---

## ⚠️ Free Tier की महत्वपूर्ण बातें और सीमाएं (Free Tier Limitations)

चूंकि आप **Free Tier** का उपयोग कर रहे हैं, कृपया इन 2 बातों का विशेष ध्यान रखें:

1. **Spin-down / Inactivity (निष्क्रियता पर बंद होना):**
   - यदि आपके ऐप पर लगातार **15 मिनट तक कोई विजिटर (ट्रैफिक) नहीं आता है**, तो Render आपके सर्वर को सुप्तावस्था (sleep mode) में डाल देता है।
   - जब कोई अगला कस्टमर या स्टाफ ऐप खोलेगा, तो सर्वर को दोबारा जागने (cold start) में **30 से 60 सेकंड** का समय लग सकता है। रेस्टोरेंट के व्यस्त समय में यह थोड़ा असुविधाजनक हो सकता है।

2. **In-Memory Session Reset (सत्रों का रीसेट होना):**
   - जब भी सर्वर निष्क्रिय होकर दोबारा जागता है या जब आप नया अपडेट डिप्लॉय करते हैं, तो सर्वर के इन-मेमोरी एक्टिव सेशन्स रीसेट हो जाते हैं। 
   - इससे स्टाफ मेंबर्स को दोबारा लॉगिन करना पड़ सकता है। इसे हल करने के लिए आप बाद में एक Redis Instance (Upstash या Render Redis) को `REDIS_URL` एनवायरनमेंट वेरिएबल के साथ जोड़ सकते हैं।
