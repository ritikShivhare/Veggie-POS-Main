# Aatmyam Pos: calculation और UI fixes

यह change 20 नवंबर के inventory/calculation audit में reproduce हुए gaps और 21 नवंबर के चार UI निर्देश संभालता है। पुराने restaurant records को bulk rewrite नहीं करता।

## Billing

- Entry, add-on, checkout में shared decimal half-up arithmetic; monetary amounts दो decimal places में validate होते हैं। ₹53, discount 10% पर taxable ₹47.70, GST ₹2.39, final ₹50.09।
- Thermal receipt में rate और line amount दोनों के पैसे दिखते हैं; columns अलग रहते हैं। पुराने bills में unknown GST rate को rounded amounts से अनुमान लगाकर नहीं छापते। Saved running GST snapshot इस्तेमाल होती है।
- Existing running bill का add-on estimate उसकी GST snapshot से बनता है। Historical frozen trial totals नई rounding से नहीं बदलते।
- Legacy settlement में bill/payment exact paise में match करते हैं। Legacy discount saved unpaid bill/version से validate होता है; prior discounts और redeemed loyalty breakdown सुरक्षित रहते हैं।
- Cash tender/change और refund events transaction में tenant metadata के साथ persist होते हैं। पिछली shift का cash refund वर्तमान drawer से घटता है। Cashier/Owner/Manager Clock In पर opening float लेता है; waiter/chef attendance में cash input नहीं जोड़ता।

## Inventory

- Purchase command ही delivery का stock/WAC update करता है; वही purchase अलग management snapshot से दोबारा नहीं जुड़ती।
- WAC rates 12 decimals तक और stock quantities 9 decimals तक; free supplies तथा zero-valued opening stock denominator में रहते हैं।
- Existing recipe version सुरक्षित है; unitless legacy quantities ingredient की storage unit में खुलती हैं। Incompatible units reject होते हैं और existing ingredient की storage unit locked है।
- Recipe conversion portions से पहले round नहीं होती। Insufficient-stock blocking OFF में full required quantity, actual issue और untracked consumption अलग persist होते हैं। Inventory में shortage दिखती है; physical stock count बदलने पर reconciliation timestamp दर्ज होता है।
- Sale/add-on issue cost snapshots सुरक्षित हैं। Cancellation में Manager ingredient-wise recovered quantity चुनता है; बाकी issued quantity wastage होती है। Recovery original issue cost से stock/WAC में लौटती है। Prepared KOT पर disposition जरूरी है; over-recovery reject होती है।
- Historical issue cost snapshot नहीं होने पर automated restock blocked है; unknown cost गढ़कर stock value नहीं बदली जाती। ऐसे records अलग reconciliation चाहते हैं।

## Reporting और CRM

- Today paid metrics settlement date और India business day से बनते हैं; pending में overnight unpaid bills उपलब्ध रहते हैं।
- Net Sales में GST शामिल नहीं है; collections/average paid bill अपने paid cohort से बनते हैं। AI report के top dishes भी उसी day के हैं। Average में paise सुरक्षित हैं।
- Negative estimated profit छिपता नहीं; loss red magnitude/sign के साथ दिखता है। Guest minimum/maximum paid bill payment/refund पर refresh होते हैं।
- पुराने disabled daily-report method में भी unpaid/history filtering सुधरी है; उसका disabled status बरकरार है।

## 21 नवंबर के UI निर्देश

1. Thermal bill से Pure Vegetarian tagline हटी; restaurant का अपना नाम रहता है।
2. KDS Test Sound button हटा; configured automatic KDS sound बरकरार है।
3. Low-stock scan और stock updates एक durable, tenant-scoped four-hour notification cooldown मानते हैं। Existing legacy alerts से cooldown शुरू होता है। Settings → Notifications → Low stock → Reorder का Enabled switch alerts बंद करता है। पुराने notification records delete नहीं किए गए।
4. Settled में सिर्फ India business day के आज settled bills; All में आज के bills और carry-forward unpaid bills। पुराने settled bills Dashboard/CRM history से उपलब्ध हैं। Badges और lists एक ही filter इस्तेमाल करते हैं।

## Validation

- `tests/calculationRegression.test.ts`: independent integer-paise reference से 100,000 GST price boundaries, preset discounts, memory और migrated local PostgreSQL पर actual financial routes/services।
- `tests/calculationUiRegression.test.tsx`: actual hooks/screens, purchase का single command, recipe legacy units/version, stock warning, Manager recovery, receipt precision, report cohorts, opening float और नए UI controls/filters।
- `tests/operationalNotifications.test.ts`: 239 one-minute scans में duplicate नहीं; चार घंटे पर reminder; restart/concurrent calls, disabled setting और existing legacy alert cooldown।
- पूर्ण Vitest suite, TypeScript और production build release gate हैं। Deployed SHA, CI और browser evidence अलग release report में दर्ज किए जाते हैं।

## Data compatibility और सीमाएँ

कोई नया SQL schema या database migration नहीं है। Cost issues, shortage history, cash tenders और refunds मौजूदा revision-checked `tenant_objects` transaction में हैं और Owner privacy export में शामिल हैं। पुराने original checkout/worktree के बदलाव सुरक्षित हैं।

Actual operating profit के बजाय पहले से मौजूद 35% estimated-cost policy बरकरार है; paid-value/loyalty earning policy अपने-आप नहीं बदली गई। Data repair और बाकी policy प्रश्न अलग `FUTURE_QUESTIONS_HI.txt` में हैं।
