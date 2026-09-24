window.ox.install(({ action }) => {
const retryFetch = async (input, init, options) => {
  const method = String(init?.method ?? "GET").toUpperCase();
  const retries = ["GET", "HEAD"].includes(method) ? (options?.retries ?? 3) : 0;
  const delay = options?.delay ?? 400;
  const factor = options?.factor ?? 2;
  for (let attempt = 0; ; attempt++) {
    try {
      const response = await window.fetch(input, init);
      const retryable = response.status === 408 || response.status === 429
        || (response.status >= 500 && response.status <= 599);
      if (response.ok || !retryable || attempt >= retries) return response;
      console.log(`retryFetch: status ${response.status}, attempt ${attempt + 1}/${retries}`);
    } catch (error) {
      const message = String(error?.message ?? "");
      const retryable = message.includes("Load failed")
        || message.includes("NetworkError")
        || message.includes("Failed to fetch");
      if (!retryable || attempt >= retries) throw error;
      console.log(`retryFetch: network ${JSON.stringify(message)}, attempt ${attempt + 1}/${retries}`);
    }
    await new Promise(resolve => setTimeout(resolve, delay * Math.pow(factor, attempt)));
  }
};


  const cleanText = value => String(value ?? "").replace(/\s+/g, " ").trim();
  const headers = { accept: "application/json", "x-requested-with": "XMLHttpRequest", "content-type": "application/json" };

  function nullableText(value) {
    if (value == null) return null;
    const text = cleanText(String(value));
    return text || null;
  }

  function articleUrl(article) {
    if (article && typeof article.path === "string" && article.path.startsWith("https://www.jiqizhixin.com/")) return article.path;
    if (article && article.slug) return "https://www.jiqizhixin.com/articles/" + encodeURIComponent(article.slug);
    if (article && article.id) return "https://www.jiqizhixin.com/articles/" + encodeURIComponent(article.id);
    return "https://www.jiqizhixin.com/articles";
  }

  function summary(article) {
    if (!article || !article.id || !article.title) throw new Error("Article result is missing its ID or title.");
    return {
      id: String(article.id),
      title: cleanText(String(article.title)),
      author: nullableText(typeof article.author === "object" ? article.author && article.author.name : article.author),
      source: nullableText(article.source),
      category: nullableText(article.category),
      publishedAt: nullableText(article.publishedAt || article.published_at),
      tags: Array.isArray(article.tagList || article.tag_list) ? (article.tagList || article.tag_list).map(x => cleanText(String(x))).filter(Boolean) : [],
      excerpt: nullableText(article.content),
      coverImageUrl: nullableText(article.coverImageUrl || article.cover_image_url),
      url: articleUrl(article),
    };
  }

  async function getJson(url) {
    const response = await retryFetch(url, { credentials: "include", headers });
    if (!response.ok) {
      if (response.status === 404) throw new Error("Article was not found.");
      throw new Error("机器之心 request failed with HTTP " + response.status + ".");
    }
    const type = response.headers.get("content-type") || "";
    if (!type.includes("application/json")) throw new Error("机器之心 returned an unexpected response type.");
    return response.json();
  }

  action("listArticles", {
    async invoke(args) {
      const limit = args.limit == null ? 20 : args.limit;
      const data = await getJson("/api/article_library/articles.json?page=1&per=20");
      if (!data || data.success !== true || !Array.isArray(data.articles)) throw new Error("机器之心 returned an invalid article list.");
      return {
        items: data.articles.slice(0, limit).map(summary),
        nextCursor: null,
        totalCount: Number.isInteger(data.totalCount) && data.totalCount >= 0 ? data.totalCount : data.articles.length,
      };
    },
  });

  action("searchArticles", {
    async invoke(args) {
      const query = cleanText(args.query);
      if (!query) throw new Error("Search query cannot be empty.");
      const data = await getJson("/api/v1/search/base?keywords=" + encodeURIComponent(query));
      const articles = data && data.articles && Array.isArray(data.articles.nodes) ? data.articles.nodes : [];
      return { items: articles.map(summary), nextCursor: null };
    },
  });

  action("getArticle", {
    async invoke(args) {
      const id = String(args.id);
      const data = await getJson("/api/article_library/articles/" + encodeURIComponent(id) + ".json");
      if (!data || !data.title || typeof data.content !== "string") throw new Error("机器之心 returned an invalid article record.");
      const holder = document.createElement("div");
      holder.innerHTML = data.content;
      holder.querySelectorAll("script,style,noscript").forEach(node => node.remove());
      const author = typeof data.author === "object" ? data.author && data.author.name : data.author;
      const tags = data.seo && Array.isArray(data.seo.keywords) ? data.seo.keywords : [];
      return {
        id,
        title: cleanText(String(data.title)),
        author: nullableText(author),
        publishedAt: nullableText(data.published_at),
        copyright: nullableText(data.copyright),
        description: nullableText(data.description || (data.seo && data.seo.des)),
        content: cleanText(holder.textContent || ""),
        coverImageUrl: nullableText(data.cover_image_url || (data.seo && data.seo.image)),
        tags: tags.map(x => cleanText(String(x))).filter(Boolean),
        likesCount: Number.isInteger(data.likes_count) && data.likes_count >= 0 ? data.likes_count : null,
        url: "https://www.jiqizhixin.com/articles/" + encodeURIComponent(id),
      };
    },
  });
});
