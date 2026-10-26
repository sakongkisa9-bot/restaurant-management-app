"use client";

import Image from "next/image";
import { QRCodeSVG } from "qrcode.react";
import { useEffect, useState, type ChangeEvent, type FormEvent } from "react";
import { slugify } from "../lib/tenant";

export type RestaurantProfileData = {
  slug: string;
  name: string;
  logo: string;
  phone: string;
  email: string;
  address: string;
  mapsUrl: string;
  welcomeMessage: string;
  famousDish: string;
  photos: string[];
  paymentMethod: string;
  paymentNumber: string;
  tableCount: number;
};

type RestaurantProfileProps = {
  initialProfile: RestaurantProfileData;
  onSave: (profile: RestaurantProfileData) => void;
};

const uploadLimit = 350 * 1024;
const photoLimit = 6;
const paymentMethods = ["Till number", "Paybill", "Pochi la Biashara", "Phone number"];

export const defaultRestaurantProfile: RestaurantProfileData = {
  slug: "",
  name: "",
  logo: "",
  phone: "",
  email: "",
  address: "",
  mapsUrl: "",
  welcomeMessage: "",
  famousDish: "",
  photos: [],
  paymentMethod: paymentMethods[0],
  paymentNumber: "",
  tableCount: 12,
};

function readImage(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => {
      if (typeof reader.result === "string") resolve(reader.result);
      else reject(new Error("Could not read that image."));
    });
    reader.addEventListener("error", () => reject(new Error("Could not read that image.")));
    reader.readAsDataURL(file);
  });
}

