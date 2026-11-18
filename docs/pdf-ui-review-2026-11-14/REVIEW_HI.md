# Aatmyam Pos — दोनों PDF और मौजूदा कोड की तुलना

दिनांक: 14 नवम्बर 2026, भारतीय समय। यह मूल audit का रिकॉर्ड है। 18 नवम्बर के सुधार और नई जाँच [वर्तमान review](../ui-review-2026-11-18/REVIEW_HI.md) में हैं।

38 UI मदें स्थानीय कोड में पूरी की गई हैं। दो भविष्य के प्रश्न अलग फ़ाइल में सुरक्षित हैं। **Render preview पर इस कार्य का deployment नहीं किया गया है।** “पूरा” का अर्थ स्थानीय implementation और नीचे उल्लिखित जाँच है; यह live deployment का दावा नहीं है।

## आधार और प्राथमिकता

- स्रोत: `ritikShivhare/Veggie-POS-Main`, `main` का commit `8a70bd7cea4350dc0513d59c24448dbba0f9ac04`। 12 नवम्बर के marketing बदलाव, staff security/capacity और notification routing इसी आधार में मौजूद हैं।
- कार्य branch: `codex/pdf-ui-review-2026-11-14`। Workspace में पहले कोई checkout नहीं था। अलग clone में काम किया; मूल main और सभी पुराने बदलाव सुरक्षित हैं। बदलाव से पहले सभी refs का Git bundle लिया गया।
- दूसरी मिली repository `Veggie-POS-Main-1` का latest commit 28 सितम्बर का है; उसे edit नहीं किया गया।
- `_frame- pdf 74.pdf` में 74 पृष्ठ; `latest all changes done 316 pages_compressed.pdf` में 316 पृष्ठ। सभी 390 पृष्ठों का दृश्य सूचकांक बनाया। चिह्नित/टिप्पणी वाले पृष्ठ अलग आकार में पढ़े। PDFs मुख्यतः screenshot हैं; selectable text या native PDF annotations को पूरा निर्देश मानकर भरोसा नहीं किया।
- पीला = संबंधित UI पाठ/तत्व हटाना। लाल = संबंधित UI/टेक्स्ट बदलना। 316-पृष्ठ वाला दस्तावेज़ प्राथमिक है। 74-पृष्ठ वाली PDF के पूरक audit/privacy/monitoring बदलाव भी लिए गए; दोहराए screenshot को अलग task नहीं गिना।
- दस्तावेज़ों का screenshot, उसमें दिखा बटन, test account, UPI पता या उदाहरण अपने-आप कोई कार्रवाई का आदेश नहीं है। Export, device clear, real payment, notification send, credential change या live data mutation नहीं चलाए गए।

## दो दस्तावेज़ों के बीच निर्णय

| विषय | पूरक PDF | प्राथमिक PDF / अंतिम निर्णय |
| --- | --- | --- |
| Reports में मिला-जुला पाठ | 74:6–7 में वही स्क्रीन | 316:7/12 के अनुसार चुनी भाषा के labels लागू |
| Notification tabs | 74:11/13 पुराने नाम दिखाते हैं | 316:22/25 की अस्पष्टता पहले पूछी; user के आसान अंग्रेज़ी नाम लागू |
| Audit/privacy/monitoring | 74:15/46/50 के चिह्न | 316 में इनका विरोधी निर्देश नहीं; पूरक बदलाव लागू |
| Order number | कोई स्पष्ट नया format नहीं | 316:170 के बाद user ने daily 001 sequence चुना |

## कोड में पहले क्या स्थिति थी?

| पहले की स्थिति | UI मदें |
| --- | ---: |
| पूरा | 2 |
| आंशिक | 9 |
| बाकी | 27 |
| कुल | 38 |

अभी स्थानीय UI में 38 पूरे हैं। पहले से पूरे दोनों payment-link व्यवहार सुरक्षित रखे गए। 36 UI मदों के लिए बदलाव/सुधार किए गए। विस्तृत स्रोत-पृष्ठ, पहले/अब की स्थिति, फ़ाइल और प्रमाण `UI_STATUS.csv` में हैं। `PAGE_INDEX.csv` में हर पृष्ठ का संबंध है।

## मुख्य परिणाम

