const retryFetch = async (input, init, options) => {
    const retries = options?.retries ?? 3;
    const delay = options?.delay ?? 400;
    const factor = options?.factor ?? 2;
    for (let attempt = 0; ; attempt++) {
        try {
            const response = await window.fetch(input, init);
            const retryable = response.status === 408 || response.status === 429 || (response.status >= 500 && response.status <= 599);
            if (response.ok || !retryable || attempt >= retries)
                return response;
        }
        catch (error) {
            const message = String(error?.message ?? "");
            const retryable = message.includes("Load failed") || message.includes("NetworkError") || message.includes("Failed to fetch");
            if (!retryable || attempt >= retries)
                throw error;
        }
        await new Promise(resolve => setTimeout(resolve, delay * Math.pow(factor, attempt)));
    }
};
window.ox.install(({ action }) => {
    const API = "https://qao9lxc60h.execute-api.us-west-2.amazonaws.com/prod";
    const getJson = async (path) => {
        const res = await retryFetch(`${API}${path}`);
        if (!res.ok)
            throw new Error(`HTTP ${res.status}`);
        return res.json();
    };
    const localIso = (epochMs, timeZone) => {
        try {
            return new Intl.DateTimeFormat("sv-SE", {
                timeZone,
                year: "numeric",
                month: "2-digit",
                day: "2-digit",
                hour: "2-digit",
                minute: "2-digit",
                hour12: false,
            }).format(new Date(epochMs)).replace(" ", "T");
        }
        catch {
            return new Date(epochMs).toISOString();
        }
    };
    const summarize = (p) => ({
        id: p.placeId,
        name: p.displayName,
        provider: p.provider?.name ?? null,
        tags: p.tags ?? [],
        coordinate: p.coordinate ?? null,
        timezone: p.timezone ?? null,
        courtCount: p.provider?.resources?.length ?? 0,
        url: `https://matchatennis.com/places/${p.placeId}`,
    });
    const mapCourt = (r, timeZone) => ({
        mrn: r.mrn,
        name: r.name,
        tags: r.tags ?? [],
        slots: (r.slots ?? []).map((s) => ({
            start: localIso(s.start, timeZone),
            durationMinutes: Math.round(s.duration / 60000),
            state: s.state ?? null,
        })),
    });
    const mapPlace = (p) => ({
        ...summarize(p),
        courts: (p.provider?.resources ?? []).map((r) => mapCourt(r, p.timezone)),
    });
    action("listPlaces", {
        async invoke({ cursor }) {
            const path = cursor ? `/places?cursor=${encodeURIComponent(cursor)}` : "/places";
            const page = await getJson(path);
            return {
                items: (page.data ?? []).map(summarize),
                nextCursor: page.cursor ?? null,
            };
        },
    });
    action("getPlace", {
        async invoke({ id }) {
            return mapPlace(await getJson(`/places/${encodeURIComponent(id)}`));
        },
    });
});