export function getMapsHref(profile: RestaurantProfileData) {
  if (profile.mapsUrl) {
    try {
      const url = new URL(profile.mapsUrl);
      const allowedHost = url.hostname === "maps.app.goo.gl" || url.hostname === "goo.gl" || url.hostname === "maps.google.com" || url.hostname === "google.com" || url.hostname.endsWith(".google.com");
      if (url.protocol === "https:" && allowedHost) return url.href;
    } catch {
      return "";
    }
  }
  if (profile.address) return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(profile.address)}`;
  return "";
}

export function RestaurantProfile({ initialProfile, onSave }: RestaurantProfileProps) {
  const [profile, setProfile] = useState(initialProfile);
  const [savedProfile, setSavedProfile] = useState(initialProfile);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);
  const [qrOrigin, setQrOrigin] = useState("");
  const [qrSelection, setQrSelection] = useState("all");
  const restaurantSlug = profile.slug || slugify(profile.name);

  useEffect(() => {
    const readOrigin = window.setTimeout(() => setQrOrigin(window.location.origin), 0);
    return () => window.clearTimeout(readOrigin);
  }, []);

  function updateProfile<K extends keyof RestaurantProfileData>(key: K, value: RestaurantProfileData[K]) {
    setProfile((current) => ({ ...current, [key]: value }));
    setSaved(false);
  }

  async function handleLogo(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Choose an image file for the restaurant logo.");
      return;
    }
    if (file.size > uploadLimit) {
      setError("Logo images must be 350 KB or smaller in this preview.");
      return;
    }

    try {
      updateProfile("logo", await readImage(file));
      setError("");
    } catch {
      setError("We couldn’t read that logo. Try another image.");
    }
  }

  async function handlePhotos(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (files.length === 0) return;
    if (profile.photos.length + files.length > photoLimit) {
      setError(`Add up to ${photoLimit} restaurant photos.`);
      return;
    }

    const oversized = files.find((file) => file.size > uploadLimit);
    if (oversized) {
      setError("Each restaurant photo must be 350 KB or smaller in this preview.");
      return;
    }
    if (files.some((file) => !file.type.startsWith("image/"))) {
      setError("Choose image files for the restaurant gallery.");
      return;
    }

    try {
      const photos = await Promise.all(files.map(readImage));
      updateProfile("photos", [...profile.photos, ...photos]);
      setError("");
    } catch {
      setError("We couldn’t read one of those photos. Try again.");
    }
  }

  function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!profile.name.trim()) {
      setError("Enter the restaurant name before saving.");
      return;
    }
    if (profile.phone && !/^[+\d][\d\s()-]{6,}$/.test(profile.phone.trim())) {
      setError("Enter a valid contact phone number.");
      return;
    }
    if (profile.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(profile.email.trim())) {
      setError("Enter a valid contact email address.");
      return;
    }
    if (profile.tableCount < 1 || profile.tableCount > 200) {
      setError("Table count must be between 1 and 200.");
      return;
    }

    const nextProfile = { ...profile, name: profile.name.trim(), slug: profile.slug || slugify(profile.name.trim()) };
    onSave(nextProfile);
    setProfile(nextProfile);
    setSavedProfile(nextProfile);
    setSaved(true);
    setError("");
  }

  function discardChanges() {
    setProfile(savedProfile);
    setSaved(false);
    setError("");
  }

  const mapsHref = getMapsHref(profile);
  const tableNumbers = Array.from({ length: profile.tableCount }, (_, index) => index + 1);
  const generalRestaurantUrl = `${qrOrigin}/?restaurant=${encodeURIComponent(restaurantSlug)}`;
  const qrCards = qrSelection === "general"
    ? [{ label: "GENERAL QR", url: generalRestaurantUrl }]
    : qrSelection === "all"
      ? tableNumbers.map((number) => ({ label: `TABLE ${String(number).padStart(2, "0")}`, url: `${qrOrigin}/?restaurant=${encodeURIComponent(restaurantSlug)}&table=${number}` }))
      : [{ label: `TABLE ${String(Number(qrSelection)).padStart(2, "0")}`, url: `${qrOrigin}/?restaurant=${encodeURIComponent(restaurantSlug)}&table=${Number(qrSelection)}` }];

  return (
    <div className="profile-workspace">
      <form className="profile-form" onSubmit={saveProfile}>
        <section className="profile-section identity-section">
          <div className="profile-section-heading"><div><p className="eyebrow">PUBLIC IDENTITY</p><h2>Restaurant details</h2><p>These details help customers recognize and contact your restaurant.</p></div><span className="section-index">01</span></div>
          <div className="identity-fields">
            <label className="profile-logo-upload">
              {profile.logo ? <Image src={profile.logo} alt="Restaurant logo preview" width={84} height={84} unoptimized /> : <span className="logo-placeholder">LOGO</span>}
              <span className="logo-upload-copy"><strong>{profile.logo ? "Change logo" : "Add restaurant logo"}</strong><small>Square image · up to 350 KB</small><span className="upload-action">Choose image</span></span>
              <input className="visually-hidden" type="file" accept="image/*" onChange={handleLogo} />
            </label>
            <label className="profile-field profile-name-field"><span>Restaurant name <i>*</i></span><input maxLength={80} placeholder="e.g. The Green Courtyard" value={profile.name} onChange={(event) => updateProfile("name", event.target.value)} /></label>
            <label className="profile-field"><span>Contact phone</span><input autoComplete="tel" inputMode="tel" placeholder="+254 7XX XXX XXX" value={profile.phone} onChange={(event) => updateProfile("phone", event.target.value)} /></label>
            <label className="profile-field"><span>Contact email</span><input autoComplete="email" placeholder="hello@restaurant.co.ke" type="email" value={profile.email} onChange={(event) => updateProfile("email", event.target.value)} /></label>
          </div>
        </section>

        <section className="profile-section location-section">
          <div className="profile-section-heading"><div><p className="eyebrow">FIND US</p><h2>Location</h2><p>Add an address and an optional Google Maps share link.</p></div><span className="section-index">02</span></div>
          <div className="location-fields">
            <label className="profile-field"><span>Street address</span><textarea maxLength={180} placeholder="Building, street, neighborhood, city" rows={2} value={profile.address} onChange={(event) => updateProfile("address", event.target.value)} /></label>
            <label className="profile-field"><span>Google Maps link <small>Optional</small></span><input inputMode="url" placeholder="https://maps.app.goo.gl/..." type="url" value={profile.mapsUrl} onChange={(event) => updateProfile("mapsUrl", event.target.value)} /></label>
            <div className="maps-preview" aria-live="polite"><div className="map-grid" aria-hidden="true"><span className="map-road road-one" /><span className="map-road road-two" /><span className="map-road road-three" /><span className="map-pin">+</span><span className="map-neighborhood">{profile.address.split(",")[0] || "RESTAURANT LOCATION"}</span></div>{mapsHref ? <a className="maps-link" href={mapsHref} target="_blank" rel="noreferrer">Open location in Google Maps <span aria-hidden="true">↗</span></a> : <span className="maps-link is-muted">Add an address to preview the map link</span>}</div>
          </div>
        </section>

        <section className="profile-section story-section">
          <div className="profile-section-heading"><div><p className="eyebrow">YOUR STORY</p><h2>Welcome customers</h2><p>Introduce the restaurant and let people know what to try.</p></div><span className="section-index">03</span></div>
          <div className="story-fields"><label className="profile-field"><span>Welcome message</span><textarea maxLength={240} placeholder="A short welcome message for your customers" rows={3} value={profile.welcomeMessage} onChange={(event) => updateProfile("welcomeMessage", event.target.value)} /><small className="character-count">{profile.welcomeMessage.length}/240</small></label><label className="profile-field"><span>Famous dish</span><input maxLength={80} placeholder="e.g. Slow-cooked beef pilau" value={profile.famousDish} onChange={(event) => updateProfile("famousDish", event.target.value)} /></label></div>
        </section>

        <section className="profile-section gallery-section">
          <div className="profile-section-heading"><div><p className="eyebrow">PHOTO GALLERY</p><h2>Restaurant photos</h2><p>Show customers the dining room, atmosphere, and food.</p></div><span className="section-index">04</span></div>
          <div className="profile-gallery">
            {profile.photos.map((photo, index) => <div className="gallery-photo" key={`${photo.slice(0, 30)}-${index}`}><Image src={photo} alt={`Restaurant gallery photo ${index + 1}`} width={180} height={125} unoptimized /><button className="remove-photo" type="button" onClick={() => updateProfile("photos", profile.photos.filter((_, photoIndex) => photoIndex !== index))} aria-label={`Remove restaurant photo ${index + 1}`}>×</button></div>)}
            {profile.photos.length < photoLimit && <label className="gallery-add"><span>+</span><strong>Add photos</strong><small>{profile.photos.length}/{photoLimit} · up to 350 KB each</small><input className="visually-hidden" type="file" accept="image/*" multiple onChange={handlePhotos} /></label>}
          </div>
        </section>

        <section className="profile-section payment-section">
          <div className="profile-section-heading"><div><p className="eyebrow">GET PAID</p><h2>M-Pesa details</h2><p>Choose the payment option customers should use.</p></div><span className="section-index">05</span></div>
          <fieldset className="payment-methods"><legend>Payment method</legend>{paymentMethods.map((method) => <label className={`payment-method${profile.paymentMethod === method ? " is-selected" : ""}`} key={method}><input type="radio" name="payment-method" value={method} checked={profile.paymentMethod === method} onChange={() => updateProfile("paymentMethod", method)} /><span>{method}</span></label>)}</fieldset>
          <label className="profile-field payment-number-field"><span>{profile.paymentMethod === "Paybill" ? "Paybill number" : profile.paymentMethod === "Till number" ? "Till number" : profile.paymentMethod === "Pochi la Biashara" ? "Pochi phone number" : "M-Pesa phone number"}</span><input autoComplete="off" inputMode="tel" placeholder={profile.paymentMethod === "Paybill" ? "Business number" : "e.g. 1234567 or +254 7XX XXX XXX"} value={profile.paymentNumber} onChange={(event) => updateProfile("paymentNumber", event.target.value)} /></label>
          <p className="sensitive-data-note"><span>i</span>Payment details are only saved in this browser preview. Do not use this for live payments until secure database storage is connected.</p>
        </section>

        <section className="profile-section tables-section">
          <div className="profile-section-heading"><div><p className="eyebrow">IN-RESTAURANT SERVICE</p><h2>Tables &amp; QR codes</h2><p>Set the number of tables and generate a customer link for each one.</p></div><span className="section-index">06</span></div>
          <div className="table-setup-row"><label className="profile-field table-count-field"><span>Total tables</span><input min="1" max="200" type="number" value={profile.tableCount} onChange={(event) => updateProfile("tableCount", Number(event.target.value))} /></label><div className="table-setup-hint"><strong>{profile.tableCount} table links</strong><span>Each code opens the customer page with its table number.</span></div><button className="secondary-button generate-qr-button" type="button" disabled={profile.tableCount < 1 || profile.tableCount > 200} onClick={() => { setQrSelection("all"); setQrOpen(true); }}>Generate QR codes <span aria-hidden="true">↗</span></button></div>
        </section>

        <section className="profile-section account-section">
          <div className="profile-section-heading"><div><p className="eyebrow">ACCOUNT &amp; PLAN</p><h2>Password &amp; subscription</h2><p>These account actions need server-side authentication and billing setup.</p></div><span className="section-index">07</span></div>
          <div className="account-actions-grid"><div className="account-action-card"><div><strong>Admin password</strong><span>Not connected</span><p>Password changes will be enabled after secure authentication is configured.</p></div><button className="secondary-button" type="button" disabled>Change password</button></div><div className="account-action-card"><div><strong>Restaurant plan</strong><span>Billing not connected</span><p>Subscription and payment options will appear here when billing is set up.</p></div><button className="secondary-button" type="button" disabled>Manage plan</button></div></div>
        </section>

        {error && <p className="profile-error" role="alert">{error}</p>}
        <div className="profile-savebar"><div>{saved ? <span className="save-confirmation">Profile saved in this browser</span> : <span>Unsaved changes stay on this page until saved.</span>}</div><div><button className="secondary-button" type="button" disabled={saved} onClick={discardChanges}>Discard</button><button className="primary-button" type="submit">Save profile</button></div></div>
      </form>

      {qrOpen && (
        <div className="modal-backdrop qr-modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setQrOpen(false)}>
          <section className="qr-dialog" role="dialog" aria-modal="true" aria-labelledby="qr-dialog-title">
            <div className="qr-dialog-heading"><div><p className="eyebrow">TABLE SERVICE</p><h2 id="qr-dialog-title">Table QR codes</h2><p>Scan a code to open the customer page for that table.</p></div><button className="dialog-close" type="button" aria-label="Close QR codes" onClick={() => setQrOpen(false)}>×</button></div>
            <div className="qr-toolbar"><label className="qr-select-field"><span>Show</span><select value={qrSelection} onChange={(event) => setQrSelection(event.target.value)}><option value="general">Restaurant general link</option><option value="all">All {tableNumbers.length} tables</option>{tableNumbers.map((number) => <option value={number} key={number}>Table {number}</option>)}</select></label><button className="secondary-button" type="button" onClick={() => window.print()}>Print codes</button></div>
            <div className="qr-grid">{qrCards.map((card) => <article className="qr-table-card" key={card.label}><QRCodeSVG value={card.url} size={112} level="M" includeMargin /><strong>{card.label}</strong><span>{card.url}</span></article>)}</div>
          </section>
        </div>
      )}
    </div>
  );
}