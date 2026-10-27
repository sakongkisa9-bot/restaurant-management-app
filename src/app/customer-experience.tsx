"use client";

import Image from "next/image";
import { useEffect, useState, type FormEvent } from "react";
import type { MenuItem } from "./menu-management";
import type { RestaurantProfileData } from "./restaurant-profile";

type CustomerPage = "Menu" | "My order" | "Booking";
type CartEntry = { itemId: string; quantity: number; specification: string };
type OrderStatus = "confirmed" | "cooking" | "ready" | "completed" | "cancelled";
type ConfirmedOrder = {
  id: string;
  number: string;
  lines: Array<CartEntry & { name: string; price: number; image: string }>;
  total: number;
  tableNumber: string;
  status: OrderStatus;
  createdAt: string;
  billRequested: boolean;
  waiterCalled: boolean;
  assignedWaiterId: string | null;
  paymentStatus: "unpaid" | "pending" | "paid";
  invoiceNumber?: string;
  ratings?: Record<string, number>;
};

function isOrderStatus(value: unknown): value is OrderStatus {
  return typeof value === "string" && ["confirmed", "cooking", "ready", "completed", "cancelled"].includes(value);
}

function parseConfirmedOrder(value: unknown): ConfirmedOrder | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)
    || !("id" in value) || typeof value.id !== "string"
    || !("number" in value) || typeof value.number !== "string"
    || !("lines" in value) || !Array.isArray(value.lines)
    || !("total" in value) || typeof value.total !== "number"
    || !("tableNumber" in value) || typeof value.tableNumber !== "string"
    || !("status" in value) || !["confirmed", "cooking", "ready", "completed", "cancelled"].includes(String(value.status))
    || !("createdAt" in value) || typeof value.createdAt !== "string"
    || !("billRequested" in value) || typeof value.billRequested !== "boolean"
    || !("waiterCalled" in value) || typeof value.waiterCalled !== "boolean"
    || !("assignedWaiterId" in value) || (typeof value.assignedWaiterId !== "string" && value.assignedWaiterId !== null)
    || !("paymentStatus" in value) || !["unpaid", "pending", "paid"].includes(String(value.paymentStatus))) return null;

  const lines: ConfirmedOrder["lines"] = [];
  for (const line of value.lines) {
    if (typeof line !== "object" || line === null || Array.isArray(line)
      || !("itemId" in line) || typeof line.itemId !== "string"
      || !("quantity" in line) || typeof line.quantity !== "number"
      || !("specification" in line) || typeof line.specification !== "string"
      || !("name" in line) || typeof line.name !== "string"
      || !("price" in line) || typeof line.price !== "number"
      || !("image" in line) || typeof line.image !== "string") return null;
    lines.push({ itemId: line.itemId, quantity: line.quantity, specification: line.specification, name: line.name, price: line.price, image: line.image });
  }

  return {
    id: value.id,
    number: value.number,
    lines,
    total: value.total,
    tableNumber: value.tableNumber,
    status: value.status as OrderStatus,
    createdAt: value.createdAt,
    billRequested: value.billRequested,
    waiterCalled: value.waiterCalled,
    assignedWaiterId: value.assignedWaiterId,
    paymentStatus: value.paymentStatus as ConfirmedOrder["paymentStatus"],
  };
}
type CustomerExperienceProps = {
  items: MenuItem[];
  profile: RestaurantProfileData;
  isOpen: boolean;
  tableNumber: string;
};

const customerPages: CustomerPage[] = ["Menu", "My order", "Booking"];

function dishImages(item: MenuItem) {
  const images = item.images?.length ? item.images : item.image ? [item.image] : [];
  return Array.from(new Set(images));
}

