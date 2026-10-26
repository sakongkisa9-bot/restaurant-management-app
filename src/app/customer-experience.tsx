"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import type { MenuItem } from "./menu-management";
import type { RestaurantProfileData } from "./restaurant-profile";

type CustomerPage = "Menu" | "My order" | "Booking";
type CartEntry = { itemId: string; quantity: number; specification: string };
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
  const [bookingMessage, setBookingMessage] = useState("");
  const [guestCount, setGuestCount] = useState("2");

  const categories = ["All", ...Array.from(new Set(items.map((item) => item.category).filter(Boolean)))];
  const visibleItems = activeCategory === "All" ? items : items.filter((item) => item.category === activeCategory);
  const cartCount = cart.reduce((total, entry) => total + entry.quantity, 0);
  const cartTotal = cart.reduce((total, entry) => {
    const item = items.find((menuItem) => menuItem.id === entry.itemId);
    return total + (item?.price ?? 0) * entry.quantity;
  }, 0);
  const restaurantPhotos = profile.photos;

  useEffect(() => {
    if (restaurantPhotos.length < 2) return;
    const timer = window.setInterval(() => setRestaurantImageIndex((current) => (current + 1) % restaurantPhotos.length), 4_000);
    return () => window.clearInterval(timer);
  }, [restaurantPhotos.length]);

  function openDish(item: MenuItem) {
    setSelectedFood(item);
    setFoodImageIndex(0);
  }

  function addToCart() {
    if (!selectedFood || selectedFood.available === false) return;
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

  function submitBooking(event: React.FormEvent<HTMLFormElement>) {
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

      {!selectedFood && activePage === "My order" && <section className="customer-subpage">
        <div className="customer-subpage-heading"><div><p className="eyebrow">YOUR SELECTION</p><h1>My order</h1><p>Review your choices before we build the order-completion flow.</p></div><span className="order-count-pill">{cartCount} {cartCount === 1 ? "item" : "items"}</span></div>
        {cart.length === 0 ? <div className="customer-empty-order"><span className="empty-icon">0</span><h2>Your order is empty</h2><p>Browse the menu and add something you love.</p><button className="primary-button" type="button" onClick={() => setActivePage("Menu")}>Browse menu <span aria-hidden="true">→</span></button></div> : <div className="order-review-layout"><div className="order-lines">{cart.map((entry) => { const item = items.find((candidate) => candidate.id === entry.itemId); if (!item) return null; const image = dishImages(item)[0]; return <article className="order-line" key={`${entry.itemId}-${entry.specification}`}>
            {image ? <Image src={image} alt="" width={84} height={74} unoptimized /> : <span className="order-line-placeholder">{item.name.slice(0, 1)}</span>}<div className="order-line-info"><strong>{item.name}</strong>{entry.specification && <span>{entry.specification}</span>}<span>KSh {item.price.toLocaleString("en-KE")} each</span></div><div className="quantity-control"><button type="button" onClick={() => changeQuantity(entry, -1)} aria-label={`Remove one ${item.name}`}>−</button><span>{entry.quantity}</span><button type="button" onClick={() => changeQuantity(entry, 1)} aria-label={`Add one ${item.name}`}>+</button></div><strong className="order-line-total">KSh {(item.price * entry.quantity).toLocaleString("en-KE")}</strong>
          </article>; })}<button className="text-button continue-menu-button" type="button" onClick={() => setActivePage("Menu")}>← Continue browsing</button></div><aside className="order-summary"><p className="eyebrow">ORDER SUMMARY</p><h2>Ready when you are.</h2><div><span>{cartCount} items</span><strong>KSh {cartTotal.toLocaleString("en-KE")}</strong></div><p>Order completion will be added in the next step.</p><button className="primary-button" type="button" disabled>Continue order</button></aside></div>}
      </section>}

      {!selectedFood && activePage === "Booking" && <section className="customer-subpage booking-page">
        <div className="customer-subpage-heading"><div><p className="eyebrow">SAVE YOUR SEAT</p><h1>Book a table</h1><p>Choose a date and time that works for your group.</p></div></div>
        <form className="booking-preview-form" onSubmit={submitBooking}><label><span>Date</span><input type="date" required min={new Date().toISOString().slice(0, 10)} /></label><label><span>Time</span><input type="time" required /></label><label><span>Guests</span><input type="number" min="1" max="20" value={guestCount} onChange={(event) => setGuestCount(event.target.value)} /></label><button className="primary-button" type="submit">Check availability <span aria-hidden="true">→</span></button>{bookingMessage && <p className="booking-preview-note" role="status">{bookingMessage}</p>}</form>
        <div className="booking-info-strip"><span className={`status-dot${isOpen ? " available-dot" : ""}`} /><strong>{isOpen ? "Taking reservations" : "Currently closed"}</strong><span>Table bookings will connect after the order flow is designed.</span></div>
      </section>}
    </main>
  );
}