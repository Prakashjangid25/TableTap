import { db } from './firebase';
import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  addDoc
} from 'firebase/firestore';

// Hardcoded premium seed data
export const SEED_RESTAURANTS = [
  {
    id: "gourmet_garden",
    name: "Gourmet Garden",
    description: "Elegant green bistro offering organic salads, artisanal sourdough pizzas, and cold-pressed mocktails.",
    logoUrl: "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&q=80&w=200",
    themeColor: "#10b981",
    taxRate: 5,
    status: "active",
    subscriptionStatus: "active",
    subscriptionExpiry: "2027-12-31",
    planName: "Premium Unlimited",
    address: "7A, Green Avenue, Ballygunge, Kolkata",
    contact: "+91 98300 12345",
    createdAt: "2026-01-01T00:00:00.000Z"
  },
  {
    id: "spicy_tadka",
    name: "Spicy Tadka",
    description: "Vibrant royal diner offering rich traditional curries, aromatic tandoori breads, and refreshing mango shakes.",
    logoUrl: "https://images.unsplash.com/photo-1589301760014-d929f3979dbc?auto=format&fit=crop&q=80&w=200",
    themeColor: "#f43f5e",
    taxRate: 5,
    status: "active",
    subscriptionStatus: "active",
    subscriptionExpiry: "2027-12-31",
    planName: "Premium Unlimited",
    address: "14, Sector 5, Salt Lake, Kolkata",
    contact: "+91 98311 54321",
    createdAt: "2026-01-01T00:00:00.000Z"
  }
];

export const SEED_CATEGORIES = {
  gourmet_garden: [
    { id: "gg_cat_starters", restaurantId: "gourmet_garden", name: "Starters & Greens", order: 1 },
    { id: "gg_cat_mains", restaurantId: "gourmet_garden", name: "Artisanal Mains", order: 2 },
    { id: "gg_cat_desserts", restaurantId: "gourmet_garden", name: "Sweet Endings", order: 3 },
    { id: "gg_cat_beverages", restaurantId: "gourmet_garden", name: "Signature Drinks", order: 4 }
  ],
  spicy_tadka: [
    { id: "st_cat_starters", restaurantId: "spicy_tadka", name: "Tandoori Appetizers", order: 1 },
    { id: "st_cat_mains", restaurantId: "spicy_tadka", name: "Curry Specialties", order: 2 },
    { id: "st_cat_breads", restaurantId: "spicy_tadka", name: "Breads & Rice", order: 3 },
    { id: "st_cat_beverages", restaurantId: "spicy_tadka", name: "Dessert & Shakes", order: 4 }
  ]
};

