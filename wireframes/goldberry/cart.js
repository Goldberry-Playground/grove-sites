/* Goldberry Grove — wireframe cart.
 * Vanilla JS. No deps. localStorage so the basket survives page nav.
 * Markup contract (shared across all goldberry pages):
 *   - [data-cart-open]     : any element that should open the drawer on click
 *   - [data-cart-close]    : backdrop, X button, etc.
 *   - [data-cart-drawer]   : the <aside> wrapper
 *   - [data-cart-items]    : container where line items render
 *   - [data-cart-empty]    : empty-state block (shown when 0 items)
 *   - [data-cart-foot]     : subtotal + checkout block (shown when >0 items)
 *   - [data-cart-subtotal] : where the subtotal $ renders
 *   - [data-cart-count]    : every nav badge — kept in sync
 *   - [data-add-cart]      : Add-to-cart buttons; uses data-id/name/price/variant/img
 */

(() => {
  const KEY = "goldberry-cart-v1";
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  /** @type {{id:string,name:string,price:number,variant:string,img:string,qty:number}[]} */
  let cart = load();

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  function save() {
    localStorage.setItem(KEY, JSON.stringify(cart));
  }

  function totalQty() {
    return cart.reduce((n, it) => n + it.qty, 0);
  }

  function subtotal() {
    return cart.reduce((n, it) => n + it.price * it.qty, 0);
  }

  function fmt(n) {
    return "$" + n.toFixed(2);
  }

  function add(item) {
    const existing = cart.find((it) => it.id === item.id);
    if (existing) {
      existing.qty += 1;
    } else {
      cart.push({ ...item, qty: 1 });
    }
    save();
    render();
  }

  function remove(id) {
    cart = cart.filter((it) => it.id !== id);
    save();
    render();
  }

  function setQty(id, qty) {
    const it = cart.find((it) => it.id === id);
    if (!it) return;
    if (qty <= 0) {
      remove(id);
      return;
    }
    it.qty = qty;
    save();
    render();
  }

  function openDrawer() {
    const drawer = $("[data-cart-drawer]");
    if (!drawer) return;
    drawer.setAttribute("aria-hidden", "false");
    drawer.classList.add("is-open");
    document.body.style.overflow = "hidden";
  }

  function closeDrawer() {
    const drawer = $("[data-cart-drawer]");
    if (!drawer) return;
    drawer.setAttribute("aria-hidden", "true");
    drawer.classList.remove("is-open");
    document.body.style.overflow = "";
  }

  function renderCounts() {
    const n = totalQty();
    $$("[data-cart-count]").forEach((el) => (el.textContent = String(n)));
  }

  // Small DOM helper — element(tag, {class, attrs, dataset}, [children])
  function el(tag, opts = {}, children = []) {
    const node = document.createElement(tag);
    if (opts.class) node.className = opts.class;
    if (opts.text != null) node.textContent = String(opts.text);
    if (opts.attrs) {
      for (const [k, v] of Object.entries(opts.attrs)) node.setAttribute(k, v);
    }
    if (opts.dataset) {
      for (const [k, v] of Object.entries(opts.dataset)) node.dataset[k] = v;
    }
    for (const child of children) {
      if (child) node.appendChild(child);
    }
    return node;
  }

  function buildLine(item) {
    // Thumbnail
    const imgNode = item.img
      ? el("img", { attrs: { src: item.img, alt: "" } })
      : el("div", { class: "cart-line-img-fallback" });
    const imgWrap = el("div", { class: "cart-line-img" }, [imgNode]);

    // Body
    const nameNode = el("div", { class: "cart-line-name", text: item.name });
    const variantNode = el("div", {
      class: "cart-line-variant",
      text: item.variant || "",
    });

    const qtyDec = el("button", {
      class: "cart-qty-btn",
      text: "−",
      attrs: { "aria-label": "Decrease quantity" },
      dataset: { qtyDec: "" },
    });
    const qtyVal = el("span", { class: "cart-qty-val", text: item.qty });
    const qtyInc = el("button", {
      class: "cart-qty-btn",
      text: "+",
      attrs: { "aria-label": "Increase quantity" },
      dataset: { qtyInc: "" },
    });
    const qtyGroup = el("div", { class: "cart-qty" }, [qtyDec, qtyVal, qtyInc]);

    const removeBtn = el("button", {
      class: "cart-line-remove",
      text: "Remove",
      dataset: { lineRemove: "" },
    });

    const controls = el("div", { class: "cart-line-controls" }, [
      qtyGroup,
      removeBtn,
    ]);

    const body = el("div", { class: "cart-line-body" }, [
      nameNode,
      variantNode,
      controls,
    ]);

    const priceNode = el("div", {
      class: "cart-line-price",
      text: fmt(item.price * item.qty),
    });

    return el(
      "article",
      { class: "cart-line", dataset: { lineId: item.id } },
      [imgWrap, body, priceNode],
    );
  }

  function renderDrawer() {
    const itemsEl = $("[data-cart-items]");
    const emptyEl = $("[data-cart-empty]");
    const footEl = $("[data-cart-foot]");
    const subEl = $("[data-cart-subtotal]");
    if (!itemsEl) return;

    if (cart.length === 0) {
      itemsEl.replaceChildren();
      itemsEl.hidden = true;
      if (emptyEl) emptyEl.hidden = false;
      if (footEl) footEl.hidden = true;
      return;
    }

    itemsEl.hidden = false;
    if (emptyEl) emptyEl.hidden = true;
    if (footEl) footEl.hidden = false;

    itemsEl.replaceChildren(...cart.map(buildLine));
    if (subEl) subEl.textContent = fmt(subtotal());
  }

  function render() {
    renderCounts();
    renderDrawer();
  }

  function bind() {
    document.addEventListener("click", (e) => {
      const opener = e.target.closest("[data-cart-open]");
      if (opener) {
        e.preventDefault();
        openDrawer();
        return;
      }
      const closer = e.target.closest("[data-cart-close]");
      if (closer) {
        e.preventDefault();
        closeDrawer();
        return;
      }
      const adder = e.target.closest("[data-add-cart]");
      if (adder) {
        e.preventDefault();
        const item = {
          id: adder.dataset.id,
          name: adder.dataset.name,
          price: Number(adder.dataset.price) || 0,
          variant: adder.dataset.variant || "",
          img: adder.dataset.img || "",
        };
        add(item);
        flash(adder);
        openDrawer();
        return;
      }
      // Drawer line-item controls (event delegation)
      const line = e.target.closest(".cart-line");
      if (line) {
        const id = line.dataset.lineId;
        if (e.target.closest("[data-qty-inc]")) {
          const it = cart.find((it) => it.id === id);
          if (it) setQty(id, it.qty + 1);
          return;
        }
        if (e.target.closest("[data-qty-dec]")) {
          const it = cart.find((it) => it.id === id);
          if (it) setQty(id, it.qty - 1);
          return;
        }
        if (e.target.closest("[data-line-remove]")) {
          remove(id);
          return;
        }
      }
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") closeDrawer();
    });

    // Sync across tabs / pages already open
    window.addEventListener("storage", (e) => {
      if (e.key !== KEY) return;
      cart = load();
      render();
    });
  }

  function flash(el) {
    el.classList.add("is-added");
    setTimeout(() => el.classList.remove("is-added"), 600);
  }

  bind();
  render();
})();