- Notification tabs: **Send Notification**, **Delivery History**।
- Order number: हर restaurant और भारतीय business date के लिए **001, 002…**। Stored number में तारीख रहती है, इसलिए अगले दिन का 001 duplicate नहीं बनता। Counter मौजूदा database transaction में persistent है; कई terminals, retry, rollback और 999 से आगे जाँचा गया। Offline order को provisional reference मिलता है; cloud sync पर सही नंबर आता है। पहले के रिकॉर्ड नहीं बदले गए।
- Hindi/English report labels, actions, empty states और status चुनी भाषा में हैं। अपना menu/staff data अनुवादित नहीं किया गया। Language बदलने पर AI request अपने-आप नहीं चलती। पुराने अलग भाषा वाले generated document को मिश्रित रूप में नहीं दिखाते।
- WAC की formula/तकनीकी boxes हटाकर purchase form सरल किया। Dropdown में केवल ingredient name; गणना और records सुरक्षित।
- Manual loyalty points केवल Owner/Manager के लिए। नई profile हमेशा zero points से बनती है; बदलाव audited manual controls से। Guest GSTIN UI हटाया; पुराने data नहीं मिटाए।
- Total Visits क्लिक करके वास्तविक paid bill history: date, time, items, bill amount, tax/discount और recorded loyalty points। Legacy paid records में timestamp न हो तो दर्ज date का उपयोग; points data न हो तो “Not recorded”।
- Guest की local save और sync command atomic हैं। UI cloud drain का इंतज़ार नहीं करती। Pending/rejected guest पुरानी server snapshot आने पर नहीं गायब होता। Canonical sync पर React state refresh होती है। समान millisecond वाले queue commands को निश्चित क्रम दिया, जिससे आपसी blocking नहीं होती।
- POS में actual role; hardware न होने के आधार पर मुख्य drawer बटन हटाया। KOT में **Done**।
- Receipt, KOT और पुराने Dashboard bill को अलग same-origin document में print करते हैं। App का छिपा layout अतिरिक्त पन्ना नहीं बनाता। 58/80mm preference सुरक्षित है।
- Audit में पढ़ने योग्य भारतीय समय, mobile layout और View details। Data controls और service alerts के सरल नाम; चिह्नित technical help हटाई।

## जाँच और व्यावहारिक सीमा

- `npm run lint`: TypeScript जाँच पास।
- `npm test`: **78 test files, 615 tests पास**।
- `npm run build`: production frontend, prerender और server bundle पास।
- Browser: 390px mobile और 1440px desktop पर जाँच; 14 निष्कर्ष `browser-results.json` में। कोई uncaught browser error नहीं।
- Customer receipt 58/80mm, KOT और historical Dashboard bill: प्रत्येक sample में एक PDF पन्ना।
- `git diff --check`: पास। आधार commit पर patch application अलग checkout में जाँची गई।

ब्राउज़र screenshots वास्तविक React components, स्थानीय test data और mocked APIs से बनाए गए हैं। वे production data या authenticated Render screenshots नहीं हैं। Render का सार्वजनिक login खोला और पढ़ा गया; authenticated POS के लिए login/session उपलब्ध नहीं था। उसके पीछे के flows को स्थानीय components, API regression और source comparison से जाँचा गया।

चार PDF artifacts में छोटे customer receipt (58/80mm), KOT और पुराने bill के लिए एक पन्ना मिला। लंबे bill में वास्तविक pagination हो सकता है। वास्तविक printer/driver का भौतिक test नहीं किया गया। Payment cancellation का backend पहले से था और regression suite से जाँचा; इस UI कार्य में real gateway payment नहीं बनाया।

## सुरक्षित उपयोग और rollback

`veggie-pos-ui.patch` आधार commit पर लागू करने योग्य Git patch है; `git apply --check` के बाद `git apply` इस्तेमाल करें। ZIP में सभी बदली source/test/doc files, patch, verification logs, screenshots, PDF samples और बदलाव से पहले का Git bundle है। Runtime cache, dependencies, credentials और `.env` package में नहीं हैं।

इस बदलाव में नया schema migration नहीं है। Daily counter मौजूदा `tenant_objects` storage और existing revision-checked transaction का उपयोग करता है। Release के बाद numbering counter बढ़े तो UI rollback करते समय business records/counters मिटाने की ज़रूरत नहीं है। पुराने records/IDs और background payment logic सुरक्षित हैं।

## मदवार सूची

