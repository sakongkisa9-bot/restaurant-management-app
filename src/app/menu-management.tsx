"use client";

import Image from "next/image";
import { useMemo, useState, type ChangeEvent, type FormEvent } from "react";

export type MenuItem = {
  id: string;
  name: string;
  price: number;
  description: string;
  image: string;
  images?: string[];
  specifications?: string[];
  available?: boolean;
  rating?: number;
  ratingCount?: number;
  category: string;
  mealPeriod: string;
  orderCount: number;
};

type EditableFields = Omit<MenuItem, "id" | "orderCount">;
type MenuManagementProps = {
  items: MenuItem[];
  onAddItem: (item: Omit<MenuItem, "id">) => Promise<MenuItem>;
  onSaveItems: (items: MenuItem[]) => Promise<void>;
  onDeleteItem: (id: string) => Promise<void>;
};

const categories = ["Mains", "Sides", "Drinks", "Desserts", "Other"];
const mealPeriods = ["Breakfast", "Lunch", "Dinner"];

function editableFields(item: MenuItem): EditableFields {
  return {
    name: item.name,
    price: item.price,
    description: item.description,
    image: item.image,
    images: item.images ?? (item.image ? [item.image] : []),
    specifications: item.specifications ?? [],
    category: item.category,
    mealPeriod: item.mealPeriod,
  };
}

