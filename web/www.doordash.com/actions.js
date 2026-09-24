const ORIGIN = "https://www.doordash.com";
const clean = (value) => typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
const amount = (unitAmount) => {
    const value = Number(unitAmount);
    return Number.isFinite(value) ? value / 100 : null;
};
const money = (value, fallbackCurrency = "USD") => ({
    amount: amount(value?.unitAmount),
    currency: clean(value?.currency) || fallbackCurrency,
    display: clean(value?.displayString) || null,
});
const cartMoney = (unitAmount, currency) => ({
    amount: amount(unitAmount),
    currency: clean(currency) || "USD",
    display: null,
});
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


const log = (...args) => console.log(...args);
    const graphql = async (operationName, query, variables = {}) => {
        const response = await retryFetch(`${ORIGIN}/graphql/${operationName}?operation=${encodeURIComponent(operationName)}`, {
            method: "POST",
            credentials: "include",
            headers: {
                Accept: "application/json",
                "Content-Type": "application/json",
                "x-channel-id": "marketplace",
                "x-experience-id": "doordash",
            },
            body: JSON.stringify({ operationName, variables, query: clean(query) }),
        });
        const text = await response.text();
        if (response.status === 401 || response.status === 403) {
            throw new Error("DoorDash requires sign-in");
        }
        if (!response.ok)
            throw new Error(`DoorDash ${operationName} HTTP ${response.status}`);
        let body;
        try {
            body = JSON.parse(text);
        }
        catch {
            throw new Error(`DoorDash ${operationName} returned a non-JSON response`);
        }
        if (body?.errors?.length) {
            throw new Error(`DoorDash ${operationName}: ${body.errors[0]?.message ?? "request failed"}`);
        }
        return body?.data;
    };
    const STORE_QUERY = `
    query storeFeed($storeId: ID!) {
      retailStorePageFeed(storeId: $storeId) {
        storeDetails {
          id
          name
          isActive
          coverSquareImgUrl
          storeHeader {
            id
            name
            description
            coverImgUrl
            ratings {
              averageRating
              numRatings
            }
            distanceFromConsumer {
              value
              label
            }
            priceRangeDisplayString
            status {
              delivery {
                isAvailable
                etaDisplayString
                displayUnavailableStatus
              }
            }
          }
        }
      }
    }
  `;
    const SEARCH_QUERY = `
    query convenienceSearchQuery($input: RetailSearchInput!) {
      retailSearch(input: $input) {
        query
        list {
          id
          urlSlug
          name
          description
          storeId
          menuId
          imageUrl
          itemMsid
          displayUnit
          unit
          ratings {
            averageRating
            displayNumRatings
            numOfRatings
          }
          price {
            displayString
            currency
            decimalPlaces
            unitAmount
          }
          quickAddContext {
            isEligible
            defaultQuantity
            nestedOptions
            specialInstructions
            price {
              displayString
              currency
              decimalPlaces
              unitAmount
            }
          }
        }
        legoRetailItems {
          id
          component {
            id
            category
          }
          custom
        }
        pageInfo {
          hasNextPage
          cursor
        }
      }
    }
  `;
    const CART_QUERY = `
    query consumerOrderCart {
      consumerOrderCart {
        id
        hasError
        cartType
        isConsumerPickup
        isConvenienceCart
        fulfillmentType
        cartStatusType
        subtotal
        total
        currencyCode
        shortenedUrl
        restaurant {
          id
          name
          coverImgUrl
          slug
        }
        orders {
          id
          orderItems {
            id
            quantity
            continuousQuantity
            priceDisplayString
            priceOfTotalQuantity
            item {
              id
              name
              imageUrl
              storeId
            }
          }
        }
      }
    }
  `;
    const RECEIPT_QUERY = `
    query getPostCheckoutConsumerOrderReceipt($orderCartId: ID!) {
      getConsumerOrderReceipt(orderCartId: $orderCartId) {
        commissionMessage
        storeName
        disclaimer
        lineItems {
          label
          note
          finalMoney {
            unitAmount
            displayString
          }
          originalMoney {
            unitAmount
            displayString
          }
        }
        orders {
          orderItemsList {
            id
            specialInstructions
            substitutionPreference
            quantity
            originalQuantity
            weightedActualQuantity
            item {
              id
              name
              description
              price
              priceMonetaryFields {
                unitAmount
                currency
                displayString
                decimalPlaces
                sign
              }
            }
            unitPriceMonetaryFields {
              currency
              unitAmount
              displayString
            }
            optionsList {
              itemExtraOption {
                name
              }
            }
          }
        }
      }
    }
  `;
    const fetchStore = async (storeId) => {
        const data = await graphql("storeFeed", STORE_QUERY, { storeId });
        const details = data?.retailStorePageFeed?.storeDetails;
        if (!details)
            throw new Error(`DoorDash store ${storeId} was not found`);
        const header = details.storeHeader ?? {};
        const delivery = header.status?.delivery ?? {};
        return {
            id: String(details.id ?? header.id ?? storeId),
            name: clean(details.name ?? header.name),
            description: clean(header.description) || null,
            url: `${ORIGIN}/store/${encodeURIComponent(String(details.id ?? storeId))}`,
            imageUrl: clean(header.coverImgUrl ?? details.coverSquareImgUrl) || null,
            isActive: Boolean(details.isActive),
            deliveryAvailable: Boolean(delivery.isAvailable),
            eta: clean(delivery.etaDisplayString) || null,
            unavailableReason: clean(delivery.displayUnavailableStatus) || null,
            distance: clean(header.distanceFromConsumer?.label) || null,
            priceRange: clean(header.priceRangeDisplayString) || null,
            rating: Number.isFinite(Number(header.ratings?.averageRating))
                ? Number(header.ratings.averageRating)
                : null,
            ratingCount: Number.isFinite(Number(header.ratings?.numRatings))
                ? Number(header.ratings.numRatings)
                : null,
        };
    };
    const fetchCart = async () => {
        const data = await graphql("consumerOrderCart", CART_QUERY);
        const cart = data?.consumerOrderCart;
        if (!cart)
            return null;
        const currency = clean(cart.currencyCode) || "USD";
        const items = (cart.orders ?? []).flatMap((order) => (order?.orderItems ?? []).map((orderItem) => ({
            id: String(orderItem.id ?? ""),
            itemId: String(orderItem.item?.id ?? ""),
            name: clean(orderItem.item?.name),
            quantity: Number(orderItem.quantity ?? orderItem.continuousQuantity ?? 0),
            price: {
                amount: amount(orderItem.priceOfTotalQuantity),
                currency,
                display: clean(orderItem.priceDisplayString) || null,
            },
            imageUrl: clean(orderItem.item?.imageUrl) || null,
            storeId: String(orderItem.item?.storeId ?? cart.restaurant?.id ?? ""),
        })));
        return {
            id: String(cart.id),
            status: clean(cart.cartStatusType) || null,
            fulfillmentType: clean(cart.fulfillmentType) || null,
            isPickup: Boolean(cart.isConsumerPickup),
            isConvenience: Boolean(cart.isConvenienceCart),
            hasError: Boolean(cart.hasError),
            store: {
                id: String(cart.restaurant?.id ?? ""),
                name: clean(cart.restaurant?.name),
                imageUrl: clean(cart.restaurant?.coverImgUrl) || null,
                url: cart.restaurant?.id
                    ? `${ORIGIN}/store/${encodeURIComponent(String(cart.restaurant.id))}`
                    : null,
            },
            subtotal: cartMoney(cart.subtotal, currency),
            total: cartMoney(cart.total, currency),
            items,
            checkoutUrl: `${ORIGIN}/consumer/checkout/`,
        };
    };
    const fetchOrders = async (limit) => {
        const response = await retryFetch(`${ORIGIN}/orders`, {
            credentials: "include",
            headers: { Accept: "text/html" },
        });
        const html = await response.text();
        if (response.status === 401 || response.status === 403 || /identity\.doordash\.com/.test(response.url)) {
            throw new Error("DoorDash requires sign-in");
        }
        if (!response.ok)
            throw new Error(`DoorDash order history HTTP ${response.status}`);
        const doc = new DOMParser().parseFromString(html, "text/html");
        const cards = [...doc.querySelectorAll('[data-testid="OrderHistoryOrderItem"]')];
        const seen = new Set();
        const items = [];
        for (const card of cards) {
            const link = [...card.querySelectorAll("a[href]")].find((candidate) => /^\/orders\/[0-9a-f-]+$/i.test(new URL(candidate.getAttribute("href") ?? "", ORIGIN).pathname));
            if (!link)
                continue;
            const url = new URL(link.getAttribute("href") ?? "", ORIGIN);
            const id = url.pathname.split("/").filter(Boolean).at(-1) ?? "";
            if (!id || seen.has(id))
                continue;
            seen.add(id);
            items.push({ id, url: url.toString(), summary: clean(card.textContent) });
            if (items.length >= limit)
                break;
        }
        if (!items.length && /sign.?in/i.test(clean(doc.title))) {
            throw new Error("DoorDash requires sign-in");
        }
        return items;
    };
    const fetchReceipt = async (orderCartId) => {
        const data = await graphql("getPostCheckoutConsumerOrderReceipt", RECEIPT_QUERY, { orderCartId });
        const receipt = data?.getConsumerOrderReceipt;
        if (!receipt)
            throw new Error(`DoorDash order ${orderCartId} was not found`);
        const items = (receipt.orders ?? []).flatMap((order) => (order?.orderItemsList ?? []).map((orderItem) => {
            const itemMoney = orderItem.unitPriceMonetaryFields ?? orderItem.item?.priceMonetaryFields;
            return {
                id: String(orderItem.id ?? ""),
                itemId: String(orderItem.item?.id ?? ""),
                name: clean(orderItem.item?.name),
                description: clean(orderItem.item?.description) || null,
                quantity: Number(orderItem.weightedActualQuantity ?? orderItem.quantity ?? 0),
                originalQuantity: Number(orderItem.originalQuantity ?? orderItem.quantity ?? 0),
                unitPrice: money(itemMoney),
                options: (orderItem.optionsList ?? [])
                    .map((option) => clean(option?.itemExtraOption?.name))
                    .filter(Boolean),
                specialInstructions: clean(orderItem.specialInstructions) || null,
                substitutionPreference: clean(orderItem.substitutionPreference) || null,
            };
        }));
        const lineItems = (receipt.lineItems ?? []).map((lineItem) => ({
            label: clean(lineItem.label),
            note: clean(lineItem.note) || null,
            amount: money(lineItem.finalMoney),
            originalAmount: lineItem.originalMoney ? money(lineItem.originalMoney) : null,
        }));
        const totalLine = [...lineItems].reverse().find((lineItem) => /total/i.test(lineItem.label));
        return {
            id: orderCartId,
            url: `${ORIGIN}/orders/${encodeURIComponent(orderCartId)}`,
            storeName: clean(receipt.storeName),
            commissionMessage: clean(receipt.commissionMessage) || null,
            disclaimer: clean(receipt.disclaimer) || null,
            total: totalLine?.amount ?? null,
            lineItems,
            items,
        };
    };
    action("getSignInUrl", {
        async invoke() {
            const query = new URLSearchParams({
                client_id: "1666519390426295040",
                intl: "en-US",
                is_iframe_modal: "true",
                last_login_action: "login",
                last_login_method: "google",
                layout: "identity_web_iframe",
                prompt: "none",
                redirect_uri: `${ORIGIN}/post-login/`,
                response_type: "code",
                scope: "*",
                state: "/",
            });
            return { url: `https://identity.doordash.com/auth?${query}` };
        },
    });
    action("getSignInState", {
        async invoke() {
            const response = await retryFetch(`${ORIGIN}/unified-gateway/notification_preferences/v1/doordash/consumer`, {
                credentials: "include",
                headers: { Accept: "application/json" },
                redirect: "manual",
            });
            if (response.status === 401 || response.status === 403 || response.status === 302) {
                return { signedIn: false };
            }
            if (!response.ok)
                throw new Error(`DoorDash sign-in probe HTTP ${response.status}`);
            return { signedIn: true };
        },
    });
    const visibleText = (node) => clean(node?.innerText || node?.textContent);
    const parseStoreCard = (link) => {
        const url = new URL(link.href, ORIGIN);
        const match = url.pathname.match(/\/store\/(?:[^/]+-)?(\d+)/i);
        if (!match) return null;
        const summary = visibleText(link);
        if (!summary) return null;
        const parts = summary.split(/\n+/).map(clean).filter(Boolean);
        const ratingMatch = summary.match(/(?:^|\s)([1-5]\.\d)(?=\s|$)/);
        const ratingCountMatch = summary.match(/\(([\d,.]+[kK+]?|[\d,.]+\+)\)/);
        const distanceMatch = summary.match(/\b\d+(?:\.\d+)?\s*(?:mi|km)\b/i);
        const etaMatch = summary.match(/\b\d+\s*min\b/i);
        const feeMatch = summary.match(/(?:\$[\d.]+|no)\s+delivery fee/i);
        const offerParts = (summary.match(/(?:\$[\d.]+ off on \$?[\d.]+\+|buy \d+[^•]*free|customer favorite|DashPass)/ig) || []).map(clean);
        return { id: match[1], name: clean(summary.replace(/\s+[1-5]\.\d\s*(?:\([\d,.kK+]+\))?[\s\S]*$/, "")) || parts[0] || "DoorDash store", url: url.toString(), summary: summary, rating: ratingMatch ? Number(ratingMatch[1]) : null, ratingCount: ratingCountMatch ? ratingCountMatch[1] : null, distance: distanceMatch ? distanceMatch[0] : null, eta: etaMatch ? etaMatch[0] : null, deliveryFee: feeMatch ? feeMatch[0] : null, offer: offerParts.length ? offerParts.join(" • ") : null };
    };
    const readVisibleMenu = (storeId, limit = 30) => {
        const title = clean(document.title);
        const storeName = title.match(/^Order\s+(.+?)\s+-\s+[^-]+Menu/i)?.[1] || visibleText([...document.querySelectorAll("h1,h2")].find((node) => visibleText(node))) || "DoorDash store";
        const excluded = /^(delivery|pickup|group order|save|reviews|see more|dashpass info|show menu categories|scroll menu navigation right|previous|next)$/i;
        const categories = [...new Set([...document.querySelectorAll("button")].map(visibleText).filter((text) => text && text.length <= 80 && !excluded.test(text) && !/add item|cart|notification|open menu/i.test(text)))].slice(0, 50);
        const items = [];
        for (const card of document.querySelectorAll('[data-testid="image-action-card-container"]')) {
            const lines = visibleText(card).split(/\n+/).map(clean).filter(Boolean);
            if (!lines.length) continue;
            const priceIndex = lines.findIndex((line) => /\$\d/.test(line));
            const name = priceIndex > 0 ? lines.slice(0, priceIndex).join(" ") : lines[0];
            const prices = lines.filter((line) => /\$\d/.test(line));
            const offerLines = lines.filter((line) => /(?:off|free|deal|save|buy \d|DashPass)/i.test(line));
            const descriptionLines = lines.filter((line, index) => index > 0 && !/\$\d/.test(line) && !offerLines.includes(line));
            if (!name || items.some((item) => item.name === name)) continue;
            items.push({ name, price: prices.length ? prices.join(" • ") : null, description: descriptionLines.length ? descriptionLines.join(" ") : null, offer: offerLines.length ? offerLines.join(" • ") : null, canAdd: Boolean(card.querySelector('button[aria-label="Add item to cart"], [data-testid="quick-add-button"]')) });
            if (items.length >= Math.max(1, Math.min(100, Number(limit) || 30))) break;
        }
        const bodyLines = visibleText(document.body).split(/\n+/).map(clean).filter(Boolean);
        const pricingIndex = bodyLines.findIndex((line) => /pricing & fees/i.test(line));
        const pricingAndFees = pricingIndex >= 0 ? bodyLines.slice(pricingIndex, pricingIndex + 4).join(" • ") : null;
        return { storeId: clean(storeId), storeName, url: location.href, categories, items, pricingAndFees, nextCursor: null };
    };
    action("searchStores", {
        async invoke({ query, limit = 10 } = {}) {
            if (!clean(query)) throw new Error("searchStores requires query");
            const max = Math.max(1, Math.min(30, Number(limit) || 10));
            const seen = new Set(); const items = [];
            for (const link of document.querySelectorAll('a[href*="/store/"]')) {
                const item = parseStoreCard(link);
                if (!item || seen.has(item.id)) continue;
                seen.add(item.id); items.push(item);
                if (items.length >= max) break;
            }
            log("searchStores results=" + items.length);
            return { items, nextCursor: null };
        },
    });
    action("browseMenu", {
        async invoke({ storeId, limit = 30 } = {}) {
            if (!clean(storeId)) throw new Error("browseMenu requires storeId");
            const result = readVisibleMenu(storeId, limit);
            log("browseMenu results=" + result.items.length);
            return result;
        },
    });
    action("getVisibleOffersAndFees", {
        async invoke({ storeId } = {}) {
            if (!clean(storeId)) throw new Error("getVisibleOffersAndFees requires storeId");
            const menu = readVisibleMenu(storeId, 100);
            const offers = [...new Set(menu.items.map((item) => item.offer).filter(Boolean))];
            const bodyLines = visibleText(document.body).split(/\n+/).map(clean).filter(Boolean);
            const deliverySummary = bodyLines.find((line) => /(?:delivery|pickup).*(?:mi|min|fee)|(?:mi|min|fee).*(?:delivery|pickup)/i.test(line)) || null;
            return { storeId: clean(storeId), storeName: menu.storeName, offers, pricingAndFees: menu.pricingAndFees, deliverySummary, url: location.href };
        },
    });
    action("getActiveOrderStatus", {
        async invoke() {
            const statusPattern = /(?:preparing|confirmed|being prepared|picked up|on the way|arriving|delivering|driver|dasher)/i;
            const cards = [...document.querySelectorAll('[data-testid="OrderHistoryOrderItem"], article')];
            for (const card of cards) {
                const summary = visibleText(card);
                if (!summary || !statusPattern.test(summary)) continue;
                const link = card.querySelector('a[href*="/orders/"]');
                const url = link ? new URL(link.href, ORIGIN).toString() : location.href;
                const orderId = new URL(url).pathname.match(/\/orders\/([^/]+)/)?.[1] || null;
                const lines = summary.split(/\n+/).map(clean).filter(Boolean);
                const eta = summary.match(/(?:arriv(?:es|ing)|eta)[^\n•]{0,40}|\b\d{1,2}:\d{2}\s*(?:AM|PM)\b|\b\d+\s*min\b/i)?.[0] || null;
                const status = lines.find((line) => statusPattern.test(line)) || null;
                return { active: true, orderId, storeName: lines[0] || null, status, eta, summary, url };
            }
            return { active: false, orderId: null, storeName: null, status: null, eta: null, summary: null, url: null };
        },
    });
    action("getStore", {
        async invoke({ storeId } = {}) {
            if (!clean(storeId))
                throw new Error("getStore requires storeId");
            return { store: await fetchStore(clean(storeId)) };
        },
    });
    action("searchStoreItems", {
        async invoke({ storeId, query, cursor, limit = 20 } = {}) {
            if (!clean(storeId))
                throw new Error("searchStoreItems requires storeId");
            if (!clean(query))
                throw new Error("searchStoreItems requires query");
            const requestedLimit = Math.max(1, Math.min(50, Number(limit) || 20));
            const data = await graphql("convenienceSearchQuery", SEARCH_QUERY, {
                input: {
                    query: clean(query),
                    storeId: clean(storeId),
                    disableSpellCheck: false,
                    limit: requestedLimit,
                    origin: "RETAIL_SEARCH",
                    filterQuery: "",
                    aggregateStoreIds: [],
                    isDebug: false,
                    ...(clean(cursor) ? { cursor: clean(cursor) } : {}),
                },
            });
            const result = data?.retailSearch;
            const seen = new Set();
            const items = [];
            const listedItems = [...(result?.list ?? [])];
            for (const facet of result?.legoRetailItems ?? []) {
                if (facet?.component?.category !== "card.retail_item" || !clean(facet.custom))
                    continue;
                try {
                    const custom = JSON.parse(facet.custom);
                    const itemData = custom?.item_data ?? {};
                    const itemPrice = itemData.price ?? {};
                    listedItems.push({
                        id: itemData.item_id,
                        name: itemData.item_name,
                        description: custom?.logging?.description,
                        imageUrl: custom?.image?.remote?.uri,
                        price: {
                            unitAmount: itemPrice.unit_amount,
                            currency: itemPrice.currency,
                            displayString: itemPrice.display_string,
                        },
                        unit: itemData.display_unit || itemData.sold_as_info_short_string,
                        ratings: null,
                        quickAddContext: {
                            isEligible: Boolean(custom?.quantity_stepper),
                            defaultQuantity: 1,
                        },
                    });
                }
                catch {
                    log(`searchStoreItems ignored malformed facet ${clean(facet?.id)}`);
                }
            }
            for (const item of listedItems) {
                const id = String(item?.id ?? "");
                if (!id || seen.has(id))
                    continue;
                seen.add(id);
                const price = money(item.price ?? item.quickAddContext?.price);
                items.push({
                    id,
                    storeId: clean(storeId),
                    name: clean(item.name),
                    description: clean(item.description) || null,
                    imageUrl: clean(item.imageUrl) || null,
                    price,
                    unit: clean(item.unit) || null,
                    rating: Number.isFinite(Number(item.ratings?.averageRating))
                        ? Number(item.ratings.averageRating)
                        : null,
                    ratingCount: Number.isFinite(Number(item.ratings?.numOfRatings))
                        ? Number(item.ratings.numOfRatings)
                        : null,
                    additionalVariants: null,
                    canQuickAdd: Boolean(item.quickAddContext?.isEligible),
                    defaultQuantity: Number(item.quickAddContext?.defaultQuantity ?? 1),
                });
                if (items.length >= requestedLimit)
                    break;
            }
            log(`searchStoreItems store=${clean(storeId)} results=${items.length}`);
            return {
                items,
                nextCursor: result?.pageInfo?.hasNextPage ? clean(result.pageInfo.cursor) || null : null,
            };
        },
    });
    action("getCart", {
        async invoke() {
            return { cart: await fetchCart() };
        },
    });
    action("listOrders", {
        async invoke({ limit = 10 } = {}) {
            const requestedLimit = Math.max(1, Math.min(10, Number(limit) || 10));
            const items = await fetchOrders(requestedLimit);
            return { items, nextCursor: null };
        },
    });
    action("getOrder", {
        async invoke({ orderCartId } = {}) {
            if (!clean(orderCartId))
                throw new Error("getOrder requires orderCartId");
            return { order: await fetchReceipt(clean(orderCartId)) };
        },
    });
    action("getPaymentUrl", {
        async invoke() {
            return { url: `${ORIGIN}/consumer/checkout/` };
        },
    });
    action("getPaymentState", {
        async invoke({ previousOrderId } = {}) {
            const cart = await fetchCart();
            if (cart?.items.length) {
                return {
                    status: "pending",
                    reference: cart.id,
                    total: cart.total.amount ?? 0,
                    currency: cart.total.currency,
                    completedAt: null,
                };
            }
            try {
                const orders = await fetchOrders(1);
                const newest = orders[0];
                if (newest && previousOrderId && newest.id !== clean(previousOrderId)) {
                    const receipt = await fetchReceipt(newest.id);
                    return {
                        status: "completed",
                        reference: newest.id,
                        total: receipt.total?.amount ?? 0,
                        currency: receipt.total?.currency ?? "USD",
                        completedAt: null,
                    };
                }
            }
            catch (error) {
                log(`getPaymentState order verification unavailable: ${error instanceof Error ? error.message : String(error)}`);
            }
            return { status: "none", reference: null, total: 0, currency: "USD", completedAt: null };
        },
    });
});