export const SEED_PRODUCTS = {
  gourmet_garden: [
    { id: "gg_prod_truffle", restaurantId: "gourmet_garden", categoryId: "gg_cat_starters", name: "Truffle Parmesan Fries", description: "Crispy skin-on potatoes tossed in white truffle oil, rosemary, and aged parmesan.", price: 249, imageUrl: "https://images.unsplash.com/photo-1573080496219-bb080dd4f877?auto=format&fit=crop&q=80&w=400", isAvailable: true, isSpecial: false, isPopular: true },
    { id: "gg_prod_avocado", restaurantId: "gourmet_garden", categoryId: "gg_cat_starters", name: "Smashed Avocado Toast", description: "Freshly smashed Hass avocados on toasted artisanal sourdough, topped with organic cherry tomatoes and feta.", price: 349, imageUrl: "https://images.unsplash.com/photo-1541532713592-79a0317b6b77?auto=format&fit=crop&q=80&w=400", isAvailable: true, isSpecial: false, isPopular: false },
    { id: "gg_prod_pizza", restaurantId: "gourmet_garden", categoryId: "gg_cat_mains", name: "Pesto Mozzarella Pizza", description: "Housemade walnut pesto, fresh bocconcini mozzarella, roasted cherry tomatoes, and garden fresh arugula.", price: 549, imageUrl: "https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&q=80&w=400", isAvailable: true, isSpecial: true, isPopular: true },
    { id: "gg_prod_risotto", restaurantId: "gourmet_garden", categoryId: "gg_cat_mains", name: "Porcini Mushroom Risotto", description: "Creamy Arborio rice slow-cooked with fresh porcini and shiitake mushrooms, finished with parmigiano reggiano.", price: 629, imageUrl: "https://images.unsplash.com/photo-1476124369491-e7addf5db371?auto=format&fit=crop&q=80&w=400", isAvailable: true, isSpecial: false, isPopular: false },
    { id: "gg_prod_cake", restaurantId: "gourmet_garden", categoryId: "gg_cat_desserts", name: "Molten Lava Chocolate Cake", description: "Decadent dark chocolate cake with a gooey warm liquid chocolate core, served with vanilla bean gelato.", price: 299, imageUrl: "https://images.unsplash.com/photo-1606313564200-e75d5e30476c?auto=format&fit=crop&q=80&w=400", isAvailable: true, isSpecial: false, isPopular: true },
    { id: "gg_prod_mojito", restaurantId: "gourmet_garden", categoryId: "gg_cat_beverages", name: "Garden Mint Mojito", description: "Refreshing blend of muddled garden mint, fresh key lime juice, organic cane sugar, and sparkling soda.", price: 189, imageUrl: "https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?auto=format&fit=crop&q=80&w=400", isAvailable: true, isSpecial: true, isPopular: false }
  ],
  spicy_tadka: [
    { id: "st_prod_paneer", restaurantId: "spicy_tadka", categoryId: "st_cat_starters", name: "Tandoori Paneer Tikka", description: "Cubes of fresh cottage cheese marinated in spiced tandoori yogurt, bell peppers, charcoal charred.", price: 329, imageUrl: "https://images.unsplash.com/photo-1567188040759-fb8a883dc6d8?auto=format&fit=crop&q=80&w=400", isAvailable: true, isSpecial: false, isPopular: true },
    { id: "st_prod_butter", restaurantId: "spicy_tadka", categoryId: "st_cat_mains", name: "Butter Chicken Classic", description: "Clay-oven cooked chicken tikka strips simmered in velvety smooth, butter-infused tomato gravy.", price: 489, imageUrl: "https://images.unsplash.com/photo-1603894584373-5ac82b2ae398?auto=format&fit=crop&q=80&w=400", isAvailable: true, isSpecial: true, isPopular: true },
    { id: "st_prod_dal", restaurantId: "spicy_tadka", categoryId: "st_cat_mains", name: "Slow-Cooked Dal Makhani", description: "Whole black urad lentils and red kidney beans slow-cooked overnight with cream, butter, and mild spices.", price: 349, imageUrl: "https://images.unsplash.com/photo-1546833999-b9f581a1996d?auto=format&fit=crop&q=80&w=400", isAvailable: true, isSpecial: false, isPopular: false },
    { id: "st_prod_naan", restaurantId: "spicy_tadka", categoryId: "st_cat_breads", name: "Butter Garlic Naan", description: "Tandoor baked soft flatbread infused with fresh minced garlic cloves and brushed with warm butter.", price: 89, imageUrl: "https://images.unsplash.com/photo-1601050690597-df056fb4ce78?auto=format&fit=crop&q=80&w=400", isAvailable: true, isSpecial: false, isPopular: true },
    { id: "st_prod_lassi", restaurantId: "spicy_tadka", categoryId: "st_cat_beverages", name: "Mango Lassi Royale", description: "Creamy traditional sweet yogurt shake blended with premium Alphonso mangoes, garnished with pistachios.", price: 149, imageUrl: "https://images.unsplash.com/photo-1534353436294-0dbd4bdac845?auto=format&fit=crop&q=80&w=400", isAvailable: true, isSpecial: true, isPopular: false }
  ]
};

