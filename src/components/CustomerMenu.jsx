import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  FiSearch,
  FiShoppingBag,
  FiX,
  FiPlus,
  FiMinus,
  FiTag,
  FiClock,
  FiCompass,
  FiCheckCircle,
  FiMapPin,
  FiChevronRight,
  FiArrowRight,
  FiMessageSquare,
  FiCheck
} from 'react-icons/fi';
import {
  getRestaurant,
  getCategories,
  getProducts,
  getCoupons,
  createOrder,
  getOrders,
  getTables
} from '../dbService';

export default function CustomerMenu() {
  const [searchParams] = useSearchParams();
  const restId = searchParams.get('r') || '';
  const tableId = searchParams.get('t') || '';
  const [tableData, setTableData] = useState(null);

  const [restaurant, setRestaurant] = useState(null);
  const [categories, setCategories] = useState([]);
  const [products, setProducts] = useState([]);
  const [coupons, setCoupons] = useState([]);

  const [activeCategory, setActiveCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [cart, setCart] = useState([]);
  const [showCart, setShowCart] = useState(false);

  // Coupon promo state
  const [promoCode, setPromoCode] = useState('');
  const [activeCoupon, setActiveCoupon] = useState(null);
  const [promoError, setPromoError] = useState('');
  const [specialInstructions, setSpecialInstructions] = useState('');

  // Active Order Tracking States
  const [placedOrder, setPlacedOrder] = useState(null);
  const [loading, setLoading] = useState(true);

  // Product Detail Modal State
  const [selectedProduct, setSelectedProduct] = useState(null);

  useEffect(() => {
    async function loadRestaurantMenu() {
      setLoading(true);
      const r = await getRestaurant(restId);
      setRestaurant(r);
      if (r) {
        const cats = await getCategories(r.id);
        const prods = await getProducts(r.id);
        const cpns = await getCoupons(r.id);
        const tbls = await getTables(r.id);
        // Find the current table
        const currentTable = tbls.find(t => t.id === tableId);
        setTableData(currentTable || null);
        setCategories(cats);
        setProducts(prods);
        setCoupons(cpns);
      }
      setLoading(false);
    }
    loadRestaurantMenu();
  }, [restId, tableId]);

  // Live order status poll when order is placed
  useEffect(() => {
    let orderPollInterval;
    if (placedOrder) {
      const checkOrderStatus = async () => {
        const activeOrders = await getOrders(restId);
        const match = activeOrders.find(o => o.id === placedOrder.id);
        if (match) {
          setPlacedOrder(match);
        }
      };
      orderPollInterval = setInterval(checkOrderStatus, 4000);
    }
    return () => clearInterval(orderPollInterval);
  }, [placedOrder, restId]);

  // Cart operations
  const addToCart = (product) => {
    const existing = cart.find(item => item.id === product.id);
    if (existing) {
      setCart(cart.map(item => item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item));
    } else {
      setCart([...cart, { ...product, quantity: 1 }]);
    }
  };

  const removeFromCart = (productId) => {
    const existing = cart.find(item => item.id === productId);
    if (existing && existing.quantity > 1) {
      setCart(cart.map(item => item.id === productId ? { ...item, quantity: item.quantity - 1 } : item));
    } else {
      setCart(cart.filter(item => item.id !== productId));
    }
  };

  const getProductQuantity = (productId) => {
    const item = cart.find(it => it.id === productId);
    return item ? item.quantity : 0;
  };

  const handleApplyPromo = (e) => {
    e.preventDefault();
    setPromoError('');
    const code = promoCode.toUpperCase().trim();
    const coupon = coupons.find(c => c.code === code && c.isActive);

    if (!coupon) {
      setPromoError('Invalid or expired coupon code.');
      setActiveCoupon(null);
      return;
    }

    const sub = cart.reduce((acc, curr) => acc + (curr.price * curr.quantity), 0);
    if (sub < coupon.minOrderAmount) {
      setPromoError(`Minimum order of ₹${coupon.minOrderAmount} required.`);
      setActiveCoupon(null);
      return;
    }

    setActiveCoupon(coupon);
  };

  const handleCheckout = async () => {
    if (cart.length === 0 || !restaurant) return;

    const subtotal = cart.reduce((acc, curr) => acc + (curr.price * curr.quantity), 0);
    let discount = 0;
    if (activeCoupon) {
      if (activeCoupon.discountType === 'percent') {
        discount = subtotal * (activeCoupon.discountValue / 100);
      } else {
        discount = activeCoupon.discountValue;
      }
    }

    const discountedSubtotal = Math.max(0, subtotal - discount);
    const tax = discountedSubtotal * ((restaurant.taxRate || 8) / 100);
    const total = discountedSubtotal + tax;

    const orderRecord = {
      id: `TT-${Math.floor(1000 + Math.random() * 9000)}`,
      restaurantId: restaurant.id,
      tableId: tableId,
      tableName: tableData?.tableName || `Table ${tableId}`,
      items: cart.map(it => ({
        productId: it.id,
        name: it.name,
        price: it.price,
        quantity: it.quantity
      })),
      totalAmount: subtotal,
      discountAmount: discount,
      taxAmount: tax,
      grandTotal: total,
      notes: specialInstructions,
      status: 'pending',
      createdAt: new Date().toISOString()
    };

    setLoading(true);
    await createOrder(restaurant.id, orderRecord);
    setPlacedOrder(orderRecord);
    setCart([]);
    setShowCart(false);
    setLoading(false);
  };

  // Filter products by category and query search
  const filteredProducts = products.filter(prod => {
    if (!prod.isAvailable) return false;
    const matchesCategory = activeCategory === 'all' || prod.categoryId === activeCategory;
    const matchesSearch = prod.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      prod.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const popularProducts = products.filter(p => p.isPopular && p.isAvailable);

  // Pricing calculations
  const cartSubtotal = cart.reduce((acc, curr) => acc + (curr.price * curr.quantity), 0);
  let cartDiscount = 0;
  if (activeCoupon) {
    if (activeCoupon.discountType === 'percent') {
      cartDiscount = cartSubtotal * (activeCoupon.discountValue / 100);
    } else {
      cartDiscount = activeCoupon.discountValue;
    }
  }
  const cartTax = (cartSubtotal - cartDiscount) * ((restaurant?.taxRate || 8) / 100);
  const cartGrandTotal = Math.max(0, cartSubtotal - cartDiscount + cartTax);

  if (loading && !restaurant) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center p-4">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 border-4 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm font-semibold text-slate-500">Detecting Restaurant and Table...</p>
        </div>
      </div>
    );
  }

  if (!restaurant) {
    return (
      <div className="min-h-screen bg-slate-50 p-6 flex flex-col items-center justify-center text-center">
        <div className="p-4 bg-rose-50 rounded-full text-rose-500 text-3xl mb-4"><FiX /></div>
        <h3 className="text-xl font-bold font-display text-slate-900 mb-2">Invalid TableTap Scan</h3>
        <p className="text-slate-500 text-sm max-w-sm font-light mb-6">
          This QR code has expired or is not configured inside the TableTap subscriber database. Please re-scan table code.
        </p>
        <button onClick={() => window.location.href = '/'} className="px-5 py-2.5 bg-slate-900 text-white rounded-xl text-xs font-semibold shadow hover:bg-slate-800">
          Return to Launchpad
        </button>
      </div>
    );
  }

  if (restaurant.status === 'suspended') {
    return (
      <div className="min-h-screen bg-slate-50 p-6 flex flex-col items-center justify-center text-center">
        <div className="p-4 bg-rose-50 rounded-full text-rose-500 text-3xl mb-4"><FiX /></div>
        <h3 className="text-xl font-bold font-display text-slate-900 mb-2">Service Temporarily Offline</h3>
        <p className="text-slate-500 text-sm max-w-sm font-light mb-6">
          This restaurant is temporarily offline. Please contact the staff or administrator for assistance.
        </p>
      </div>
    );
  }

  // RENDER TRACKER STATE
  if (placedOrder) {
    const steps = ['pending', 'accepted', 'preparing', 'ready', 'served', 'completed'];
    const currentStepIndex = steps.indexOf(placedOrder.status);

    const getStepStatusClass = (stepName) => {
      const idx = steps.indexOf(stepName);
      if (idx < currentStepIndex) return 'bg-emerald-500 text-white border-emerald-500';
      if (idx === currentStepIndex) return 'bg-amber-500 text-slate-950 border-amber-500 font-bold scale-110';
      return 'bg-slate-100 text-slate-400 border-slate-200';
    };

    return (
      <div className="min-h-screen bg-slate-50 flex flex-col max-w-md mx-auto relative shadow-2xl overflow-hidden border-x">
        {/* Tracker Header */}
        <div className="bg-slate-900 text-white p-6 space-y-3 relative shrink-0">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-extrabold font-display">Live Order Tracker</h2>
            <span className="text-[10px] bg-amber-500/10 text-amber-400 font-mono font-bold px-2.5 py-0.5 rounded-full border border-amber-500/20 uppercase">
              Table ID: {placedOrder.tableName || 'Seated Table'}
            </span>
          </div>
          <p className="text-slate-400 text-xs font-light leading-relaxed">
            Your culinary selection has been dispatched directly to the chef's counter! Watch the progress of your cooking live.
          </p>
        </div>

        {/* Tracker Progress bar column */}
        <div className="flex-1 p-6 space-y-8 overflow-y-auto">

          <div className="flex flex-col relative space-y-8 pl-10 border-l border-slate-200 ml-4 py-2">
            {[
              { id: 'pending', title: 'Order Submitted', desc: 'Awaiting restaurant host verification.' },
              { id: 'accepted', title: 'Order Confirmed', desc: 'Host approved. Forwarding to kitchen display.' },
              { id: 'preparing', title: 'Preparing Food', desc: 'Chefs are currently baking and frying your selections.' },
              { id: 'ready', title: 'Ready to Dispatch', desc: 'Food is cooked and plated! Server is picking it up.' },
              { id: 'served', title: 'Served', desc: 'Placed at your table. Enjoy your premium meal!' },
              { id: 'completed', title: 'Ticket Completed', desc: 'Payment settled. Thank you for using TableTap!' }
            ].map(step => {
              const active = placedOrder.status === step.id;
              return (
                <div key={step.id} className="relative group">

                  {/* Step bubble overlay */}
                  <span className={`absolute left-[-50px] top-0 w-8 h-8 rounded-full border-2 flex items-center justify-center text-xs transition-all duration-300 ${getStepStatusClass(step.id)}`}>
                    {steps.indexOf(step.id) < currentStepIndex ? <FiCheck /> : (steps.indexOf(step.id) + 1)}
                  </span>

                  <div>
                    <h4 className={`text-sm font-bold ${active ? 'text-slate-900 text-base font-extrabold' : 'text-slate-500'}`}>{step.title}</h4>
                    <p className="text-xs text-slate-400 mt-1 font-light leading-normal">{step.desc}</p>
                  </div>

                </div>
              );
            })}
          </div>

          {/* Placed Order details receipt */}
          <div className="bg-white border p-5 rounded-2xl space-y-4 shadow-sm">
            <h4 className="font-bold text-slate-800 text-sm">Selection Receipts (Order #{placedOrder.id})</h4>
            <div className="space-y-2 text-xs divide-y divide-slate-50">
              {placedOrder.items.map((it, idx) => (
                <div key={idx} className="flex justify-between items-center py-2">
                  <span className="font-semibold text-slate-700">{it.name} <span className="text-slate-400 font-normal">x{it.quantity}</span></span>
                  <span className="font-mono font-bold text-slate-800">₹{(it.price * it.quantity).toFixed(2)}</span>
                </div>
              ))}
            </div>

            <div className="border-t pt-3 text-right flex justify-between text-xs font-semibold text-slate-500">
              <span>Grand Total Paid</span>
              <span className="font-mono font-bold text-slate-900 text-sm">₹{placedOrder.grandTotal.toFixed(2)}</span>
            </div>
          </div>

        </div>

        {/* Order again footer */}
        <div className="p-4 bg-white border-t shrink-0 text-center">
          <button
            onClick={() => {
              setPlacedOrder(null);
              setCart([]);
            }}
            className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-white font-bold text-sm rounded-xl shadow transition-colors cursor-pointer"
          >
            Order Something Else
          </button>
        </div>
      </div>
    );
  }

  // CUSTOMER MENU SCREEN
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col max-w-md mx-auto relative shadow-2xl overflow-hidden border-x pb-20">

      {/* Dynamic Colored header background based on theme */}
      <header
        style={{ backgroundColor: restaurant.themeColor || '#10b981' }}
        className="text-white p-6 relative shrink-0"
      >
        <div className="flex gap-4 items-center">
          <img
            src={restaurant.logoUrl}
            alt={restaurant.name}
            className="w-16 h-16 rounded-2xl object-cover border border-white/20 shadow-lg bg-slate-950"
            onError={(e) => { e.target.src = "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&q=80&w=400" }}
          />
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-extrabold font-display leading-tight tracking-tight truncate">{restaurant.name}</h1>
            <p className="text-xs text-white/80 font-light mt-1 line-clamp-2 leading-relaxed">{restaurant.description}</p>
            <div className="flex items-center gap-1 text-[10px] text-white/90 bg-black/20 px-2 py-0.5 rounded-full mt-2 w-max border border-white/10 font-bold uppercase tracking-wider">
              <FiMapPin /> {tableData?.tableName || `Table ${tableId}`}
            </div>
          </div>
        </div>
      </header>

      {/* Floating Cart Button */}
      {cart.length > 0 && (
        <button
          onClick={() => setShowCart(true)}
          className="fixed bottom-6 left-1/2 -translate-x-1/2 w-[90%] max-w-[360px] bg-slate-900 hover:bg-slate-800 active:bg-slate-950 text-white font-bold py-3 px-5 rounded-2xl shadow-2xl flex justify-between items-center z-40 transition-all scale-105"
        >
          <div className="flex items-center gap-2.5">
            <div className="w-6 h-6 rounded-lg bg-amber-400 text-slate-950 font-bold text-xs flex items-center justify-center font-mono">
              {cart.reduce((acc, curr) => acc + curr.quantity, 0)}
            </div>
            <span className="text-sm uppercase tracking-wider">View Selection Cart</span>
          </div>
          <span className="font-mono text-base font-extrabold text-amber-400">₹{cartSubtotal.toFixed(2)}</span>
        </button>
      )}

      {/* Main categories + listings */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6">

        {/* Search bar */}
        <div className="relative">
          <FiSearch className="absolute left-4 top-3.5 text-slate-400" />
          <input
            type="text"
            placeholder="Search delicious culinary specialties..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-white border border-slate-200 rounded-2xl py-2.5 pl-11 pr-4 text-sm text-slate-800 focus:outline-none focus:border-amber-500 shadow-sm"
          />
        </div>

        {/* Scrolling categories selector */}
        <div className="flex gap-2 overflow-x-auto no-scrollbar py-1">
          <button
            onClick={() => setActiveCategory('all')}
            className={`px-4 py-2 rounded-xl text-xs font-bold shrink-0 transition-colors cursor-pointer ${activeCategory === 'all'
                ? 'bg-slate-900 text-white shadow-sm'
                : 'bg-white text-slate-500 border border-slate-200'
              }`}
          >
            All Specialties
          </button>
          {categories.map(cat => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={`px-4 py-2 rounded-xl text-xs font-bold shrink-0 transition-colors cursor-pointer ${activeCategory === cat.id
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'bg-white text-slate-500 border border-slate-200'
                }`}
            >
              {cat.name}
            </button>
          ))}
        </div>

        {/* CHEF'S POPULAR ACCENTS SLIDER */}
        {activeCategory === 'all' && searchQuery === '' && popularProducts.length > 0 && (
          <div className="space-y-3">
            <h3 className="font-bold font-display text-slate-900 text-sm tracking-tight flex items-center gap-1.5">
              ⭐ Today's Popular Selections
            </h3>
            <div className="flex gap-4 overflow-x-auto no-scrollbar py-1">
              {popularProducts.map(prod => (
                <div
                  key={prod.id}
                  onClick={() => setSelectedProduct(prod)}
                  className="bg-white rounded-2xl border border-slate-200/80 p-3 shadow-sm flex flex-col justify-between shrink-0 w-44 hover:shadow-md transition-shadow cursor-pointer"
                >
                  <img
                    src={prod.imageUrl}
                    alt={prod.name}
                    className="w-full h-24 object-cover rounded-xl bg-slate-100"
                    onError={(e) => { e.target.src = "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&q=80&w=400" }}
                  />
                  <div className="space-y-1.5 pt-2 flex-1 flex flex-col justify-between">
                    <div>
                      <h4 className="font-bold text-slate-900 text-xs truncate">{prod.name}</h4>
                      <p className="text-[10px] text-slate-400 font-mono font-bold">₹{prod.price.toFixed(2)}</p>
                    </div>

                    <div className="pt-2 flex justify-between items-center">
                      <span className="text-[9px] text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-full font-bold">Popular</span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          addToCart(prod);
                        }}
                        className="p-1 rounded-full bg-slate-900 hover:bg-slate-800 text-white transition-all cursor-pointer"
                      >
                        <FiPlus className="text-xs" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* MASTER PRODUCTS LIST */}
        <div className="space-y-4">
          <h3 className="font-bold font-display text-slate-900 text-sm tracking-tight">
            {activeCategory === 'all' ? 'All Menu Specialties' : categories.find(c => c.id === activeCategory)?.name}
          </h3>

          <div className="space-y-3.5">
            {filteredProducts.map(prod => {
              const qty = getProductQuantity(prod.id);
              return (
                <div
                  key={prod.id}
                  onClick={() => setSelectedProduct(prod)}
                  className="p-3 bg-white rounded-2xl border border-slate-200/80 hover:border-slate-300 shadow-sm flex gap-4 items-center justify-between transition-all cursor-pointer relative"
                >
                  <img
                    src={prod.imageUrl}
                    alt={prod.name}
                    className="w-16 h-16 rounded-xl object-cover bg-slate-50 shrink-0 border"
                    onError={(e) => { e.target.src = "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&q=80&w=400" }}
                  />

                  <div className="flex-1 min-w-0 pr-1 space-y-1">
                    <div className="flex items-center gap-1.5">
                      <h4 className="font-bold text-slate-900 text-sm truncate leading-tight">{prod.name}</h4>
                      {prod.isSpecial && <span className="bg-emerald-500 text-white font-extrabold text-[8px] uppercase px-1 rounded">Chef</span>}
                    </div>
                    <p className="text-xs text-slate-400 line-clamp-1 leading-normal font-light">{prod.description}</p>
                    <p className="font-mono text-xs font-bold text-slate-800">₹{prod.price.toFixed(2)}</p>
                  </div>

                  {/* Quantity selector overlay */}
                  <div className="shrink-0" onClick={(e) => e.stopPropagation()}>
                    {qty > 0 ? (
                      <div className="flex items-center gap-2 bg-slate-100 border p-1 rounded-xl">
                        <button onClick={() => removeFromCart(prod.id)} className="w-6 h-6 rounded-lg bg-white hover:bg-slate-50 text-slate-700 flex items-center justify-center cursor-pointer shadow-sm"><FiMinus className="text-xs" /></button>
                        <span className="font-mono text-xs font-bold text-slate-800 px-1">{qty}</span>
                        <button onClick={() => addToCart(prod)} className="w-6 h-6 rounded-lg bg-white hover:bg-slate-50 text-slate-700 flex items-center justify-center cursor-pointer shadow-sm"><FiPlus className="text-xs" /></button>
                      </div>
                    ) : (
                      <button
                        onClick={() => addToCart(prod)}
                        className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 active:bg-black text-white font-bold text-xs shadow-sm cursor-pointer"
                      >
                        Add
                      </button>
                    )}
                  </div>

                </div>
              );
            })}
            {filteredProducts.length === 0 && (
              <div className="text-center py-10 text-slate-400 text-xs">No culinary specialties match your filters.</div>
            )}
          </div>
        </div>

      </div>

      {/* DETAILED DIALOG MODAL */}
      {selectedProduct && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4">
          <div className="w-full max-w-sm bg-white rounded-t-3xl sm:rounded-2xl overflow-hidden shadow-2xl animate-fade-in text-slate-800">
            <div className="relative h-56 bg-slate-100">
              <img
                src={selectedProduct.imageUrl}
                alt={selectedProduct.name}
                className="w-full h-full object-cover"
                onError={(e) => { e.target.src = "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&q=80&w=400" }}
              />
              <button
                onClick={() => setSelectedProduct(null)}
                className="absolute top-4 right-4 w-8 h-8 rounded-full bg-black/40 hover:bg-black/60 text-white flex items-center justify-center backdrop-blur shadow"
              >
                <FiX />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="space-y-1">
                <div className="flex justify-between items-start">
                  <h3 className="text-lg font-bold font-display text-slate-900">{selectedProduct.name}</h3>
                  <span className="font-mono text-base font-extrabold text-slate-900">₹{selectedProduct.price.toFixed(2)}</span>
                </div>
                <div className="flex gap-2">
                  {selectedProduct.isPopular && <span className="bg-amber-400 text-slate-950 font-bold uppercase text-[9px] px-2 py-0.5 rounded">Popular selection</span>}
                  {selectedProduct.isSpecial && <span className="bg-emerald-500 text-white font-bold uppercase text-[9px] px-2 py-0.5 rounded">Chef's pick</span>}
                </div>
              </div>

              <p className="text-xs text-slate-500 leading-relaxed font-light">{selectedProduct.description || 'Artisanal culinary preparation made by master chefs in the house.'}</p>

              <div className="pt-3 border-t flex justify-between items-center">
                <span className="text-xs text-slate-400 font-medium">Configure to Cart</span>
                <div className="flex items-center gap-2 bg-slate-100 border p-1 rounded-xl">
                  <button onClick={() => removeFromCart(selectedProduct.id)} className="w-7 h-7 rounded-lg bg-white text-slate-700 flex items-center justify-center cursor-pointer shadow-sm"><FiMinus /></button>
                  <span className="font-mono text-xs font-bold text-slate-800 px-2">{getProductQuantity(selectedProduct.id)}</span>
                  <button onClick={() => addToCart(selectedProduct)} className="w-7 h-7 rounded-lg bg-white text-slate-700 flex items-center justify-center cursor-pointer shadow-sm"><FiPlus /></button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SLIDING VIEW CART MODAL PANEL */}
      {showCart && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end justify-center">
          <div className="w-full max-w-md bg-white rounded-t-3xl overflow-hidden shadow-2xl animate-fade-in flex flex-col max-h-[85vh]">

            {/* Header */}
            <div className="px-5 py-4 border-b flex justify-between items-center bg-slate-900 text-white shrink-0">
              <div className="flex items-center gap-2">
                <FiShoppingBag className="text-amber-400" />
                <h3 className="font-bold text-sm tracking-tight uppercase">Culinary Selection Cart</h3>
              </div>
              <button onClick={() => setShowCart(false)} className="text-slate-400 hover:text-white"><FiX className="text-xl" /></button>
            </div>

            {/* Cart content scrollable */}
            <div className="flex-1 overflow-y-auto p-5 space-y-5">

              <div className="space-y-3.5 divide-y divide-slate-100">
                {cart.map(item => (
                  <div key={item.id} className="flex justify-between items-center py-2 text-xs">
                    <div>
                      <h4 className="font-bold text-slate-900">{item.name}</h4>
                      <p className="text-slate-400 font-mono mt-0.5">₹{item.price.toFixed(2)} x {item.quantity}</p>
                    </div>
                    <div className="flex items-center gap-2 bg-slate-100 border p-1 rounded-lg shrink-0">
                      <button onClick={() => removeFromCart(item.id)} className="w-5 h-5 rounded-md bg-white text-slate-700 flex items-center justify-center cursor-pointer shadow-xs"><FiMinus className="text-[10px]" /></button>
                      <span className="font-mono font-bold text-slate-800 text-[11px] px-1">{item.quantity}</span>
                      <button onClick={() => addToCart(item)} className="w-5 h-5 rounded-md bg-white text-slate-700 flex items-center justify-center cursor-pointer shadow-xs"><FiPlus className="text-[10px]" /></button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Special Instructions text */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                  <FiMessageSquare /> Special cooking instructions
                </label>
                <textarea
                  rows="2"
                  placeholder="e.g. No sesame oil, well done burger, extra napkins..."
                  value={specialInstructions}
                  onChange={(e) => setSpecialInstructions(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs focus:outline-none focus:border-amber-500 text-slate-700"
                />
              </div>

              {/* Coupons form input */}
              <form onSubmit={handleApplyPromo} className="space-y-2">
                <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Apply Store Coupon</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Enter code e.g. WELCOME10"
                    value={promoCode}
                    onChange={(e) => setPromoCode(e.target.value)}
                    className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs text-slate-800 focus:outline-none uppercase"
                  />
                  <button type="submit" className="px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 rounded-xl text-xs font-bold text-white cursor-pointer">
                    Apply
                  </button>
                </div>
                {promoError && <p className="text-[10px] text-rose-500 font-semibold">{promoError}</p>}
                {activeCoupon && (
                  <p className="text-[10px] text-emerald-600 font-semibold flex items-center gap-1 animate-pulse">
                    <FiCheck /> Promo code applied: {activeCoupon.discountType === 'percent' ? `${activeCoupon.discountValue}% off` : `₹${activeCoupon.discountValue} off`}!
                  </p>
                )}
              </form>

              {/* Pricing overview breakdown */}
              <div className="border-t pt-4 space-y-2 text-xs text-slate-500 font-medium font-display">
                <div className="flex justify-between">
                  <span>Subtotal</span>
                  <span className="font-mono text-slate-700 font-bold">₹{cartSubtotal.toFixed(2)}</span>
                </div>
                {cartDiscount > 0 && (
                  <div className="flex justify-between text-emerald-600">
                    <span>Discount applied</span>
                    <span className="font-mono font-bold">-₹{cartDiscount.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span>Taxes & Service ({restaurant.taxRate || 8}%)</span>
                  <span className="font-mono text-slate-700 font-bold">₹{cartTax.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm font-bold text-slate-900 pt-1.5 border-t border-dashed">
                  <span>Grand Total</span>
                  <span className="font-mono text-amber-600 text-base font-extrabold">₹{cartGrandTotal.toFixed(2)}</span>
                </div>
              </div>

            </div>

            {/* Place checkout */}
            <div className="p-4 bg-slate-50 border-t shrink-0">
              <button
                onClick={handleCheckout}
                className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-white font-bold text-sm rounded-xl shadow-lg transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <span>Confirm Order Checkout</span>
                <FiArrowRight />
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
