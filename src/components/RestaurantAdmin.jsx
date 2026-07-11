import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FiHome,
  FiFolder,
  FiGrid,
  FiFileText,
  FiTag,
  FiSettings,
  FiPower,
  FiPlus,
  FiTrash2,
  FiShoppingBag,
  FiCoffee,
  FiLock,
  FiMail,
  FiAlertTriangle,
  FiPrinter,
  FiCheck,
  FiSun,
  FiMoon,
  FiX,
  FiEdit2,
  FiMap
} from 'react-icons/fi';
import FloorMapManager from './FloorMapManager.jsx';
import { db } from '../firebase';
import { collection, query, orderBy, onSnapshot, doc, setDoc, deleteDoc, updateDoc } from 'firebase/firestore';
import QRPrintSystem from './QRPrintSystem.jsx';
import {
  getRestaurants,
  getCategories,
  createCategory,
  deleteCategory,
  getProducts,
  createProduct,
  updateProduct,
  deleteProduct,
  getTables,
  createTable,
  deleteTable,
  getCoupons,
  createCoupon,
  deleteCoupon,
  getOrders,
  updateOrderStatus,
  updateRestaurant
} from '../dbService';
import { useAuth } from './AuthProvider.jsx';
import { useTheme } from '../contexts/ThemeContext.jsx';

// Theme toggle button
function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  return (
    <button onClick={toggleTheme} className="theme-toggle" title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}>
      {theme === 'dark' ? <FiSun className="text-sm" /> : <FiMoon className="text-sm" />}
    </button>
  );
}

