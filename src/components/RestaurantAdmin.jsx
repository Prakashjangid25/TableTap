import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { jsPDF } from 'jspdf';
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
  FiMap,
  FiCalendar,
  FiChevronDown,
  FiDownload,
  FiDollarSign
} from 'react-icons/fi';
import FloorMapManager from './FloorMapManager.jsx';
import BillingSystem from './BillingSystem.jsx';
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
  const [dateFilter, setDateFilter] = useState('today');
  const [isFilterDropdownOpen, setIsFilterDropdownOpen] = useState(false);
  const [ordersDateFilter, setOrdersDateFilter] = useState('today');
  const [isOrdersFilterDropdownOpen, setIsOrdersFilterDropdownOpen] = useState(false);
  const [orderToDelete, setOrderToDelete] = useState(null);

  // Export & Delete states
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [selectedExportMonth, setSelectedExportMonth] = useState('');
  const [exportFormats, setExportFormats] = useState({ pdf: true, xlsx: true, csv: true });
  const [exportStep, setExportStep] = useState(1); // 1 = select & export, 2 = confirm delete prompt
  const [isExporting, setIsExporting] = useState(false);

  // Close custom dropdowns on click outside
  useEffect(() => {
    if (!isFilterDropdownOpen && !isOrdersFilterDropdownOpen) return;
    const handleOutsideClick = () => {
      setIsFilterDropdownOpen(false);
      setIsOrdersFilterDropdownOpen(false);
    };
    document.addEventListener('click', handleOutsideClick);
    return () => document.removeEventListener('click', handleOutsideClick);
  }, [isFilterDropdownOpen, isOrdersFilterDropdownOpen]);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [isSuspended, setIsSuspended] = useState(false);
  const wasActive = React.useRef(false);

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
    if (!user || !selectedRestId || isSuspended) return;
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

  // Load restaurant metadata and watch status in real-time
  useEffect(() => {
    if (!user || !selectedRestId) return;

    const restDocRef = doc(db, 'restaurants', selectedRestId);
    const unsubscribe = onSnapshot(restDocRef, async (docSnap) => {
      if (docSnap.exists()) {
        const r = { id: docSnap.id, ...docSnap.data() };

        if (r.status === 'suspended') {
          if (wasActive.current) {
            // Real-time suspension: log out and clear session immediately
            await logOut();
            return;
          } else {
            // Just logged in, show suspended screen
            setIsSuspended(true);
            return;
          }
        } else if (r.status === 'active') {
          wasActive.current = true;
          setIsSuspended(false);
        }

        setCurrentRest(r);

        try {
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
        } catch (err) {
          console.error("Error loading restaurant collections:", err);
        }
      }
    }, (error) => {
      console.error("Firestore restaurant status error:", error);
    });

    return () => unsubscribe();
  }, [selectedRestId, user]);

  // Real-time listener for orders using Firebase Firestore
  useEffect(() => {
    if (!user || !selectedRestId || isSuspended) return;

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

  const formatOrderDateTime = (createdAtStr) => {
    if (!createdAtStr) return { date: '-', time: '-' };
    const d = new Date(createdAtStr);
    if (isNaN(d.getTime())) return { date: '-', time: '-' };

    const day = d.getDate();
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const month = months[d.getMonth()];
    const year = d.getFullYear();
    const dateFormatted = `${day} ${month} ${year}`;

    let hours = d.getHours();
    const minutes = d.getMinutes();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12;
    const minutesStr = minutes < 10 ? '0' + minutes : minutes;
    const timeFormatted = `${hours}:${minutesStr} ${ampm}`;

    return { date: dateFormatted, time: timeFormatted };
  };

  const handleDeleteOrder = async (orderId) => {
    if (!currentRest) return;
    try {
      const orderRef = doc(db, "restaurants", currentRest.id, "orders", orderId);
      await deleteDoc(orderRef);
      setOrderToDelete(null);
      setAdminSuccessToast('Order permanently deleted successfully.');
      setTimeout(() => setAdminSuccessToast(''), 3000);
      refreshCollections();
    } catch (err) {
      console.error("Error permanently deleting order: ", err);
    }
  };

  const getExportMonthOptions = () => {
    const options = [];
    const now = new Date();
    for (let i = 0; i < 12; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const label = d.toLocaleString('default', { month: 'long', year: 'numeric' });
      const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      options.push({ label, value });
    }
    return options;
  };

  const getOrdersForMonth = (monthVal) => {
    if (!monthVal) return [];
    const [year, month] = monthVal.split('-').map(Number);
    return orders.filter(o => {
      if (!o.createdAt) return false;
      const od = new Date(o.createdAt);
      if (isNaN(od.getTime())) return false;
      return od.getFullYear() === year && (od.getMonth() + 1) === month;
    });
  };

  const handleExportFiles = async () => {
    if (!selectedExportMonth) return;
    setIsExporting(true);

    const ordersForMonth = getOrdersForMonth(selectedExportMonth);
    const monthsList = getExportMonthOptions();
    const selectedMonthLabel = monthsList.find(m => m.value === selectedExportMonth)?.label || selectedExportMonth;

    if (ordersForMonth.length === 0) {
      alert("No orders found for the selected month.");
      setIsExporting(false);
      return;
    }

    // PDF Export
    if (exportFormats.pdf) {
      try {
        const docPDF = new jsPDF('p', 'mm', 'a4');
        docPDF.setFont("helvetica", "normal");

        // Title
        docPDF.setFontSize(18);
        docPDF.setTextColor(30, 41, 59);
        docPDF.text("MONTHLY ORDERS REPORT", 14, 20);

        // Meta Information
        docPDF.setFontSize(10);
        docPDF.setTextColor(100, 116, 139);
        docPDF.text(`Restaurant: ${currentRest?.name || 'TableTap Restaurant'}`, 14, 28);
        docPDF.text(`Address: ${currentRest?.address || 'N/A'}`, 14, 34);
        docPDF.text(`Period: ${selectedMonthLabel}`, 14, 40);
        docPDF.text(`Exported On: ${new Date().toLocaleDateString()}`, 14, 46);

        // Horizontal Rule
        docPDF.setDrawColor(226, 232, 240);
        docPDF.line(14, 52, 196, 52);

        // Table Header
        docPDF.setFontSize(9);
        docPDF.setFont("helvetica", "bold");
        docPDF.setTextColor(71, 85, 105);
        docPDF.text("ID", 14, 60);
        docPDF.text("Date & Time", 35, 60);
        docPDF.text("Table", 70, 60);
        docPDF.text("Items & Qty", 90, 60);
        docPDF.text("Total", 160, 60);
        docPDF.text("Status", 180, 60);

        docPDF.line(14, 64, 196, 64);
        docPDF.setFont("helvetica", "normal");
        docPDF.setTextColor(51, 65, 85);

        let y = 70;
        ordersForMonth.forEach((o) => {
          if (y > 275) {
            docPDF.addPage();
            y = 20;
            docPDF.setFont("helvetica", "bold");
            docPDF.text("ID", 14, y);
            docPDF.text("Date & Time", 35, y);
            docPDF.text("Table", 70, y);
            docPDF.text("Items & Qty", 90, y);
            docPDF.text("Total", 160, y);
            docPDF.text("Status", 180, y);
            docPDF.line(14, y + 4, 196, y + 4);
            docPDF.setFont("helvetica", "normal");
            y += 10;
          }

          const { date, time } = formatOrderDateTime(o.createdAt);
          const tableNo = o.tableName || 'Table';
          const totalStr = `INR ${(o.grandTotal || o.totalAmount || 0).toFixed(0)}`;
          const statusStr = o.status || 'Pending';

          const itemsStr = o.items.map(i => `${i.name} (x${i.quantity})`).join(', ');
          const itemText = itemsStr.length > 38 ? itemsStr.substring(0, 35) + '...' : itemsStr;

          docPDF.text(o.id.substring(0, 10), 14, y);
          docPDF.text(`${date} ${time}`, 35, y);
          docPDF.text(tableNo, 70, y);
          docPDF.text(itemText, 90, y);
          docPDF.text(totalStr, 160, y);
          docPDF.text(statusStr, 180, y);

          y += 8;
        });

        docPDF.save(`Orders_${selectedMonthLabel.replace(/\s+/g, '_')}.pdf`);
      } catch (err) {
        console.error("Error generating PDF: ", err);
      }
    }

    // Excel Export
    if (exportFormats.xlsx) {
      try {
        const excelTemplate = `
          <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
          <head>
            <meta charset="utf-8" />
            <!--[if gte mso 9]><xml><x:ExcelWorkbook><x:ExcelWorksheets><x:ExcelWorksheet><x:Name>Orders Export</x:Name><x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions></x:ExcelWorksheet></x:ExcelWorksheets></x:ExcelWorkbook></xml><![endif]-->
            <style>
              body { font-family: Arial, sans-serif; }
              .header { font-size: 16px; font-weight: bold; margin-bottom: 20px; }
              table { border-collapse: collapse; width: 100%; }
              th { background-color: #f2f2f2; border: 1px solid #dddddd; padding: 8px; text-align: left; font-weight: bold; }
              td { border: 1px solid #dddddd; padding: 8px; text-align: left; }
              .meta-table { margin-bottom: 20px; }
              .meta-table td { border: none; padding: 4px; font-size: 12px; }
            </style>
          </head>
          <body>
            <div class="header">Monthly Orders Export - ${currentRest?.name || 'TableTap'}</div>
            <table class="meta-table">
              <tr><td><strong>Restaurant:</strong></td><td>${currentRest?.name || 'TableTap'}</td></tr>
              <tr><td><strong>Address:</strong></td><td>${currentRest?.address || 'N/A'}</td></tr>
              <tr><td><strong>Month & Year:</strong></td><td>${selectedMonthLabel}</td></tr>
              <tr><td><strong>Export Date:</strong></td><td>${new Date().toLocaleDateString()}</td></tr>
            </table>
            <table>
              <thead>
                <tr>
                  <th>Order ID</th>
                  <th>Date</th>
                  <th>Time</th>
                  <th>Table Number</th>
                  <th>Items</th>
                  <th>Quantity</th>
                  <th>Total Amount (INR)</th>
                  <th>Payment Status</th>
                  <th>Order Status</th>
                </tr>
              </thead>
              <tbody>
                ${ordersForMonth.map(o => {
          const { date, time } = formatOrderDateTime(o.createdAt);
          const itemNames = o.items.map(i => i.name).join(', ');
          const itemQuantities = o.items.map(i => i.quantity).join(', ');
          return `
                    <tr>
                      <td>${o.id}</td>
                      <td>${date}</td>
                      <td>${time}</td>
                      <td>${o.tableName || 'Table'}</td>
                      <td>${itemNames}</td>
                      <td>${itemQuantities}</td>
                      <td>${(o.grandTotal || o.totalAmount || 0).toFixed(2)}</td>
                      <td>${o.paymentStatus || 'Pending'}</td>
                      <td>${o.status}</td>
                    </tr>
                  `;
        }).join('')}
              </tbody>
            </table>
          </body>
          </html>
        `;

        const blob = new Blob([excelTemplate], { type: 'application/vnd.ms-excel;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Orders_${selectedMonthLabel.replace(/\s+/g, '_')}.xls`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } catch (err) {
        console.error("Error generating Excel: ", err);
      }
    }

    // CSV Export
    if (exportFormats.csv) {
      try {
        const metadata = [
          `Restaurant Name,${(currentRest?.name || 'TableTap Restaurant').replace(/,/g, ' ')}`,
          `Restaurant Address,${(currentRest?.address || 'N/A').replace(/,/g, ' ')}`,
          `Month & Year,${selectedMonthLabel}`,
          `Export Date,${new Date().toLocaleDateString()}`,
          ``,
        ];

        const headers = ["Order ID", "Date", "Time", "Table Number", "Items", "Quantity", "Total Amount (INR)", "Payment Status", "Order Status"];
        const rows = ordersForMonth.map(o => {
          const { date, time } = formatOrderDateTime(o.createdAt);
          const itemNames = o.items.map(i => i.name).join('; ');
          const itemQuantities = o.items.map(i => i.quantity).join('; ');
          const totalAmount = (o.grandTotal || o.totalAmount || 0).toFixed(2);
          return [
            o.id,
            date,
            time,
            o.tableName || 'Table',
            `"${itemNames.replace(/"/g, '""')}"`,
            `"${itemQuantities}"`,
            totalAmount,
            o.paymentStatus || 'Pending',
            o.status
          ];
        });

        const csvContent = [...metadata, headers.join(','), ...rows.map(r => r.join(','))].join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Orders_${selectedMonthLabel.replace(/\s+/g, '_')}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } catch (err) {
        console.error("Error generating CSV: ", err);
      }
    }

    setIsExporting(false);
    setExportStep(2); // Prompt for deletion step next!
  };

  const handleDeleteMonthOrders = async () => {
    if (!currentRest || !selectedExportMonth) return;
    try {
      const ordersForMonth = getOrdersForMonth(selectedExportMonth);
      if (ordersForMonth.length === 0) return;

      const deletePromises = ordersForMonth.map(o => {
        const orderRef = doc(db, "restaurants", currentRest.id, "orders", o.id);
        return deleteDoc(orderRef);
      });

      await Promise.all(deletePromises);
      setAdminSuccessToast(`Successfully deleted ${ordersForMonth.length} exported orders.`);
      setTimeout(() => setAdminSuccessToast(''), 3000);

      // Close modal and reset states
      setIsExportModalOpen(false);
      setSelectedExportMonth('');
      setExportStep(1);
      refreshCollections();
    } catch (err) {
      console.error("Error permanently deleting month orders: ", err);
    }
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
      taxRate: Number(currentRest.taxRate), address: currentRest.address, contact: currentRest.contact,
      showPoweredBy: currentRest.showPoweredBy ?? false
    });
    setSettingsStatus('Settings updated successfully!');
    setTimeout(() => setSettingsStatus(''), 3000);
  };

  // Helper to determine if an order falls into the selected date range
  const isOrderInDateFilter = (createdAtStr) => {
    if (!createdAtStr) return false;
    const now = new Date();
    const orderDate = new Date(createdAtStr);
    if (isNaN(orderDate.getTime())) return false;

    if (dateFilter === 'today') {
      return orderDate.toDateString() === now.toDateString();
    } else if (dateFilter === 'month') {
      return orderDate.getMonth() === now.getMonth() &&
        orderDate.getFullYear() === now.getFullYear();
    } else if (dateFilter === 'year') {
      return orderDate.getFullYear() === now.getFullYear();
    }
    return true;
  };

  // Helper to determine if an order falls into the selected date range for the Orders tab
  const isOrderInOrdersDateFilter = (createdAtStr) => {
    if (!createdAtStr) return false;
    const now = new Date();
    const orderDate = new Date(createdAtStr);
    if (isNaN(orderDate.getTime())) return false;

    if (ordersDateFilter === 'today') {
      return orderDate.toDateString() === now.toDateString();
    } else if (ordersDateFilter === 'month') {
      return orderDate.getMonth() === now.getMonth() &&
        orderDate.getFullYear() === now.getFullYear();
    } else if (ordersDateFilter === 'year') {
      return orderDate.getFullYear() === now.getFullYear();
    }
    return true;
  };

  // Calculations
  const filteredOrdersForMetrics = orders.filter(o => isOrderInDateFilter(o.createdAt));
  const totalSales = filteredOrdersForMetrics.filter(o => o.status === 'completed' || o.status === 'served').reduce((acc, curr) => acc + (curr.grandTotal || 0), 0);
  const ordersCount = filteredOrdersForMetrics.length;
  const pendingOrdersCount = orders.filter(o => o.status === 'pending').length;
  const filteredOrdersForDisplay = orders.filter(o => isOrderInOrdersDateFilter(o.createdAt));

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

  // ═══════════════════════════════════════════════
  // SUSPENDED SCREEN
  // ═══════════════════════════════════════════════
  if (isSuspended) {
    return (
      <div className={`min-h-screen font-sans flex items-center justify-center p-4 ${isDark ? 'bg-slate-950 text-white' : 'bg-slate-50 text-slate-800'}`}>
        <div className={`w-full max-w-md p-8 rounded-2xl border shadow-2xl text-center animate-fade-in ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200/80'
          }`}>
          <div className="w-16 h-16 bg-rose-500/10 border border-rose-500/20 text-rose-500 rounded-full flex items-center justify-center mx-auto mb-6">
            <FiAlertTriangle className="text-3xl" />
          </div>
          <h2 className={`text-2xl font-bold font-display tracking-tight mb-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>
            Account Suspended
          </h2>
          <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-600'} mb-1`}>
            Your account has been suspended by the Super Admin.
          </p>
          <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-600'} mb-8`}>
            Please contact the Super Admin to reactivate your subscription.
          </p>
          <button
            onClick={async () => {
              setIsSuspended(false);
              await logOut();
            }}
            className="w-full py-3 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded-xl text-sm transition-all shadow-lg cursor-pointer"
          >
            Back to Login
          </button>
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
              { id: 'billing', label: 'Billing System', icon: <FiDollarSign /> },
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
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <h1 className={`text-3xl font-bold font-display tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>Storefront Overview</h1>
                <p className={`text-sm mt-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Live overview of sales performance, tables, and product analytics.</p>
              </div>

              {/* Premium Date Filter Dropdown */}
              <div className="relative shrink-0 select-none">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsFilterDropdownOpen(!isFilterDropdownOpen);
                  }}
                  className={`flex items-center gap-2.5 px-4 py-2.5 rounded-xl border text-sm font-semibold tracking-wide transition-all shadow-sm hover:shadow cursor-pointer ${isDark
                      ? 'bg-slate-900 border-slate-800 text-slate-200 hover:text-white hover:bg-slate-800/80'
                      : 'bg-white border-slate-200 text-slate-700 hover:text-slate-900 hover:bg-slate-50'
                    }`}
                >
                  <FiCalendar className="text-amber-500 text-base" />
                  <span>
                    Show: {dateFilter === 'today' ? 'Today' : dateFilter === 'month' ? 'This Month' : 'This Year'}
                  </span>
                  <FiChevronDown className={`text-slate-400 transition-transform duration-300 ${isFilterDropdownOpen ? 'rotate-180' : ''}`} />
                </button>

                {isFilterDropdownOpen && (
                  <div
                    onClick={(e) => e.stopPropagation()}
                    className={`absolute right-0 mt-2 w-48 rounded-2xl border shadow-2xl p-2 z-50 animate-fade-in divide-y ${isDark
                        ? 'bg-slate-900 border-slate-800 divide-slate-800/50'
                        : 'bg-white border-slate-200 divide-slate-100'
                      }`}
                  >
                    {[
                      { value: 'today', label: 'Today' },
                      { value: 'month', label: 'This Month' },
                      { value: 'year', label: 'This Year' }
                    ].map((opt) => {
                      const isSelected = dateFilter === opt.value;
                      return (
                        <button
                          key={opt.value}
                          onClick={() => {
                            setDateFilter(opt.value);
                            setIsFilterDropdownOpen(false);
                          }}
                          className={`w-full text-left px-4 py-2.5 rounded-xl text-xs font-semibold flex items-center justify-between transition-colors cursor-pointer ${isSelected
                              ? isDark
                                ? 'bg-amber-500/10 text-amber-400'
                                : 'bg-amber-50 text-amber-600'
                              : isDark
                                ? 'text-slate-400 hover:bg-slate-800/50 hover:text-white'
                                : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                            }`}
                        >
                          <span>{opt.label}</span>
                          {isSelected && <FiCheck className="text-sm stroke-[3px]" />}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {[
                {
                  label: 'Gross Sales',
                  value: `₹${totalSales.toFixed(2)}`,
                  sub: dateFilter === 'today'
                    ? '✓ Today\'s checkouts inclusive'
                    : dateFilter === 'month'
                      ? '✓ This month\'s checkouts'
                      : '✓ This year\'s checkouts',
                  icon: '₹',
                  color: 'text-amber-500',
                  bg: 'bg-amber-500/10',
                  subColor: isDark ? 'text-emerald-400' : 'text-emerald-600'
                },
                {
                  label: 'Total Orders',
                  value: ordersCount,
                  sub: dateFilter === 'today'
                    ? 'Placed today via scanned QRs'
                    : dateFilter === 'month'
                      ? 'Placed this month via scanned QRs'
                      : 'Placed this year via scanned QRs',
                  icon: <FiShoppingBag />,
                  color: 'text-sky-500',
                  bg: 'bg-sky-500/10',
                  subColor: isDark ? 'text-slate-500' : 'text-slate-500'
                },
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
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <h1 className={`text-3xl font-bold font-display tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>Active Table Orders</h1>
                <p className={`text-sm mt-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Accept incoming orders, forward to Kitchen, or mark served.</p>
              </div>

              {/* Premium Actions Container */}
              <div className="flex flex-wrap items-center gap-3">
                {/* Premium Export & Delete Button */}
                <button
                  onClick={() => {
                    setExportStep(1);
                    setSelectedExportMonth(getExportMonthOptions()[0]?.value || '');
                    setIsExportModalOpen(true);
                  }}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-semibold tracking-wide transition-all shadow-sm hover:shadow cursor-pointer ${isDark
                      ? 'bg-slate-900 border-slate-800 text-amber-400 hover:text-amber-300 hover:bg-slate-800/80'
                      : 'bg-amber-50 border-amber-200 text-amber-700 hover:text-amber-800 hover:bg-amber-100/50'
                    }`}
                  title="Export old monthly orders and delete them permanently"
                >
                  <FiDownload className="text-base shrink-0" />
                  <span>Export & Delete</span>
                </button>

                {/* Premium Date Filter Dropdown */}
                <div className="relative shrink-0 select-none">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsOrdersFilterDropdownOpen(!isOrdersFilterDropdownOpen);
                    }}
                    className={`flex items-center gap-2.5 px-4 py-2.5 rounded-xl border text-sm font-semibold tracking-wide transition-all shadow-sm hover:shadow cursor-pointer ${isDark
                        ? 'bg-slate-900 border-slate-800 text-slate-200 hover:text-white hover:bg-slate-800/80'
                        : 'bg-white border-slate-200 text-slate-700 hover:text-slate-900 hover:bg-slate-50'
                      }`}
                  >
                    <FiCalendar className="text-amber-500 text-base" />
                    <span>
                      Show: {ordersDateFilter === 'today' ? 'Today' : ordersDateFilter === 'month' ? 'This Month' : 'This Year'}
                    </span>
                    <FiChevronDown className={`text-slate-400 transition-transform duration-300 ${isOrdersFilterDropdownOpen ? 'rotate-180' : ''}`} />
                  </button>

                  {isOrdersFilterDropdownOpen && (
                    <div
                      onClick={(e) => e.stopPropagation()}
                      className={`absolute right-0 mt-2 w-48 rounded-2xl border shadow-2xl p-2 z-50 animate-fade-in divide-y ${isDark
                          ? 'bg-slate-900 border-slate-800 divide-slate-800/50'
                          : 'bg-white border-slate-200 divide-slate-100'
                        }`}
                    >
                      {[
                        { value: 'today', label: 'Today' },
                        { value: 'month', label: 'This Month' },
                        { value: 'year', label: 'This Year' }
                      ].map((opt) => {
                        const isSelected = ordersDateFilter === opt.value;
                        return (
                          <button
                            key={opt.value}
                            onClick={() => {
                              setOrdersDateFilter(opt.value);
                              setIsOrdersFilterDropdownOpen(false);
                            }}
                            className={`w-full text-left px-4 py-2.5 rounded-xl text-xs font-semibold flex items-center justify-between transition-colors cursor-pointer ${isSelected
                                ? isDark
                                  ? 'bg-amber-500/10 text-amber-400'
                                  : 'bg-amber-50 text-amber-600'
                                : isDark
                                  ? 'text-slate-400 hover:bg-slate-800/50 hover:text-white'
                                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                              }`}
                          >
                            <span>{opt.label}</span>
                            {isSelected && <FiCheck className="text-sm stroke-[3px]" />}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className={`rounded-2xl border overflow-hidden shadow-sm ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className={`border-b text-xs font-semibold uppercase ${isDark ? 'border-slate-800 text-slate-400' : 'border-slate-200 text-slate-400 bg-slate-50'}`}>
                      <th className="px-6 py-3.5">Order ID</th>
                      <th className="px-6 py-3.5">Date & Time</th>
                      <th className="px-6 py-3.5">Source</th>
                      <th className="px-6 py-3.5">Items</th>
                      <th className="px-6 py-3.5">Total Amount</th>
                      <th className="px-6 py-3.5">Status</th>
                      <th className="px-6 py-3.5">Update Stage</th>
                      <th className="px-6 py-3.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className={`divide-y ${isDark ? 'divide-slate-800 text-slate-300' : 'divide-slate-100 text-slate-700'}`}>
                    {filteredOrdersForDisplay.map(order => {
                      const itemSummary = order.items.map(i => `${i.name} x${i.quantity}`).join(', ');
                      return (
                        <tr key={order.id} className={`transition-colors ${isDark ? 'hover:bg-slate-800/40' : 'hover:bg-slate-50/50'}`}>
                          <td className="px-6 py-4">
                            <span className={`font-mono font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>{order.id}</span>
                          </td>
                          <td className="px-6 py-4">
                            {(() => {
                              const { date, time } = formatOrderDateTime(order.createdAt);
                              return (
                                <div className="flex flex-col">
                                  <span className={`text-xs font-semibold ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>{date}</span>
                                  <span className={`text-[10px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{time}</span>
                                </div>
                              );
                            })()}
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
                          <td className="px-6 py-4">
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
                          <td className="px-6 py-4 text-right">
                            <button
                              onClick={() => setOrderToDelete(order)}
                              className="p-2 rounded-xl bg-rose-500/10 text-rose-500 hover:text-white hover:bg-rose-500 transition-all cursor-pointer inline-flex items-center justify-center border border-rose-500/20"
                              title="Delete Order Permanently"
                            >
                              <FiTrash2 className="text-sm" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                    {filteredOrdersForDisplay.length === 0 && (
                      <tr><td colSpan="8" className={`text-center py-10 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>No orders found for this timeframe. Place one from the Menu!</td></tr>
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
            currentRest={currentRest}
          />
        )}

        {/* ── TAB BILLING: BILLING SYSTEM ──────── */}
        {activeTab === 'billing' && currentRest && (
          <BillingSystem
            restaurantId={currentRest.id}
            products={products}
            categories={categories}
            tables={tables}
            orders={orders}
            currentRest={currentRest}
            isDark={isDark}
            onShowStatus={showToast}
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

              {/* Billing Settings Section */}
              <div className={`pt-6 border-t ${isDark ? 'border-slate-800' : 'border-slate-100'}`}>
                <h3 className={`text-base font-bold tracking-tight mb-4 ${isDark ? 'text-white' : 'text-slate-900'}`}>Billing Settings</h3>

                {/* Receipt Branding Subsection */}
                <div className={`p-4 rounded-xl border ${isDark ? 'bg-slate-950/50 border-slate-800' : 'bg-slate-50 border-slate-150'}`}>
                  <h4 className={`text-xs font-bold tracking-wider uppercase mb-3 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Receipt Branding</h4>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className={`text-sm font-semibold ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>Show: "Powered by EasyDine"</p>
                      <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'} mt-0.5`}>Display a minimal, elegant footer branding at the bottom of printed receipts and exported PDFs.</p>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className={`text-xs font-black tracking-wider ${currentRest.showPoweredBy ? 'text-amber-500' : isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                        {currentRest.showPoweredBy ? 'ON' : 'OFF'}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setCurrentRest({
                            ...currentRest,
                            showPoweredBy: !currentRest.showPoweredBy
                          });
                        }}
                        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${currentRest.showPoweredBy ? 'bg-amber-500' : isDark ? 'bg-slate-700' : 'bg-slate-200'
                          }`}
                      >
                        <span
                          className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${currentRest.showPoweredBy ? 'translate-x-5' : 'translate-x-0'
                            }`}
                        />
                      </button>
                    </div>
                  </div>
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

      {/* Delete Order Confirmation Modal */}
      {orderToDelete && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className={`w-full max-w-md rounded-3xl border shadow-2xl overflow-hidden ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
            {/* Header */}
            <div className={`p-6 border-b flex justify-between items-center ${isDark ? 'border-slate-800 bg-slate-900/50' : 'border-slate-100 bg-slate-50'}`}>
              <div className="flex items-center gap-2 text-rose-500">
                <FiAlertTriangle className="text-xl animate-bounce" />
                <h3 className={`text-lg font-black font-display tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  Delete Order
                </h3>
              </div>
              <button
                onClick={() => setOrderToDelete(null)}
                className={`p-2 rounded-xl transition-all cursor-pointer hover:text-rose-500 ${isDark ? 'hover:bg-slate-800 text-slate-400' : 'hover:bg-slate-100 text-slate-500'}`}
              >
                <FiX className="text-lg" />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 space-y-4">
              <p className={`text-sm leading-relaxed ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                Are you sure you want to permanently delete this order? This action cannot be undone.
              </p>
              <div className={`p-4 rounded-2xl border text-xs font-mono space-y-1 ${isDark ? 'bg-slate-950/40 border-slate-800 text-slate-400' : 'bg-slate-50 border-slate-200 text-slate-600'}`}>
                <div><span className="font-bold text-amber-500">Order ID:</span> {orderToDelete.id}</div>
                <div><span className="font-bold text-amber-500">Table/Source:</span> {orderToDelete.tableName || 'Table'}</div>
                <div><span className="font-bold text-amber-500">Amount:</span> ₹{(orderToDelete.grandTotal || orderToDelete.totalAmount || 0).toFixed(2)}</div>
              </div>
            </div>

            {/* Actions */}
            <div className={`px-6 py-4 border-t flex justify-end gap-3 ${isDark ? 'border-slate-800 bg-slate-950/20' : 'border-slate-100 bg-slate-50/50'}`}>
              <button
                onClick={() => setOrderToDelete(null)}
                className={`px-4 py-2 rounded-xl text-sm font-bold transition-all cursor-pointer ${isDark
                    ? 'bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white'
                    : 'bg-slate-200 hover:bg-slate-300 text-slate-700 hover:text-slate-900'
                  }`}
              >
                Cancel
              </button>
              <button
                onClick={() => handleDeleteOrder(orderToDelete.id)}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl text-sm transition-all shadow-md flex items-center gap-1.5 cursor-pointer"
              >
                <FiTrash2 /> Delete Order
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Export & Delete Old Orders Modal */}
      {isExportModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className={`w-full max-w-lg rounded-3xl border shadow-2xl overflow-hidden ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>

            {/* Header */}
            <div className={`p-6 border-b flex justify-between items-center ${isDark ? 'border-slate-800 bg-slate-900/50' : 'border-slate-100 bg-slate-50'}`}>
              <div className="flex items-center gap-2 text-amber-500">
                <FiDownload className="text-xl animate-pulse" />
                <h3 className={`text-lg font-black font-display tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  {exportStep === 1 ? 'Export Monthly Orders' : 'Export Completed'}
                </h3>
              </div>
              <button
                onClick={() => {
                  setIsExportModalOpen(false);
                  setExportStep(1);
                  setSelectedExportMonth('');
                }}
                className={`p-2 rounded-xl transition-all cursor-pointer hover:text-amber-500 ${isDark ? 'hover:bg-slate-800 text-slate-400' : 'hover:bg-slate-100 text-slate-500'}`}
              >
                <FiX className="text-lg" />
              </button>
            </div>

            {/* STEP 1 & 2: Select Month & Formats */}
            {exportStep === 1 && (
              <div className="p-6 space-y-6">
                <div>
                  <label className={`block text-xs font-bold uppercase tracking-wider mb-2 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                    Select Month & Year
                  </label>
                  <select
                    value={selectedExportMonth}
                    onChange={(e) => setSelectedExportMonth(e.target.value)}
                    className={`w-full p-3.5 rounded-2xl border text-sm font-semibold tracking-wide focus:outline-none focus:border-amber-500 transition-colors ${isDark
                        ? 'bg-slate-950 border-slate-800 text-slate-200'
                        : 'bg-slate-50 border-slate-200 text-slate-800'
                      }`}
                  >
                    <option value="" disabled>-- Choose Month --</option>
                    {getExportMonthOptions().map(opt => {
                      const count = getOrdersForMonth(opt.value).length;
                      return (
                        <option key={opt.value} value={opt.value}>
                          {opt.label} ({count} orders)
                        </option>
                      );
                    })}
                  </select>
                </div>

                <div>
                  <label className={`block text-xs font-bold uppercase tracking-wider mb-3 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                    Select Export Formats
                  </label>
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { key: 'pdf', label: 'PDF Report', ext: '.pdf' },
                      { key: 'xlsx', label: 'Excel Sheet', ext: '.xlsx' },
                      { key: 'csv', label: 'CSV File', ext: '.csv' }
                    ].map(fmt => {
                      const isSelected = exportFormats[fmt.key];
                      return (
                        <button
                          key={fmt.key}
                          type="button"
                          onClick={() => setExportFormats(prev => ({ ...prev, [fmt.key]: !prev[fmt.key] }))}
                          className={`p-4 rounded-2xl border flex flex-col items-center justify-center gap-2 transition-all cursor-pointer text-center group ${isSelected
                              ? isDark
                                ? 'bg-amber-500/10 border-amber-500/50 text-amber-400'
                                : 'bg-amber-50 border-amber-200 text-amber-700 font-bold'
                              : isDark
                                ? 'bg-slate-950/40 border-slate-800 text-slate-400 hover:border-slate-700'
                                : 'bg-slate-50/50 border-slate-100 text-slate-500 hover:border-slate-200'
                            }`}
                        >
                          <span className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-black transition-colors ${isSelected
                              ? 'bg-amber-500 text-slate-950'
                              : isDark ? 'bg-slate-800 text-slate-500' : 'bg-slate-200 text-slate-500'
                            }`}>
                            {isSelected ? '✓' : ''}
                          </span>
                          <span className="text-xs font-bold tracking-tight">{fmt.label}</span>
                          <span className="text-[10px] opacity-60 font-mono">{fmt.ext}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {selectedExportMonth && (
                  <div className={`p-4 rounded-2xl border flex items-center gap-3 text-xs ${isDark ? 'bg-slate-950/50 border-slate-800 text-slate-400' : 'bg-slate-50 border-slate-200 text-slate-600'
                    }`}>
                    <FiAlertTriangle className="text-amber-500 text-lg shrink-0" />
                    <span>
                      Found <strong>{getOrdersForMonth(selectedExportMonth).length}</strong> orders for the selected month.
                    </span>
                  </div>
                )}

                {/* Actions */}
                <div className={`pt-4 border-t flex justify-end gap-3 ${isDark ? 'border-slate-800' : 'border-slate-100'}`}>
                  <button
                    type="button"
                    onClick={() => setIsExportModalOpen(false)}
                    className={`px-5 py-2.5 rounded-xl text-sm font-bold transition-all cursor-pointer ${isDark
                        ? 'bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white'
                        : 'bg-slate-200 hover:bg-slate-300 text-slate-700 hover:text-slate-900'
                      }`}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={!selectedExportMonth || (!exportFormats.pdf && !exportFormats.xlsx && !exportFormats.csv) || getOrdersForMonth(selectedExportMonth).length === 0 || isExporting}
                    onClick={handleExportFiles}
                    className="px-5 py-2.5 rounded-xl text-sm font-bold shadow-md flex items-center gap-2 transition-all cursor-pointer text-slate-950 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isExporting ? 'Exporting...' : 'Export & Continue'}
                  </button>
                </div>
              </div>
            )}

            {/* STEP 3 & 4: Confirm Permanent Deletion */}
            {exportStep === 2 && (
              <div className="p-6 space-y-6">
                <div className="flex flex-col items-center text-center space-y-3">
                  <div className="w-16 h-16 rounded-full bg-emerald-500/10 text-emerald-500 flex items-center justify-center text-3xl">
                    ✓
                  </div>
                  <div>
                    <h4 className={`text-xl font-black font-display tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
                      Export Completed
                    </h4>
                    <p className={`text-sm mt-1 leading-relaxed ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                      Your selected month has been successfully exported.
                    </p>
                  </div>
                </div>

                <div className={`p-5 rounded-2xl border border-dashed space-y-3 ${isDark ? 'bg-rose-950/10 border-rose-500/20' : 'bg-rose-50/30 border-rose-500/10'
                  }`}>
                  <div className="flex items-start gap-2.5 text-rose-500">
                    <FiAlertTriangle className="text-lg shrink-0 mt-0.5" />
                    <div>
                      <h5 className="text-sm font-bold tracking-tight">Database Cleanup Option</h5>
                      <p className={`text-xs mt-1 leading-relaxed ${isDark ? 'text-rose-400/80' : 'text-rose-700/80'}`}>
                        Do you also want to permanently delete these orders from the database?
                      </p>
                    </div>
                  </div>
                  <div className={`p-3.5 rounded-xl border text-xs font-mono flex flex-col gap-1 ${isDark ? 'bg-slate-950/40 border-slate-800/80 text-slate-400' : 'bg-slate-50 border-slate-200/60 text-slate-600'
                    }`}>
                    <div><span className="font-bold text-amber-500">Selected Month:</span> {getExportMonthOptions().find(m => m.value === selectedExportMonth)?.label || selectedExportMonth}</div>
                    <div><span className="font-bold text-amber-500">Total Cleared:</span> {getOrdersForMonth(selectedExportMonth).length} Orders</div>
                    <div className="text-[10px] text-rose-500 font-bold mt-1 uppercase">★ Action cannot be undone</div>
                  </div>
                </div>

                {/* Actions */}
                <div className={`pt-4 border-t flex flex-col sm:flex-row gap-3 ${isDark ? 'border-slate-800' : 'border-slate-100'}`}>
                  <button
                    type="button"
                    onClick={() => {
                      setIsExportModalOpen(false);
                      setExportStep(1);
                      setSelectedExportMonth('');
                    }}
                    className={`flex-1 px-5 py-3 rounded-xl text-sm font-bold transition-all cursor-pointer text-center ${isDark
                        ? 'bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white'
                        : 'bg-slate-200 hover:bg-slate-300 text-slate-700 hover:text-slate-900'
                      }`}
                  >
                    Keep Orders
                  </button>
                  <button
                    type="button"
                    onClick={handleDeleteMonthOrders}
                    className="flex-1 px-5 py-3 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl text-sm transition-all shadow-md flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <FiTrash2 /> Delete From Database
                  </button>
                </div>
              </div>
            )}

          </div>
        </div>
      )}
    </div>
  );
}
