/**
 * Buy X Get Y Free - storefront cart sync.
 *
 * Rules are configured by the merchant in the app admin ("Free gift rules")
 * and served read-only from this shop's App Proxy at
 * /apps/bogo/storefront/rules. Each rule looks like:
 *
 *   {
 *     id, triggerMode: "specific" | "storewide",
 *     triggerBasis: "quantity" | "amount", triggerQuantity, triggerAmount, freeQuantity,
 *     triggerItems: [{ productId, variantId }, ...],   // ignored when storewide
 *     freeOptions:  [{ productId, variantId, productTitle, variantTitle }, ...],
 *   }
 *
 * On every cart change (and on a slow background poll, as a catch-all for
 * themes that mutate the cart in ways we don't otherwise detect) this
 * script:
 *   1. Measures the cart against each rule's condition - either a unit
 *      count or a subtotal amount (triggerAmount is in cents), counting
 *      either only the products listed in triggerItems, or (storewide) any
 *      product at all.
 *   2. Works out how many free units the customer has earned.
 *   3. If there's more than one free gift option and nothing has been
 *      picked yet, shows a popup so the shopper can choose which one they
 *      want. With a single option, it's added automatically.
 *   4. Adds/removes/rescales the chosen free line via the Ajax Cart API so
 *      the cart always reflects exactly what's currently earned - including
 *      removing it again if the cart no longer qualifies.
 *
 * The chosen free line is tagged with a `_bogo_rule_id` line item property
 * so this script (and only this script) manages its quantity, and so it
 * never gets double-counted as a "trigger" item itself.
 */
