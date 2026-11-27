# Website visit statistics

Measurement ID: `G-WPERCLQYVR` (public identifier, not a password).

यह setup केवल anonymous visitors के public marketing/legal pages पर लागू है। `https://www.aatmyampos.in` और पुराने `https://aatmyam-marketing-preview.onrender.com` दोनों hostnames supported हैं। Login, signup, terminal, signed-in POS, private query strings और token fragments track नहीं होते। पुराने `/login` outreach links से marketing page खुलने तक visit statistics नहीं गिनी जाएँगी; नए outreach links में public homepage इस्तेमाल करें।

## Privacy और access

- पहली visit पर **Allow statistics** या **No thanks** चुना जा सकता है। Allow से पहले Google का script नहीं लोड होता। **Privacy choices** से बाद में बदला जा सकता है। DNT/GPC opt-out भी माना जाता है।
- Cookie-session restoration पूरी होने तक statistics बंद रहती हैं। Session check fail हो तो भी tracking बंद रहती है। Private app views पर `ga-disable` लागू रहता है।
- केवल public page addresses/titles और सीमित campaign labels भेजे जाते हैं। कोई staff/customer ID, PIN, order, bill, phone number, email address या form-field value जानबूझकर नहीं भेजी जाती। Ads storage, ad personalization और Google Signals बंद हैं।
- यह code Analytics reports को public नहीं बनाता और किसी account/person को नई report permissions नहीं देता। Reports उन्हीं accounts को मिलती हैं जिनको Google Analytics property में access है। Measurement ID से report access नहीं मिलता। इस release में property access/data-sharing settings नहीं बदली गई हैं।
- Reports consenting visitors की page views हैं, सभी taps या हर व्यक्ति की सटीक पहचान नहीं। Browser blockers, consent और processing delay counts पर असर डाल सकते हैं। Health pings/API calls visitors नहीं हैं। Tracking से पहले के clicks बाद में नहीं बनाए जा सकते।

## Deployment से पहले जरूरी Google setting

Google Analytics → Admin → Data streams → इस Web stream → Enhanced measurement ⚙️ → Page views → Show advanced settings → **Page changes based on browser history events = Off** → Save.

कारण: app public SPA views को खुद भेजता है। Google की browser-history automatic pageviews साथ में चलने पर duplicates मिलते हैं। `send_page_view: false` अकेले इस setting को बंद नहीं करता। Real Google SDK browser test में duplicate पहचाना गया था। यह setting बदले और duplicate-free browser check पास हुए बिना deploy/merge नहीं करना है। मौजूदा connector से Google की यह setting बदली नहीं जा सकती; owner अपने Analytics account में बदलेगा। इस action से report access permissions नहीं बदलतीं।

## Realtime जाँच

1. Deploy के बाद अपना public homepage नए/incognito tab में खोलें और **Allow statistics** चुनें।
2. Product और Pricing pages खोलें।
3. Google Analytics में इसी Measurement ID वाली property चुनें → Reports → Realtime देखें। सामान्य reports को processing time लग सकता है।
4. Account/POS pages पर जाकर देखें कि private addresses या tenant details events में नहीं आ रही हैं। Local automated test के सारे artificial Google collection requests intercept किए जाते हैं; कोई QA customer/order वास्तविक database में नहीं बनाया जाता।

## आगे share करने के links

WhatsApp:
`https://www.aatmyampos.in/?utm_source=whatsapp&utm_medium=social&utm_campaign=restaurant_outreach`

Email:
`https://www.aatmyampos.in/?utm_source=direct_email&utm_medium=email&utm_campaign=restaurant_outreach`

Campaign labels में किसी व्यक्ति का नाम, phone, email, PIN या token न रखें। Source/medium रिपोर्ट में इन labels से channels अलग पहचाने जा सकते हैं। पहले भेजे हुए plain links Direct/unknown दिख सकते हैं। Consent किसी बाद के public page पर दी जाए तो initial safe campaign labels memory में सुरक्षित रखे जाते हैं।

## Verification

25 focused tests और पूरी 751-test suite / 89 files, typecheck तथा production build पास हैं। Browser का real Google SDK check automatic-history setting Off होने के बाद अंतिम रूप से पास होना बाकी है। Settings और final deployment evidence pull request/Actions history में दर्ज किए जाएँगे।

Official guidance:

- https://developers.google.com/analytics/devguides/collection/ga4/views
- https://developers.google.com/tag-platform/security/guides/privacy
- https://developers.google.com/tag-platform/security/guides/consent
- https://developers.google.com/tag-platform/security/guides/csp
- https://developers.google.com/analytics/devguides/collection/ga4/reference/config