export const SEED_TABLES = {
  gourmet_garden: [
    { id: "gg_tbl_1", restaurantId: "gourmet_garden", tableName: "Table 1 (Garden View)" },
    { id: "gg_tbl_2", restaurantId: "gourmet_garden", tableName: "Table 2 (Window Side)" },
    { id: "gg_tbl_3", restaurantId: "gourmet_garden", tableName: "Table 3 (Bonsai Corner)" },
    { id: "gg_tbl_4", restaurantId: "gourmet_garden", tableName: "Table 4 (VIP Booth)" }
  ],
  spicy_tadka: [
    { id: "st_tbl_1", restaurantId: "spicy_tadka", tableName: "Table 1 (Royal Court)" },
    { id: "st_tbl_2", restaurantId: "spicy_tadka", tableName: "Table 2 (Maharaja Sofa)" },
    { id: "st_tbl_3", restaurantId: "spicy_tadka", tableName: "Table 3 (Tandoor View)" }
  ]
};

export const SEED_COUPONS = {
  gourmet_garden: [
    { id: "gg_cp_save10", restaurantId: "gourmet_garden", code: "SAVE10", discountType: "percent", discountValue: 10, minOrderAmount: 499, isActive: true },
    { id: "gg_cp_flat100", restaurantId: "gourmet_garden", code: "WELCOME100", discountType: "fixed", discountValue: 100, minOrderAmount: 999, isActive: true }
  ],
  spicy_tadka: [
    { id: "st_cp_festive", restaurantId: "spicy_tadka", code: "FESTIVE15", discountType: "percent", discountValue: 15, minOrderAmount: 599, isActive: true }
  ]
};

export const SEED_PLANS = [
  {
    id: "plan_lite",
    name: "Standard Bistro",
    monthlyPrice: 1999,
    yearlyPrice: 19990,
    restaurantLimit: 1,
    staffLimit: 5,
    orderLimit: 1000,
    durationMonths: 1,
    features: ["Digital QR Menu", "Kitchen Display (KDS)", "Staff Accounts", "Basic Analytics"],
    isActive: true,
    createdAt: "2026-01-01T00:00:00.000Z"
  },
  {
    id: "plan_pro",
    name: "Enterprise Dine",
    monthlyPrice: 4999,
    yearlyPrice: 49990,
    restaurantLimit: 5,
    staffLimit: 20,
    orderLimit: 5000,
    durationMonths: 1,
    features: ["Multiple Outlets", "Advance KDS", "Promo & Coupons Engine", "Tax Configuration", "SaaS Custom Branding"],
    isActive: true,
    createdAt: "2026-01-01T00:00:00.000Z"
  }
];

// In-Memory Database State for absolute reliability fallback
const loadFromStorage = (key, defaultVal) => {
  try {
    const val = localStorage.getItem(`tabletap_${key}`);
    return val ? JSON.parse(val) : defaultVal;
  } catch {
    return defaultVal;
  }
};

const saveToStorage = (key, val) => {
  try {
    localStorage.setItem(`tabletap_${key}`, JSON.stringify(val));
  } catch (e) {
    console.error(e);
  }
};

let memRestaurants = loadFromStorage("restaurants", SEED_RESTAURANTS);
let memCategories = loadFromStorage("categories", SEED_CATEGORIES);
let memProducts = loadFromStorage("products", SEED_PRODUCTS);
let memTables = loadFromStorage("tables", SEED_TABLES);
let memCoupons = loadFromStorage("coupons", SEED_COUPONS);
let memOrders = loadFromStorage("orders", []);
let memPlans = loadFromStorage("subscriptionPlans", SEED_PLANS);