export function MenuManagement({ items, onAddItem, onSaveItems, onDeleteItem }: MenuManagementProps) {
  const [view, setView] = useState<"list" | "add">("list");
  const [editingIds, setEditingIds] = useState<Set<string>>(new Set());
  const [drafts, setDrafts] = useState<Record<string, EditableFields>>({});
  const [showAllBest, setShowAllBest] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [specificationInput, setSpecificationInput] = useState("");
  const [foodForm, setFoodForm] = useState({
    name: "",
    price: "",
    description: "",
    image: "",
    images: [] as string[],
    specifications: [] as string[],
    category: categories[0],
    mealPeriod: mealPeriods[1],
  });

  const rankedItems = useMemo(
    () => [...items].sort((left, right) => right.orderCount - left.orderCount || left.name.localeCompare(right.name)),
    [items],
  );
  const topSeller = rankedItems.find((item) => item.orderCount > 0);

  function beginEdit(item: MenuItem) {
    setDrafts((current) => ({ ...current, [item.id]: editableFields(item) }));
    setEditingIds((current) => new Set(current).add(item.id));
    setError("");
  }

  function beginEditAll() {
    setDrafts((current) => ({ ...current, ...Object.fromEntries(items.map((item) => [item.id, editableFields(item)])) }));
    setEditingIds(new Set(items.map((item) => item.id)));
    setError("");
  }

  function updateDraft(item: MenuItem, field: keyof EditableFields, value: string | number) {
    setDrafts((current) => ({
      ...current,
      [item.id]: { ...(current[item.id] ?? editableFields(item)), [field]: value },
    }));
  }

  function validateFields(fields: EditableFields) {
    if (!fields.name.trim()) return "Add a food name before saving.";
    if (!Number.isFinite(fields.price) || fields.price <= 0) return "Enter a price greater than zero.";
    return "";
  }

  async function saveOne(item: MenuItem) {
    const fields = drafts[item.id] ?? editableFields(item);
    const validationError = validateFields(fields);
    if (validationError) {
      setError(validationError);
      return;
    }

    setSaving(true);
    try {
      await onSaveItems([{ ...item, ...fields, name: fields.name.trim() }]);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not save this menu item.");
      return;
    } finally {
      setSaving(false);
    }
    setEditingIds((current) => {
      const next = new Set(current);
      next.delete(item.id);
      return next;
    });
    setDrafts((current) => {
      const next = { ...current };
      delete next[item.id];
      return next;
    });
    setError("");
  }

  async function saveAll() {
    const editedItems = items.filter((item) => editingIds.has(item.id));
    for (const item of editedItems) {
      const validationError = validateFields(drafts[item.id] ?? editableFields(item));
      if (validationError) {
        setError(`${item.name || "A menu item"}: ${validationError}`);
        return;
      }
    }

    setSaving(true);
    try {
      await onSaveItems(editedItems.map((item) => ({ ...item, ...(drafts[item.id] ?? editableFields(item)) })));
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not save menu items.");
      return;
    } finally {
      setSaving(false);
    }
    setEditingIds(new Set());
    setDrafts({});
    setError("");
  }

  function handleImageChange(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (!files.length) return;
    if (foodForm.images.length + files.length > 4) {
      setError("Add up to 4 food photos.");
      return;
    }
    if (files.some((file) => !file.type.startsWith("image/"))) {
      setError("Choose an image file.");
      return;
    }
    if (files.some((file) => file.size > 350 * 1024)) {
      setError("Food photos must be 350 KB or smaller in this browser preview.");
      return;
    }

    Promise.all(files.map((file) => new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.addEventListener("load", () => typeof reader.result === "string" ? resolve(reader.result) : reject(new Error("Could not read image.")));
      reader.addEventListener("error", () => reject(new Error("Could not read image.")));
      reader.readAsDataURL(file);
    }))).then((images) => {
      setFoodForm((current) => {
        const nextImages = [...current.images, ...images];
        return { ...current, images: nextImages, image: nextImages[0] ?? "" };
      });
      setError("");
    }).catch(() => {
      setError("We couldn’t read one of those photos. Try another image.");
    });
  }

  function addSpecification() {
    const value = specificationInput.trim();
    if (!value) return;
    if (foodForm.specifications.some((item) => item.toLowerCase() === value.toLowerCase())) {
      setError("That specification option has already been added.");
      return;
    }
    setFoodForm((current) => ({ ...current, specifications: [...current.specifications, value] }));
    setSpecificationInput("");
    setError("");
  }

  function removeFoodImage(index: number) {
    setFoodForm((current) => {
      const images = current.images.filter((_, imageIndex) => imageIndex !== index);
      return { ...current, images, image: images[0] ?? "" };
    });
  }

  function removeSpecification(value: string) {
    setFoodForm((current) => ({ ...current, specifications: current.specifications.filter((item) => item !== value) }));
  }

  async function addFood(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const price = Number(foodForm.price);
    if (!foodForm.name.trim()) {
      setError("Enter a food name.");
      return;
    }
    if (!Number.isFinite(price) || price <= 0) {
      setError("Enter a price greater than zero.");
      return;
    }

    setSaving(true);
    try {
      await onAddItem({
        name: foodForm.name.trim(),
        price,
        description: foodForm.description.trim(),
        image: foodForm.images[0] ?? "",
        images: foodForm.images,
        specifications: foodForm.specifications,
        available: true,
        rating: 0,
        ratingCount: 0,
        category: foodForm.category,
        mealPeriod: foodForm.mealPeriod,
        orderCount: 0,
      });
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not add this menu item.");
      return;
    } finally {
      setSaving(false);
    }
    setFoodForm({ name: "", price: "", description: "", image: "", images: [], specifications: [], category: categories[0], mealPeriod: mealPeriods[1] });
    setError("");
    setView("list");
  }

  async function deleteItem(item: MenuItem) {
    if (!window.confirm(`Delete ${item.name} from the menu?`)) return;
    setSaving(true);
    try {
      await onDeleteItem(item.id);
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Could not delete this menu item.");
      return;
    } finally {
      setSaving(false);
    }
    setEditingIds((current) => {
      const next = new Set(current);
      next.delete(item.id);
      return next;
    });
    setDrafts((current) => {
      const next = { ...current };
      delete next[item.id];
      return next;
    });
  }

  return (
    <div className="menu-workspace">
      {view === "add" ? (
        <section className="menu-form-panel">
          <div className="menu-form-heading">
            <div><p className="eyebrow">MENU MANAGEMENT / NEW ITEM</p><h2>Add new food</h2><p className="menu-panel-copy">Add a dish to the restaurant menu.</p></div>
            <button className="secondary-button" type="button" onClick={() => { setError(""); setView("list"); }}>Back to menu</button>
          </div>
          <form className="food-form" onSubmit={addFood}>
            <label className="food-image-upload">
              {foodForm.images[0] ? <Image src={foodForm.images[0]} alt="Food preview" width={120} height={90} unoptimized /> : <span className="upload-mark">+</span>}
              <span><strong>{foodForm.images.length ? "Add another food photo" : "Add food photos"}</strong><small>{foodForm.images.length}/4 photos · up to 350 KB each</small></span>
              <input className="visually-hidden" type="file" accept="image/*" multiple onChange={handleImageChange} />
            </label>
            {foodForm.images.length > 0 && <div className="food-image-previews">{foodForm.images.map((image, index) => <div className="food-image-preview" key={`${image.slice(0, 30)}-${index}`}><Image src={image} alt={`Food photo ${index + 1}`} width={70} height={58} unoptimized /><button type="button" aria-label={`Remove food photo ${index + 1}`} onClick={() => removeFoodImage(index)}>×</button></div>)}</div>}
            <div className="food-form-fields">
              <label className="menu-field menu-field-wide"><span>Food name</span><input autoFocus maxLength={80} placeholder="e.g. Swahili chicken pilau" value={foodForm.name} onChange={(event) => setFoodForm((current) => ({ ...current, name: event.target.value }))} /></label>
              <label className="menu-field"><span>Price <small>KSh</small></span><input inputMode="decimal" min="1" placeholder="0" type="number" value={foodForm.price} onChange={(event) => setFoodForm((current) => ({ ...current, price: event.target.value }))} /></label>
              <label className="menu-field"><span>Category</span><select value={foodForm.category} onChange={(event) => setFoodForm((current) => ({ ...current, category: event.target.value }))}>{categories.map((category) => <option key={category}>{category}</option>)}</select></label>
              <label className="menu-field"><span>Meal period</span><select value={foodForm.mealPeriod} onChange={(event) => setFoodForm((current) => ({ ...current, mealPeriod: event.target.value }))}>{mealPeriods.map((meal) => <option key={meal}>{meal}</option>)}</select></label>
              <label className="menu-field menu-field-wide"><span>Short description</span><textarea maxLength={180} placeholder="Describe the dish in a few words" rows={3} value={foodForm.description} onChange={(event) => setFoodForm((current) => ({ ...current, description: event.target.value }))} /></label>
              <div className="menu-field menu-field-wide specification-field"><span>Customer specifications <small>Optional · e.g. Hot, Cold</small></span><div className="specification-entry"><input aria-label="Specification option" maxLength={32} placeholder="Add an option" value={specificationInput} onChange={(event) => setSpecificationInput(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); addSpecification(); } }} /><button className="secondary-button" type="button" onClick={addSpecification}>Add option</button></div>{foodForm.specifications.length > 0 && <div className="specification-chips">{foodForm.specifications.map((specification) => <span key={specification}>{specification}<button type="button" onClick={() => removeSpecification(specification)} aria-label={`Remove ${specification}`}>×</button></span>)}</div>}</div>
            </div>
            {error && <p className="menu-error" role="alert">{error}</p>}
            <div className="food-form-actions"><button className="secondary-button" type="button" disabled={saving} onClick={() => { setError(""); setView("list"); }}>Cancel</button><button className="primary-button" type="submit" disabled={saving}>{saving ? "Saving…" : "Save food"}</button></div>
          </form>
        </section>
      ) : (
        <>
          <section className="menu-list-panel">
            <div className="menu-panel-heading">
              <div><p className="eyebrow">MENU MANAGEMENT</p><h2>Menu list <span className="menu-count">{items.length}</span></h2><p className="menu-panel-copy">Manage the dishes customers can see.</p></div>
              <div className="menu-bulk-actions"><button className="secondary-button" type="button" disabled={items.length === 0 || saving} onClick={beginEditAll}>Edit all</button><button className="primary-button" type="button" disabled={editingIds.size === 0 || saving} onClick={saveAll}>{saving ? "Saving…" : "Save all"}</button></div>
            </div>
            {error && <p className="menu-error" role="alert">{error}</p>}
            {items.length === 0 ? (
              <div className="menu-empty-state"><span className="empty-icon">M</span><strong>Your menu starts here</strong><p>Add dishes and they will appear on the customer page.</p></div>
            ) : (
              <div className="menu-table-wrap">
                <div className="menu-table-head"><span>Food</span><span>Category / meal</span><span>Price</span><span>Actions</span></div>
                {items.map((item) => {
                  const isEditing = editingIds.has(item.id);
                  const draft = drafts[item.id] ?? editableFields(item);
                  return (
                    <div className={`menu-row${isEditing ? " is-editing" : ""}`} key={item.id}>
                      <div className="menu-food-cell">
                        {draft.image ? <Image className="menu-food-thumb" src={draft.image} alt="" width={48} height={44} unoptimized /> : <span className="menu-food-thumb menu-thumb-placeholder">{draft.name.slice(0, 1).toUpperCase() || "M"}</span>}
                        <div className="menu-food-details">
                          {isEditing ? <input aria-label={`${item.name} food name`} className="row-input row-name-input" maxLength={80} value={draft.name} onChange={(event) => updateDraft(item, "name", event.target.value)} /> : <strong>{item.name}</strong>}
                          {isEditing ? <input aria-label={`${item.name} description`} className="row-input row-description-input" maxLength={180} value={draft.description} onChange={(event) => updateDraft(item, "description", event.target.value)} /> : <span>{item.description || "No description"}</span>}
                        </div>
                      </div>
                      <div className="menu-tags-cell">
                        {isEditing ? <><select aria-label={`${item.name} category`} className="row-select" value={draft.category} onChange={(event) => updateDraft(item, "category", event.target.value)}>{categories.map((category) => <option key={category}>{category}</option>)}</select><select aria-label={`${item.name} meal period`} className="row-select" value={draft.mealPeriod} onChange={(event) => updateDraft(item, "mealPeriod", event.target.value)}>{mealPeriods.map((meal) => <option key={meal}>{meal}</option>)}</select></> : <><span className="menu-category-tag">{item.category}</span><span className="menu-meal-tag">{item.mealPeriod}</span></>}
                      </div>
                      <div className="menu-price-cell">{isEditing ? <label className="price-edit-field"><span>KSh</span><input aria-label={`${item.name} price`} className="row-input row-price-input" inputMode="decimal" min="1" type="number" value={draft.price} onChange={(event) => updateDraft(item, "price", Number(event.target.value))} /></label> : <strong>KSh {item.price.toLocaleString("en-KE")}</strong>}</div>
                      <div className="menu-row-actions"><button className="row-action" type="button" onClick={() => beginEdit(item)} disabled={isEditing || saving} aria-label={`Edit ${item.name}`} title="Edit">Edit</button><button className="row-action save-row-action" type="button" onClick={() => saveOne(item)} disabled={!isEditing || saving} aria-label={`Save ${item.name}`} title="Save">Save</button><button className="row-action delete-row-action" type="button" onClick={() => deleteItem(item)} disabled={saving} aria-label={`Delete ${item.name}`} title="Delete">Delete</button></div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          <div className="add-food-row"><span>Ready to expand the menu?</span><button className="primary-button" type="button" onClick={() => { setFoodForm({ name: "", price: "", description: "", image: "", images: [], specifications: [], category: categories[0], mealPeriod: mealPeriods[1] }); setError(""); setView("add"); }}><span className="button-symbol">+</span> Add new food</button></div>

          <section className="panel menu-best-panel">
            <div className="section-heading"><div><p className="eyebrow">ORDER TRENDS</p><h2>Best foods</h2></div><button className="text-button" type="button" disabled={items.length === 0} onClick={() => setShowAllBest((current) => !current)}>{showAllBest ? "Show top three" : "View all"} <span aria-hidden="true">→</span></button></div>
            {topSeller ? (
              <div className="best-food-list">{rankedItems.filter((item) => item.orderCount > 0).slice(0, showAllBest ? undefined : 3).map((item, index) => <div className="best-food-row" key={item.id}><span className="best-food-rank">{String(index + 1).padStart(2, "0")}</span><div><strong>{item.name}</strong><span>{item.category} · {item.mealPeriod}</span></div><strong className="best-food-orders">{item.orderCount} orders</strong></div>)}</div>
            ) : (
              <div className="empty-list-state menu-best-empty"><span className="empty-icon">01</span><div><strong>No best sellers yet</strong><p>Food rankings will appear when order activity is connected.</p></div></div>
            )}
          </section>

          <section className="menu-recommendation-panel">
            <div className="recommendation-icon">↗</div><div><p className="eyebrow">SUPPLY RECOMMENDATION</p><h2>{topSeller ? `Consider preparing more ${topSeller.name}.` : "Recommendations will appear here."}</h2><p>{topSeller ? `${topSeller.name} is currently the most ordered dish, with ${topSeller.orderCount} orders.` : "Once orders are connected, this panel will use popular dishes to suggest what to prepare more of."}</p></div><span className="recommendation-status">{topSeller ? "ORDER-LED" : "AWAITING ORDERS"}</span>
          </section>
          <p className="local-data-note">Menu changes are saved in this browser for now. Shared restaurant storage will be connected later.</p>
        </>
      )}
    </div>
  );
}
