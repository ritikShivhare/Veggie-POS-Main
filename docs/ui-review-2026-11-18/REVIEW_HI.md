# Aatmyam Pos — UI review और main merge की तैयारी

दिनांक: 18 नवम्बर 2026, भारतीय समय। आधार: `main` commit `8a70bd7cea4350dc0513d59c24448dbba0f9ac04`। कार्य branch: `codex/aatmyam-pos-pdf-ui-2026-11-18`।

उपयोगकर्ता ने UI का काम पूरा करके GitHub की `main` branch में merge करने की अनुमति दी है। यह अनुमति पुराने handover के read-only/Part 2 रोक वाले निर्देश को इस काम के लिए बदलती है। नया Render deployment इस बदलाव में शामिल नहीं है।

## PDF और पुराने काम की स्थिति

दोनों PDFs के लिए पीला = हटाना, लाल = UI/टेक्स्ट बदलना, और विवाद में 316-पृष्ठ PDF प्राथमिक है। सभी 390 पृष्ठों का पुराना सूचकांक और 38 UI आवश्यकताओं की तुलना [PDF review](../pdf-ui-review-2026-11-14/REVIEW_HI.md), [UI_STATUS.csv](../pdf-ui-review-2026-11-14/UI_STATUS.csv) तथा [PAGE_INDEX.csv](../pdf-ui-review-2026-11-14/PAGE_INDEX.csv) में सुरक्षित है। पुराने audit में नाम Veggie POS था; वर्तमान नाम **Aatmyam Pos** है।

| स्थिति | मूल आधार कोड | इस branch में |
| --- | ---: | ---: |
| पूरा | 2 | 38 |
| आंशिक | 9 | 0 |
| बाकी UI मदें | 27 | 0 |
| अलग भविष्य के प्रश्न | 2 | 2 |

यह implementation की स्थिति है। Render पर इन सभी बदलावों के live होने का दावा नहीं है।

मूल checkout के 31 बदले हुए files की पूरी patch लेकर अलग worktree में काम किया गया। मूल branch, HEAD और patch hash सुरक्षित हैं। इस काम में पुराना code reset/stash नहीं किया गया। Marketing/SEO, staff security और notification routing वाले main के बाद के बदलाव आधार में रखे गए हैं।

मूल PDF काम में स्थायी daily bill numbering, guest history API और offline guest recovery भी हैं; इसलिए पूरा PR केवल CSS बदलाव नहीं है। नया schema migration नहीं है। Daily counter मौजूदा tenant-object storage और revision-checked transaction में जुड़ा है। India business date पर प्रति restaurant 001 से क्रम शुरू होता है, stored number में तारीख रहती है, और पुरानी IDs/records नहीं बदले जाते। Offline bill में provisional reference रहता है; sync पर स्थायी नंबर मिलता है।

## इस समीक्षा में हुए सुधार

- Sidebar, login, QR, receipts, marketing pages और अन्य दृश्य brand labels में **Aatmyam Pos**। पुराने database/local storage identifiers और merchant के configured UPI पते नहीं बदले।
- QR, Switch Outlet, emergency unlock और नए Guest History में साझा native Dialog। नाम वाले close controls, Tab सीमा, Escape, वापस focus और छोटे viewport में scrolling।
- Mobile drawer बंद होने पर inert, खुलने पर focus सीमा और Escape। Active page का `aria-current`; छोटा viewport भी native menu scrolling से सभी links तक पहुँचता है।
- Toast के प्रकार के अनुसार status/alert announcement semantics, लंबे संदेशों का wrapping और header के नीचे अधिकतम पाँच संदेश। असली screen reader announcement सुनकर नहीं जाँचा गया।
- Login/PIN/QR में input-label/error संबंध, 16px input font, संबंधित controls का कम से कम 44px target और बेहतर contrast। Android keyboard का भौतिक test अभी बाकी है; 460px viewport उसकी जगह PASS नहीं माना गया।
- टूटे public demo shortcuts हटे; उपलब्ध वास्तविक cached active stores के लिए Saved stores दिखता है। किसी user store को public demo नहीं बनाया।
- Dashboard में mobile 2×2 और desktop 4-column summary, ₹0.00 और सही empty states। Paid Checkouts, Pending orders और कुल Orders today अलग हैं; औसत bill का आधार paid count है। बिना तुलना के +100%/65% badges नहीं दिखते।
- Historical Dashboard sales में भी Completed और paidAt वाले orders गिने जाते हैं, जिससे unpaid order बिक्री नहीं बनता। यह frontend display calculation है; backend settlement, ledger, pricing या tax नहीं बदला।
- New bill, Inventory, Reports, Settings quick actions सही tab खोलते हैं। Reports पर जाने से AI generation अपने-आप शुरू नहीं होती।
- Estimated Profit स्पष्ट रूप से पुराना 35% cost estimate बताता है। इसे वास्तविक पूर्ण dish costing नहीं कहा गया है।