// Initialize / Sync with Firestore if possible
export async function seedDatabaseIfEmpty() {
  try {
    // 0. Seed Super Admin Security Key
    const systemSettingsRef = doc(db, "system", "settings");
    const systemSettingsSnap = await getDoc(systemSettingsRef);
    if (!systemSettingsSnap.exists()) {
      console.log("Seeding system settings with Super Admin security key...");
      await setDoc(systemSettingsRef, {
        superAdminSecurityKey: "PRAKASH-2002-07-25"
      });
    } else {
      const systemSettingsData = systemSettingsSnap.data();
      if (systemSettingsData.superAdminSecurityKey !== "PRAKASH-2002-07-25") {
        console.log("Updating superAdminSecurityKey in system settings...");
        await setDoc(systemSettingsRef, {
          ...systemSettingsData,
          superAdminSecurityKey: "PRAKASH-2002-07-25"
        }, { merge: true });
      }
    }

    // 1. Seed Subscription Plans
    const plansColl = collection(db, "subscriptionPlans");
    const plansSnap = await getDocs(plansColl);
    if (plansSnap.empty) {
      console.log("Firestore subscriptionPlans empty. Seeding plans...");
      for (const plan of SEED_PLANS) {
        await setDoc(doc(db, "subscriptionPlans", plan.id), plan);
      }
    }

    // 2. Seed Restaurants and associated collections
    const restColl = collection(db, "restaurants");
    const snapshot = await getDocs(restColl);
    if (snapshot.empty) {
      console.log("Firestore empty. Seeding data...");
      for (const rest of SEED_RESTAURANTS) {
        await setDoc(doc(db, "restaurants", rest.id), rest);

        // Seed categories
        const cats = SEED_CATEGORIES[rest.id] || [];
        for (const cat of cats) {
          await setDoc(doc(db, "restaurants", rest.id, "categories", cat.id), {
            id: cat.id,
            restaurantId: rest.id,
            name: cat.name,
            order: cat.order,
            createdAt: new Date().toISOString()
          });
        }

        // Seed products
        const prods = SEED_PRODUCTS[rest.id] || [];
        for (const prod of prods) {
          await setDoc(doc(db, "restaurants", rest.id, "products", prod.id), {
            id: prod.id,
            restaurantId: rest.id,
            categoryId: prod.categoryId,
            name: prod.name,
            description: prod.description,
            price: prod.price,
            imageUrl: prod.imageUrl,
            isAvailable: prod.isAvailable,
            isSpecial: prod.isSpecial,
            isPopular: prod.isPopular,
            createdAt: new Date().toISOString()
          });
        }

        // Seed tables
        const tbls = SEED_TABLES[rest.id] || [];
        for (const tbl of tbls) {
          await setDoc(doc(db, "restaurants", rest.id, "tables", tbl.id), {
            id: tbl.id,
            restaurantId: rest.id,
            tableName: tbl.tableName,
            createdAt: new Date().toISOString()
          });
        }

        // Seed coupons
        const cpn = SEED_COUPONS[rest.id] || [];
        for (const cp of cpn) {
          await setDoc(doc(db, "restaurants", rest.id, "coupons", cp.id), {
            id: cp.id,
            restaurantId: rest.id,
            code: cp.code,
            discountType: cp.discountType,
            discountValue: cp.discountValue,
            minOrderAmount: cp.minOrderAmount,
            isActive: cp.isActive,
            createdAt: new Date().toISOString()
          });
        }
      }
      console.log("Seeding complete!");
    }
  } catch (error) {
    console.error("Firebase seeding bypassed (will run in reliable memory mode):", error);
  }
}

// RESTAURANTS
export async function getRestaurants() {
  try {
    const snapshot = await getDocs(collection(db, "restaurants"));
    if (snapshot.empty) {
      await seedDatabaseIfEmpty();
      const retrySnapshot = await getDocs(collection(db, "restaurants"));
      if (!retrySnapshot.empty) {
        const results = retrySnapshot.docs.map(doc => doc.data());
        memRestaurants = results;
        saveToStorage("restaurants", memRestaurants);
        return results;
      }
    } else {
      const results = snapshot.docs.map(doc => doc.data());
      memRestaurants = results;
      saveToStorage("restaurants", memRestaurants);
      return results;
    }
  } catch (e) {
    console.warn("Firestore error, falling back to local memory", e);
  }
  return memRestaurants;
}

