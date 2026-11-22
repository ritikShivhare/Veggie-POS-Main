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
    summary: "Work out the ingredient cost of one dish, use the same measurements throughout and compare expected ingredient use with the stock you count.",
    category: "inventory", label: "Recipe costing guide", updatedAt: "2026-11-12",
    takeaway: "Use consistent units and real purchase prices; a recipe cost is an estimate until you compare it with actual stock use.",
    sections: [
      {
        title: "What does recipe food cost measure?",
        paragraphs: [
          "Recipe food cost is the cost of the ingredient quantities used for one serving. Divide that cost by the selling price, then multiply by 100 to express it as a percentage. Be consistent about whether GST is included when comparing ingredient costs and selling prices.",
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
          "On plans with inventory features, use your recipes, purchase entries and counted stock to compare expected ingredient use with actual use. Check measurements and recipe changes, and keep the original purchase records. The comparison depends on the information you enter.",
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
    takeaway: "Show the QR, check that the money has arrived, then mark the bill paid. Each step matters.",
    sections: [
      {
        title: "Start with an order the kitchen can understand",
        paragraphs: [
          "Agree where staff should enter dine-in, takeaway orders. Select the correct menu items and quantities, review the total, and include relevant preparation notes. A customer name or table reference can help staff find the right order later.",
          "After sending an order, check that the kitchen can see its ticket. If the screen shows an error or the order is missing, ask the Owner to check it before entering it again. This helps avoid duplicate orders.",
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
          "Add the restaurant’s UPI ID to show a QR with the bill amount. The guest pays using their UPI app. Before marking the bill paid, check that the payment reached the restaurant; showing or scanning the QR alone is not enough.",
          "Staff should check the restaurant's accepted bank or payment-app record, then record the payment in the POS. For cash, check the amount received and change due. Keep a clear process for a pending, failed or disputed transfer rather than marking it paid from a screenshot alone.",
        ],
      },
      {
        title: "Close the loop with a confirmed record",
        paragraphs: [
          "After recording a payment, check the application's confirmation and receipt details. Keep the order reference available if a customer later asks about a correction. Reconcile the POS totals against the cash and external payment records according to your outlet's process.",
          "Paying for an Aatmyam Pos plan is separate from collecting a guest’s bill. Your plan changes after the subscription payment is confirmed. Staff still need to check each guest’s UPI payment before marking that bill paid.",
        ],
      },
    ],
    related: ["/resources/kot-vs-kds", "/resources/restaurant-staff-access-checklist"],
  },
  {
    path: "/resources/restaurant-staff-access-checklist",
    title: "Staff access and end-of-day checks for a small restaurant",
    summary: "Give staff the access they need, check who can approve changes and compare the day’s recorded payments with cash and UPI receipts.",
    category: "operations", label: "Staff access checklist", updatedAt: "2026-11-12",
    takeaway: "Give each staff member appropriate access and investigate discrepancies using records rather than treating an alert as proof of wrongdoing.",
    sections: [
      {
        title: "Make access individual and understandable",
        paragraphs: [
          "Shared sign-ins make it harder to understand who performed an action. Give staff their own access, explain their responsibilities and protect owner credentials. An employee should know which screen to use for an order, a kitchen update or a request for help.",
          "Give each staff member their own PIN and check which screens and actions they can use. During setup, make sure each person can do the work assigned to them.",
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
          "Keep staff PINs out of screenshots, training notes and shared messages. If a PIN or sign-in detail is shared by mistake, change it and check that the right person can sign in again.",
        ],
      },
      {
        title: "Compare the day's records with money actually received",
        paragraphs: [
          "Choose a consistent cutoff time. Compare recorded cash payments with the counted cash, allowing for the opening float and documented movements. Compare UPI entries with the restaurant's own bank or payment-app records. Keep unsettled or disputed items identifiable rather than forcing them into a balanced total.",
          "A difference may come from a late payment, a mistaken entry, work that has not finished saving or a missed step. Keep the order number and check what happened. Compare recorded payments with the money actually received before drawing a conclusion.",
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
    summary: "Check that the plan covers your staff and orders. Ask for prices for the devices, printing, training and other costs your restaurant will need.",
    category: "technology", label: "POS buying guide", updatedAt: "2026-11-12",
    takeaway: "Compare the whole setup and its limits; a software price alone does not establish total cost or hardware compatibility.",
    sections: [
      {
        title: "Start with one outlet's requirements",
        paragraphs: [
          "Count expected order records across a complete billing cycle and list the staff who need active access. Include busy weekends and seasonal peaks. Decide whether you need recipe-linked inventory, a kitchen screen or only basic billing and sales records.",
          "Each Aatmyam Pos plan covers one outlet for 30 days. The prices below are for that 30-day period. Ask for separate quotes for any devices, setup or other costs your restaurant needs.",
        ],
      },
      {
        title: "Check the order allowance before comparing prices",
        paragraphs: [
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
        title: "Compare costs over the same period",
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
    summary: "Prepare your menu, recipes, staff access and devices, then practise an order from start to payment. Also check what to do if the internet drops or an order does not appear.",
    category: "single-outlet", label: "Outlet setup checklist", updatedAt: "2026-11-12",
    takeaway: "Practise both a normal order and what to do when something goes wrong.",
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
          "On a device already set up and signed in, some order-taking tasks can continue during a short internet outage. Signing in, managing your account and activating a paid plan need internet. Before your first service, practise a brief connection loss, reconnect and check that the latest orders and payments have been saved.",
        ],
      },
      {
        title: "Agree how the team will recover",
        paragraphs: [
          "Agree who checks a missing order, what the team will write down if the internet drops and when to call the Owner. Do not clear saved information, reset the device or enter an uncertain order again until the latest work has been checked.",
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
          "Try the kitchen screen with your own menu and check how staff mark orders as preparing, ready and served. Orders from delivery apps do not arrive automatically in Aatmyam Pos. If you use several kitchen stations, ask us to show exactly how the team will pass tickets between them.",
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
          "If you have several kitchen stations, check how orders will reach each team before service. Each Aatmyam Pos restaurant account covers one outlet; it does not manage kitchens across several locations.",
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
