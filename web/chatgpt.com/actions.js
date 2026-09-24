{
  const __oxRuntime = window.ox;
  const __oxRuntimeCallServiceAction = __oxRuntime.callServiceAction;
  let __oxLegacyCall;
  try {
(() => {
  const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

  async function chat(args) {
    const message = args && args.message;
    if (typeof message !== "string" || !message.trim()) throw new Error("chat: message is required");

    if (location.origin !== "https://chatgpt.com") throw new Error("chat: unexpected origin");

    const composer = document.querySelector("#mobile-composer-prompt, textarea[aria-label='Chat with ChatGPT'], textarea[placeholder='Ask ChatGPT']");
    if (!composer) throw new Error("chat: guest composer is unavailable; reload ChatGPT or complete any visible verification");

    composer.focus();
    const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value").set;
    setter.call(composer, message);
    composer.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: message }));
    composer.dispatchEvent(new Event("change", { bubbles: true }));
    await sleep(150);

    const form = composer.closest("form");
    const send = (form && form.querySelector("button[aria-label='Send message'], button[type='submit']")) || document.querySelector("button[aria-label='Send message']");
    if (!send || send.disabled) throw new Error("chat: send button is unavailable; ChatGPT may require verification or the guest limit may have been reached");

    const before = [...document.querySelectorAll("main article, main [data-message-author-role='assistant'], main .markdown, main [class*='assistant']")];
    const beforeSet = new Set(before);
    send.click();

    const deadline = Date.now() + 25000;
    let candidate = null;
    let lastText = "";
    let stableSince = 0;

    while (Date.now() < deadline) {
      const stop = document.querySelector("button[aria-label='Stop generating'], button[data-testid='stop-button']");
      const nodes = [...document.querySelectorAll("main article, main [data-message-author-role='assistant'], main .markdown, main [class*='assistant']")]
        .filter(el => !beforeSet.has(el) && el !== form && !form?.contains(el));
      candidate = nodes[nodes.length - 1] || candidate;
      const text = (candidate && candidate.innerText || "").trim();
      if (text && text === lastText) {
        if (!stableSince) stableSince = Date.now();
      } else {
        lastText = text;
        stableSince = Date.now();
      }
      if (text && !stop && Date.now() - stableSince >= 900) return { response: text };

      const pageText = document.body.innerText || "";
      if (/verify you are human|unusual activity|try again later|rate limit/i.test(pageText)) {
        throw new Error("chat: ChatGPT requires human verification or has rate-limited guest access");
      }
      await sleep(200);
    }
    throw new Error("chat: timed out waiting for ChatGPT's response");
  }

  window.ox = {
    async callServiceAction(name, args) {
      if (name === "chat") return chat(args);
      throw new Error(`unknown action: ${name}`);
    }
  };
})();

    if (typeof window.ox?.callServiceAction === "function") {
      __oxLegacyCall = window.ox.callServiceAction.bind(window.ox);
    }
  } finally {
    window.ox = __oxRuntime;
    __oxRuntime.callServiceAction = __oxRuntimeCallServiceAction;
  }
  if (typeof __oxLegacyCall !== "function") throw new Error("legacy service dispatcher is unavailable");
  window.ox.install(({ action }) => {
  action("chat", { async invoke(args) { return __oxLegacyCall("chat", args); } });
  });
}