// FlowBot knowledge base.
// An open, self-hosted set of Q&A entries (app help + general freelancing /
// invoicing knowledge). No external AI service is used — the assistant does a
// lightweight keyword-overlap retrieval over these entries. Content is original
// / common-knowledge and free to use.

export const KNOWLEDGE = [
  {
    keywords: ['what', 'freelanceflow', 'app', 'about', 'purpose'],
    answer:
      'FreelanceFlow is an all-in-one dashboard for freelancers: manage clients and projects, track time with a stopwatch, and turn logged hours into professional PDF invoices — replacing the usual mix of Trello, Excel and Word.',
  },
  {
    keywords: ['add', 'create', 'new', 'client'],
    answer:
      'To add a client: open the Clients page, fill in the name, email, company and default hourly rate, then click "+ Add Client". The hourly rate is used automatically when you log time for that client\'s projects. (Free plan allows up to 2 clients.)',
  },
  {
    keywords: ['add', 'create', 'new', 'project', 'start'],
    answer:
      'To create a project: go to the Projects page, pick the client, enter a project name and budget, and click "+ Add Project". Each project tracks its budget burn as you log hours.',
  },
  {
    keywords: ['task', 'todo', 'to-do', 'add', 'checklist'],
    answer:
      'Tasks live inside a project. Open a project\'s "View Details", then use the Tasks section to add a task with an optional due date, tick it off when done, or delete it. Open tasks with due dates also appear under "Upcoming Deadlines" on the dashboard.',
  },
  {
    keywords: ['timer', 'stopwatch', 'track', 'time', 'start', 'clock'],
    answer:
      'To track time live: go to Time Tracking, choose a project, add a description and press "▶ Start Timer". The timer bar stays visible as you move around the app; you can Pause/Resume, then "⏹ Stop & Save" to log the time. The start time is stored on the server and mirrored to localStorage, so it survives a page refresh.',
  },
  {
    keywords: ['manual', 'log', 'hours', 'yesterday', 'enter', 'time'],
    answer:
      'To log time manually: on the Time Tracking page use the "Manual Entry" form — pick the project, enter the number of hours and the date, add a description, and click "Log Hours". Useful for work you did away from the app.',
  },
  {
    keywords: ['burn', 'rate', 'budget', 'spent', 'what'],
    answer:
      'Burn rate shows how much of a project\'s budget you have consumed. It is logged hours × hourly rate, divided by the budget. On each project card the bar turns red once you pass 90%, warning you that the project is close to over-budget.',
  },
  {
    keywords: ['create', 'make', 'generate', 'invoice', 'bill', 'how'],
    answer:
      'To create an invoice: open Invoices, choose the client and a date range, then "Preview Unbilled Time" to see the hours that haven\'t been billed yet. Review the total and click "Generate Invoice". Pro users can then download it as a PDF.',
  },
  {
    keywords: ['double', 'twice', 'billed', 'again', 'unbilled', 'invoice'],
    answer:
      'Each invoice marks its included time logs as "billed", so those hours are excluded from future invoice previews. That guarantees the same hours can never be billed twice.',
  },
  {
    keywords: ['pdf', 'download', 'export', 'invoice'],
    answer:
      'PDF invoice export is a Pro feature. On the Pro plan, open an invoice and click "Download PDF" to get a clean, professional document generated with PDFKit. Free users can still create and track invoices, just not download the PDF.',
  },
  {
    keywords: ['plan', 'free', 'pro', 'upgrade', 'difference', 'pricing', 'limit'],
    answer:
      'Free plan: up to 2 clients and no PDF export. Pro plan: unlimited clients plus downloadable PDF invoices. Use the "Upgrade" button in the header to switch to Pro (and "Downgrade" to go back).',
  },
  {
    keywords: ['sample', 'demo', 'data', 'load', 'seed', 'test'],
    answer:
      'Click "Load Sample Data" on the dashboard to instantly populate demo clients, projects, tasks, time logs and invoices — handy for seeing the charts and features without entering everything by hand.',
  },
  {
    keywords: ['data', 'private', 'security', 'isolation', 'tenant', 'see', 'other', 'safe'],
    answer:
      'Your data is isolated per account. Every database query is scoped to your user id from your login token, so no other user can ever see or change your clients, projects or invoices.',
  },
  {
    keywords: ['paid', 'sent', 'draft', 'status', 'mark', 'invoice'],
    answer:
      'Invoices move through three statuses: Draft (created, not sent), Sent (delivered to the client, awaiting payment), and Paid (money received). Change the status from the dropdown in the All Invoices table; "Outstanding" totals count everything that is not yet Paid.',
  },
  {
    keywords: ['outstanding', 'owed', 'unpaid', 'receivable', 'mean'],
    answer:
      'An outstanding (or unpaid) invoice is one you have issued but not yet been paid for — its status is Draft or Sent. The dashboard\'s "Outstanding" figure is the sum of all such invoices, i.e. money still owed to you.',
  },
  {
    keywords: ['hourly', 'rate', 'set', 'change', 'price'],
    answer:
      'Set a client\'s default hourly rate on the Clients page. That rate is applied to time you log for the client\'s projects and drives both the budget burn and invoice totals.',
  },
  {
    keywords: ['net', '30', 'terms', 'payment', 'due', 'when'],
    answer:
      'Payment terms like "Net 30" mean the invoice is due 30 days after it is issued (Net 15 = 15 days, and so on). Setting a clear due date and shorter terms generally helps freelancers get paid faster.',
  },
  {
    keywords: ['tips', 'faster', 'get', 'paid', 'advice', 'late'],
    answer:
      'Tips to get paid faster: invoice promptly when work is done, use short payment terms (e.g. Net 15), itemise the hours clearly, set a due date, and send a polite reminder once an invoice is overdue. FlowBot\'s "Outstanding" view helps you spot who still owes you.',
  },
  {
    keywords: ['chart', 'revenue', 'dashboard', 'graph', 'analytics'],
    answer:
      'The dashboard\'s "Revenue vs Outstanding" chart (built with Recharts) plots your paid income against money still owed over recent months, giving you a quick read on cash flow. The stat cards at the top drill into details when clicked.',
  },
  {
    keywords: ['multi', 'tenant', 'multitenancy', 'how', 'work'],
    answer:
      'Multi-tenancy means many users share one app and database while staying fully separated. FreelanceFlow does this by storing a user_id on every record and filtering every query by the logged-in user, so accounts never mix.',
  },
];

const STOPWORDS = new Set([
  'the', 'a', 'an', 'is', 'are', 'do', 'does', 'how', 'to', 'i', 'my', 'me',
  'can', 'you', 'of', 'in', 'on', 'for', 'and', 'what', 'with', 'it', 'this',
  'that', 'about', 'please', 'tell', 'show', 'give', 'get', 'whats', "what's",
]);

function tokenize(text) {
  return String(text)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 1 && !STOPWORDS.has(w));
}

// Return the best-matching knowledge answer, or null if nothing is relevant.
export function searchKnowledge(text) {
  const words = new Set(tokenize(text));
  if (!words.size) return null;

  let best = null;
  let bestScore = 0;
  for (const entry of KNOWLEDGE) {
    let score = 0;
    for (const kw of entry.keywords) {
      if (words.has(kw)) score += 1;
    }
    if (score > bestScore) {
      bestScore = score;
      best = entry;
    }
  }
  // Require at least two overlapping keywords to avoid weak matches.
  return bestScore >= 2 ? best.answer : null;
}