export async function getRestaurant(id) {
  try {
    const docRef = doc(db, "restaurants", id);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      return snap.data();
    }
  } catch (e) {
    console.warn("Firestore error", e);
  }
  return memRestaurants.find(r => r.id === id) || null;
}

export async function createRestaurant(restaurant) {
  try {
    await setDoc(doc(db, "restaurants", restaurant.id), restaurant);
  } catch (e) {
    console.warn("Firestore error", e);
  }
  const index = memRestaurants.findIndex(r => r.id === restaurant.id);
  if (index >= 0) {
    memRestaurants[index] = restaurant;
  } else {
    memRestaurants.push(restaurant);
  }
  saveToStorage("restaurants", memRestaurants);
  return restaurant;
}

export async function updateRestaurant(restaurantId, data) {
  try {
    await updateDoc(doc(db, "restaurants", restaurantId), data);
  } catch (e) {
    console.warn("Firestore error", e);
  }
  const index = memRestaurants.findIndex(r => r.id === restaurantId);
  if (index >= 0) {
    memRestaurants[index] = { ...memRestaurants[index], ...data };
    saveToStorage("restaurants", memRestaurants);
  }
  return true;
}

export async function deleteRestaurant(restaurantId) {
  try {
    await deleteDoc(doc(db, "restaurants", restaurantId));
  } catch (e) {
    console.warn("Firestore error", e);
  }
  memRestaurants = memRestaurants.filter(r => r.id !== restaurantId);
  saveToStorage("restaurants", memRestaurants);
  return true;
}

// CATEGORIES
export async function getCategories(restaurantId) {
  try {
    const snapshot = await getDocs(collection(db, "restaurants", restaurantId, "categories"));
    if (!snapshot.empty) {
      const list = snapshot.docs.map(d => d.data());
      memCategories[restaurantId] = list.sort((a, b) => (a.order || 0) - (b.order || 0));
      saveToStorage("categories", memCategories);
      return memCategories[restaurantId];
    }
  } catch (e) {
    console.warn("Firestore error", e);
  }
  return memCategories[restaurantId] || [];
}

export async function createCategory(restaurantId, category) {
  try {
    await setDoc(doc(db, "restaurants", restaurantId, "categories", category.id), category);
  } catch (e) {
    console.warn("Firestore error", e);
  }
  if (!memCategories[restaurantId]) memCategories[restaurantId] = [];
  const idx = memCategories[restaurantId].findIndex(c => c.id === category.id);
  if (idx >= 0) {
    memCategories[restaurantId][idx] = category;
  } else {
    memCategories[restaurantId].push(category);
  }
  saveToStorage("categories", memCategories);
  return category;
}

export async function deleteCategory(restaurantId, categoryId) {
  try {
    await deleteDoc(doc(db, "restaurants", restaurantId, "categories", categoryId));
  } catch (e) {
    console.warn("Firestore error", e);
  }
  if (memCategories[restaurantId]) {
    memCategories[restaurantId] = memCategories[restaurantId].filter(c => c.id !== categoryId);
    saveToStorage("categories", memCategories);
  }
  return true;
}

// PRODUCTS
export async function getProducts(restaurantId) {
  try {
    const snapshot = await getDocs(collection(db, "restaurants", restaurantId, "products"));
    if (!snapshot.empty) {
      const list = snapshot.docs.map(d => d.data());
      memProducts[restaurantId] = list;
      saveToStorage("products", memProducts);
      return list;
    }
  } catch (e) {
    console.warn("Firestore error", e);
  }
  return memProducts[restaurantId] || [];
}

