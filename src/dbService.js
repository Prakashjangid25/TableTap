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
export const SEED_RESTAURANTS = [];
export const SEED_CATEGORIES = {};
export const SEED_PRODUCTS = {};
export const SEED_TABLES = {};
export const SEED_COUPONS = {};

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
let memPlans = loadFromStorage("subscriptionPlans", []);

// Initialize / Sync with Firestore if possible
export async function seedDatabaseIfEmpty() {
  try {
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
