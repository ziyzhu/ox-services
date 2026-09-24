window.ox.install(({ action }) => {
const log = (...args) => console.log(...args);
  const portal = "https://myutilities.seattle.gov/eportal/";
  function parseStored(key) {
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    try { const parsed = JSON.parse(raw); return parsed && Object.prototype.hasOwnProperty.call(parsed, "_value") ? parsed._value : parsed; }
    catch { throw new Error("Utility portal session data could not be read."); }
  }
  function num(v) {
    if (v == null || v === "") return null;
    const n = Number(String(v).replace(/[$,]/g, ""));
    return Number.isFinite(n) ? n : null;
  }
  function truth(v) {
    if (v == null || v === "") return null;
    return /^(y|yes|true|1|active|enrolled)$/i.test(String(v));
  }
  function mask(v) {
    const s = String(v || "");
    return s.length <= 4 ? s : "••••" + s.slice(-4);
  }
  function mapAccount(a) {
    const id = String(a.accountNumber || "");
    if (!id) throw new Error("The utility portal returned an account without an identifier.");
    return {
      accountId: id,
      maskedAccountNumber: mask(id),
      serviceAddress: a.serviceAddress || null,
      accountBalance: num(a.accountBalance),
      currentAmountDue: num(a.currentAmountDue),
      pastDueAmount: num(a.pastDueAmount),
      totalAmountDue: num(a.totalAmountDue),
      billDate: a.currentBillDate || null,
      dueDate: a.paymentDueDate || null,
      lastPaymentAmount: num(a.lastPaymentAmount),
      lastPaymentDate: a.lastPaymentDate || a.lastPaymentAmountReceivedDate || null,
      autoPayEnabled: truth(a.autoPayInd),
      paperlessBilling: truth(a.paperlessBillInd)
    };
  }
  function accounts() {
    const map = parseStored("PORTAL_ACC_MAP");
    if (!map || typeof map !== "object") throw new Error("Sign in to the utility portal and open Account Overview.");
    return Object.values(map).map(mapAccount);
  }
  action("listAccounts", { async invoke() {
    const items = accounts(); log("listAccounts", { phase: "complete", count: items.length });
    return { accounts: items, nextCursor: null };
  }});
  action("getBill", { async invoke({ accountId }) {
    const item = accounts().find(a => a.accountId === accountId);
    if (!item) throw new Error("That utility account was not found in the signed-in account list.");
    return item;
  }});
  action("preparePayment", { async invoke({ accountId, amount }) {
    if (!accounts().some(a => a.accountId === accountId)) throw new Error("That utility account was not found.");
    const paymentId = "seattle-" + Date.now() + "-" + Math.random().toString(36).slice(2, 10);
    const episode = { paymentId, accountId, amount, createdAt: new Date().toISOString() };
    sessionStorage.setItem("OX_SEATTLE_PAYMENT", JSON.stringify(episode));
    const url = portal + "#/billingoverview";
    return { paymentId, accountId, amount, currency: "USD", url };
  }});
  action("getPaymentUrl", { async invoke({ paymentId, accountId, amount }) {
    const raw = sessionStorage.getItem("OX_SEATTLE_PAYMENT");
    if (!raw) throw new Error("Prepare the payment again before opening checkout.");
    const p = JSON.parse(raw);
    if (p.paymentId !== paymentId || p.accountId !== accountId || Number(p.amount) !== Number(amount)) throw new Error("Prepared payment details do not match.");
    return { url: portal + "#/billingoverview" };
  }});
  action("getPaymentState", { async invoke({ paymentId, accountId, amount }) {
    const raw = sessionStorage.getItem("OX_SEATTLE_PAYMENT");
    if (!raw) return { status: "none", reference: null, total: amount, currency: "USD", completedAt: null };
    const p = JSON.parse(raw);
    const match = p.paymentId === paymentId && p.accountId === accountId && Number(p.amount) === Number(amount);
    return { status: match ? "pending" : "none", reference: null, total: amount, currency: "USD", completedAt: null };
  }});
  action("getSignInUrl", { async invoke() { return { url: portal }; }});
  action("getSignInState", { async invoke() {
    try {
      const response = await fetch("https://myutilities.seattle.gov/rest/account/verify/status", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json", "Accept": "application/json" }, body: "{}" });
      if (response.status === 401 || response.status === 403) return { signedIn: false };
      if (response.status === 200) return { signedIn: true };
      throw new Error("Unexpected sign-in status response: " + response.status);
    } catch (error) { throw new Error("Unable to verify the utility portal session: " + error.message); }
  }});
});