export async function createProduct(restaurantId, product) {
  try {
    await setDoc(doc(db, "restaurants", restaurantId, "products", product.id), product);
  } catch (e) {
    console.warn("Firestore error", e);
  }
  if (!memProducts[restaurantId]) memProducts[restaurantId] = [];
  const idx = memProducts[restaurantId].findIndex(p => p.id === product.id);
  if (idx >= 0) {
    memProducts[restaurantId][idx] = product;
  } else {
    memProducts[restaurantId].push(product);
  }
  saveToStorage("products", memProducts);
  return product;
}

export async function updateProduct(restaurantId, productId, data) {
  try {
    await updateDoc(doc(db, "restaurants", restaurantId, "products", productId), data);
  } catch (e) {
    console.warn("Firestore error", e);
  }
  if (memProducts[restaurantId]) {
    const idx = memProducts[restaurantId].findIndex(p => p.id === productId);
    if (idx >= 0) {
      memProducts[restaurantId][idx] = { ...memProducts[restaurantId][idx], ...data };
      saveToStorage("products", memProducts);
    }
  }
  return true;
}

export async function deleteProduct(restaurantId, productId) {
  try {
    await deleteDoc(doc(db, "restaurants", restaurantId, "products", productId));
  } catch (e) {
    console.warn("Firestore error", e);
  }
  if (memProducts[restaurantId]) {
    memProducts[restaurantId] = memProducts[restaurantId].filter(p => p.id !== productId);
    saveToStorage("products", memProducts);
  }
  return true;
}

// TABLES
export async function getTables(restaurantId) {
  try {
    const snapshot = await getDocs(collection(db, "restaurants", restaurantId, "tables"));
    if (!snapshot.empty) {
      const list = snapshot.docs.map(d => d.data());
      memTables[restaurantId] = list;
      saveToStorage("tables", memTables);
      return list;
    }
  } catch (e) {
    console.warn("Firestore error", e);
  }
  return memTables[restaurantId] || [];
}

export async function createTable(restaurantId, table) {
  try {
    await setDoc(doc(db, "restaurants", restaurantId, "tables", table.id), table);
  } catch (e) {
    console.warn("Firestore error", e);
  }
  if (!memTables[restaurantId]) memTables[restaurantId] = [];
  const idx = memTables[restaurantId].findIndex(t => t.id === table.id);
  if (idx >= 0) {
    memTables[restaurantId][idx] = table;
  } else {
    memTables[restaurantId].push(table);
  }
  saveToStorage("tables", memTables);
  return table;
}

export async function deleteTable(restaurantId, tableId) {
  try {
    await deleteDoc(doc(db, "restaurants", restaurantId, "tables", tableId));
  } catch (e) {
    console.warn("Firestore error", e);
  }
  if (memTables[restaurantId]) {
    memTables[restaurantId] = memTables[restaurantId].filter(t => t.id !== tableId);
    saveToStorage("tables", memTables);
  }
  return true;
}

// COUPONS
export async function getCoupons(restaurantId) {
  try {
    const snapshot = await getDocs(collection(db, "restaurants", restaurantId, "coupons"));
    if (!snapshot.empty) {
      const list = snapshot.docs.map(d => d.data());
      memCoupons[restaurantId] = list;
      saveToStorage("coupons", memCoupons);
      return list;
    }
  } catch (e) {
    console.warn("Firestore error", e);
  }
  return memCoupons[restaurantId] || [];
}

export async function createCoupon(restaurantId, coupon) {
  try {
    await setDoc(doc(db, "restaurants", restaurantId, "coupons", coupon.id), coupon);
  } catch (e) {
    console.warn("Firestore error", e);
  }
  if (!memCoupons[restaurantId]) memCoupons[restaurantId] = [];
  const idx = memCoupons[restaurantId].findIndex(c => c.id === coupon.id);
  if (idx >= 0) {
    memCoupons[restaurantId][idx] = coupon;
  } else {
    memCoupons[restaurantId].push(coupon);
  }
  saveToStorage("coupons", memCoupons);
  return coupon;
}

