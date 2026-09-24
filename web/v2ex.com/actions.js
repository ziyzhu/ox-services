{
  const __oxRuntime = window.ox;
  const __oxRuntimeCallServiceAction = __oxRuntime.callServiceAction;
  let __oxLegacyCall;
  try {
(() => {
  const ORIGIN = "https://v2ex.com";

  const normalizeTopic = (t) => ({
    id: t.id,
    title: t.title,
    content: t.content,
    content_rendered: t.content_rendered,
    url: t.url,
    created: t.created,
    last_touched: t.last_touched,
    last_reply_by: t.last_reply_by ?? "",
    replies: t.replies ?? 0,
    node: t.node ? {
      id: t.node.id,
      name: t.node.name,
      title: t.node.title,
      title_alternative: t.node.title_alternative ?? "",
      url: t.node.url,
      topics: t.node.topics ?? 0,
      header: t.node.header ?? "",
      footer: t.node.footer ?? ""
    } : null,
    member: t.member ? {
      id: t.member.id,
      username: t.member.username,
      url: t.member.url,
      website: t.member.website ?? "",
      location: t.member.location ?? "",
      tagline: t.member.tagline ?? "",
      bio: t.member.bio ?? "",
      created: t.member.created,
      twitter: t.member.twitter ?? null,
      github: t.member.github ?? null
    } : null
  });

  const normalizeReply = (r) => ({
    id: r.id,
    content: r.content,
    content_rendered: r.content_rendered,
    created: r.created,
    topic_id: r.topic_id,
    member: r.member ? {
      id: r.member.id,
      username: r.member.username,
      url: r.member.url,
      website: r.member.website ?? "",
      location: r.member.location ?? "",
      tagline: r.member.tagline ?? "",
      bio: r.member.bio ?? "",
      created: r.member.created,
      twitter: r.member.twitter ?? null,
      github: r.member.github ?? null
    } : null
  });

  const normalizeNode = (n) => ({
    id: n.id,
    name: n.name,
    title: n.title,
    title_alternative: n.title_alternative ?? "",
    url: n.url,
    topics: n.topics ?? 0,
    stars: n.stars ?? 0,
    header: n.header ?? "",
    footer: n.footer ?? "",
    aliases: n.aliases ?? [],
    parent_node_name: n.parent_node_name ?? "",
    root: n.root ?? false
  });

  const normalizeMember = (m) => ({
    id: m.id,
    username: m.username,
    url: m.url,
    website: m.website ?? "",
    twitter: m.twitter ?? null,
    psn: m.psn ?? null,
    github: m.github ?? null,
    btc: m.btc ?? null,
    location: m.location ?? "",
    tagline: m.tagline ?? "",
    bio: m.bio ?? "",
    created: m.created,
    last_modified: m.last_modified,
    pro: m.pro ?? 0
  });

  const normalizeNodeItem = (n) => ({
    name: n.name,
    title: n.title,
    topics: n.topics ?? 0,
    aliases: n.aliases ?? []
  });

  async function fetchJson(path) {
    const resp = await fetch(ORIGIN + path);
    if (resp.status >= 400) {
      throw new Error(`V2EX request failed with HTTP ${resp.status}`);
    }
    const text = await resp.text();
    try {
      return JSON.parse(text);
    } catch (e) {
      throw new Error(`V2EX returned non-JSON response`);
    }
  }

  const handlers = {
    async getHotTopics() {
      const data = await fetchJson("/api/topics/hot.json");
      return { items: (Array.isArray(data) ? data : []).map(normalizeTopic) };
    },

    async getLatestTopics() {
      const data = await fetchJson("/api/topics/latest.json");
      return { items: (Array.isArray(data) ? data : []).map(normalizeTopic) };
    },

    async getTopic({ id }) {
      const data = await fetchJson(`/api/topics/show.json?id=${id}`);
      return { items: (Array.isArray(data) ? data : []).map(normalizeTopic) };
    },

    async getNodeTopics({ node, page = 1 }) {
      const data = await fetchJson(`/api/topics/show.json?node_name=${encodeURIComponent(node)}&page=${page}`);
      return { items: (Array.isArray(data) ? data : []).map(normalizeTopic) };
    },

    async getReplies({ topicId, page = 1 }) {
      const data = await fetchJson(`/api/replies/show.json?topic_id=${topicId}&page=${page}`);
      return { items: (Array.isArray(data) ? data : []).map(normalizeReply) };
    },

    async getNode({ name }) {
      const data = await fetchJson(`/api/nodes/show.json?name=${encodeURIComponent(name)}`);
      return normalizeNode(data);
    },

    async listNodes() {
      const data = await fetchJson("/api/nodes/list.json?fields=name,title,topics,aliases&sort_by=topics&reverse=1");
      return { items: (Array.isArray(data) ? data : []).map(normalizeNodeItem) };
    },

    async getMember({ username }) {
      const data = await fetchJson(`/api/members/show.json?username=${encodeURIComponent(username)}`);
      return normalizeMember(data);
    }
  };

  window.ox = {
    async callServiceAction(name, args) {
      const handler = handlers[name];
      if (!handler) {
        throw new Error(`unknown action: ${name}`);
      }
      return handler(args ?? {});
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
  action("getHotTopics", { async invoke(args) { return __oxLegacyCall("getHotTopics", args); } });
  action("getLatestTopics", { async invoke(args) { return __oxLegacyCall("getLatestTopics", args); } });
  action("getTopic", { async invoke(args) { return __oxLegacyCall("getTopic", args); } });
  action("getNodeTopics", { async invoke(args) { return __oxLegacyCall("getNodeTopics", args); } });
  action("getReplies", { async invoke(args) { return __oxLegacyCall("getReplies", args); } });
  action("getNode", { async invoke(args) { return __oxLegacyCall("getNode", args); } });
  action("listNodes", { async invoke(args) { return __oxLegacyCall("listNodes", args); } });
  action("getMember", { async invoke(args) { return __oxLegacyCall("getMember", args); } });
  });
}