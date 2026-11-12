import { PLAN_LIMITS } from "./planCatalog";

export const GUIDE_PATHS = [
  "/resources/restaurant-food-cost-calculation",
  "/resources/restaurant-order-payment-workflow",
  "/resources/restaurant-staff-access-checklist",
  "/resources/restaurant-pos-cost-guide",
  "/resources/single-outlet-setup-checklist",
  "/resources/kot-vs-kds",
] as const;

export type GuidePath = typeof GUIDE_PATHS[number];
export interface GuideSection {
  title: string;
  paragraphs: readonly string[];
  steps?: readonly string[];
  table?: { headings: readonly string[]; rows: readonly (readonly string[])[] };
}
export interface MarketingGuide {
  path: GuidePath;
  title: string;
  summary: string;
  category: "inventory" | "operations" | "technology" | "single-outlet";
  label: string;
  updatedAt: string;
  takeaway: string;
  sections: readonly GuideSection[];
  related: readonly GuidePath[];
}

export const MARKETING_GUIDES: readonly MarketingGuide[] = [
  {
    path: "/resources/restaurant-food-cost-calculation",
    title: "Restaurant food cost: a recipe calculation you can check",
    summary: "Calculate a dish's ingredient cost, convert purchase units into recipe units, and compare theoretical consumption with a physical stock count.",
    category: "inventory", label: "Recipe costing guide", updatedAt: "2026-11-12",
    takeaway: "Use consistent units and real purchase prices; a recipe cost is an estimate until you compare it with actual stock use.",
    sections: [
      {
        title: "What does recipe food cost measure?",
        paragraphs: [
          "Recipe food cost is the cost of the ingredient quantities used for one serving. Divide that cost by the selling price, then multiply by 100 to express it as a percentage. Keep the selling-price and ingredient-cost tax basis consistent.",
          "This is different from a restaurant's total monthly food cost. A recipe estimate does not include every stock adjustment, unsold portion or complimentary meal. It also does not establish net profit: rent, wages, utilities, packaging and payment charges may need separate treatment.",
        ],
      },
      {
        title: "A café example with explicitly illustrative prices",
        paragraphs: [
          "The following inputs are invented for this calculation, not supplier quotes or a recommended coffee recipe. Replace them with your invoice prices and measured serving quantities. The example treats all figures on the same tax basis and includes a takeaway cup.",
        ],
        table: {
          headings: ["Item", "Assumed purchase cost", "Quantity per serving", "Serving cost"],
          rows: [
            ["Milk", "₹60 per litre", "180 ml", "₹10.80"],
            ["Coffee beans", "₹800 per kg", "18 g", "₹14.40"],
            ["Sugar", "₹50 per kg", "8 g", "₹0.40"],
            ["Cup", "₹3 each", "1", "₹3.00"],
            ["Total", "Illustrative inputs", "1 serving", "₹28.60"],
          ],
        },
      },
      {
        title: "Calculate the cost before drawing a conclusion",
        paragraphs: [
          "For milk, ₹60 ÷ 1,000 ml × 180 ml = ₹10.80. For beans, ₹800 ÷ 1,000 g × 18 g = ₹14.40. Add every serving cost to obtain ₹28.60. At an assumed selling price of ₹120 on the same tax basis, the ingredient-and-cup percentage is ₹28.60 ÷ ₹120 × 100 = approximately 23.8%.",
          "That percentage is not a guaranteed margin. Record waste and actual yields separately. A purchased kilogram may not yield a kilogram of usable prepared ingredient. Measure trim, evaporation or rejected portions before deciding which purchase quantity supports your recipe.",
        ],
        steps: [
          "Choose one dish and write down a measured serving recipe.",
          "Convert every purchase unit into the recipe unit before multiplying.",
          "Use a dated purchase cost and include the items your costing policy covers.",
          "Check whether tax and packaging are included on both sides of the calculation.",
        ],
      },
      {
        title: "Compare recipes with actual restaurant records",
        paragraphs: [
          "For a stock item, opening quantity plus purchases minus closing quantity gives a starting estimate of consumption. Then account for transfers, waste and other adjustments. Compare that result with servings sold multiplied by the recipe quantity. A difference is a reason to investigate, not proof that a staff member caused a loss.",
          "Aatmyam supports recipe-linked ingredient records and stock workflows on plans with advanced inventory. The quality of the report depends on your recipes, purchase entries and stock counts. Review units and recipe changes before relying on a comparison, and keep the original purchase records available.",
        ],
      },
    ],
    related: ["/resources/single-outlet-setup-checklist", "/resources/restaurant-pos-cost-guide"],
  },
  {
    path: "/resources/restaurant-order-payment-workflow",
    title: "A clear order-to-payment workflow for one restaurant",
    summary: "Separate order entry, kitchen progress, checking the customer's payment and saving the payment record so staff know what each screen confirms.",
    category: "operations", label: "Counter workflow", updatedAt: "2026-11-12",
    takeaway: "A generated UPI QR, a customer's bank transfer and a saved POS payment record are three different events.",
    sections: [
      {
        title: "Start with an order the kitchen can understand",
        paragraphs: [
          "Agree where staff should enter dine-in, takeaway and delivery orders. Select the correct menu items and quantities, review the total, and include relevant preparation notes. A customer name or table reference can help staff find the right order later.",
          "After submitting, check that the order was accepted. An editable basket is not a saved kitchen ticket. If the device reports a save error or an unconfirmed operation, resolve that state before entering the same order again. Repeating an uncertain action without checking can create duplicate work.",
        ],
      },
      {
        title: "Keep preparation status separate from settlement",
        paragraphs: [
          "Kitchen preparation and payment answer different questions. Staff may need to see an order as preparing or ready before the customer settles the bill. Decide which staff member owns each update and how the front counter learns that an item is ready.",
          "Aatmyam's kitchen view supports incoming orders and preparation-status updates. Confirm the exact statuses and handoff your outlet will use during a walkthrough. Do not assume a kitchen status alone proves that money has been received.",
        ],
        steps: [
          "Review item quantities and the intended table or order reference.",
          "Confirm the kitchen can see the accepted order.",
          "Update preparation status as the team works.",
          "Find the same order for settlement rather than starting an unrelated bill.",
        ],
      },
      {
        title: "Understand what the UPI QR does",
        paragraphs: [
          "With a configured restaurant UPI ID, Aatmyam can generate a QR containing the payee and current bill amount. The customer's UPI app handles the transfer. Displaying or scanning that QR is not an automatic confirmation that the restaurant received the payment.",
          "Staff should check the restaurant's accepted bank or payment-app record, then record the payment in the POS. For cash, check the amount received and change due. Keep a clear process for a pending, failed or disputed transfer rather than marking it paid from a screenshot alone.",
        ],
      },
      {
        title: "Close the loop with a confirmed record",
        paragraphs: [
          "After recording a payment, check the application's confirmation and receipt details. Keep the order reference available if a customer later asks about a correction. Reconcile the POS totals against the cash and external payment records according to your outlet's process.",
          "Aatmyam software-subscription payments are separate: configured Cashfree checkout is reconciled by the backend before plan access changes. That subscription verification does not turn customer UPI QR payments into an automatic bank-reconciliation service.",
        ],
      },
    ],
    related: ["/resources/kot-vs-kds", "/resources/restaurant-staff-access-checklist"],
  },
  {
    path: "/resources/restaurant-staff-access-checklist",
    title: "Staff access and end-of-day checks for a small restaurant",
    summary: "Assign individual staff access, review sensitive permissions and reconcile recorded activity with actual cash and payment records.",
    category: "operations", label: "Staff access checklist", updatedAt: "2026-11-12",
    takeaway: "Give each staff member appropriate access and investigate discrepancies using records rather than treating an alert as proof of wrongdoing.",
    sections: [
      {
        title: "Make access individual and understandable",
        paragraphs: [
          "Shared sign-ins make it harder to understand who performed an action. Give staff their own access, explain their responsibilities and protect owner credentials. An employee should know which screen to use for an order, a kitchen update or a request for help.",
          "Aatmyam provides role-based access and staff PIN settings. Confirm the actual permissions for each role during setup. A label such as cashier or manager is not a substitute for checking which operations that account can perform.",
        ],
        steps: [
          "Create individual access for the people who need the system.",
          "Review billing, inventory and reporting permissions against each person's job.",
          "Keep owner access separate from routine counter work.",
          "Remove or deactivate access when responsibilities change or staff leave.",
        ],
      },
      {
        title: "Practise sensitive actions before service",
        paragraphs: [
          "Use clearly marked test data to practise a normal sale, a correction and a rejected action. Check that staff can complete the tasks they need and cannot perform the tasks reserved for an owner. Review the outcome on the other relevant device rather than assuming a click was saved.",
          "Do not record real staff PINs in screenshots, training documents or shared messages. If a credential is exposed, use the supported credential-change process and verify that the affected person can sign in again.",
        ],
      },
      {
        title: "Compare the day's records with money actually received",
        paragraphs: [
          "Choose a consistent cutoff time. Compare recorded cash payments with the counted cash, allowing for the opening float and documented movements. Compare UPI entries with the restaurant's own bank or payment-app records. Keep unsettled or disputed items identifiable rather than forcing them into a balanced total.",
          "A discrepancy can come from a timing difference, an entry mistake, an incomplete sync or a process problem. Preserve the order reference and investigate before drawing a conclusion. A sales report is useful evidence, but it is not a guarantee that every external payment has been reconciled.",
        ],
      },
      {
        title: "Review the process with the team",
        paragraphs: [
          "Write down who can approve corrections and who reviews the final figures. Repeat the checks when you add a device or change staff responsibilities. Use exported records where appropriate and follow your business's retention requirements.",
          "This checklist describes an operating process, not a promise of automatic fraud detection, connected cash-drawer hardware or a certified audit. Ask to see the current permission and reporting workflows for your outlet before choosing a plan.",
        ],
      },
    ],
    related: ["/resources/restaurant-order-payment-workflow", "/resources/single-outlet-setup-checklist"],
  },
  {
    path: "/resources/restaurant-pos-cost-guide",
    title: "Restaurant POS cost and hardware checklist for India",
    summary: "Compare the published software allowance with your order volume, then budget for devices, printing, setup and any external charges using actual quotes.",
    category: "technology", label: "POS buying guide", updatedAt: "2026-11-12",
    takeaway: "Compare the whole setup and its limits; a software price alone does not establish total cost or hardware compatibility.",
    sections: [
      {
        title: "Start with one outlet's requirements",
        paragraphs: [
          "Count expected order records across a complete billing cycle and list the staff who need active access. Include busy weekends and seasonal peaks. Decide whether you need recipe-linked inventory, a kitchen screen or only basic billing and sales records.",
          "Aatmyam currently offers single-outlet plans on a 30-day cycle. The plan comparison below comes from the same catalog used by the app. It is not an annual subscription quote, and additional setup or third-party costs should be confirmed for your specific arrangement.",
        ],
      },
      {
        title: "Check the order allowance before comparing prices",
        paragraphs: [
          `Pro's ${PLAN_LIMITS.pro.monthlyOrders} orders per 30-day cycle average about ${(PLAN_LIMITS.pro.monthlyOrders / 30).toFixed(1)} orders per day, but there is no daily quota implied by that average. Twenty orders every day for 30 days total 600. Compare that example with the plan's cycle allowance. The application's usage counts order records in the subscription period; do not assume the limit means only paid receipts.`,
          "Check Billing for current usage, staff allowance and cycle dates. At an order limit, new order creation can be blocked. Plan for the allowance your outlet needs before a busy service rather than treating an upgrade as something to discover at the counter.",
        ],
      },
      {
        title: "Get real quotes for the complete setup",
        paragraphs: [
          "Using an existing phone, tablet or computer may avoid buying another terminal, but it does not establish compatibility with every printer or cash drawer. Record the operating system, browser, printer model and connection type. Ask for a test using the exact combination you intend to install.",
          "The following checklist has no assumed competitor prices and no promised savings. Fill it with supplier quotes and your actual requirements. Keep one-time costs separate from recurring charges.",
        ],
        table: {
          headings: ["Cost or requirement", "What to confirm"],
          rows: [
            ["Software", "Plan price, order/staff allowances and 30-day cycle"],
            ["Counter and kitchen devices", "Existing device suitability or a supplier quote"],
            ["Receipt/KOT printing", "Exact printer, paper width, connection and required setup"],
            ["Connectivity", "Reliable network and tested reconnect procedure"],
            ["Setup and training", "Who enters the menu, recipes and staff; any charges"],
            ["Payments and support", "External payment charges, support availability and any agreed fees"],
          ],
        },
      },
      {
        title: "Keep the comparison fair and reproducible",
        paragraphs: [
          "A simple comparison is setup costs plus software cycles plus maintenance and other recurring charges over the same period. State the dates and assumptions, including tax treatment. Twelve 30-day software cycles cover 360 days; do not silently present that as a calendar-year contract.",
          "Before paying, review current trial eligibility, refund terms, data export and plan-change behavior. Aatmyam is in early access, so use a walkthrough to check the current product against your own menu and device setup. This guide does not claim that one POS type always costs less than another.",
        ],
      },
    ],
    related: ["/resources/single-outlet-setup-checklist", "/resources/restaurant-food-cost-calculation"],
  },
  {
    path: "/resources/single-outlet-setup-checklist",
    title: "A practical setup checklist for one restaurant outlet",
    summary: "Prepare menu, recipes, staff, payments and devices, then rehearse a complete order and recovery workflow before moving a service onto a new POS.",
    category: "single-outlet", label: "Outlet setup checklist", updatedAt: "2026-11-12",
    takeaway: "A successful setup includes a rehearsed recovery process as well as a successful normal order.",
    sections: [
      {
        title: "Prepare the records you will actually use",
        paragraphs: [
          "Start with a clean menu: item names, prices, categories and availability. Agree how staff will identify tables or order references. If you use ingredient tracking, list purchase units, stock units, opening quantities and measured recipes before relying on automatic deductions.",
          "Use your actual operating data when configuring a real outlet, but keep sample transactions clearly distinguishable during training. Do not import old customer or staff information that the outlet does not need or is not authorized to use.",
        ],
        steps: [
          "Review menu prices and the business's applicable tax settings.",
          "Check ingredient units and recipe quantities using a worked example.",
          "Assign individual staff access and review permissions.",
          "Confirm the selected plan's order and active-staff allowances.",
        ],
      },
      {
        title: "Check devices and payment requirements",
        paragraphs: [
          "List each device's job: counter entry, kitchen updates or owner review. Check its browser and network access. If printing is needed, test the exact receipt or KOT layout on the chosen printer and paper width; an on-screen receipt preview is not proof that a physical printer works.",
          "Configure the restaurant's own UPI ID before showing customers a payment QR. Check the payee details and amount using the intended setup. Agree who checks actual receipt of funds before a payment is recorded in the POS.",
        ],
      },
      {
        title: "Rehearse the complete service loop",
        paragraphs: [
          "Take an order, check that it appears in the kitchen, update its preparation status, record a checked payment and review the resulting records. Repeat a correction and an action that the current staff member is not permitted to perform. Review the same order reference from the relevant devices.",
          "Aatmyam has browser caching and queued synchronization workflows, but availability depends on the action, device and prior setup. First sign-in, account operations and payment-provider verification need connectivity. Test a brief network interruption in a controlled rehearsal, then reconnect and verify the final saved state.",
        ],
      },
      {
        title: "Agree how the team will recover",
        paragraphs: [
          "Identify who checks an unconfirmed save, which records should be kept during an outage and when the owner is contacted. Do not clear browser data, reset a terminal or repeatedly re-enter uncertain orders without checking pending work.",
          "Before the first live shift, agree the end-of-day review and export procedure. Early-access onboarding should establish what is available now, what still needs configuration and what the outlet should not rely on yet. A walkthrough is a chance to check those boundaries rather than assume a guaranteed setup time.",
        ],
      },
    ],
    related: ["/resources/restaurant-order-payment-workflow", "/resources/restaurant-staff-access-checklist"],
  },
  {
    path: "/resources/kot-vs-kds",
    title: "KOT and KDS: how a small kitchen can organize order handoffs",
    summary: "Understand a kitchen order ticket and a kitchen display, then decide which handoff and preparation-status process fits your outlet.",
    category: "operations", label: "Kitchen workflow guide", updatedAt: "2026-11-12",
    takeaway: "A ticket communicates what to prepare; a display and a clear staff process help communicate preparation progress.",
    sections: [
      {
        title: "What is the difference between KOT and KDS?",
        paragraphs: [
          "A kitchen order ticket (KOT) is the information sent to the kitchen about an order: items, quantities, relevant notes and a reference. It can be presented on paper or digitally. A kitchen display system (KDS) is a screen-based view used to review orders and, where supported, update preparation progress.",
          "The two terms describe different parts of a process. Buying a screen does not by itself decide who acknowledges an order or tells the counter it is ready. Start with the actual handoff between your front-of-house and kitchen staff.",
        ],
      },
      {
        title: "Choose a workflow the team can practise",
        paragraphs: [
          "Write down how an order enters the kitchen, who checks its details, which preparation states are used and who marks it ready. Decide how an item change or cancellation is communicated before asking staff to change their routine.",
          "Aatmyam's kitchen view lets staff review incoming orders and update preparation status. Demonstrate that current workflow with your own menu. Do not assume it includes every form of automatic station routing, aggregator integration or production scheduling simply because a sample screen resembles one.",
        ],
        steps: [
          "Enter a clearly labeled practice order and find the same reference in the kitchen.",
          "Check quantities and preparation notes before work begins.",
          "Update the supported preparation states and confirm the counter can see the change.",
          "Rehearse a correction and the process for an uncertain or disconnected device.",
        ],
      },
      {
        title: "Evaluate paper and screen requirements separately",
        paragraphs: [
          "For paper tickets, check the physical printer, connection, paper width and reprint procedure. For a display, check screen readability, placement, power and how staff will operate it during service. A device that works at an office desk may not suit a hot or crowded preparation area.",
          "If the outlet needs multiple kitchen stations, confirm the exact supported behavior with the product and configuration in front of you. Aatmyam's current marketing scope is a single restaurant outlet; it is not a promise of multi-location kitchen coordination.",
        ],
      },
      {
        title: "Review real outcomes after a small trial",
        paragraphs: [
          "Observe a manageable service period and note missed handoffs, incorrect quantities and staff questions. Use the same definitions before and after a change. Only claim a speed or accuracy improvement if the outlet has collected comparable evidence.",
          "A digital kitchen workflow can make status information easier to review, but it does not guarantee a percentage improvement or remove the need for staff communication. Choose the arrangement your team can operate and recover when something needs attention.",
        ],
      },
    ],
    related: ["/resources/restaurant-order-payment-workflow", "/resources/single-outlet-setup-checklist"],
  },
];

export function guideReadTime(guide: MarketingGuide) {
  const text = [guide.title, guide.summary, guide.takeaway, ...guide.sections.flatMap(section =>
    [section.title, ...section.paragraphs, ...(section.steps || []), ...(section.table?.rows.flat() || [])]
  )].join(" ");
  return `About ${Math.max(1, Math.ceil(text.split(/\s+/).length / 200))} min read`;
}