export async function deleteCoupon(restaurantId, couponId) {
  try {
    await deleteDoc(doc(db, "restaurants", restaurantId, "coupons", couponId));
  } catch (e) {
    console.warn("Firestore error", e);
  }
  if (memCoupons[restaurantId]) {
    memCoupons[restaurantId] = memCoupons[restaurantId].filter(c => c.id !== couponId);
    saveToStorage("coupons", memCoupons);
  }
  return true;
}

// ORDERS
export async function getOrders(restaurantId) {
  try {
    const snapshot = await getDocs(collection(db, "restaurants", restaurantId, "orders"));
    if (!snapshot.empty) {
      const list = snapshot.docs.map(d => d.data());
      // Merge with memOrders for the current restaurant to guarantee dynamic orders made during the session are reflected
      const dbIds = new Set(list.map(item => item.id));
      const activeMemOrders = memOrders.filter(o => o.restaurantId === restaurantId && !dbIds.has(o.id));
      const merged = [...list, ...activeMemOrders];
      return merged.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    }
  } catch (e) {
    console.warn("Firestore error", e);
  }
  return memOrders.filter(o => o.restaurantId === restaurantId).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

export async function createOrder(restaurantId, order) {
  try {
    await setDoc(doc(db, "restaurants", restaurantId, "orders", order.id), order);
  } catch (e) {
    console.warn("Firestore error", e);
  }
  memOrders.unshift(order);
  saveToStorage("orders", memOrders);
  return order;
}

export async function updateOrderStatus(restaurantId, orderId, status) {
  try {
    await updateDoc(doc(db, "restaurants", restaurantId, "orders", orderId), { status });
  } catch (e) {
    console.warn("Firestore error", e);
  }
  const idx = memOrders.findIndex(o => o.id === orderId && o.restaurantId === restaurantId);
  if (idx >= 0) {
    memOrders[idx].status = status;
    saveToStorage("orders", memOrders);
  }
  return true;
}

// SUBSCRIPTION PLANS
export async function getSubscriptionPlans() {
  try {
    const snapshot = await getDocs(collection(db, "subscriptionPlans"));
    if (!snapshot.empty) {
      const list = snapshot.docs.map(d => d.data());
      memPlans = list;
      saveToStorage("subscriptionPlans", memPlans);
      return list;
    }
  } catch (e) {
    console.warn("Firestore error loading plans", e);
  }
  return memPlans;
}

export async function createSubscriptionPlan(plan) {
  try {
    await setDoc(doc(db, "subscriptionPlans", plan.id), plan);
  } catch (e) {
    console.warn("Firestore error creating plan", e);
  }
  const idx = memPlans.findIndex(p => p.id === plan.id);
  if (idx >= 0) {
    memPlans[idx] = plan;
  } else {
    memPlans.push(plan);
  }
  saveToStorage("subscriptionPlans", memPlans);
  return plan;
}

export async function updateSubscriptionPlan(planId, data) {
  try {
    await updateDoc(doc(db, "subscriptionPlans", planId), data);
  } catch (e) {
    console.warn("Firestore error updating plan", e);
  }
  const idx = memPlans.findIndex(p => p.id === planId);
  if (idx >= 0) {
    memPlans[idx] = { ...memPlans[idx], ...data };
    saveToStorage("subscriptionPlans", memPlans);
  }
  return true;
}

export async function deleteSubscriptionPlan(planId) {
  try {
    await deleteDoc(doc(db, "subscriptionPlans", planId));
  } catch (e) {
    console.warn("Firestore error deleting plan", e);
  }
  memPlans = memPlans.filter(p => p.id !== planId);
  saveToStorage("subscriptionPlans", memPlans);
  return true;
}