| ID | PDF:पृष्ठ | अपेक्षित बदलाव | पहले | अब |
| --- | --- | --- | --- | --- |
| UI-01 | 74:1 | PIN label में STAFF और auto-submits badge हटाना | बाकी | पूरा |
| UI-02 | 74:3 | Dashboard के नीचे तकनीकी परिचय हटाना | बाकी | पूरा |
| UI-03 | 74:11 | Notification compose का तकनीकी परिचय हटाना | बाकी | पूरा |
| UI-04 | 74:13 | Delivery History की खाली स्क्रीन का लंबे कानूनी/तकनीकी पाठ हटाना | बाकी | पूरा |
| UI-05 | 74:15 | Privacy/data section का शीर्षक, विवरण और controls सरल करना | आंशिक | पूरा |
| UI-06 | 74:46 | Audit timestamps पढ़ने योग्य करना | बाकी | पूरा |
| UI-07 | 74:46 | Audit description को mobile में पढ़ने योग्य करना | बाकी | पूरा |
| UI-08 | 74:50 | Monitoring heading, description, switch और Slack field का सरल UI | बाकी | पूरा |
| UI-09 | 74:50 | Sentry, Operations Email और environment fallback विवरण UI से हटाना | बाकी | पूरा |
| UI-10 | 316:1 | Merchant name के Optional/defaults वाले चिह्नित पाठ हटाना | बाकी | पूरा |
| UI-11 | 316:1 | Test QR का चिह्नित scan-help paragraph हटाना | बाकी | पूरा |
| UI-12 | 316:1 | Receipt printer के नीचे चिह्नित लंबा निर्देश हटाना | बाकी | पूरा |
| UI-13 | 316:1 | खाली QR preview में veggiepos@upi की जगह Aatmyampos@upi text | बाकी | पूरा |
| UI-14 | 316:4 | पुराना Invalid UPI explanation banner हटाना | बाकी | पूरा |
| UI-15 | 316:7,12 | Hindi/English report UI में भाषा का मिश्रण समाप्त करना | आंशिक | पूरा |
| UI-16 | 316:22,25 | Dispatch Lab और Gateway Logs के आसान अंग्रेज़ी नाम | बाकी | पूरा |
| UI-17 | 316:35 | PIN बदलने के प्रभावों का चिह्नित लंबा द्विभाषी उदाहरण हटाना | बाकी | पूरा |
| UI-18 | 316:38,41 | GST/FSSAI और instant update का चिह्नित सहायता-पाठ हटाना | बाकी | पूरा |
| UI-19 | 316:38,39 | Subscription की चिह्नित provider/explanation line हटाना | बाकी | पूरा |
| UI-20 | 316:41 | Cancelled/expired payment-link history UI से हटाना | पूरा | पूरा |
| UI-21 | 316:41 | नई checkout पर पुराने link को रद्द/expire करने की background प्रक्रिया | पूरा | पूरा |
| UI-22 | 316:45 | Raw material price के नीचे per kg/pcs (WAC) text हटाना | बाकी | पूरा |
| UI-23 | 316:79 | Purchase dialog में formula/technical WAC boxes का सरल UI | बाकी | पूरा |
| UI-24 | 316:83 | Ingredient dropdown में केवल नाम दिखाना | बाकी | पूरा |
| UI-25 | 316:122 | Starting loyalty balance से गैर-Owner/Manager को points बदलने से रोकना | आंशिक | पूरा |
| UI-26 | 316:127 | Manual Loyalty Ledger Actions केवल Owner/Manager को दिखाना | आंशिक | पूरा |
| UI-27 | 316:128,148 | Total Visits पर date/time, bill items/amount और loyalty history खोलना | बाकी | पूरा |
| UI-28 | 316:133,144 | Guest जोड़ने पर दो मिनट की प्रतीक्षा हटाना | आंशिक | पूरा |
| UI-29 | 316:133,144 | Sync pending होने पर guest गायब न हो और सही स्थिति दिखे | आंशिक | पूरा |
| UI-30 | 316:149,199 | Guest GSTIN field और खाली registration row हटाना | बाकी | पूरा |
| UI-31 | 316:170 | Order/bill number हर दिन 001 से; स्थायी व्यवस्था | बाकी | पूरा |
| UI-32 | 316:191 | KDS empty state का चिह्नित explanatory paragraph हटाना | बाकी | पूरा |
| UI-33 | 316:220 | बिना hardware वाले POS से Cash Drawer बटन हटाना | आंशिक | पूरा |
| UI-34 | 316:220 | Owner के लिए Cashier का गलत label सुधारना | बाकी | पूरा |
| UI-35 | 316:253 | KOT close action Dismiss से Done करना | आंशिक | पूरा |
| UI-36 | 316:260,314-316 | Print/Save PDF में छोटे बिल की अतिरिक्त प्रति/पन्ना हटाना | आंशिक | पूरा |
| UI-37 | 316:269,291 | Daily performance breakdown का चिह्नित explanation हटाना | बाकी | पूरा |
| UI-38 | 316:273,291 | English Dashboard/chart labels से चिह्नित Hindi suffix हटाना | बाकी | पूरा |
| FQ-01 | 316:52 | Shift/login active होने और कर्मचारी के वास्तव में restaurant में काम करने में अंतर कैसे मापें? | बाकी | बाकी |
| FQ-02 | 316:156 | BOM ingredients में gas, बिजली, श्रम व अन्य overhead जोड़कर पूर्ण dish cost कैसे निकालें? | बाकी | बाकी |