(function () {
  var RULES_ENDPOINT = "/apps/bogo/storefront/rules";
  var DESIGN_ENDPOINT = "/apps/bogo/storefront/design";
  var POLL_INTERVAL_MS = 4000;
  var DEBUG = false; // set to true locally if you need to debug cart sync

  var DEFAULT_DESIGN = {
    popupHeading: "You've unlocked a free gift!",
    popupSubheading: "Choose which one you'd like:",
    imageShape: "rounded",
    titleColor: "#1a1a1a",
    buttonColor: "#008060",
    buttonTextColor: "#ffffff",
  };
  var design = DEFAULT_DESIGN;

  // Simple gray placeholder shown when a free-gift option has no saved
  // product image (inline SVG, so no extra network request).
  var PLACEHOLDER_IMAGE =
    "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='72' height='72'%3E" +
    "%3Crect width='72' height='72' fill='%23f2f2f2'/%3E" +
    "%3Cpath d='M20 48l10-12 8 9 6-7 8 10z' fill='%23cfcfcf'/%3E" +
    "%3Ccircle cx='27' cy='26' r='6' fill='%23cfcfcf'/%3E%3C/svg%3E";

  var syncing = false;
  var pending = false;
  var debounceTimer = null;
  var openModalRuleId = null;

  function log() {
    if (DEBUG && window.console) {
      console.log.apply(console, ["[BOGO]"].concat(Array.prototype.slice.call(arguments)));
    }
  }

  function digits(id) {
    return id ? String(id).replace(/\D/g, "") : "";
  }

  function fetchJson(url, options) {
    return fetch(url, Object.assign({ credentials: "same-origin" }, options)).then(
      function (res) {
        return res.text().then(function (text) {
          var body;
          try {
            body = text ? JSON.parse(text) : null;
          } catch (e) {
            body = text;
          }
          if (!res.ok) {
            var err = new Error("Request to " + url + " failed: " + res.status);
            err.status = res.status;
            err.body = body;
            throw err;
          }
          return body;
        });
      },
    );
  }

  function fetchRules() {
    return fetchJson(RULES_ENDPOINT).catch(function (err) {
      log("failed to fetch rules", err);
      return { rules: [] };
    });
  }

  function fetchCart() {
    return fetchJson("/cart.js");
  }

  function loadDesign() {
    fetchJson(DESIGN_ENDPOINT)
      .then(function (result) {
        if (result && typeof result === "object") {
          design = {
            popupHeading: result.popupHeading || DEFAULT_DESIGN.popupHeading,
            popupSubheading:
              result.popupSubheading || DEFAULT_DESIGN.popupSubheading,
            imageShape: result.imageShape === "square" ? "square" : "rounded",
            titleColor: result.titleColor || DEFAULT_DESIGN.titleColor,
            buttonColor: result.buttonColor || DEFAULT_DESIGN.buttonColor,
            buttonTextColor:
              result.buttonTextColor || DEFAULT_DESIGN.buttonTextColor,
          };
        }
      })
      .catch(function (err) {
        log("failed to fetch design settings, using defaults", err);
      });
  }

  // Measures how much of the rule's condition the cart currently satisfies -
  // either a unit count or a subtotal in cents, over only the eligible
  // products (or everything, if storewide).
  function measureCartAgainstRule(cart, rule) {
    var eligibleVariantIds = null;
    if (rule.triggerMode !== "storewide") {
      eligibleVariantIds = {};
      (rule.triggerItems || []).forEach(function (item) {
        eligibleVariantIds[digits(item.variantId)] = true;
      });
    }

    var qty = 0;
    var amountCents = 0;
    cart.items.forEach(function (item) {
      if (item.properties && item.properties._bogo_rule_id) return; // never a trigger
      var eligible =
        eligibleVariantIds === null || eligibleVariantIds[String(item.variant_id)];
      if (!eligible) return;
      qty += item.quantity;
      amountCents += item.line_price;
    });

    return rule.triggerBasis === "amount" ? amountCents : qty;
  }

  function findChosenLine(cart, ruleId) {
    for (var i = 0; i < cart.items.length; i++) {
      var item = cart.items[i];
      if (item.properties && item.properties._bogo_rule_id === ruleId) {
        return item;
      }
    }
    return null;
  }

  function planChanges(rules, cart) {
    var additions = [];
    var lineUpdates = [];
    var toPromptFor = [];
    var activeRuleIds = {};

    rules.forEach(function (rule) {
      activeRuleIds[rule.id] = true;
      var threshold =
        rule.triggerBasis === "amount" ? rule.triggerAmount : rule.triggerQuantity;
      if (!threshold || threshold < 1) return;
      if (!rule.freeOptions || !rule.freeOptions.length) return;

      var measured = measureCartAgainstRule(cart, rule);
      var multiples = Math.floor(measured / threshold);
      var eligibleFreeQty = multiples * (rule.freeQuantity || 1);
      var chosenLine = findChosenLine(cart, rule.id);
      var currentFreeQty = chosenLine ? chosenLine.quantity : 0;

      log(
        "rule", rule.id,
        "| mode:", rule.triggerMode,
        "| basis:", rule.triggerBasis,
        "| measured:", rule.triggerBasis === "amount" ? "$" + (measured / 100).toFixed(2) : measured,
        "| needed per free unit:", rule.triggerBasis === "amount" ? "$" + (threshold / 100).toFixed(2) : threshold,
        "| multiples:", multiples,
        "| free qty per multiple:", rule.freeQuantity,
        "| eligible free qty:", eligibleFreeQty,
        "| currently in cart:", currentFreeQty,
      );

      if (eligibleFreeQty <= 0) {
        if (chosenLine) {
          lineUpdates.push({ id: chosenLine.key, quantity: 0 });
        }
        return;
      }

      if (!chosenLine) {
        if (rule.freeOptions.length === 1) {
          additions.push({
            id: digits(rule.freeOptions[0].variantId),
            quantity: eligibleFreeQty,
            properties: { _bogo_rule_id: rule.id, _bogo_auto: "true" },
          });
        } else {
          toPromptFor.push({ rule: rule, quantity: eligibleFreeQty });
        }
        return;
      }

      if (chosenLine.quantity !== eligibleFreeQty) {
        lineUpdates.push({ id: chosenLine.key, quantity: eligibleFreeQty });
      }
    });

    // Clean up free items left behind by a rule that's since been
    // deactivated or deleted (it won't show up in `rules` any more).
    cart.items.forEach(function (item) {
      var ruleId = item.properties && item.properties._bogo_rule_id;
      if (ruleId && !activeRuleIds[ruleId]) {
        log("removing orphaned free item from inactive/deleted rule", ruleId);
        lineUpdates.push({ id: item.key, quantity: 0 });
      }
    });

    return { additions: additions, lineUpdates: lineUpdates, toPromptFor: toPromptFor };
  }

  function applyChanges(plan) {
    var updates = plan.lineUpdates.map(function (update) {
      return fetchJson("/cart/change.js", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: update.id, quantity: update.quantity }),
      }).catch(function (err) {
        log("cart/change.js failed for", update, err);
      });
    });

    return Promise.allSettled(updates).then(function () {
      if (!plan.additions.length) return null;
      return fetchJson("/cart/add.js", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: plan.additions }),
      }).catch(function (err) {
        log("cart/add.js failed", err);
      });
    });
  }

  // ---- Refresh the theme's own cart UI (drawer, cart page, icon count) --
  //
  // We mutate the cart with raw fetch() calls, which the theme's own
  // JS/Web Components don't know about, so drawers/cart pages don't
  // re-render on their own. Shopify wraps every theme section in
  // <div id="shopify-section-{id}">, and its Section Rendering API lets us
  // re-fetch just that section's fresh HTML and swap it in - the same
  // mechanism themes use internally, so components re-initialize correctly.
  // We find cart-related sections generically (by id or by containing a
  // known cart custom element) instead of guessing theme-specific ids.

  var CART_ELEMENT_SELECTORS = [
    "cart-drawer",
    "cart-notification",
    "cart-icon-bubble",
    "mini-cart",
    "cart-drawer-items",
    '[id*="cart-drawer" i]',
    '[class*="cart-drawer" i]',
    '[id*="CartDrawer" i]',
    '[class*="CartDrawer" i]',
    '[id*="mini-cart" i]',
    '[class*="mini-cart" i]',
    '[id*="cart-notification" i]',
    '[class*="cart-notification" i]',
  ];

  function findCartSectionIds() {
    var ids = {};
    document.querySelectorAll('[id^="shopify-section-"]').forEach(function (el) {
      var sectionId = el.id.slice("shopify-section-".length);
      var matchesById = sectionId.toLowerCase().indexOf("cart") !== -1;
      var matchesByChild = CART_ELEMENT_SELECTORS.some(function (selector) {
        try {
          return !!el.querySelector(selector);
        } catch (e) {
          return false;
        }
      });
      if (matchesById || matchesByChild) ids[sectionId] = true;
    });
    return Object.keys(ids);
  }

  // Diagnostic helper: any drawer-ish element on the page at all, whether or
  // not it lives inside a shopify-section wrapper we can re-fetch.
  function findCartDrawerElements() {
    var found = [];
    CART_ELEMENT_SELECTORS.forEach(function (selector) {
      try {
        document.querySelectorAll(selector).forEach(function (el) {
          found.push(el.tagName.toLowerCase() + (el.id ? "#" + el.id : "") + (el.className ? "." + String(el.className).split(" ").join(".") : ""));
        });
      } catch (e) {
        /* ignore invalid selector in older browsers */
      }
    });
    return found;
  }

  function refreshGenericSections(ids) {
    log("refreshing cart sections:", ids);
    var url = window.location.pathname + "?sections=" + encodeURIComponent(ids.join(","));
    return fetchJson(url)
      .then(function (sections) {
        ids.forEach(function (id) {
          var html = sections && sections[id];
          var wrapper = document.getElementById("shopify-section-" + id);
          if (html && wrapper) {
            wrapper.outerHTML = html;
          }
        });
        log("refreshed cart sections", ids);
      })
      .catch(function (err) {
        log("generic section refresh failed (non-fatal)", err);
      });
  }

  function extractInnerHtml(fullSectionHtml, rootSelector) {
    var temp = document.createElement("div");
    temp.innerHTML = fullSectionHtml;
    var root = rootSelector ? temp.querySelector(rootSelector) : temp.firstElementChild;
    return root ? root.innerHTML : null;
  }

  // Dawn (and Dawn-derived themes, e.g. many "Skeleton"/Horizon-based
  // storefronts) render the cart drawer via {% render 'cart-drawer' %}
  // rather than a {% section %} tag, so it never gets wrapped in a
  // <div id="shopify-section-cart-drawer">. It's still a real,
  // independently re-fetchable section named "cart-drawer" though - Dawn's
  // own JS refreshes it the same way, by swapping the contents of the
  // #CartDrawer element. Same idea for the header cart-count bubble,
  // usually #cart-icon-bubble, section id "cart-icon-bubble".
  // Best-effort visual polish, Dawn-specific only: disable the quantity
  // stepper/input on whichever cart-drawer row is our auto-added free line,
  // so it doesn't even look editable. This is NOT what actually prevents a
  // shopper from ending up with extra free units - planChanges()'s
  // reconciliation (backed by the immediate checkout-blocking overlay on
  // every mutation) is what guarantees that, on every theme. This just
  // makes the common case look right too.
  function lockAutoAddedRowsInDawnDrawer(cart) {
    var drawerEl = document.getElementById("CartDrawer");
    if (!drawerEl) return;
    cart.items.forEach(function (item, index) {
      if (!(item.properties && item.properties._bogo_rule_id)) return;
      var row = document.getElementById("CartDrawer-Item-" + (index + 1));
      if (!row) return;
      row
        .querySelectorAll(
          'input[type="number"], input[name*="quantity" i], button[name="plus"], button[name="minus"], quantity-input button',
        )
        .forEach(function (el) {
          el.disabled = true;
          el.setAttribute("aria-disabled", "true");
          el.style.opacity = "0.5";
          el.style.pointerEvents = "none";
        });
    });
  }

  function refreshDawnStyleCartDrawer() {
    return Promise.all([
      fetchJson(window.location.pathname + "?sections=cart-drawer,cart-icon-bubble"),
      fetchCart(),
    ])
      .then(function (results) {
        var sections = results[0];
        var freshCart = results[1];

        if (sections && sections["cart-drawer"]) {
          var drawerEl = document.getElementById("CartDrawer");
          var inner = extractInnerHtml(sections["cart-drawer"], "#CartDrawer");
          if (drawerEl && inner !== null) {
            drawerEl.innerHTML = inner;
          }
        }
        if (sections && sections["cart-icon-bubble"]) {
          var bubbleEl = document.getElementById("cart-icon-bubble");
          if (bubbleEl) {
            var bubbleInner = extractInnerHtml(sections["cart-icon-bubble"], "#cart-icon-bubble");
            bubbleEl.innerHTML = bubbleInner !== null ? bubbleInner : sections["cart-icon-bubble"];
          }
        }
        lockAutoAddedRowsInDawnDrawer(freshCart);
        log("refreshed Dawn-style cart-drawer/cart-icon-bubble");
      })
      .catch(function (err) {
        log("Dawn-style cart-drawer refresh failed (non-fatal)", err);
      });
  }

  function refreshCartSections() {
    var ids = findCartSectionIds();
    var hasDawnDrawer = !!document.getElementById("CartDrawer");
    var tasks = [];

    if (ids.length) tasks.push(refreshGenericSections(ids));
    if (hasDawnDrawer) tasks.push(refreshDawnStyleCartDrawer());

    if (!tasks.length) {
      var drawerEls = findCartDrawerElements();
      log(
        "no shopify-section wrapper found for the cart drawer.",
        drawerEls.length
          ? "Found these drawer-ish elements, but they're not inside a re-fetchable section: " + drawerEls.join(", ")
          : "No drawer-ish elements found on the page at all - it may only render once opened, or use different markup than expected.",
      );
      return Promise.resolve();
    }

    return Promise.all(tasks);
  }

  // ---- Free-gift choice popup ----------------------------------------

  function injectStylesOnce() {
    if (document.getElementById("bogo-styles")) return;
    var style = document.createElement("style");
    style.id = "bogo-styles";
    style.textContent =
      ".bogo-overlay{position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:2147483000;" +
      "display:flex;align-items:center;justify-content:center;padding:16px;font-family:inherit;" +
      "animation:bogo-fade-in .15s ease-out;}" +
      "@keyframes bogo-fade-in{from{opacity:0}to{opacity:1}}" +
      "@keyframes bogo-pop-in{from{opacity:0;transform:scale(.96)}to{opacity:1;transform:scale(1)}}" +
      ".bogo-box{background:#fff;color:#111;border-radius:16px;padding:24px;max-width:420px;width:100%;" +
      "max-height:85vh;overflow-y:auto;box-shadow:0 20px 60px rgba(0,0,0,.3);animation:bogo-pop-in .18s ease-out;}" +
      ".bogo-title{font-size:19px;font-weight:700;margin:0 0 4px;}" +
      ".bogo-desc{font-size:14px;margin:0 0 18px;color:#666;}" +
      ".bogo-options-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:12px;margin-bottom:8px;}" +
      ".bogo-option-card{border:1px solid #e3e3e3;border-radius:12px;padding:14px 12px;text-align:center;" +
      "background:#fff;transition:box-shadow .15s ease,border-color .15s ease;}" +
      ".bogo-option-card:hover{border-color:#c4c4c4;box-shadow:0 4px 14px rgba(0,0,0,.08);}" +
      ".bogo-option-image{width:72px;height:72px;object-fit:cover;margin:0 auto 10px;display:block;background:#f2f2f2;}" +
      ".bogo-option-image.bogo-shape-rounded{border-radius:50%;}" +
      ".bogo-option-image.bogo-shape-square{border-radius:6px;}" +
      ".bogo-option-title{font-size:13px;font-weight:600;margin:0 0 2px;line-height:1.3;" +
      "display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;}" +
      ".bogo-option-variant{font-size:11px;color:#888;margin:0 0 10px;}" +
      ".bogo-option-select-btn{display:block;width:100%;border:none;border-radius:8px;padding:9px 8px;" +
      "font-size:13px;font-weight:600;cursor:pointer;transition:filter .15s ease;}" +
      ".bogo-option-select-btn:hover{filter:brightness(0.92);}" +
      ".bogo-dismiss-btn{display:block;width:100%;text-align:center;padding:10px;margin-top:4px;" +
      "border:none;background:transparent;color:#666;cursor:pointer;font-size:13px;text-decoration:underline;}" +
      ".bogo-busy-overlay{position:fixed;inset:0;z-index:2147483200;cursor:progress;background:rgba(255,255,255,.01);}" +
      ".bogo-busy-badge{position:fixed;bottom:20px;right:20px;background:#111;color:#fff;padding:10px 16px;" +
      "border-radius:8px;font-size:13px;box-shadow:0 4px 16px rgba(0,0,0,.2);z-index:2147483201;font-family:inherit;}";
    document.head.appendChild(style);
  }

  // ---- Busy overlay: block checkout/clicks while a cart call is in flight

  var busyCount = 0;

  function showBusyOverlay() {
    busyCount++;
    if (document.getElementById("bogo-busy-overlay")) return;
    injectStylesOnce();
    var overlay = document.createElement("div");
    overlay.id = "bogo-busy-overlay";
    overlay.className = "bogo-busy-overlay";
    var badge = document.createElement("div");
    badge.className = "bogo-busy-badge";
    badge.textContent = "Updating your cart…";
    overlay.appendChild(badge);
    document.body.appendChild(overlay);
  }

  function hideBusyOverlay() {
    busyCount = Math.max(0, busyCount - 1);
    if (busyCount > 0) return;
    var overlay = document.getElementById("bogo-busy-overlay");
    if (overlay && overlay.parentNode) overlay.parentNode.removeChild(overlay);
  }

  function dismissKey(ruleId, quantity) {
    return "bogo_dismissed_" + ruleId + "_" + quantity;
  }

  function wasDismissed(ruleId, quantity) {
    try {
      return sessionStorage.getItem(dismissKey(ruleId, quantity)) === "1";
    } catch (e) {
      return false;
    }
  }

  function markDismissed(ruleId, quantity) {
    try {
      sessionStorage.setItem(dismissKey(ruleId, quantity), "1");
    } catch (e) {
      /* ignore */
    }
  }

  function closeModal(overlay) {
    if (overlay && overlay.parentNode) overlay.parentNode.removeChild(overlay);
    openModalRuleId = null;
  }

  function showChoiceModal(rule, quantity) {
    injectStylesOnce();
    openModalRuleId = rule.id;

    var overlay = document.createElement("div");
    overlay.className = "bogo-overlay";

    var box = document.createElement("div");
    box.className = "bogo-box";

    var title = document.createElement("p");
    title.className = "bogo-title";
    title.textContent = design.popupHeading || DEFAULT_DESIGN.popupHeading;

    var desc = document.createElement("p");
    desc.className = "bogo-desc";
    desc.textContent = design.popupSubheading || DEFAULT_DESIGN.popupSubheading;

    box.appendChild(title);
    box.appendChild(desc);

    var grid = document.createElement("div");
    grid.className = "bogo-options-grid";

    rule.freeOptions.forEach(function (option) {
      var card = document.createElement("div");
      card.className = "bogo-option-card";

      var img = document.createElement("img");
      img.className =
        "bogo-option-image bogo-shape-" +
        (design.imageShape === "square" ? "square" : "rounded");
      img.src = option.imageUrl || PLACEHOLDER_IMAGE;
      img.alt = option.productTitle || "";
      img.loading = "lazy";
      card.appendChild(img);

      var optionTitle = document.createElement("p");
      optionTitle.className = "bogo-option-title";
      optionTitle.style.color = design.titleColor;
      optionTitle.textContent = option.productTitle || "Free gift";
      card.appendChild(optionTitle);

      if (option.variantTitle && option.variantTitle !== "Default Title") {
        var variantLabel = document.createElement("p");
        variantLabel.className = "bogo-option-variant";
        variantLabel.textContent = option.variantTitle;
        card.appendChild(variantLabel);
      }

      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "bogo-option-select-btn";
      btn.style.background = design.buttonColor;
      btn.style.color = design.buttonTextColor;
      btn.textContent = "Select";
      btn.addEventListener("click", function () {
        closeModal(overlay);
        showBusyOverlay();
        fetchJson("/cart/add.js", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            items: [
              {
                id: digits(option.variantId),
                quantity: quantity,
                properties: { _bogo_rule_id: rule.id, _bogo_auto: "true" },
              },
            ],
          }),
        })
          .then(function () {
            document.dispatchEvent(new CustomEvent("bogo:cart-changed"));
            return refreshCartSections();
          })
          .then(function () {
            sync();
          })
          .catch(function (err) {
            log("adding chosen free gift failed", err);
          })
          .finally(function () {
            hideBusyOverlay();
          });
      });
      card.appendChild(btn);

      grid.appendChild(card);
    });

    box.appendChild(grid);

    var dismiss = document.createElement("button");
    dismiss.type = "button";
    dismiss.className = "bogo-dismiss-btn";
    dismiss.textContent = "Maybe later";
    dismiss.addEventListener("click", function () {
      markDismissed(rule.id, quantity);
      closeModal(overlay);
    });
    box.appendChild(dismiss);

    overlay.appendChild(box);
    document.body.appendChild(overlay);
  }

  function maybePrompt(toPromptFor) {
    if (!toPromptFor.length || openModalRuleId) return;
    for (var i = 0; i < toPromptFor.length; i++) {
      var entry = toPromptFor[i];
      if (!wasDismissed(entry.rule.id, entry.quantity)) {
        showChoiceModal(entry.rule, entry.quantity);
        return;
      }
    }
  }

  // ---- Sync loop -------------------------------------------------------

  function runSync() {
    if (syncing) {
      pending = true;
      return Promise.resolve();
    }
    syncing = true;

    return Promise.all([fetchRules(), fetchCart()])
      .then(function (results) {
        var rules = results[0].rules || [];
        var cart = results[1];

        var plan = planChanges(rules, cart);
        maybePrompt(plan.toPromptFor);

        if (!plan.additions.length && !plan.lineUpdates.length) {
          log("no changes needed");
          return null;
        }

        log("applying plan", plan);
        showBusyOverlay();
        return applyChanges(plan)
          .then(function () {
            document.dispatchEvent(new CustomEvent("bogo:cart-changed"));
            return refreshCartSections();
          })
          .finally(function () {
            hideBusyOverlay();
          });
      })
      .catch(function (err) {
        log("sync failed", err);
      })
      .finally(function () {
        syncing = false;
        if (pending) {
          pending = false;
          sync();
        }
      });
  }

  // Both the passive re-check (page load, background poll) and the
  // mutation-triggered one share a single debounce timer and a monotonic
  // "generation" counter. Only the LAST call before the timer fires ever
  // gets to run (clearTimeout cancels the rest), but a mutation can also
  // arrive while a previous runSync() is already mid-flight (past the
  // debounce, actively fetching) - clearTimeout can't stop that one, so
  // two runs can genuinely overlap. blockedGeneration/thisGeneration make
  // sure we only release the checkout block once the run that corresponds
  // to the MOST RECENT mutation has settled, never an earlier, superseded
  // one - otherwise there'd be a gap where checkout is briefly clickable
  // again even though a newer cart change still hasn't been reconciled.
  var mutationGeneration = 0;
  var blockedGeneration = -1;

  function scheduleSync(isMutation) {
    mutationGeneration++;
    var thisGeneration = mutationGeneration;

    if (isMutation) {
      if (blockedGeneration === -1) showBusyOverlay();
      blockedGeneration = thisGeneration;
    }

    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(function () {
      runSync().finally(function () {
        if (blockedGeneration !== -1 && thisGeneration >= blockedGeneration) {
          blockedGeneration = -1;
          hideBusyOverlay();
        }
      });
    }, 350);
  }

  // Passive re-check: page load, background poll. Doesn't pre-emptively
  // block checkout on its own - runSync() only blocks it if it actually
  // finds something to fix, so idle poll ticks stay invisible to the
  // shopper.
  function sync() {
    scheduleSync(false);
  }

  // A cart mutation was just detected (add/change/update/clear, from any
  // source: our own script, the theme's own JS, or the customer's browser).
  // We block checkout IMMEDIATELY - before we've even fetched the cart to
  // work out whether a correction is needed - otherwise there's a window
  // (the mutation's own network round trip, plus our debounce) where the
  // cart is stale but checkout is still clickable, letting a shopper race
  // a free item through before we've had a chance to remove it.
  function onMutationDetected() {
    scheduleSync(true);
  }

  // Detect cart mutations regardless of theme (fetch, XHR, or form submits).
  var CART_ENDPOINTS = ["/cart/add", "/cart/change", "/cart/update", "/cart/clear"];
  var BARE_CART_PATH = /\/cart\/?(\?|$)/;

  function isCartMutation(url) {
    if (!url) return false;
    return (
      CART_ENDPOINTS.some(function (endpoint) {
        return url.indexOf(endpoint) !== -1;
      }) || BARE_CART_PATH.test(url)
    );
  }

  var nativeFetch = window.fetch;
  window.fetch = function (input, init) {
    var url = typeof input === "string" ? input : input && input.url;
    var method = (init && init.method) || (typeof input === "object" && input.method) || "GET";
    // Detect and block BEFORE the request goes out, not after it resolves -
    // otherwise checkout stays open for the entire round trip of the
    // customer's own add/remove call.
    if (url && method.toUpperCase() !== "GET" && isCartMutation(url)) {
      onMutationDetected();
    }
    return nativeFetch.apply(this, arguments);
  };

  var nativeXhrOpen = window.XMLHttpRequest.prototype.open;
  window.XMLHttpRequest.prototype.open = function (method, url) {
    if (method && url && method.toUpperCase() !== "GET" && isCartMutation(String(url))) {
      onMutationDetected();
    }
    return nativeXhrOpen.apply(this, arguments);
  };

  document.addEventListener("submit", function (event) {
    var form = event.target;
    if (form && form.action && isCartMutation(form.action)) {
      onMutationDetected();
    }
  });

  loadDesign();
  document.addEventListener("DOMContentLoaded", sync);
  window.addEventListener("pageshow", sync);

  // Catch-all: some themes update the cart in ways we can't hook directly
  // (custom elements, section re-renders, etc). A slow poll guarantees the
  // cart eventually reconciles even then.
  setInterval(sync, POLL_INTERVAL_MS);

  window.BogoFreeGift = { sync: sync };
})();