export default function RestaurantAdmin() {
  const navigate = useNavigate();
  const { user, userRole, userRestaurantId, signInWithEmail, logOut, loading: authLoading } = useAuth();
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  // selectedRestId: null by default — must come from auth, not hardcoded
  const [selectedRestId, setSelectedRestId] = useState(null);
  const [currentRest, setCurrentRest] = useState(null);
  const [activeTab, setActiveTab] = useState('dashboard');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');

  // Core collections data
  const [categories, setCategories] = useState([]);
  const [products, setProducts] = useState([]);
  const [tables, setTables] = useState([]);
  const [orders, setOrders] = useState([]);
  const [coupons, setCoupons] = useState([]);
  const [loading, setLoading] = useState(false);

  // Modals / Creators Form State
  const [showAddCategory, setShowAddCategory] = useState(false);
  const [newCatName, setNewCatName] = useState('');

  const [showAddProduct, setShowAddProduct] = useState(false);
  const [newProd, setNewProd] = useState({
    name: '', description: '', price: '', categoryId: '',
    imageUrl: '', isAvailable: true, isPopular: false, isSpecial: false
  });

  const [showAddTable, setShowAddTable] = useState(false);
  const [newTableName, setNewTableName] = useState('');

  // Print QR modal state
  const [printTable, setPrintTable] = useState(null);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);

  const [showAddCoupon, setShowAddCoupon] = useState(false);
  const [newCoupon, setNewCoupon] = useState({
    code: '', discountType: 'percent', discountValue: '', minOrderAmount: '', isActive: true
  });

  const [settingsStatus, setSettingsStatus] = useState('');

  // Edit Product System states
  const [editingProdId, setEditingProdId] = useState(null);
  const [adminSuccessToast, setAdminSuccessToast] = useState('');

  // KDS Management System states
  const [kitchenAccessList, setKitchenAccessList] = useState([]);
  const [showAddKitchen, setShowAddKitchen] = useState(false);
  const [newKitchenName, setNewKitchenName] = useState('');
  const [editingKitchenId, setEditingKitchenId] = useState(null);
  const [editingKitchenName, setEditingKitchenName] = useState('');

  // Fetch kitchen accesses real-time
  useEffect(() => {
    if (!user || !selectedRestId) return;
    const accessColRef = collection(db, "restaurants", selectedRestId, "kitchenAccess");
    const unsubscribe = onSnapshot(accessColRef, (snapshot) => {
      const list = snapshot.docs.map(doc => doc.data());
      setKitchenAccessList(list);
    }, (error) => {
      console.error("Firestore kitchenAccess error", error);
    });
    return () => unsubscribe();
  }, [selectedRestId, user]);

  const getKdsLimitNum = (limit) => {
    if (!limit || limit === 'Unlimited') return Infinity;
    const parsed = parseInt(limit, 10);
    return isNaN(parsed) ? Infinity : parsed;
  };

  const handleAddKitchenAccess = async (e) => {
    e.preventDefault();
    if (!newKitchenName.trim() || !currentRest) return;

    const limitNum = getKdsLimitNum(currentRest.kdsLimit);
    if (kitchenAccessList.length >= limitNum) {
      alert(`You have reached your Kitchen Display System (KDS) limit of ${currentRest.kdsLimit || '2'} screens. Please contact support to upgrade your limit.`);
      return;
    }

    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let randKey = '';
    for (let i = 0; i < 6; i++) {
      randKey += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    const accessKey = `KDS-${randKey}`;

    let pin = '';
    for (let i = 0; i < 4; i++) {
      pin += Math.floor(Math.random() * 10);
    }

    const newId = `kds_${Date.now()}`;
    const newAccess = {
      id: newId,
      restaurantId: currentRest.id,
      kitchenName: newKitchenName.trim(),
      accessKey,
      pin,
      status: 'active',
      createdAt: new Date().toISOString(),
      lastUsed: 'Never'
    };

    try {
      await setDoc(doc(db, "restaurants", currentRest.id, "kitchenAccess", newId), newAccess);
      setNewKitchenName('');
      setShowAddKitchen(false);
      showToast(`Kitchen "${newAccess.kitchenName}" registered successfully!`);
    } catch (err) {
      console.error("Error creating kitchen access", err);
      alert("Failed to register kitchen: " + err.message);
    }
  };

  const handleRegenerateKeys = async (id, name) => {
    if (!window.confirm(`Are you sure you want to regenerate access credentials for "${name}"? Any active display using these credentials will be logged out.`)) return;

    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let randKey = '';
    for (let i = 0; i < 6; i++) {
      randKey += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    const accessKey = `KDS-${randKey}`;

    let pin = '';
    for (let i = 0; i < 4; i++) {
      pin += Math.floor(Math.random() * 10);
    }

    try {
      await updateDoc(doc(db, "restaurants", currentRest.id, "kitchenAccess", id), {
        accessKey,
        pin,
        lastUsed: 'Never'
      });
      showToast(`Credentials regenerated for "${name}"`);
    } catch (err) {
      console.error(err);
    }
  };

  const handleRenameKitchen = async (e) => {
    e.preventDefault();
    if (!editingKitchenName.trim() || !editingKitchenId) return;
    try {
      await updateDoc(doc(db, "restaurants", currentRest.id, "kitchenAccess", editingKitchenId), {
        kitchenName: editingKitchenName.trim()
      });
      setEditingKitchenId(null);
      setEditingKitchenName('');
      showToast("Kitchen renamed successfully!");
    } catch (err) {
      console.error(err);
    }
  };

  const handleToggleKitchenStatus = async (id, currentStatus) => {
    const newStatus = currentStatus === 'active' ? 'disabled' : 'active';
    try {
      await updateDoc(doc(db, "restaurants", currentRest.id, "kitchenAccess", id), {
        status: newStatus
      });
      showToast(`Kitchen status updated to "${newStatus}"`);
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteKitchenAccess = async (id, name) => {
    if (!window.confirm(`Are you absolutely sure you want to delete access for "${name}"? This cannot be undone and any active display using this will be logged out.`)) return;
    try {
      await deleteDoc(doc(db, "restaurants", currentRest.id, "kitchenAccess", id));
      showToast(`Kitchen access deleted.`);
    } catch (err) {
      console.error(err);
    }
  };

  // Toast helper function
  const showToast = (message) => {
    setAdminSuccessToast(message);
    setTimeout(() => {
      setAdminSuccessToast('');
    }, 4000);
  };

  // When user is authenticated as restaurant_admin, load their restaurantId from auth context
  useEffect(() => {
    if (user && userRole === 'restaurant_admin' && userRestaurantId) {
      setSelectedRestId(userRestaurantId);
    } else if (user && userRole === 'super_admin') {
      // Super admins can also view restaurant panel — but they must have a restaurantId set
      // For super_admin with no restaurantId, show selection or nothing
      setSelectedRestId(userRestaurantId || null);
    }
  }, [user, userRole, userRestaurantId]);

  // Real-time order notification system states
  const [notificationQueue, setNotificationQueue] = useState([]);
  const [currentNotification, setCurrentNotification] = useState(null);
  const [isFadingOut, setIsFadingOut] = useState(false);

  // Sound play helper using high-fidelity Web Audio API synthesizer
  const playNotificationSound = () => {
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      const ctx = new AudioContext();

      // Dual-note chime (E5 -> A5)
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(659.25, ctx.currentTime); // E5
      gain1.gain.setValueAtTime(0.15, ctx.currentTime);
      gain1.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);

      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start();
      osc1.stop(ctx.currentTime + 0.3);

      setTimeout(() => {
        try {
          const osc2 = ctx.createOscillator();
          const gain2 = ctx.createGain();
          osc2.type = 'sine';
          osc2.frequency.setValueAtTime(880, ctx.currentTime); // A5
          gain2.gain.setValueAtTime(0.15, ctx.currentTime);
          gain2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);

          osc2.connect(gain2);
          gain2.connect(ctx.destination);
          osc2.start();
          osc2.stop(ctx.currentTime + 0.4);
        } catch (e) {
          console.warn("Second audio note failed", e);
        }
      }, 120);
    } catch (e) {
      console.warn("Web Audio chime failed", e);
    }
  };

  // Load restaurant metadata when selectedRestId changes
  useEffect(() => {
    async function loadRestaurant() {
      if (!user || !selectedRestId) return;
      setLoading(true);
      const list = await getRestaurants();
      const r = list.find(item => item.id === selectedRestId);
      setCurrentRest(r || null);
      if (r) {
        const [cats, prods, tbls, cpns] = await Promise.all([
          getCategories(r.id),
          getProducts(r.id),
          getTables(r.id),
          getCoupons(r.id)
        ]);
        setCategories(cats);
        setProducts(prods);
        setTables(tbls);
        setCoupons(cpns);
      }
      setLoading(false);
    }
    loadRestaurant();
  }, [selectedRestId, user]);

  // Real-time listener for orders using Firebase Firestore
  useEffect(() => {
    if (!user || !selectedRestId) return;

    let isInitialLoad = true;

    const ordersColRef = collection(db, "restaurants", selectedRestId, "orders");
    const q = query(ordersColRef, orderBy("createdAt", "desc"));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map(doc => doc.data());
      setOrders(list);

      // Listen for newly added orders
      snapshot.docChanges().forEach(change => {
        if (change.type === 'added') {
          const newOrder = change.doc.data();
          if (!isInitialLoad) {
            // This is a genuinely new order! Play sound and queue the notification toast
            playNotificationSound();
            setNotificationQueue(prev => [...prev, {
              id: newOrder.id,
              tableName: newOrder.tableName || 'Table',
              orderId: newOrder.id
            }]);
          }
        }
      });

      isInitialLoad = false;
    }, (error) => {
      console.error("Firestore real-time orders error", error);
      // Fallback to static fetch in case of permissions or connectivity issue
      getOrders(selectedRestId).then(setOrders);
    });

    return () => unsubscribe();
  }, [selectedRestId, user]);

  // FIFO Queue processing effect for sequential, non-overlapping order notification toasts
  useEffect(() => {
    if (!currentNotification && notificationQueue.length > 0) {
      const nextNotification = notificationQueue[0];
      setCurrentNotification(nextNotification);
      setNotificationQueue(prev => prev.slice(1));
    }
  }, [notificationQueue, currentNotification]);

  // Auto-dismiss the active notification after 4.5 seconds
  useEffect(() => {
    if (currentNotification) {
      const timer = setTimeout(() => {
        handleCloseNotification();
      }, 4500);
      return () => clearTimeout(timer);
    }
  }, [currentNotification]);

  const handleCloseNotification = () => {
    setIsFadingOut(true);
    setTimeout(() => {
      setCurrentNotification(null);
      setIsFadingOut(false);
    }, 250); // duration of the fade-out CSS animation
  };

  // Refresh helper for other metadata (orders are updated in real-time)
  const refreshCollections = async () => {
    if (!currentRest) return;
    const [cats, prods, tbls, cpns] = await Promise.all([
      getCategories(currentRest.id),
      getProducts(currentRest.id),
      getTables(currentRest.id),
      getCoupons(currentRest.id)
    ]);
    setCategories(cats);
    setProducts(prods);
    setTables(tbls);
    setCoupons(cpns);
  };

  // ── Auth ──────────────────────────────────────
  const handleAuthSubmit = async (e) => {
    e.preventDefault();
    setAuthError('');
    if (!email || !password) { setAuthError('Please fill in all fields.'); return; }
    try {
      const authedUser = await signInWithEmail(email, password);
      // Note: userRole will update via context — the useEffect above will then set selectedRestId
      if (!authedUser) throw new Error('Login failed. Please try again.');
    } catch (err) {
      setAuthError(err.message || 'Authentication failed. Please check your credentials.');
    }
  };

  // ── Category Operations ───────────────────────
  const handleAddCategory = async (e) => {
    e.preventDefault();
    if (!newCatName.trim() || !currentRest) return;
    await createCategory(currentRest.id, {
      id: `cat_${Date.now()}`, restaurantId: currentRest.id, name: newCatName, order: categories.length + 1
    });
    setNewCatName(''); setShowAddCategory(false);
    refreshCollections();
  };

  const handleDeleteCategory = async (id) => {
    if (window.confirm("Deleting this category won't delete your products but they will lose category bindings. Proceed?")) {
      await deleteCategory(currentRest.id, id);
      refreshCollections();
    }
  };

  // ── Product Operations ────────────────────────
  const handleAddProduct = async (e) => {
    e.preventDefault();
    if (!newProd.name || !newProd.price || !currentRest) return;

    try {
      if (editingProdId) {
        // Edit Mode: Update existing Firestore product document
        await updateProduct(currentRest.id, editingProdId, {
          name: newProd.name,
          price: Number(newProd.price),
          categoryId: newProd.categoryId,
          imageUrl: newProd.imageUrl,
          description: newProd.description,
          isPopular: newProd.isPopular,
          isSpecial: newProd.isSpecial,
          isAvailable: newProd.isAvailable
        });
        showToast("Food item updated successfully.");
        setEditingProdId(null);
      } else {
        // Add Mode: Create new product document
        await createProduct(currentRest.id, {
          ...newProd, id: `prod_${Date.now()}`, restaurantId: currentRest.id, price: Number(newProd.price)
        });
        showToast("Food item published successfully.");
      }
    } catch (err) {
      console.error("Error saving product:", err);
    }

    setShowAddProduct(false);
    setNewProd({ name: '', description: '', price: '', categoryId: '', imageUrl: '', isAvailable: true, isPopular: false, isSpecial: false });
    refreshCollections();
  };

  const handleEditProductClick = (prod) => {
    setEditingProdId(prod.id);
    setNewProd({
      name: prod.name || '',
      price: prod.price !== undefined ? String(prod.price) : '',
      categoryId: prod.categoryId || '',
      imageUrl: prod.imageUrl || '',
      description: prod.description || '',
      isAvailable: prod.isAvailable !== undefined ? prod.isAvailable : true,
      isPopular: !!prod.isPopular,
      isSpecial: !!prod.isSpecial
    });
    setShowAddProduct(true);
  };

  const handleCancelProductForm = () => {
    setShowAddProduct(false);
    setEditingProdId(null);
    setNewProd({ name: '', description: '', price: '', categoryId: '', imageUrl: '', isAvailable: true, isPopular: false, isSpecial: false });
  };

  const handleToggleProductAvailability = async (id, currentVal) => {
    await updateProduct(currentRest.id, id, { isAvailable: !currentVal });
    refreshCollections();
  };

  const handleDeleteProduct = async (id) => {
    if (window.confirm("Delete this food item?")) {
      await deleteProduct(currentRest.id, id);
      refreshCollections();
    }
  };

  // ── Table Operations ──────────────────────────
  const handleAddTable = async (e) => {
    e.preventDefault();
    if (!newTableName.trim() || !currentRest) return;
    await createTable(currentRest.id, {
      id: `tbl_${Date.now()}`, restaurantId: currentRest.id, tableName: newTableName
    });
    setNewTableName(''); setShowAddTable(false);
    refreshCollections();
  };

  const handleDeleteTable = async (id) => {
    if (window.confirm("Delete this table QR mapping?")) {
      await deleteTable(currentRest.id, id);
      refreshCollections();
    }
  };

  // ── Order Operations ──────────────────────────
  const handleUpdateStatus = async (orderId, newStatus) => {
    await updateOrderStatus(currentRest.id, orderId, newStatus);
    refreshCollections();
  };

  // ── Coupon Operations ─────────────────────────
  const handleAddCoupon = async (e) => {
    e.preventDefault();
    if (!newCoupon.code || !newCoupon.discountValue || !currentRest) return;
    await createCoupon(currentRest.id, {
      ...newCoupon, id: `cpn_${Date.now()}`, restaurantId: currentRest.id,
      code: newCoupon.code.toUpperCase().trim(),
      discountValue: Number(newCoupon.discountValue),
      minOrderAmount: Number(newCoupon.minOrderAmount || 0)
    });
    setNewCoupon({ code: '', discountType: 'percent', discountValue: '', minOrderAmount: '', isActive: true });
    setShowAddCoupon(false);
    refreshCollections();
  };

  const handleDeleteCoupon = async (id) => {
    await deleteCoupon(currentRest.id, id);
    refreshCollections();
  };

  // ── Restaurant Settings ───────────────────────
  const handleSaveSettings = async (e) => {
    e.preventDefault();
    setSettingsStatus('Saving...');
    await updateRestaurant(currentRest.id, {
      name: currentRest.name, description: currentRest.description,
      logoUrl: currentRest.logoUrl, themeColor: currentRest.themeColor,
      taxRate: Number(currentRest.taxRate), address: currentRest.address, contact: currentRest.contact
    });
    setSettingsStatus('Settings updated successfully!');
    setTimeout(() => setSettingsStatus(''), 3000);
  };

  // Calculations
  const totalSales = orders.filter(o => o.status === 'completed' || o.status === 'served').reduce((acc, curr) => acc + (curr.grandTotal || 0), 0);
  const ordersCount = orders.length;
  const pendingOrdersCount = orders.filter(o => o.status === 'pending').length;

  // ── Shared styles ─────────────────────────────
  const surface = isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200';
  const inputCls = `w-full border rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-amber-500 transition-colors ${isDark ? 'bg-slate-950 border-slate-800 text-white placeholder:text-slate-600' : 'bg-slate-50 border-slate-200 text-slate-800'}`;
  const labelCls = `block text-xs font-semibold uppercase tracking-wider mb-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`;

  // ═══════════════════════════════════════════════
  // LOGIN SCREEN — no user logged in
  // ═══════════════════════════════════════════════
  if (!user) {
    return (
      <div className={`min-h-screen font-sans flex items-center justify-center p-4 ${isDark ? 'bg-slate-950 text-white' : 'bg-slate-50 text-slate-800'}`}>
        {/* Theme toggle in corner */}
        <div className="absolute top-4 right-4">
          <ThemeToggle />
        </div>

        <div className={`w-full max-w-md p-8 rounded-2xl border shadow-2xl animate-fade-in ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200/80'}`}>
          <div className="flex justify-between items-center mb-6">
            <span className="text-amber-600 text-xs font-semibold uppercase tracking-widest bg-amber-500/10 px-2.5 py-1 rounded">
              Restaurant Admin Gate
            </span>
            <button onClick={() => navigate('/')} className={`text-xs flex items-center gap-1 ${isDark ? 'text-slate-400 hover:text-white' : 'text-slate-400 hover:text-slate-800'}`}>
              <FiHome /> Back
            </button>
          </div>

          <h2 className={`text-2xl font-bold font-display tracking-tight mb-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>
            Sign in to Storefront
          </h2>
          <p className={`text-sm font-light mb-6 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
            Enter the credentials provided by your Super Admin to manage this restaurant.
          </p>

          <form onSubmit={handleAuthSubmit} className="space-y-4">
            <div>
              <label className={labelCls}>Email Address</label>
              <div className="relative">
                <FiMail className={`absolute left-3.5 top-3.5 ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
                <input
                  type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                  placeholder="manager@restaurant.com"
                  className={`w-full border rounded-xl py-2.5 pl-10 pr-4 text-sm focus:outline-none focus:border-amber-500 ${isDark ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-200 text-slate-800'}`}
                  required
                />
              </div>
            </div>
            <div>
              <label className={labelCls}>Password</label>
              <div className="relative">
                <FiLock className={`absolute left-3.5 top-3.5 ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
                <input
                  type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className={`w-full border rounded-xl py-2.5 pl-10 pr-4 text-sm focus:outline-none focus:border-amber-500 ${isDark ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-200 text-slate-800'}`}
                  required
                />
              </div>
              {authError && <p className="text-xs text-rose-500 mt-2 flex items-center gap-1"><FiAlertTriangle /> {authError}</p>}
            </div>
            <button
              type="submit" disabled={authLoading}
              className="w-full bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-white font-semibold py-3 rounded-xl text-sm shadow-lg transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {authLoading ? (<><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /><span>Signing in...</span></>) : 'Sign In to Storefront'}
            </button>
          </form>

          <p className={`text-xs text-center mt-6 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
            Credentials are provided by the Super Admin when your restaurant is registered.
          </p>
        </div>
      </div>
    );
  }

  // ─── Access Denied ──────────────────────────────
  if (userRole !== 'restaurant_admin' && userRole !== 'super_admin') {
    return (
      <div className={`min-h-screen font-sans flex items-center justify-center p-4 ${isDark ? 'bg-slate-950 text-white' : 'bg-slate-50 text-slate-800'}`}>
        <div className={`w-full max-w-md p-8 rounded-2xl border shadow-2xl text-center ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
          <FiAlertTriangle className="text-amber-500 text-5xl mx-auto mb-4 animate-bounce" />
          <h2 className={`text-2xl font-bold font-display tracking-tight mb-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>Access Denied</h2>
          <p className={`text-sm font-light mb-6 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
            Your current account ({user.email}) does not have permission to view the Restaurant Administration panel.
          </p>
          <div className="flex flex-col gap-3">
            <button onClick={() => logOut()} className="w-full bg-slate-800 text-white hover:bg-slate-700 py-2.5 rounded-xl text-sm font-semibold transition-all cursor-pointer">Sign Out</button>
            <button onClick={() => navigate('/')} className={`w-full bg-transparent border py-2.5 rounded-xl text-sm transition-all ${isDark ? 'border-slate-800 text-slate-400' : 'border-slate-200 text-slate-500'}`}>Return to Launchpad</button>
          </div>
        </div>
      </div>
    );
  }

  // ─── No restaurant assigned ──────────────────────
  if (!selectedRestId || !currentRest) {
    return (
      <div className={`min-h-screen font-sans flex items-center justify-center p-4 ${isDark ? 'bg-slate-950 text-white' : 'bg-slate-50 text-slate-800'}`}>
        <div className={`w-full max-w-md p-8 rounded-2xl border shadow-2xl text-center ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
          {loading ? (
            <>
              <div className="w-10 h-10 border-4 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
              <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Loading restaurant data...</p>
            </>
          ) : (
            <>
              <FiAlertTriangle className="text-amber-500 text-5xl mx-auto mb-4" />
              <h2 className={`text-xl font-bold mb-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>No Restaurant Found</h2>
              <p className={`text-sm font-light mb-6 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                Your account is not linked to any restaurant, or the restaurant no longer exists. Please contact the Super Admin.
              </p>
              <button onClick={() => logOut()} className="w-full bg-amber-500 hover:bg-amber-600 text-white py-2.5 rounded-xl text-sm font-semibold transition-all cursor-pointer">Sign Out</button>
            </>
          )}
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════
  // MAIN RESTAURANT ADMIN DASHBOARD
  // ═══════════════════════════════════════════════
  return (
    <div className={`min-h-screen font-sans flex flex-col md:flex-row ${isDark ? 'bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-800'}`}>

      {/* Sidebar */}
      <aside className={`w-full md:w-64 p-6 flex flex-col justify-between border-r shrink-0 ${isDark ? 'bg-slate-900 border-slate-800 text-slate-100' : 'bg-slate-900 border-slate-800 text-slate-100'}`}>
        <div>
          {/* Logo & Rest details */}
          {currentRest && (
            <div className="flex items-center gap-3 mb-8">
              <img src={currentRest.logoUrl} alt={currentRest.name} className="w-10 h-10 rounded-lg object-cover bg-slate-800 border border-slate-700" onError={(e) => { e.target.src = "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&q=80&w=200" }} />
              <div>
                <h2 className="font-bold font-display text-sm truncate max-w-[140px] text-white">{currentRest.name}</h2>
                <p className="text-[10px] text-amber-400 font-mono">Store Administrator</p>
              </div>
            </div>
          )}

          {/* Nav Tabs */}
          <nav className="space-y-1">
            {[
              { id: 'dashboard', label: 'Dashboard', icon: <FiHome /> },
              { id: 'categories', label: 'Categories', icon: <FiFolder /> },
              { id: 'products', label: 'Manage Products', icon: <FiCoffee /> },
              { id: 'tables', label: 'Table QRs', icon: <FiGrid /> },
              { id: 'floormap', label: 'Floor Map', icon: <FiMap /> },
              { id: 'orders', label: 'Orders', icon: <FiFileText />, badge: pendingOrdersCount },
              { id: 'coupons', label: 'Coupons & Deals', icon: <FiTag /> },
              { id: 'kds', label: 'KDS Management', icon: <FiPrinter /> },
              { id: 'settings', label: 'Store Settings', icon: <FiSettings /> }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`w-full flex items-center justify-between px-4 py-2.5 rounded-lg text-sm transition-all text-left font-medium cursor-pointer ${activeTab === tab.id ? 'bg-amber-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                  }`}
              >
                <div className="flex items-center gap-3">
                  <span className="text-lg shrink-0">{tab.icon}</span>
                  <span>{tab.label}</span>
                </div>
                {tab.badge ? (
                  <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${activeTab === tab.id ? 'bg-slate-950 text-amber-400' : 'bg-amber-500/10 text-amber-400'}`}>{tab.badge}</span>
                ) : null}
              </button>
            ))}
          </nav>
        </div>

        <div className="border-t border-slate-800 pt-4 mt-6 space-y-2">
          <div className="flex items-center justify-between px-1">
            <span className="text-xs text-slate-500 truncate max-w-[140px]">{user.email}</span>
            <ThemeToggle />
          </div>
          <button onClick={() => navigate('/')} className="w-full flex items-center justify-center gap-2 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-300 font-medium cursor-pointer">
            Launchpad
          </button>
          <button onClick={() => logOut()} className="w-full flex items-center justify-center gap-2 py-2 rounded-lg bg-slate-800/40 hover:bg-slate-800 text-xs text-rose-400 font-medium cursor-pointer">
            <FiPower /> Sign Out
          </button>
        </div>
      </aside>

      {/* Main Panel Content */}
      <main className="flex-1 p-6 md:p-10 overflow-y-auto w-full max-w-7xl mx-auto">

        {/* ── TAB 1: DASHBOARD ──────────────────── */}
        {activeTab === 'dashboard' && (
          <div className="animate-fade-in space-y-8">
            <div>
              <h1 className={`text-3xl font-bold font-display tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>Storefront Overview</h1>
              <p className={`text-sm mt-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Live overview of sales performance, tables, and product analytics.</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {[
                { label: 'Gross Sales', value: `₹${totalSales.toFixed(2)}`, sub: '✓ Dynamic checkouts inclusive', icon: '₹', color: 'text-amber-500', bg: 'bg-amber-500/10', subColor: isDark ? 'text-emerald-400' : 'text-emerald-600' },
                { label: 'Total Orders', value: ordersCount, sub: 'Placed via scanned QR codes', icon: <FiShoppingBag />, color: 'text-sky-500', bg: 'bg-sky-500/10', subColor: isDark ? 'text-slate-500' : 'text-slate-500' },
                { label: 'Active Tables', value: tables.length, sub: 'Active mapped locations', icon: <FiGrid />, color: 'text-purple-500', bg: 'bg-purple-500/10', subColor: isDark ? 'text-slate-500' : 'text-slate-500' },
                { label: 'Pending Orders', value: pendingOrdersCount, sub: 'Awaiting acceptance from staff', icon: <FiCoffee />, color: 'text-rose-500', bg: 'bg-rose-500/10', subColor: isDark ? 'text-slate-500' : 'text-slate-500' },
              ].map(stat => (
                <div key={stat.label} className={`p-6 rounded-2xl border shadow-sm ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200/80'}`}>
                  <div className="flex justify-between items-center mb-4">
                    <span className={`text-xs font-bold uppercase tracking-wider ${isDark ? 'text-slate-400' : 'text-slate-400'}`}>{stat.label}</span>
                    <div className={`w-8 h-8 rounded-lg ${stat.bg} ${stat.color} flex items-center justify-center font-bold text-sm`}>{stat.icon}</div>
                  </div>
                  <h3 className={`text-3xl font-extrabold font-mono ${isDark ? 'text-white' : 'text-slate-900'}`}>{stat.value}</h3>
                  <p className={`text-xs mt-2 ${stat.subColor}`}>{stat.sub}</p>
                </div>
              ))}
            </div>

            {/* Quick launch */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className={`md:col-span-2 p-6 rounded-2xl border shadow-sm ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200/80'}`}>
                <h3 className={`font-bold text-base mb-4 ${isDark ? 'text-white' : 'text-slate-900'}`}>Tables & QR Scan Links</h3>
                <div className="space-y-4">
                  {tables.map(tbl => {
                    const scanLink = `${window.location.origin}/customer?r=${currentRest.id}&t=${tbl.id}`;
                    const qrImg = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(scanLink)}`;
                    return (
                      <div key={tbl.id} className={`flex flex-col sm:flex-row sm:items-center justify-between p-3.5 rounded-xl border gap-4 text-xs ${isDark ? 'bg-slate-800/40 border-slate-700' : 'bg-slate-50 border-slate-100'}`}>
                        <div className="min-w-0 flex-1">
                          <p className={`font-bold text-sm ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>{tbl.tableName}</p>
                          <p className={`text-xs break-all sm:truncate max-w-full select-all mt-0.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`} title={scanLink}>{scanLink}</p>
                        </div>
                        <div className="flex items-center gap-3 shrink-0 justify-end sm:justify-start">
                          <img src={qrImg} alt="QR" className="w-8 h-8 rounded border bg-white p-0.5 shrink-0" />
                          <a href={scanLink} target="_blank" rel="noreferrer" className="px-2.5 py-1.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 rounded font-semibold text-[11px] uppercase tracking-wider text-center shrink-0">Test Scan</a>
                        </div>
                      </div>
                    );
                  })}
                  {tables.length === 0 && <p className={`text-sm text-center py-4 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>No tables configured yet. Go to Table QRs tab to add some.</p>}
                </div>
              </div>

              <div className={`p-6 rounded-2xl border shadow-sm flex flex-col justify-between ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200/80'}`}>
                <div>
                  <h3 className={`font-bold text-base mb-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>Kitchen Quick Launch</h3>
                  <p className={`text-sm leading-relaxed font-light mb-6 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                    Launch the KDS (Kitchen Display System) in a new tab for your kitchen staff.
                  </p>
                </div>
                <button onClick={() => navigate(`/kitchen?r=${currentRest.id}`)} className={`w-full font-bold py-2.5 rounded-xl text-xs transition-all shadow ${isDark ? 'bg-slate-800 hover:bg-slate-700 text-white' : 'bg-slate-900 hover:bg-slate-800 text-white'}`}>
                  Open Kitchen Screen (KDS)
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── TAB 2: CATEGORIES ─────────────────── */}
        {activeTab === 'categories' && (
          <div className="animate-fade-in space-y-6">
            <div className="flex justify-between items-center">
              <div>
                <h1 className={`text-3xl font-bold font-display tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>Menu Categories</h1>
                <p className={`text-sm mt-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Organize your digital food menu items into clean scrollable categories.</p>
              </div>
              <button onClick={() => setShowAddCategory(!showAddCategory)} className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded-xl text-sm transition-all shadow-md flex items-center gap-1.5 cursor-pointer">
                <FiPlus /> New Category
              </button>
            </div>

            {showAddCategory && (
              <form onSubmit={handleAddCategory} className={`p-6 rounded-xl border shadow-sm max-w-md animate-fade-in space-y-3 ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
                <h3 className={`font-bold text-sm ${isDark ? 'text-white' : 'text-slate-900'}`}>Add Category</h3>
                <input type="text" required placeholder="e.g. Signature Cocktails, Vegan Mains" value={newCatName} onChange={(e) => setNewCatName(e.target.value)} className={`w-full border rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-amber-500 ${isDark ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-200 text-slate-800'}`} />
                <div className="flex gap-2 justify-end pt-2">
                  <button type="button" onClick={() => setShowAddCategory(false)} className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${isDark ? 'bg-slate-800 text-slate-400 hover:bg-slate-700' : 'bg-slate-100 hover:bg-slate-200 text-slate-500'}`}>Cancel</button>
                  <button type="submit" className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 rounded-lg text-xs font-bold text-slate-950">Add</button>
                </div>
              </form>
            )}

            <div className={`rounded-2xl overflow-hidden shadow-sm border ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className={`border-b text-xs font-semibold uppercase ${isDark ? 'border-slate-800 text-slate-400' : 'border-slate-200 text-slate-400 bg-slate-50'}`}>
                    <th className="px-6 py-3">Category Name</th>
                    <th className="px-6 py-3">Database Slug ID</th>
                    <th className="px-6 py-3">Sort Order</th>
                    <th className="px-6 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className={`divide-y ${isDark ? 'divide-slate-800 text-slate-300' : 'divide-slate-100 text-slate-700'}`}>
                  {categories.map((cat, idx) => (
                    <tr key={cat.id} className={`transition-colors ${isDark ? 'hover:bg-slate-800/40' : 'hover:bg-slate-50'}`}>
                      <td className={`px-6 py-4 font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>{cat.name}</td>
                      <td className="px-6 py-4 font-mono text-xs">{cat.id}</td>
                      <td className="px-6 py-4">{cat.order || idx + 1}</td>
                      <td className="px-6 py-4 text-right">
                        <button onClick={() => handleDeleteCategory(cat.id)} className="p-1.5 rounded-lg bg-rose-50 text-rose-500 hover:bg-rose-100 border border-rose-100 transition-colors cursor-pointer"><FiTrash2 /></button>
                      </td>
                    </tr>
                  ))}
                  {categories.length === 0 && (
                    <tr><td colSpan="4" className={`text-center py-8 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>No categories declared yet. Press Add to seed one!</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── TAB 3: PRODUCTS ───────────────────── */}
        {activeTab === 'products' && (
          <div className="animate-fade-in space-y-6">
            <div className="flex justify-between items-center">
              <div>
                <h1 className={`text-3xl font-bold font-display tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>Menu Products</h1>
                <p className={`text-sm mt-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Publish, unpublish, and update descriptions, badges, and prices for your menu.</p>
              </div>
              <button onClick={() => {
                if (!showAddProduct) {
                  handleCancelProductForm();
                  setShowAddProduct(true);
                } else {
                  setShowAddProduct(false);
                }
              }} className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded-xl text-sm transition-all shadow-md flex items-center gap-1.5 cursor-pointer">
                <FiPlus /> Add Food Item
              </button>
            </div>

            {showAddProduct && (
              <form onSubmit={handleAddProduct} className={`p-6 rounded-2xl border shadow-xl max-w-lg animate-fade-in space-y-4 ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
                <h3 className={`font-bold text-base ${isDark ? 'text-white' : 'text-slate-900'}`}>{editingProdId ? 'Edit Food Item' : 'Add Menu Product'}</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className={labelCls}>Product Name</label>
                    <input type="text" required placeholder="e.g. Butter Chicken" value={newProd.name} onChange={(e) => setNewProd({ ...newProd, name: e.target.value })} className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Price (₹)</label>
                    <input type="number" required step="0.01" placeholder="299" value={newProd.price} onChange={(e) => setNewProd({ ...newProd, price: e.target.value })} className={inputCls} />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className={labelCls}>Category</label>
                    <select required value={newProd.categoryId} onChange={(e) => setNewProd({ ...newProd, categoryId: e.target.value })} className={inputCls}>
                      <option value="">Select a Category</option>
                      {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}>Product Image URL</label>
                    <input type="url" placeholder="https://images.unsplash.com/..." value={newProd.imageUrl} onChange={(e) => setNewProd({ ...newProd, imageUrl: e.target.value })} className={inputCls} />
                  </div>
                </div>
                <div>
                  <label className={labelCls}>Short Description</label>
                  <input type="text" placeholder="Tender chicken in creamy tomato gravy..." value={newProd.description} onChange={(e) => setNewProd({ ...newProd, description: e.target.value })} className={inputCls} />
                </div>
                <div className="flex gap-6 pt-2 text-xs font-semibold">
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input type="checkbox" checked={newProd.isPopular} onChange={(e) => setNewProd({ ...newProd, isPopular: e.target.checked })} />
                    <span className={isDark ? 'text-slate-300' : 'text-slate-600'}>Popular Badge</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input type="checkbox" checked={newProd.isSpecial} onChange={(e) => setNewProd({ ...newProd, isSpecial: e.target.checked })} />
                    <span className={isDark ? 'text-slate-300' : 'text-slate-600'}>Chef's Special Badge</span>
                  </label>
                </div>
                <div className="flex gap-2 justify-end pt-4">
                  <button type="button" onClick={handleCancelProductForm} className={`px-4 py-2 rounded-lg text-xs font-semibold ${isDark ? 'bg-slate-800 text-slate-400 hover:bg-slate-700' : 'bg-slate-100 hover:bg-slate-200 text-slate-500'}`}>Cancel</button>
                  <button type="submit" className="px-4 py-2 bg-amber-500 hover:bg-amber-600 rounded-lg text-xs font-bold text-slate-950">{editingProdId ? 'Save Changes' : 'Publish Product'}</button>
                </div>
              </form>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {products.map(prod => {
                const catName = categories.find(c => c.id === prod.categoryId)?.name || 'Unbound';
                return (
                  <div key={prod.id} className={`rounded-2xl border overflow-hidden shadow-sm flex flex-col justify-between ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200/80'}`}>
                    <div>
                      <div className="relative h-44 bg-slate-100 overflow-hidden">
                        <img src={prod.imageUrl || "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&q=80&w=400"} alt={prod.name} className="w-full h-full object-cover" onError={(e) => { e.target.src = "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&q=80&w=400" }} />
                        <div className="absolute top-2 right-2 flex flex-col gap-1">
                          {prod.isPopular && <span className="bg-amber-400 text-slate-950 font-bold uppercase text-[9px] px-2 py-0.5 rounded">Popular</span>}
                          {prod.isSpecial && <span className="bg-emerald-500 text-white font-bold uppercase text-[9px] px-2 py-0.5 rounded">Special</span>}
                        </div>
                      </div>
                      <div className="p-4 space-y-2">
                        <span className="text-[10px] font-bold text-amber-600 uppercase tracking-wide bg-amber-50 px-2 py-0.5 rounded">{catName}</span>
                        <div className="flex justify-between items-center">
                          <h4 className={`font-bold truncate max-w-[180px] ${isDark ? 'text-white' : 'text-slate-900'}`}>{prod.name}</h4>
                          <span className={`font-mono font-bold ${isDark ? 'text-slate-200' : 'text-slate-900'}`}>₹{prod.price.toFixed(2)}</span>
                        </div>
                        <p className={`text-xs font-light line-clamp-2 ${isDark ? 'text-slate-400' : 'text-slate-400'}`}>{prod.description || 'No description provided.'}</p>
                      </div>
                    </div>
                    <div className={`px-4 py-3 border-t flex justify-between items-center ${isDark ? 'border-slate-800 bg-slate-800/30' : 'border-slate-100 bg-slate-50/50'}`}>
                      <div className="flex items-center gap-2">
                        <span className={`text-xs font-medium ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Available</span>
                        <input type="checkbox" checked={prod.isAvailable} onChange={() => handleToggleProductAvailability(prod.id, prod.isAvailable)} className="cursor-pointer" />
                      </div>
                      <div className="flex items-center gap-3">
                        <button onClick={() => handleEditProductClick(prod)} className={`p-1 transition-colors ${isDark ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-slate-900'}`} title="Edit Food Item">
                          <FiEdit2 />
                        </button>
                        <button onClick={() => handleDeleteProduct(prod.id)} className="p-1 text-rose-500 hover:text-rose-600 transition-colors" title="Delete Food Item"><FiTrash2 /></button>
                      </div>
                    </div>
                  </div>
                );
              })}
              {products.length === 0 && (
                <div className={`col-span-full text-center py-12 rounded-2xl border border-dashed ${isDark ? 'border-slate-700 text-slate-500' : 'border-slate-300 text-slate-400'}`}>No products yet. Click "Add Food Item" to publish your first item.</div>
              )}
            </div>
          </div>
        )}

        {/* ── TAB 4: TABLES & QR CODES ──────────── */}
        {activeTab === 'tables' && (
          <div className="animate-fade-in space-y-6">
            <div className="flex justify-between items-center">
              <div>
                <h1 className={`text-3xl font-bold font-display tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>Restaurant QR Codes</h1>
                <p className={`text-sm mt-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Deploy tables, map links, and download print-ready QR codes.</p>
              </div>
              <button onClick={() => setShowAddTable(!showAddTable)} className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded-xl text-sm transition-all shadow-md flex items-center gap-1.5 cursor-pointer">
                <FiPlus /> Add Table
              </button>
            </div>

            {showAddTable && (
              <form onSubmit={handleAddTable} className={`p-6 rounded-xl border shadow-sm max-w-md animate-fade-in space-y-3 ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
                <h3 className={`font-bold text-sm ${isDark ? 'text-white' : 'text-slate-900'}`}>Add Table Mapping</h3>
                <input type="text" required placeholder="e.g. Table 15 (Patio)" value={newTableName} onChange={(e) => setNewTableName(e.target.value)} className={`w-full border rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-amber-500 ${isDark ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-200 text-slate-800'}`} />
                <div className="flex gap-2 justify-end pt-2">
                  <button type="button" onClick={() => setShowAddTable(false)} className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${isDark ? 'bg-slate-800 text-slate-400' : 'bg-slate-100 text-slate-500'}`}>Cancel</button>
                  <button type="submit" className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 rounded-lg text-xs font-bold text-slate-950">Create</button>
                </div>
              </form>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {tables.map(tbl => {
                const scanLink = `${window.location.origin}/customer?r=${currentRest.id}&t=${tbl.id}`;
                const qrImg = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(scanLink)}`;
                return (
                  <div key={tbl.id} className={`p-6 rounded-2xl border shadow-sm hover:shadow-md transition-shadow flex flex-col md:flex-row gap-6 items-center ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200/85'}`}>
                    <div className={`p-4 rounded-xl border text-center flex flex-col items-center shrink-0 ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-100'}`}>
                      <img src={qrImg} alt="QR Code" className="w-32 h-32 bg-white p-1 rounded-lg border shadow-sm" />
                      <span className={`text-[10px] font-mono mt-2 ${isDark ? 'text-slate-400' : 'text-slate-400'}`}>Scan TableTap QR</span>
                    </div>
                    <div className="flex-1 min-w-0 space-y-3 w-full text-center md:text-left">
                      <div>
                        <h4 className={`text-xl font-bold font-display ${isDark ? 'text-white' : 'text-slate-900'}`}>{tbl.tableName}</h4>
                        <p className={`text-xs break-all whitespace-normal mb-1.5 select-all ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{scanLink}</p>
                        <span className={`font-mono text-[10px] px-2 py-0.5 rounded ${isDark ? 'bg-slate-800 text-slate-400' : 'bg-slate-100 text-slate-600'}`}>ID: {tbl.id}</span>
                      </div>
                      <div className="flex flex-wrap gap-2 justify-center md:justify-start pt-2">
                        <a href={scanLink} target="_blank" rel="noreferrer" className="px-3 py-1.5 rounded-lg bg-amber-500 text-slate-950 hover:bg-amber-600 font-bold text-[11px] uppercase transition-colors">Test Menu Link</a>
                        <button
                          onClick={() => { setPrintTable(tbl); setIsPrintModalOpen(true); }}
                          className="px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 font-bold text-[11px] uppercase transition-colors flex items-center gap-1 text-slate-950 cursor-pointer"
                        >
                          <FiPrinter className="text-sm shrink-0" /> Print QR
                        </button>
                        <button onClick={() => window.print()} className={`px-3 py-1.5 rounded-lg font-semibold text-[11px] uppercase transition-colors flex items-center gap-1 ${isDark ? 'bg-slate-800 hover:bg-slate-700 text-slate-300' : 'bg-slate-100 hover:bg-slate-200 text-slate-600'}`}><FiPrinter /> Print Sheet</button>
                        <button onClick={() => handleDeleteTable(tbl.id)} className="p-1.5 rounded-lg bg-rose-50 text-rose-500 hover:bg-rose-100 border border-rose-100 transition-colors cursor-pointer ml-auto"><FiTrash2 /></button>
                      </div>
                    </div>
                  </div>
                );
              })}
              {tables.length === 0 && <div className={`col-span-full text-center py-10 rounded-2xl border border-dashed ${isDark ? 'border-slate-700 text-slate-500' : 'border-slate-300 text-slate-400'}`}>No tables added yet.</div>}
            </div>
          </div>
        )}

        {/* ── TAB 5: ORDERS ─────────────────────── */}
        {activeTab === 'orders' && (
          <div className="animate-fade-in space-y-6">
            <div>
              <h1 className={`text-3xl font-bold font-display tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>Active Table Orders</h1>
              <p className={`text-sm mt-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Accept incoming orders, forward to Kitchen, or mark served.</p>
            </div>

            <div className={`rounded-2xl border overflow-hidden shadow-sm ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className={`border-b text-xs font-semibold uppercase ${isDark ? 'border-slate-800 text-slate-400' : 'border-slate-200 text-slate-400 bg-slate-50'}`}>
                      <th className="px-6 py-3.5">Order ID / Time</th>
                      <th className="px-6 py-3.5">Source</th>
                      <th className="px-6 py-3.5">Items</th>
                      <th className="px-6 py-3.5">Total Amount</th>
                      <th className="px-6 py-3.5">Status</th>
                      <th className="px-6 py-3.5 text-right">Update Stage</th>
                    </tr>
                  </thead>
                  <tbody className={`divide-y ${isDark ? 'divide-slate-800 text-slate-300' : 'divide-slate-100 text-slate-700'}`}>
                    {orders.map(order => {
                      const itemSummary = order.items.map(i => `${i.name} x${i.quantity}`).join(', ');
                      return (
                        <tr key={order.id} className={`transition-colors ${isDark ? 'hover:bg-slate-800/40' : 'hover:bg-slate-50/50'}`}>
                          <td className="px-6 py-4">
                            <span className={`font-mono font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>{order.id}</span>
                            <div className={`text-[10px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{new Date(order.createdAt).toLocaleTimeString()}</div>
                          </td>
                          <td className={`px-6 py-4 font-semibold ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>{order.tableName || 'Table'}</td>
                          <td className="px-6 py-4 max-w-sm">
                            <p className={`truncate text-xs font-medium ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>{itemSummary}</p>
                            {order.notes && <p className="text-[10px] text-rose-500 font-medium truncate mt-0.5">Note: {order.notes}</p>}
                          </td>
                          <td className={`px-6 py-4 font-mono font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                            ₹{(order.grandTotal || order.totalAmount || 0).toFixed(2)}
                          </td>
                          <td className="px-6 py-4">
                            <span className={`inline-flex items-center gap-0.5 text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${order.status === 'pending' ? 'bg-amber-100 text-amber-700 border border-amber-200' :
                                order.status === 'accepted' ? 'bg-blue-100 text-blue-700 border border-blue-200' :
                                  order.status === 'preparing' ? 'bg-indigo-100 text-indigo-700 border border-indigo-200' :
                                    order.status === 'ready' ? 'bg-pink-100 text-pink-700 border border-pink-200' :
                                      order.status === 'served' ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' :
                                        order.status === 'completed' ? 'bg-teal-100 text-teal-700 border border-teal-200' :
                                          'bg-slate-100 text-slate-500 border'
                              }`}>
                              {order.status}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <select value={order.status} onChange={(e) => handleUpdateStatus(order.id, e.target.value)} className={`border rounded-lg px-2 py-1 text-xs font-semibold focus:outline-none focus:border-amber-500 ${isDark ? 'bg-slate-800 border-slate-700 text-slate-200' : 'bg-slate-50 border-slate-200 text-slate-700'}`}>
                              <option value="pending">Pending</option>
                              <option value="accepted">Accepted</option>
                              <option value="preparing">Preparing</option>
                              <option value="ready">Ready</option>
                              <option value="served">Served</option>
                              <option value="completed">Completed</option>
                              <option value="cancelled">Cancelled</option>
                            </select>
                          </td>
                        </tr>
                      );
                    })}
                    {orders.length === 0 && (
                      <tr><td colSpan="6" className={`text-center py-10 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>No active orders yet. Place one from the Menu!</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ── TAB 6: COUPONS ────────────────────── */}
        {activeTab === 'coupons' && (
          <div className="animate-fade-in space-y-6">
            <div className="flex justify-between items-center">
              <div>
                <h1 className={`text-3xl font-bold font-display tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>Active Coupons</h1>
                <p className={`text-sm mt-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Generate discount coupon codes to boost table size and recurring orders.</p>
              </div>
              <button onClick={() => setShowAddCoupon(!showAddCoupon)} className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded-xl text-sm transition-all shadow-md flex items-center gap-1.5 cursor-pointer">
                <FiPlus /> New Coupon
              </button>
            </div>

            {showAddCoupon && (
              <form onSubmit={handleAddCoupon} className={`p-6 rounded-2xl border shadow-xl max-w-md animate-fade-in space-y-4 ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
                <h3 className={`font-bold text-base ${isDark ? 'text-white' : 'text-slate-900'}`}>Add Coupon Code</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className={labelCls}>Coupon Code</label>
                    <input type="text" required placeholder="e.g. SPECIAL15" value={newCoupon.code} onChange={(e) => setNewCoupon({ ...newCoupon, code: e.target.value })} className={inputCls + ' uppercase'} />
                  </div>
                  <div>
                    <label className={labelCls}>Min Order Size (₹)</label>
                    <input type="number" placeholder="200" value={newCoupon.minOrderAmount} onChange={(e) => setNewCoupon({ ...newCoupon, minOrderAmount: e.target.value })} className={inputCls} />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className={labelCls}>Discount Type</label>
                    <select value={newCoupon.discountType} onChange={(e) => setNewCoupon({ ...newCoupon, discountType: e.target.value })} className={inputCls}>
                      <option value="percent">Percent (%)</option>
                      <option value="fixed">Fixed Amount (₹)</option>
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}>Discount Value</label>
                    <input type="number" required placeholder="15" value={newCoupon.discountValue} onChange={(e) => setNewCoupon({ ...newCoupon, discountValue: e.target.value })} className={inputCls} />
                  </div>
                </div>
                <div className="flex gap-2 justify-end pt-2">
                  <button type="button" onClick={() => setShowAddCoupon(false)} className={`px-4 py-2 rounded-lg text-xs font-semibold ${isDark ? 'bg-slate-800 text-slate-400' : 'bg-slate-100 text-slate-500'}`}>Cancel</button>
                  <button type="submit" className="px-4 py-2 bg-amber-500 hover:bg-amber-600 rounded-lg text-xs font-bold text-slate-950">Add Coupon</button>
                </div>
              </form>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {coupons.map(cp => (
                <div key={cp.id} className={`p-5 rounded-2xl border shadow-sm flex items-center justify-between ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
                  <div className="space-y-1">
                    <span className={`font-mono text-base font-extrabold tracking-wider px-3 py-1 rounded border ${isDark ? 'bg-slate-800 text-slate-100 border-slate-700' : 'bg-slate-100 text-slate-900 border-slate-200'}`}>{cp.code}</span>
                    <p className={`text-xs font-medium pt-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                      {cp.discountType === 'percent' ? `${cp.discountValue}% Off` : `₹${cp.discountValue} Off`}
                      <span> on orders over ₹{cp.minOrderAmount || 0}</span>
                    </p>
                  </div>
                  <button onClick={() => handleDeleteCoupon(cp.id)} className="p-1.5 rounded-lg bg-rose-50 text-rose-500 hover:bg-rose-100 hover:text-rose-600 transition-colors border border-rose-100 cursor-pointer"><FiTrash2 /></button>
                </div>
              ))}
              {coupons.length === 0 && (
                <div className={`col-span-full text-center py-10 rounded-2xl border border-dashed ${isDark ? 'border-slate-700 text-slate-500' : 'border-slate-300 text-slate-400'}`}>No promo coupons available yet.</div>
              )}
            </div>
          </div>
        )}

        {/* ── TAB KDS: KDS MANAGEMENT ─────────── */}
        {activeTab === 'kds' && currentRest && (
          <div className="animate-fade-in space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h1 className={`text-3xl font-bold font-display tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>KDS Management</h1>
                <p className={`text-sm mt-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Manage secure access credentials for individual Kitchen Display Screens.</p>
              </div>
              <button
                onClick={() => {
                  if (kitchenAccessList.length >= getKdsLimitNum(currentRest.kdsLimit)) {
                    alert(`You have reached your KDS Limit of ${currentRest.kdsLimit || '2'} screens. Please contact support to upgrade your limit.`);
                    return;
                  }
                  setShowAddKitchen(!showAddKitchen);
                  setEditingKitchenId(null);
                }}
                className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded-xl text-sm transition-all shadow-md flex items-center gap-1.5 cursor-pointer self-start sm:self-auto"
              >
                <FiPlus /> New Kitchen Screen
              </button>
            </div>

            {/* Limits Card */}
            <div className={`p-6 rounded-2xl border ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
              <div className="flex justify-between items-center mb-2 text-sm font-semibold">
                <span className={isDark ? 'text-slate-400' : 'text-slate-600'}>Active Screens Allocation</span>
                <span className={isDark ? 'text-emerald-400' : 'text-emerald-600'}>
                  {kitchenAccessList.length} of {currentRest.kdsLimit || '2'} Screens Used
                </span>
              </div>
              <div className="w-full h-2.5 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-500 transition-all duration-500"
                  style={{
                    width: `${Math.min(100, (kitchenAccessList.length / (getKdsLimitNum(currentRest.kdsLimit) === Infinity ? 10 : getKdsLimitNum(currentRest.kdsLimit))) * 100)}%`
                  }}
                />
              </div>
              <p className="text-[11px] text-slate-500 mt-2">
                Your subscription plan limits you to a maximum of {currentRest.kdsLimit || '2'} concurrent kitchen displays. Need more screens? Contact the platform administrator.
              </p>
            </div>

            {/* Add Kitchen Form */}
            {showAddKitchen && (
              <form onSubmit={handleAddKitchenAccess} className={`p-6 rounded-2xl border shadow-xl max-w-md animate-fade-in space-y-4 ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
                <h3 className={`font-bold text-base ${isDark ? 'text-white' : 'text-slate-900'}`}>Add Kitchen Display Screen</h3>
                <div>
                  <label className={labelCls}>Kitchen Screen Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Main Kitchen, Bar, Bakery"
                    value={newKitchenName}
                    onChange={(e) => setNewKitchenName(e.target.value)}
                    className={inputCls}
                  />
                </div>
                <div className="flex gap-2 justify-end pt-2">
                  <button type="button" onClick={() => setShowAddKitchen(false)} className={`px-4 py-2 rounded-lg text-xs font-semibold ${isDark ? 'bg-slate-800 text-slate-400' : 'bg-slate-100 text-slate-500'}`}>Cancel</button>
                  <button type="submit" className="px-4 py-2 bg-amber-500 hover:bg-amber-600 rounded-lg text-xs font-bold text-slate-950">Register Screen</button>
                </div>
              </form>
            )}

            {/* Edit/Rename Kitchen Form */}
            {editingKitchenId && (
              <form onSubmit={handleRenameKitchen} className={`p-6 rounded-2xl border shadow-xl max-w-md animate-fade-in space-y-4 ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
                <h3 className={`font-bold text-base ${isDark ? 'text-white' : 'text-slate-900'}`}>Rename Kitchen Screen</h3>
                <div>
                  <label className={labelCls}>Kitchen Screen Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Desserts"
                    value={editingKitchenName}
                    onChange={(e) => setEditingKitchenName(e.target.value)}
                    className={inputCls}
                  />
                </div>
                <div className="flex gap-2 justify-end pt-2">
                  <button type="button" onClick={() => { setEditingKitchenId(null); setEditingKitchenName(''); }} className={`px-4 py-2 rounded-lg text-xs font-semibold ${isDark ? 'bg-slate-800 text-slate-400' : 'bg-slate-100 text-slate-500'}`}>Cancel</button>
                  <button type="submit" className="px-4 py-2 bg-amber-500 hover:bg-amber-600 rounded-lg text-xs font-bold text-slate-950">Save Rename</button>
                </div>
              </form>
            )}

            {/* Kitchen Displays Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {kitchenAccessList.map(item => (
                <div key={item.id} className={`p-6 rounded-2xl border shadow-sm flex flex-col justify-between gap-4 ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
                  <div>
                    <div className="flex justify-between items-start mb-2">
                      <h3 className={`font-bold text-base ${isDark ? 'text-white' : 'text-slate-900'}`}>{item.kitchenName}</h3>
                      <span className={`inline-flex items-center text-[10px] px-2 py-0.5 rounded-full font-extrabold uppercase tracking-wider ${item.status === 'active'
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                        }`}>
                        {item.status}
                      </span>
                    </div>

                    <div className="space-y-3 mt-4">
                      {/* Access Key */}
                      <div>
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Access Key</span>
                        <div className={`flex items-center justify-between p-2 rounded-lg font-mono text-xs ${isDark ? 'bg-slate-950 border-slate-800 text-amber-400' : 'bg-slate-50 border-slate-200 text-slate-800'} border`}>
                          <span>{item.accessKey}</span>
                          <button
                            type="button"
                            onClick={() => {
                              navigator.clipboard.writeText(item.accessKey);
                              showToast("Access Key copied to clipboard!");
                            }}
                            className="text-[10px] font-bold text-amber-500 hover:underline px-1.5"
                          >
                            Copy
                          </button>
                        </div>
                      </div>

                      {/* PIN */}
                      <div>
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Kitchen PIN</span>
                        <div className={`flex items-center justify-between p-2 rounded-lg font-mono text-xs ${isDark ? 'bg-slate-950 border-slate-800 text-amber-400' : 'bg-slate-50 border-slate-200 text-slate-800'} border`}>
                          <span>{item.pin}</span>
                          <button
                            type="button"
                            onClick={() => {
                              navigator.clipboard.writeText(item.pin);
                              showToast("PIN copied to clipboard!");
                            }}
                            className="text-[10px] font-bold text-amber-500 hover:underline px-1.5"
                          >
                            Copy
                          </button>
                        </div>
                      </div>

                      <div className="text-[10px] text-slate-500 pt-1 flex justify-between">
                        <span>Created: {new Date(item.createdAt).toLocaleDateString()}</span>
                        <span>Last Active: {item.lastUsed === 'Never' ? 'Never' : new Date(item.lastUsed).toLocaleTimeString()}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2 pt-4 border-t border-slate-800/20">
                    <button
                      onClick={() => {
                        setEditingKitchenId(item.id);
                        setEditingKitchenName(item.kitchenName);
                        setShowAddKitchen(false);
                      }}
                      className={`px-2.5 py-1.5 text-xs rounded-lg font-medium flex-1 text-center border ${isDark
                          ? 'border-slate-800 text-slate-300 hover:bg-slate-800'
                          : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                        }`}
                    >
                      Rename
                    </button>
                    <button
                      onClick={() => handleToggleKitchenStatus(item.id, item.status)}
                      className={`px-2.5 py-1.5 text-xs rounded-lg font-medium flex-1 text-center border ${item.status === 'active'
                          ? 'border-amber-500/20 text-amber-400 bg-amber-500/5 hover:bg-amber-500/10'
                          : 'border-emerald-500/20 text-emerald-400 bg-emerald-500/5 hover:bg-emerald-500/10'
                        }`}
                    >
                      {item.status === 'active' ? 'Disable' : 'Enable'}
                    </button>
                    <button
                      onClick={() => handleRegenerateKeys(item.id, item.kitchenName)}
                      title="Regenerate access codes"
                      className={`p-1.5 text-xs rounded-lg font-medium border ${isDark
                          ? 'border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800'
                          : 'border-slate-200 text-slate-500 hover:bg-slate-100'
                        }`}
                    >
                      Regen
                    </button>
                    <button
                      onClick={() => handleDeleteKitchenAccess(item.id, item.kitchenName)}
                      className="p-1.5 text-xs rounded-lg text-rose-500 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20"
                    >
                      <FiTrash2 />
                    </button>
                  </div>
                </div>
              ))}
              {kitchenAccessList.length === 0 && (
                <div className={`col-span-full text-center py-10 rounded-2xl border border-dashed ${isDark ? 'border-slate-700 text-slate-500' : 'border-slate-300 text-slate-400'}`}>
                  No kitchen displays registered yet. Click "New Kitchen Screen" to generate secure credentials.
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── TAB FLOORMAP: FLOOR MAP ─────────── */}
        {activeTab === 'floormap' && currentRest && (
          <FloorMapManager
            restaurantId={currentRest.id}
            physicalTables={tables}
            orders={orders}
          />
        )}

        {/* ── TAB 7: SETTINGS ───────────────────── */}
        {activeTab === 'settings' && currentRest && (
          <div className="animate-fade-in space-y-6 max-w-3xl">
            <div>
              <h1 className={`text-3xl font-bold font-display tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>Store Settings</h1>
              <p className={`text-sm mt-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Configure restaurant display name, logo, theme colors, and tax structures.</p>
            </div>

            <form onSubmit={handleSaveSettings} className={`p-6 rounded-2xl border shadow-sm space-y-6 ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div>
                  <label className={labelCls}>Restaurant Display Name</label>
                  <input type="text" required value={currentRest.name} onChange={(e) => setCurrentRest({ ...currentRest, name: e.target.value })} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Tax Rate (%)</label>
                  <input type="number" required value={currentRest.taxRate} onChange={(e) => setCurrentRest({ ...currentRest, taxRate: e.target.value })} className={inputCls} />
                </div>
              </div>
              <div>
                <label className={labelCls}>Short Description / Subtitle</label>
                <input type="text" required value={currentRest.description || ''} onChange={(e) => setCurrentRest({ ...currentRest, description: e.target.value })} className={inputCls} />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div>
                  <label className={labelCls}>Store Logo Image URL</label>
                  <input type="url" value={currentRest.logoUrl || ''} onChange={(e) => setCurrentRest({ ...currentRest, logoUrl: e.target.value })} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Brand Primary Theme Color</label>
                  <div className="flex gap-3">
                    <input type="color" value={currentRest.themeColor || '#10b981'} onChange={(e) => setCurrentRest({ ...currentRest, themeColor: e.target.value })} className={`border rounded-xl h-10 w-16 p-1 focus:outline-none cursor-pointer ${isDark ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-200'}`} />
                    <input type="text" value={currentRest.themeColor || '#10b981'} disabled className={`flex-1 border rounded-xl px-4 py-2 text-sm font-mono ${isDark ? 'bg-slate-800 border-slate-700 text-slate-400' : 'bg-slate-100 border-slate-200 text-slate-500'}`} />
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div>
                  <label className={labelCls}>Physical Address</label>
                  <input type="text" value={currentRest.address || ''} onChange={(e) => setCurrentRest({ ...currentRest, address: e.target.value })} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Contact Number</label>
                  <input type="text" value={currentRest.contact || ''} onChange={(e) => setCurrentRest({ ...currentRest, contact: e.target.value })} className={inputCls} />
                </div>
              </div>
              <div className={`pt-4 border-t flex items-center justify-between ${isDark ? 'border-slate-800' : 'border-slate-100'}`}>
                <button type="submit" className="px-6 py-2.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded-xl text-sm transition-all shadow cursor-pointer">
                  Save Store Settings
                </button>
                {settingsStatus && <span className="text-xs font-semibold text-emerald-500 animate-pulse">{settingsStatus}</span>}
              </div>
            </form>
          </div>
        )}
      </main>

      {/* Real-time Order Notification Toast */}
      {currentNotification && (
        <div className={`fixed top-4 right-4 z-50 w-full max-w-sm p-4 bg-[#16a34a] text-white rounded-2xl shadow-xl border border-emerald-500/30 flex items-start gap-3 select-none ${isFadingOut ? 'animate-fade-out-right' : 'animate-slide-in-right'
          }`}>
          <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center font-bold text-lg text-white shrink-0">
            🔔
          </div>
          <div className="flex-1">
            <h4 className="font-extrabold text-sm tracking-tight">New Order Received</h4>
            <p className="text-xs font-semibold opacity-90 mt-0.5">Table No: {currentNotification.tableName}</p>
            <p className="text-[10px] font-mono opacity-80 mt-1">Order #{currentNotification.orderId}</p>
          </div>
          <button
            onClick={handleCloseNotification}
            className="p-1 rounded-lg hover:bg-white/10 active:bg-white/20 text-white transition-colors cursor-pointer"
          >
            <FiX className="text-base" />
          </button>
        </div>
      )}

      {/* Admin Action Success Toast */}
      {adminSuccessToast && (
        <div className="fixed bottom-4 right-4 z-50 w-full max-w-sm p-4 bg-[#16a34a] text-white rounded-2xl shadow-xl border border-emerald-500/30 flex items-center gap-3 select-none animate-slide-in-right">
          <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center font-bold text-lg text-white shrink-0">
            ✓
          </div>
          <div className="flex-1 text-sm font-semibold">
            {adminSuccessToast}
          </div>
          <button
            onClick={() => setAdminSuccessToast('')}
            className="p-1 rounded-lg hover:bg-white/10 active:bg-white/20 text-white transition-colors cursor-pointer"
          >
            <FiX className="text-base" />
          </button>
        </div>
      )}

      <QRPrintSystem
        isOpen={isPrintModalOpen}
        onClose={() => { setIsPrintModalOpen(false); setPrintTable(null); }}
        table={printTable}
        restaurant={currentRest}
        isDark={isDark}
      />
    </div>
  );
}
