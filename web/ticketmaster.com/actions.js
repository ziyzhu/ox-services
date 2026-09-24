window.ox.install(({ action }) => {
const log = (...args) => console.log(...args);
  const cleanText = value => String(value ?? "").replace(/\s+/g, " ").trim();

  function text(value) {
    if (value == null) return null;
    const cleaned = cleanText(String(value));
    return cleaned || null;
  }

  function readSearchData(query, page) {
    const node = document.getElementById("__NEXT_DATA__");
    if (!node || !node.textContent) {
      const body = (document.body && document.body.innerText || "").toLowerCase();
      if (/verify|unusual activity|not a robot|access denied/.test(body)) {
        throw new Error("Ticketmaster requires human verification in Browser.");
      }
      throw new Error("Ticketmaster search data is unavailable on this page.");
    }

    let root;
    try {
      root = JSON.parse(node.textContent);
    } catch {
      throw new Error("Ticketmaster returned malformed search data.");
    }

    const queries = root?.props?.pageProps?.initialReduxState?.api?.queries;
    if (!queries || typeof queries !== "object") {
      throw new Error("Ticketmaster search state was not found.");
    }

    const entries = Object.entries(queries).filter(([key, value]) =>
      key.startsWith("searchEvents(") && value?.status === "fulfilled" && Array.isArray(value?.data?.events)
    );
    const exact = entries.find(([key]) => {
      try {
        const args = JSON.parse(key.slice("searchEvents(".length, -1));
        return String(args.keyword || "").toLowerCase() === query.toLowerCase() && Number(args.page || 0) === page;
      } catch {
        return false;
      }
    });
    const selected = exact || entries[0];
    if (!selected) throw new Error("Ticketmaster returned no usable event search response.");
    return selected[1].data;
  }

  action("searchTickets", {
    async invoke(args) {
      const query = cleanText(args.query || "");
      if (!query) throw new Error("query is required.");
      const page = args.cursor == null ? 0 : Number(args.cursor);
      const limit = args.limit == null ? 20 : Number(args.limit);
      if (!Number.isInteger(page) || page < 0) throw new Error("cursor must be a non-negative page number.");
      if (!Number.isInteger(limit) || limit < 1 || limit > 20) throw new Error("limit must be between 1 and 20.");

      const expected = "/search?q=" + encodeURIComponent(query);
      if (location.pathname !== "/search" || new URLSearchParams(location.search).get("q") !== query || page > 0) {
        const target = "https://www.ticketmaster.com/search?q=" + encodeURIComponent(query) + (page ? "&page=" + page : "");
        if (location.href !== target) {
          location.assign(target);
          throw new Error("Ticketmaster search page is loading; retry this action.");
        }
      }

      const data = readSearchData(query, page);
      const source = data.events.slice(0, limit);
      const items = source.map((event) => ({
        id: String(event.id || event.discoveryId || ""),
        title: text(event.title) || "Untitled event",
        startDate: text(event.dates?.startDate),
        timeZone: text(event.timeZone),
        url: String(event.url || ""),
        venue: event.venue ? {
          name: text(event.venue.name),
          city: text(event.venue.city),
          state: text(event.venue.state),
          country: text(event.venue.countryName || event.venue.countryCode || event.venue.country)
        } : null,
        category: text(typeof event.majorCategory === "string" ? event.majorCategory : event.majorCategory?.name),
        artists: Array.isArray(event.artists) ? event.artists.map(a => text(a?.name)).filter(Boolean) : [],
        soldOut: Boolean(event.soldOut),
        limitedAvailability: Boolean(event.limitedAvailability),
        cancelled: Boolean(event.cancelled),
        postponed: Boolean(event.postponed),
        rescheduled: Boolean(event.rescheduled)
      })).filter(item => item.id && item.url);

      const total = Number.isFinite(Number(data.total)) ? Number(data.total) : items.length;
      const hasMore = (page + 1) * 20 < total && data.events.length > 0;
      log("searchTickets complete", { page, resultCount: items.length, total });
      return { items, total, nextCursor: hasMore ? String(page + 1) : null };
    }
  });
});