export function CustomerExperience({ items, profile, isOpen, tableNumber }: CustomerExperienceProps) {
  const [activePage, setActivePage] = useState<CustomerPage>("Menu");
  const [activeCategory, setActiveCategory] = useState("All");
  const [selectedFood, setSelectedFood] = useState<MenuItem | null>(null);
  const [foodImageIndex, setFoodImageIndex] = useState(0);
  const [restaurantImageIndex, setRestaurantImageIndex] = useState(0);
  const [selectedSpecifications, setSelectedSpecifications] = useState<Record<string, string>>({});
  const [cart, setCart] = useState<CartEntry[]>([]);
  const [confirmedOrder, setConfirmedOrder] = useState<ConfirmedOrder | null>(null);
  const [customerSessionId, setCustomerSessionId] = useState("");
  const [orderLoaded, setOrderLoaded] = useState(false);
  const [loadedOrderStorageKey, setLoadedOrderStorageKey] = useState("");
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [paymentCopyMessage, setPaymentCopyMessage] = useState("");
  const [orderNotice, setOrderNotice] = useState("");
  const [orderSubmitting, setOrderSubmitting] = useState(false);
  const [serviceRequestSubmitting, setServiceRequestSubmitting] = useState(false);
  const [waiterRequestOpen, setWaiterRequestOpen] = useState(false);
  const [waiterRequestReason, setWaiterRequestReason] = useState("Water");
  const [waiterRequestDetails, setWaiterRequestDetails] = useState("");
  const [feedbackType, setFeedbackType] = useState<"recommendation" | "complaint">("recommendation");
  const [feedbackText, setFeedbackText] = useState("");
  const [feedbackMessage, setFeedbackMessage] = useState("");
  const [ratingMessage, setRatingMessage] = useState("");
  const [bookingMessage, setBookingMessage] = useState("");
  const [guestCount, setGuestCount] = useState("2");

  const categories = ["All", ...Array.from(new Set(items.map((item) => item.category).filter(Boolean)))];
  const visibleItems = activeCategory === "All" ? items : items.filter((item) => item.category === activeCategory);
  const cartCount = cart.reduce((total, entry) => total + entry.quantity, 0);
  const cartTotal = cart.reduce((total, entry) => {
    const item = items.find((menuItem) => menuItem.id === entry.itemId);
    return total + (item?.price ?? 0) * entry.quantity;
  }, 0);
  const orderActive = Boolean(confirmedOrder && confirmedOrder.status !== "completed" && confirmedOrder.status !== "cancelled");
  const restaurantPhotos = profile.photos;
  const orderStorageKey = profile.id && tableNumber && customerSessionId
    ? `room.customer-order.v2.${profile.id}.${tableNumber}.${customerSessionId}`
    : "";

  useEffect(() => {
    if (!profile.id) return;
    const visitStorageKey = `room.customer-visit.v1.${profile.id}.${tableNumber || "menu"}`;
    let sessionId: string;
    try {
      const navigationType = (performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined)?.type;
      const previousSession = window.sessionStorage.getItem(visitStorageKey);
      sessionId = previousSession && (navigationType === "reload" || navigationType === "back_forward")
        ? previousSession
        : window.crypto.randomUUID();
      window.sessionStorage.setItem(visitStorageKey, sessionId);
    } catch {
      const errorTimer = window.setTimeout(() => {
        setOrderNotice("This browser could not start a secure order session. Please enable site storage and scan the table QR code again.");
      }, 0);
      return () => window.clearTimeout(errorTimer);
    }
    const timer = window.setTimeout(() => setCustomerSessionId(sessionId), 0);
    return () => window.clearTimeout(timer);
  }, [profile.id, tableNumber]);

  useEffect(() => {
    if (restaurantPhotos.length < 2) return;
    const timer = window.setInterval(() => setRestaurantImageIndex((current) => (current + 1) % restaurantPhotos.length), 4_000);
    return () => window.clearInterval(timer);
  }, [restaurantPhotos.length]);

  useEffect(() => {
    let active = true;
    const loadOrder = window.setTimeout(() => {
      try {
        const storedOrder = orderStorageKey ? window.sessionStorage.getItem(orderStorageKey) : null;
        const parsedOrder: unknown = storedOrder ? JSON.parse(storedOrder) : null;
        if (active) {
          setConfirmedOrder(parseConfirmedOrder(parsedOrder));
          setLoadedOrderStorageKey(orderStorageKey);
          setOrderLoaded(true);
        }
      } catch {
        if (active) {
          setConfirmedOrder(null);
          setLoadedOrderStorageKey(orderStorageKey);
          setOrderLoaded(true);
        }
      }
    }, 0);
    return () => {
      active = false;
      window.clearTimeout(loadOrder);
    };
  }, [orderStorageKey]);

  useEffect(() => {
    if (!orderLoaded || loadedOrderStorageKey !== orderStorageKey) return;
    try {
      if (!orderStorageKey) return;
      if (confirmedOrder) window.sessionStorage.setItem(orderStorageKey, JSON.stringify(confirmedOrder));
      else window.sessionStorage.removeItem(orderStorageKey);
    } catch {
      return;
    }
  }, [confirmedOrder, loadedOrderStorageKey, orderLoaded, orderStorageKey]);

  useEffect(() => {
    const orderId = confirmedOrder?.id;
    if (!orderLoaded || !orderActive || !orderId || !customerSessionId || !profile.id) return;
    const restaurantId = profile.id;
    let active = true;
    const refreshOrder = async () => {
      try {
        const query = new URLSearchParams({ restaurantId, customerSessionId });
        const response = await fetch(`/api/orders/${encodeURIComponent(orderId)}?${query}`, { cache: "no-store" });
        const payload: unknown = await response.json();
        const orderData = typeof payload === "object" && payload !== null && "order" in payload ? payload.order : null;
        const status = typeof orderData === "object" && orderData !== null && "status" in orderData && isOrderStatus(orderData.status)
          ? orderData.status
          : null;
        const assignedWaiterId = typeof orderData === "object" && orderData !== null && "assignedWaiterId" in orderData
          ? orderData.assignedWaiterId
          : undefined;
        const billRequested = typeof orderData === "object" && orderData !== null && "billRequested" in orderData
          ? orderData.billRequested
          : undefined;
        const waiterCalled = typeof orderData === "object" && orderData !== null && "waiterCalled" in orderData
          ? orderData.waiterCalled
          : undefined;
        if (!response.ok || typeof orderData !== "object" || orderData === null
          || status === null
          || (typeof assignedWaiterId !== "string" && assignedWaiterId !== null)
          || typeof billRequested !== "boolean"
          || typeof waiterCalled !== "boolean") {
          const message = typeof payload === "object" && payload !== null && "error" in payload && typeof payload.error === "string"
            ? payload.error
            : "Could not refresh the order status.";
          throw new Error(message);
        }
        if (active) {
          setConfirmedOrder((current) => current ? {
            ...current,
            status,
            assignedWaiterId,
            billRequested,
            waiterCalled,
          } : current);
        }
      } catch (refreshError) {
        if (active) setOrderNotice(refreshError instanceof Error ? refreshError.message : "Could not refresh the order status.");
      }
    };
    const timer = window.setInterval(() => void refreshOrder(), 4_000);
    void refreshOrder();
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [confirmedOrder?.id, customerSessionId, orderActive, orderLoaded, profile.id]);

  function openDish(item: MenuItem) {
    setSelectedFood(item);
    setFoodImageIndex(0);
  }

  function addToCart() {
    if (!selectedFood || selectedFood.available === false) return;
    if (orderActive) {
      setOrderNotice("You already placed this order. Check My order.");
      setSelectedFood(null);
      setActivePage("My order");
      return;
    }
    if (confirmedOrder) setConfirmedOrder(null);
    const specification = selectedSpecifications[selectedFood.id] ?? selectedFood.specifications?.[0] ?? "";
    setCart((current) => {
      const existing = current.find((entry) => entry.itemId === selectedFood.id && entry.specification === specification);
      if (existing) return current.map((entry) => entry === existing ? { ...entry, quantity: entry.quantity + 1 } : entry);
      return [...current, { itemId: selectedFood.id, quantity: 1, specification }];
    });
    setSelectedFood(null);
    setActivePage("My order");
  }

  function changeQuantity(entry: CartEntry, change: number) {
    setCart((current) => current.flatMap((item) => {
      if (item.itemId !== entry.itemId || item.specification !== entry.specification) return [item];
      const quantity = item.quantity + change;
      return quantity > 0 ? [{ ...item, quantity }] : [];
    }));
  }

  async function confirmOrder() {
    if (cart.length === 0 || orderActive || orderSubmitting) return;
    if (!profile.id || !customerSessionId || !tableNumber || !Number.isInteger(Number(tableNumber)) || Number(tableNumber) < 1) {
      setOrderNotice("Open this menu from a restaurant table QR code before confirming an order.");
      return;
    }
    const lines = cart.flatMap((entry) => {
      const item = items.find((candidate) => candidate.id === entry.itemId);
      return item ? [{ ...entry, name: item.name, price: item.price, image: dishImages(item)[0] ?? "" }] : [];
    });
    if (!lines.length) return;

    setOrderSubmitting(true);
    setOrderNotice("");
    try {
      const response = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          restaurantId: profile.id,
          customerSessionId,
          tableNumber: Number(tableNumber),
          lines: lines.map(({ itemId, name, quantity, price, specification }) => ({ itemId, name, quantity, price, specification })),
        }),
      });
      const payload: unknown = await response.json();
      if (!response.ok || typeof payload !== "object" || payload === null || !("order" in payload)
        || typeof payload.order !== "object" || payload.order === null
        || !("id" in payload.order) || typeof payload.order.id !== "string"
        || !("orderNumber" in payload.order) || typeof payload.order.orderNumber !== "string") {
        const message = typeof payload === "object" && payload !== null && "error" in payload && typeof payload.error === "string"
          ? payload.error
          : "The order could not be sent to the restaurant.";
        throw new Error(message);
      }
      setConfirmedOrder({
        id: payload.order.id,
        number: payload.order.orderNumber,
        lines,
        total: lines.reduce((total, line) => total + line.price * line.quantity, 0),
        tableNumber,
        status: "confirmed",
        createdAt: new Date().toISOString(),
        billRequested: false,
        waiterCalled: false,
        assignedWaiterId: null,
        paymentStatus: "unpaid",
      });
      setCart([]);
    } catch (submitError) {
      setOrderNotice(submitError instanceof Error ? submitError.message : "The order could not be sent to the restaurant.");
    } finally {
      setOrderSubmitting(false);
    }
  }

  async function cancelOrder() {
    if (!confirmedOrder || !profile.id || !customerSessionId || confirmedOrder.status !== "confirmed"
      || confirmedOrder.assignedWaiterId || serviceRequestSubmitting) return;
    setServiceRequestSubmitting(true);
    setOrderNotice("");
    try {
      const response = await fetch(`/api/orders/${encodeURIComponent(confirmedOrder.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ restaurantId: profile.id, customerSessionId, action: "cancel" }),
      });
      const payload: unknown = await response.json();
      if (!response.ok) {
        const message = typeof payload === "object" && payload !== null && "error" in payload && typeof payload.error === "string"
          ? payload.error
          : "This order could not be cancelled.";
        throw new Error(message);
      }
      setConfirmedOrder((current) => current ? { ...current, status: "cancelled" } : current);
      setOrderNotice("");
    } catch (cancelError) {
      setOrderNotice(cancelError instanceof Error ? cancelError.message : "This order could not be cancelled.");
    } finally {
      setServiceRequestSubmitting(false);
    }
  }

  async function requestService(request: "bill" | "waiter", reason?: string, details?: string) {
    if (!confirmedOrder || !profile.id) return;
    if (request === "waiter" && !reason) {
      setWaiterRequestOpen(true);
      setOrderNotice("");
      return;
    }
    setServiceRequestSubmitting(true);
    try {
      const response = await fetch(`/api/orders/${encodeURIComponent(confirmedOrder.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          restaurantId: profile.id,
          action: request,
          ...(request === "waiter" ? { reason, details: details ?? "" } : {}),
        }),
      });
      const payload: unknown = await response.json();
      if (!response.ok) {
        const message = typeof payload === "object" && payload !== null && "error" in payload && typeof payload.error === "string"
          ? payload.error
          : "Your request could not be sent.";
        throw new Error(message);
      }
      setConfirmedOrder((current) => current ? {
        ...current,
        [request === "bill" ? "billRequested" : "waiterCalled"]: true,
      } : current);
      setOrderNotice(request === "bill" ? "Your bill request has been sent to the service team." : "Your request has been sent to the waiter.");
      setWaiterRequestOpen(false);
      setWaiterRequestDetails("");
    } catch (requestError) {
      setOrderNotice(requestError instanceof Error ? requestError.message : "Your request could not be sent.");
    } finally {
      setServiceRequestSubmitting(false);
    }
  }

  function submitWaiterRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void requestService("waiter", waiterRequestReason, waiterRequestDetails.trim());
  }

  async function submitFeedback(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!feedbackText.trim()) {
      setFeedbackMessage("Write a short message before submitting.");
      return;
    }

    if (!profile.id) {
      setFeedbackMessage("This restaurant is not ready to receive feedback yet.");
      return;
    }

    try {
      const response = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          restaurantId: profile.id,
          type: feedbackType,
          message: feedbackText.trim(),
          orderNumber: confirmedOrder?.number ?? "",
        }),
      });
      const payload: unknown = await response.json();
      if (!response.ok) {
        const message = typeof payload === "object" && payload !== null && "error" in payload && typeof payload.error === "string"
          ? payload.error
          : "Feedback could not be saved.";
        throw new Error(message);
      }
      setFeedbackText("");
      setFeedbackMessage(`${feedbackType === "recommendation" ? "Recommendation" : "Complaint"} sent to ${profile.name}.`);
    } catch (submitError) {
      setFeedbackMessage(submitError instanceof Error ? submitError.message : "Feedback could not be saved.");
    }
  }

  function submitRating(itemId: string, rating: number) {
    if (!confirmedOrder || confirmedOrder.status !== "ready") return;
    setConfirmedOrder((current) => current ? { ...current, ratings: { ...current.ratings, [itemId]: rating } } : current);
    setRatingMessage("Thank you for rating your order.");
  }

  function submitPaymentIntent() {
    if (!confirmedOrder || confirmedOrder.paymentStatus !== "unpaid") return;
    setConfirmedOrder((current) => current ? { ...current, paymentStatus: "pending" } : current);
    setPaymentCopyMessage("Payment reported. It will remain pending until verified by the payment service or cashier.");
  }

  async function copyPaymentNumber() {
    if (!profile.paymentNumber) return;
    try {
      await navigator.clipboard.writeText(profile.paymentNumber);
      setPaymentCopyMessage("Payment number copied.");
    } catch {
      setPaymentCopyMessage("Copy isn’t available here. Select the number to copy it.");
    }
  }

  function submitBooking(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBookingMessage("Booking requests will be enabled in the reservations setup.");
  }

  const brandName = profile.name || "Your restaurant";

  return (
    <main className="page-content customer-content customer-experience">
      <div className="customer-topline">
        <nav className="customer-page-tabs" aria-label="Customer pages">
          {customerPages.map((page) => (
            <button className={`customer-page-tab${activePage === page && !selectedFood ? " is-active" : ""}`} key={page} type="button" onClick={() => { setSelectedFood(null); setActivePage(page); }} aria-current={activePage === page && !selectedFood ? "page" : undefined}>
              {page}{page === "My order" && cartCount > 0 && <span className="cart-count">{cartCount}</span>}
            </button>
          ))}
        </nav>
        {tableNumber && <span className="customer-table-notice">Table {tableNumber}</span>}
      </div>

      {!selectedFood && activePage === "Menu" && (
        <>
          <section className="customer-kicker"><span className="eyebrow">{brandName.toUpperCase()} · WELCOME</span><span className={`customer-open-state${isOpen ? " is-open" : ""}`}><i className="status-dot" />{isOpen ? "Open now" : "Currently closed"}</span></section>
          <section className="customer-welcome customer-menu-hero">
            <div className="customer-welcome-copy"><p className="eyebrow">{profile.famousDish ? "A LOCAL FAVORITE" : "GOOD FOOD, GOOD COMPANY"}</p><h1>{brandName}</h1><p>{profile.welcomeMessage || "Come in, find your favorite, and make yourself at home."}</p>{profile.famousDish && <div className="customer-famous-dish"><span>HOUSE FAVORITE</span><strong>{profile.famousDish}</strong></div>}<button className="primary-button" type="button" onClick={() => document.getElementById("customer-menu")?.scrollIntoView({ behavior: "smooth" })}>Explore the menu <span aria-hidden="true">↓</span></button></div>
            <div className="customer-visual customer-restaurant-carousel" aria-label="Restaurant gallery">
              {restaurantPhotos.length > 0 ? <Image className="restaurant-carousel-image" src={restaurantPhotos[restaurantImageIndex]} alt={`${brandName} restaurant`} fill sizes="(max-width: 650px) 100vw, 40vw" unoptimized priority /> : <div className="customer-visual-fallback"><div className="plate plate-back" /><div className="plate plate-front"><span className="plate-center" /></div><span className="visual-leaf leaf-one" /><span className="visual-leaf leaf-two" /><span className="visual-dot dot-one" /><span className="visual-dot dot-two" /><span className="visual-caption">MADE FRESH<br />SERVED WITH CARE</span></div>}
              {restaurantPhotos.length > 1 && <div className="restaurant-carousel-controls"><button type="button" onClick={() => setRestaurantImageIndex((current) => (current - 1 + restaurantPhotos.length) % restaurantPhotos.length)} aria-label="Previous restaurant photo">‹</button><div>{restaurantPhotos.map((photo, index) => <button className={restaurantImageIndex === index ? "is-active" : ""} key={`${photo.slice(0, 25)}-${index}`} type="button" onClick={() => setRestaurantImageIndex(index)} aria-label={`Show restaurant photo ${index + 1}`} aria-pressed={restaurantImageIndex === index} />)}</div><button type="button" onClick={() => setRestaurantImageIndex((current) => (current + 1) % restaurantPhotos.length)} aria-label="Next restaurant photo">›</button></div>}
            </div>
          </section>

          <section className="customer-menu-section customer-menu-browser" id="customer-menu">
            <div className="customer-menu-heading"><div><p className="eyebrow">FRESH FROM OUR KITCHEN</p><h2>Explore the menu</h2></div><span>{visibleItems.length} {visibleItems.length === 1 ? "dish" : "dishes"}</span></div>
            {categories.length > 1 && <div className="menu-category-strip" aria-label="Filter menu by category">{categories.map((category) => <button className={`menu-category-button${activeCategory === category ? " is-active" : ""}`} key={category} type="button" onClick={() => setActiveCategory(category)} aria-pressed={activeCategory === category}>{category}</button>)}</div>}
            {visibleItems.length > 0 ? <div className="customer-menu-grid">{visibleItems.map((item) => {
              const image = dishImages(item)[0];
              const available = item.available !== false;
              return <article className={`customer-food-card customer-dish-card${!available ? " is-unavailable" : ""}`} key={item.id}>
                <button className="dish-card-open" type="button" onClick={() => openDish(item)} aria-label={`View ${item.name}`}>
                  {image ? <Image src={image} alt={item.name} className="customer-food-image" fill sizes="(max-width: 650px) 40vw, 33vw" unoptimized /> : <div className="customer-food-placeholder" aria-hidden="true">{item.name.slice(0, 1).toUpperCase()}</div>}
                </button>
                <div className="customer-food-copy"><div className="food-card-tags"><span>{item.category}</span><span>{item.mealPeriod}</span></div><div className="dish-card-title-row"><h3>{item.name}</h3><span className={`dish-availability${available ? " is-available" : " is-out"}`}><i />{available ? "Available" : "Out of stock"}</span></div><p>{item.description || "Freshly prepared in our kitchen."}</p><div className="dish-card-footer"><strong>KSh {item.price.toLocaleString("en-KE")}</strong>{available ? <button className="secondary-button dish-order-button" type="button" onClick={() => openDish(item)}>Order <span aria-hidden="true">→</span></button> : <button className="secondary-button dish-order-button" type="button" disabled>Unavailable</button>}</div></div>
              </article>;
            })}</div> : <div className="menu-empty-state customer-category-empty"><span className="empty-icon">M</span><strong>{items.length ? `No dishes in ${activeCategory}` : "The menu is being prepared"}</strong><p>{items.length ? "Try another category." : "Our menu will appear here soon."}</p></div>}
          </section>
          {profile.address && <section className="customer-visit-note"><span><i className="status-dot available-dot" />{isOpen ? "Come visit us today" : "We look forward to seeing you"}</span><strong>{profile.address}</strong>{profile.phone && <a href={`tel:${profile.phone}`}>{profile.phone}</a>}{profile.email && <a href={`mailto:${profile.email}`}>{profile.email}</a>}</section>}
        </>
      )}

      {selectedFood && (() => {
        const images = dishImages(selectedFood);
        const selectedOption = selectedSpecifications[selectedFood.id] ?? selectedFood.specifications?.[0] ?? "";
        const available = selectedFood.available !== false;
        return <section className="dish-detail-page">
          <button className="back-to-menu" type="button" onClick={() => setSelectedFood(null)}><span aria-hidden="true">←</span> Back to menu</button>
          <div className="dish-detail-layout">
            <div className="dish-detail-gallery">
              <div className="dish-detail-image">
                {images.length > 0 ? <Image src={images[foodImageIndex] ?? images[0]} alt={selectedFood.name} fill sizes="(max-width: 650px) 100vw, 55vw" unoptimized priority /> : <div className="customer-food-placeholder" aria-hidden="true">{selectedFood.name.slice(0, 1).toUpperCase()}</div>}
                {images.length > 1 && <><button className="dish-image-arrow previous" type="button" aria-label="Previous food photo" onClick={() => setFoodImageIndex((current) => (current - 1 + images.length) % images.length)}>‹</button><button className="dish-image-arrow next" type="button" aria-label="Next food photo" onClick={() => setFoodImageIndex((current) => (current + 1) % images.length)}>›</button><span className="dish-image-count">{foodImageIndex + 1} / {images.length}</span></>}
              </div>
              {images.length > 1 && <div className="dish-image-thumbnails">{images.map((image, index) => <button className={foodImageIndex === index ? "is-selected" : ""} type="button" key={`${image.slice(0, 25)}-${index}`} onClick={() => setFoodImageIndex(index)} aria-label={`Show food photo ${index + 1}`}><Image src={image} alt="" fill sizes="64px" unoptimized /></button>)}</div>}
            </div>
            <div className="dish-detail-copy"><div className="food-card-tags"><span>{selectedFood.category}</span><span>{selectedFood.mealPeriod}</span></div><span className={`dish-availability detail-availability${available ? " is-available" : " is-out"}`}><i />{available ? "Available to order" : "Out of stock"}</span><h1>{selectedFood.name}</h1><p className="dish-detail-description">{selectedFood.description || "Freshly prepared in our kitchen."}</p><div className="dish-rating"><span className="rating-stars" aria-label={selectedFood.ratingCount ? `Rated ${selectedFood.rating} out of 5` : "No ratings yet"}>{selectedFood.ratingCount ? "★★★★★" : "☆☆☆☆☆"}</span><span>{selectedFood.ratingCount ? `${(selectedFood.rating ?? 0).toFixed(1)} · ${selectedFood.ratingCount} ratings` : "No ratings yet"}</span></div><strong className="dish-detail-price">KSh {selectedFood.price.toLocaleString("en-KE")}</strong>
              {(selectedFood.specifications?.length ?? 0) > 0 && <fieldset className="dish-specification-fieldset"><legend>Choose a preference <small>Optional</small></legend><div>{selectedFood.specifications?.map((specification) => <label className={`dish-specification${selectedOption === specification ? " is-selected" : ""}`} key={specification}><input type="radio" name={`dish-specification-${selectedFood.id}`} checked={selectedOption === specification} onChange={() => setSelectedSpecifications((current) => ({ ...current, [selectedFood.id]: specification }))} /><span>{specification}</span></label>)}</div></fieldset>}
              {!available && <p className="out-of-stock-note">This dish is out of stock right now. Please check back later.</p>}
              <button className="primary-button add-to-cart-button" type="button" disabled={!available} onClick={addToCart}>Add to my order <span aria-hidden="true">→</span></button>
            </div>
          </div>
        </section>;
      })()}

      {!selectedFood && activePage === "My order" && <section className="customer-subpage order-page">
        <div className="customer-subpage-heading"><div><p className="eyebrow">YOUR SELECTION</p><h1>My order</h1><p>{orderActive && confirmedOrder ? `Order ${confirmedOrder.number} · placed ${new Intl.DateTimeFormat("en-KE", { hour: "numeric", minute: "2-digit" }).format(new Date(confirmedOrder.createdAt))}` : "Review your choices before confirming with the kitchen."}</p></div><span className={`order-count-pill${orderActive ? " is-tracking" : ""}`}>{orderActive ? "TRACKING" : `${cartCount} ${cartCount === 1 ? "item" : "items"}`}</span></div>
        {orderNotice && !orderActive && <p className="order-action-notice" role="alert">{orderNotice}</p>}
        {confirmedOrder?.status === "cancelled" && <div className="customer-empty-order cancelled-order-state"><span className="empty-icon">×</span><h2>Order cancelled</h2><p>The cancellation was recorded and the service team has been notified.</p><button className="primary-button" type="button" onClick={() => setActivePage("Menu")}>Browse menu <span aria-hidden="true">→</span></button></div>}
        {!orderActive && cart.length === 0 && confirmedOrder?.status !== "cancelled" ? <div className="customer-empty-order"><span className="empty-icon">0</span><h2>Your order is empty</h2><p>Browse the menu and add something you love.</p><button className="primary-button" type="button" onClick={() => setActivePage("Menu")}>Browse menu <span aria-hidden="true">→</span></button></div> : !orderActive && cart.length > 0 && <div className="order-review-layout"><div className="order-lines"><div className="order-lines-heading"><div><p className="eyebrow">CART REVIEW</p><h2>Check your order</h2></div><span>{cartCount} {cartCount === 1 ? "item" : "items"}</span></div>{cart.map((entry) => { const item = items.find((candidate) => candidate.id === entry.itemId); if (!item) return null; const image = dishImages(item)[0]; return <article className="order-line" key={`${entry.itemId}-${entry.specification}`}>
            {image ? <Image src={image} alt="" width={64} height={56} unoptimized /> : <span className="order-line-placeholder">{item.name.slice(0, 1)}</span>}<div className="order-line-info"><strong>{item.name}</strong>{entry.specification && <span>{entry.specification}</span>}<span>KSh {item.price.toLocaleString("en-KE")} each</span></div><div className="quantity-control"><button type="button" onClick={() => changeQuantity(entry, -1)} aria-label={`Remove one ${item.name}`}>−</button><span>{entry.quantity}</span><button type="button" onClick={() => changeQuantity(entry, 1)} aria-label={`Add one ${item.name}`}>+</button></div><strong className="order-line-total">KSh {(item.price * entry.quantity).toLocaleString("en-KE")}</strong>
          </article>; })}<button className="text-button continue-menu-button" type="button" onClick={() => setActivePage("Menu")}>← Continue browsing</button></div><aside className="order-summary"><p className="eyebrow">ORDER SUMMARY</p><h2>Ready to send?</h2><div><span>{cartCount} {cartCount === 1 ? "item" : "items"}</span><strong>KSh {cartTotal.toLocaleString("en-KE")}</strong></div><p>Confirming sends this order to the kitchen.</p><button className="primary-button" type="button" disabled={orderSubmitting} onClick={() => void confirmOrder()}>{orderSubmitting ? "Sending order…" : "Confirm order"} <span aria-hidden="true">→</span></button></aside></div>}

        {orderActive && confirmedOrder && <>
          <div className="confirmed-order-layout"><div className="confirmed-order-main">
            <section className="order-tracker-panel"><div className="order-tracker-heading"><div><p className="eyebrow">KITCHEN STATUS</p><h2>{confirmedOrder.status === "ready" ? "Your order is ready" : confirmedOrder.status === "cooking" ? "The kitchen is cooking" : "Order received"}</h2></div><span className={`tracker-status status-${confirmedOrder.status}`}>{confirmedOrder.status === "confirmed" ? "CONFIRMED" : confirmedOrder.status.toUpperCase()}</span></div><div className="order-progress-steps">{(["confirmed", "cooking", "ready"] as const).map((status, index) => { const statusIndex = ["confirmed", "cooking", "ready"].indexOf(confirmedOrder.status); const currentIndex = index; const complete = statusIndex >= currentIndex; return <div className={`order-progress-step${complete ? " is-complete" : ""}${confirmedOrder.status === status ? " is-current" : ""}`} key={status}><span className="progress-step-mark">{complete ? "✓" : String(index + 1).padStart(2, "0")}</span><span>{status === "confirmed" ? "Received" : status === "cooking" ? "Cooking" : "Ready"}</span></div>; })}</div><p className="tracker-explanation">{confirmedOrder.status === "confirmed" ? "Your order has been received and is being sent to the kitchen." : confirmedOrder.status === "cooking" ? "The cook is preparing your order." : "Please wait for your waiter to bring your order."}</p></section>
            <section className="confirmed-lines-panel"><div className="confirmed-lines-heading"><div><p className="eyebrow">ORDER DETAILS</p><h2>Order {confirmedOrder.number}</h2></div>{confirmedOrder.tableNumber && <span className="order-table-tag">Table {confirmedOrder.tableNumber}</span>}</div>{confirmedOrder.lines.map((line) => <article className="confirmed-order-line" key={`${line.itemId}-${line.specification}`}>{line.image ? <Image src={line.image} alt="" width={64} height={56} unoptimized /> : <span className="order-line-placeholder">{line.name.slice(0, 1)}</span>}<div><strong>{line.name}</strong>{line.specification && <span>{line.specification}</span>}<small>{line.quantity} × KSh {line.price.toLocaleString("en-KE")}</small></div><strong>KSh {(line.quantity * line.price).toLocaleString("en-KE")}</strong></article>)}<div className="confirmed-total"><span>Total</span><strong>KSh {confirmedOrder.total.toLocaleString("en-KE")}</strong></div></section>
            {orderNotice && <p className="order-action-notice" role="status">{orderNotice}</p>}
            <section className="order-service-actions"><button className={`secondary-button${confirmedOrder.billRequested ? " is-requested" : ""}`} type="button" disabled={confirmedOrder.billRequested} onClick={() => void requestService("bill")}><span className="service-action-symbol">B</span><span><strong>{confirmedOrder.billRequested ? "Bill requested" : "Request bill"}</strong><small>{confirmedOrder.billRequested ? "Service team notified" : "Pay the cashier in person"}</small></span></button><button className={`secondary-button${confirmedOrder.waiterCalled ? " is-requested" : ""}`} type="button" disabled={confirmedOrder.waiterCalled} onClick={() => void requestService("waiter")}><span className="service-action-symbol waiter-action-symbol">W</span><span><strong>{confirmedOrder.waiterCalled ? "Waiter called" : "Call waiter"}</strong><small>{confirmedOrder.waiterCalled ? "Request sent to service" : "Ask for assistance"}</small></span></button><button className="primary-button" type="button" disabled={confirmedOrder.paymentStatus !== "unpaid"} onClick={() => { setPaymentOpen((current) => !current); setPaymentCopyMessage(""); }}><span className="service-action-symbol pay-action-symbol">KSh</span><span><strong>{confirmedOrder.paymentStatus === "pending" ? "Payment pending" : confirmedOrder.paymentStatus === "paid" ? "Paid" : "Pay directly"}</strong><small>{confirmedOrder.paymentStatus === "unpaid" ? "M-Pesa payment options" : "Awaiting payment verification"}</small></span></button></section>
            {confirmedOrder.status === "confirmed" && !confirmedOrder.assignedWaiterId && <div className="order-cancel-action"><button className="secondary-button" type="button" disabled={serviceRequestSubmitting} onClick={() => void cancelOrder()}>{serviceRequestSubmitting ? "Cancelling…" : "Cancel order"}</button><p>You can cancel while your order is waiting for waiter approval.</p></div>}
            {paymentOpen && <section className="payment-detail-panel"><div className="payment-detail-heading"><div><p className="eyebrow">M-PESA PAYMENT</p><h2>Pay KSh {confirmedOrder.total.toLocaleString("en-KE")}</h2></div><button className="dialog-close" type="button" aria-label="Close payment details" onClick={() => setPaymentOpen(false)}>×</button></div><p className="payment-detail-copy">Send the exact amount using the restaurant details below. This preview cannot verify payments.</p><dl className="payment-detail-list"><div><dt>Method</dt><dd>{profile.paymentMethod || "Not configured"}</dd></div><div><dt>Payment number</dt><dd>{profile.paymentNumber || "Not set in restaurant profile"}</dd></div>{profile.paymentMethod === "Paybill" && <div><dt>Account/reference</dt><dd>Order {confirmedOrder.number}</dd></div>}</dl><button className="copy-payment-button" type="button" disabled={!profile.paymentNumber} onClick={copyPaymentNumber}>{paymentCopyMessage.includes("copied") ? "Copied" : "Copy payment number"}</button><div className="stk-preview"><span><strong>Request STK push</strong><small>Secure M-Pesa confirmation will be enabled with server payment integration.</small></span><button className="secondary-button" type="button" disabled>STK push unavailable</button></div><button className="primary-button report-payment-button" type="button" disabled={!profile.paymentNumber || confirmedOrder.paymentStatus !== "unpaid"} onClick={submitPaymentIntent}>I&apos;ve sent the payment</button>{paymentCopyMessage && <p className="payment-status-message" role="status">{paymentCopyMessage}</p>}</section>}
            {confirmedOrder.paymentStatus === "pending" && <p className="pending-payment-notice">Payment reported. It is not verified yet, so no invoice has been issued.</p>}
            {confirmedOrder.paymentStatus === "paid" && confirmedOrder.invoiceNumber && <section className="invoice-panel"><p className="eyebrow">PAYMENT RECEIPT</p><h2>Invoice {confirmedOrder.invoiceNumber}</h2><p>Payment verified for KSh {confirmedOrder.total.toLocaleString("en-KE")}.</p></section>}
            <section className="order-rating-panel"><div><p className="eyebrow">HOW WAS YOUR MEAL?</p><h2>{confirmedOrder.status === "ready" ? "Rate each dish" : "Rating opens when your order is ready"}</h2></div>{confirmedOrder.lines.map((line) => <div className="rating-line" key={line.itemId}><span>{line.name}</span><div aria-label={`Rate ${line.name} out of five stars`}>{[1, 2, 3, 4, 5].map((rating) => <button className={(confirmedOrder.ratings?.[line.itemId] ?? 0) >= rating ? "is-rated" : ""} key={rating} type="button" disabled={confirmedOrder.status !== "ready"} onClick={() => submitRating(line.itemId, rating)} aria-label={`${rating} star${rating === 1 ? "" : "s"}`}>★</button>)}</div></div>)}{ratingMessage && <p className="feedback-status-message" role="status">{ratingMessage}</p>}</section>
          </div><aside className="active-order-aside"><p className="eyebrow">ORDER TOTAL</p><strong className="active-order-total">KSh {confirmedOrder.total.toLocaleString("en-KE")}</strong><span>Order {confirmedOrder.number}</span><span>{confirmedOrder.lines.reduce((count, line) => count + line.quantity, 0)} items</span><div className="aside-payment-status"><i className={`status-dot${confirmedOrder.paymentStatus === "paid" ? " available-dot" : ""}`} />{confirmedOrder.paymentStatus === "paid" ? "Paid" : confirmedOrder.paymentStatus === "pending" ? "Payment pending" : "Payment due"}</div></aside></div></>}

        <section className="customer-feedback-panel"><div className="customer-feedback-heading"><div><p className="eyebrow">CUSTOMER VOICE</p><h2>Share feedback</h2><p>Tell us what you enjoyed or what we can improve.</p></div></div><form className="customer-feedback-form" onSubmit={submitFeedback}><div className="feedback-type-toggle"><label className={feedbackType === "recommendation" ? "is-selected" : ""}><input type="radio" name="feedback-type" value="recommendation" checked={feedbackType === "recommendation"} onChange={() => setFeedbackType("recommendation")} /><span>Recommendation</span></label><label className={feedbackType === "complaint" ? "is-selected" : ""}><input type="radio" name="feedback-type" value="complaint" checked={feedbackType === "complaint"} onChange={() => setFeedbackType("complaint")} /><span>Complaint</span></label></div><label className="feedback-message-field"><span className="visually-hidden">Your feedback</span><textarea maxLength={500} placeholder="Write your feedback" rows={3} value={feedbackText} onChange={(event) => setFeedbackText(event.target.value)} /></label><div className="customer-feedback-footer"><span>{feedbackText.length}/500</span><button className="secondary-button" type="submit">Send feedback</button></div>{feedbackMessage && <p className="feedback-status-message" role="status">{feedbackMessage}</p>}</form></section>
      </section>}

      {!selectedFood && activePage === "Booking" && <section className="customer-subpage booking-page">
        <div className="customer-subpage-heading"><div><p className="eyebrow">SAVE YOUR SEAT</p><h1>Book a table</h1><p>Choose a date and time that works for your group.</p></div></div>
        <form className="booking-preview-form" onSubmit={submitBooking}><label><span>Date</span><input type="date" required min={new Date().toISOString().slice(0, 10)} /></label><label><span>Time</span><input type="time" required /></label><label><span>Guests</span><input type="number" min="1" max="20" value={guestCount} onChange={(event) => setGuestCount(event.target.value)} /></label><button className="primary-button" type="submit">Check availability <span aria-hidden="true">→</span></button>{bookingMessage && <p className="booking-preview-note" role="status">{bookingMessage}</p>}</form>
        <div className="booking-info-strip"><span className={`status-dot${isOpen ? " available-dot" : ""}`} /><strong>{isOpen ? "Taking reservations" : "Currently closed"}</strong><span>Table bookings will connect after the order flow is designed.</span></div>
      </section>}
      {waiterRequestOpen && (
        <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setWaiterRequestOpen(false)}>
          <section className="dialog-card waiter-request-dialog" role="dialog" aria-modal="true" aria-labelledby="waiter-request-title">
            <button className="dialog-close" type="button" onClick={() => setWaiterRequestOpen(false)} aria-label="Close waiter request">×</button>
            <p className="eyebrow">TABLE {confirmedOrder?.tableNumber}</p><h2 id="waiter-request-title">What do you need?</h2>
            <p className="dialog-description">Your request will be sent to the waiter serving your table.</p>
            <form className="waiter-request-form" onSubmit={submitWaiterRequest}>
              <label className="profile-field"><span>Reason</span><select value={waiterRequestReason} onChange={(event) => setWaiterRequestReason(event.target.value)}><option>Water</option><option>Assistance</option><option>Utensils</option><option>Other</option></select></label>
              <label className="profile-field"><span>Details {waiterRequestReason === "Other" && <small>Required</small>}</span><textarea rows={3} maxLength={500} required={waiterRequestReason === "Other"} placeholder="Add a short note for your waiter" value={waiterRequestDetails} onChange={(event) => setWaiterRequestDetails(event.target.value)} /></label>
              {orderNotice && <p className="field-error" role="alert">{orderNotice}</p>}
              <div className="dialog-actions"><button className="secondary-button" type="button" onClick={() => setWaiterRequestOpen(false)}>Cancel</button><button className="primary-button" type="submit" disabled={serviceRequestSubmitting}>{serviceRequestSubmitting ? "Sending…" : "Send request"}</button></div>
            </form>
          </section>
        </div>
      )}
    </main>
  );
}