13 पुराने Step 4 निष्कर्षों का मदवार समाधान [RESOLVED_FINDINGS.csv](RESOLVED_FINDINGS.csv) में है। PDF की दो प्रश्न-सूचियाँ मिलाई नहीं गईं; आगे के प्रश्न [FUTURE_QUESTIONS_HI.md](../pdf-ui-review-2026-11-14/FUTURE_QUESTIONS_HI.md) में अलग हैं।

## सत्यापन और उसकी सीमा

| जाँच | परिणाम |
| --- | --- |
| TypeScript (`npm run lint`) | पास |
| पूरा Vitest suite | 80 files, 624 tests पास |
| Production frontend + marketing prerender + server build | पास |
| Dependency audit, high threshold | पास; 0 high/critical, 2 moderate |
| Component browser acceptance | 34 captures; कोई horizontal page overflow/uncaught error नहीं |
| Dashboard aXe, live/analytics × 360/390/412/1440 | 8 cases, 0 दर्ज violations |
| वास्तविक पूरे local app का PIN login/session | unauthenticated sync 401; login और उसी browser का authenticated sync 200 |
| Signed-in Dashboard/Sidebar | 360×800, 390×844, 412×915; सभी पास |
| Settings Owner inputs | पूरे local app में खुलते हैं |
| PDF flows | Reports language, CRM history/role, inventory, notification tabs, audit, POS/KOT और bill print पास |
| छोटा bill/PDF sample | 58mm/80mm receipt, KOT, historical invoice: प्रत्येक एक पन्ना |

Component fixture में वास्तविक React source, नकली स्थानीय data और mocked APIs हैं। पूरे app के अलग test में वास्तविक Express routes, bcrypt PIN verification और session middleware चला; API responses mock नहीं किए। Throwaway in-memory tenant/Owner बनाया गया, hosted Supabase/payment/email credentials दिए नहीं गए। किसी user account से login, वास्तविक order/payment या message नहीं बनाया गया।

इन screenshots को authenticated Render प्रमाण न मानें। मौजूदा Preview अभी पुराने Part 1 SHA `2cdbfe8608725805bebc276995f27c3866a29e39` पर है। नए commit का deployment और उसके बाद live smoke test अलग रहेगा। असली Android keyboard, screen reader और printer/driver पर जाँच बाकी है। लंबे bills में वास्तविक pagination हो सकती है। Build में मौजूदा large-chunk warning है; compilation पास है।

## Review और release

Feature branch पर PR बनाकर GitHub Actions के lint/test/audit/build checks पास होने पर सामान्य merge करें। Branch protection/review requirements को bypass न करें। इस PR में Render service, branch connection, environment, secrets, Supabase schema और production data बदलने का काम नहीं है।

UI rollback में पुराने business records या daily counters मिटाने की आवश्यकता नहीं है। दैनिक number को पुराने transaction history से अलग करके reset नहीं करना चाहिए।
