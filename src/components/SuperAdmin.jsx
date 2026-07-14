import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FiHome,
  FiUser,
  FiLock,
  FiPower,
  FiPlus,
  FiTrash2,
  FiRefreshCw,
  FiActivity,
  FiServer,
  FiGrid,
  FiSettings,
  FiCheckCircle,
  FiXCircle,
  FiAlertTriangle,
  FiArrowLeft,
  FiMail,
  FiEdit3,
  FiToggleLeft,
  FiToggleRight,
  FiSun,
  FiMoon,
  FiPhone,
  FiLayers
} from 'react-icons/fi';
import {
  getRestaurants,
  createRestaurant,
  deleteRestaurant,
  updateRestaurant,
  getSubscriptionPlans,
  createSubscriptionPlan,
  updateSubscriptionPlan,
  deleteSubscriptionPlan
} from '../dbService';
import { doc, setDoc, getDoc, collection, query, where, getDocs, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from './AuthProvider.jsx';
import { useTheme } from '../contexts/ThemeContext.jsx';
import ImageUploader from './ImageUploader.jsx';

// Rupee symbol helper
const INR = (amount) => `₹${Number(amount || 0).toLocaleString('en-IN')}`;

// Theme toggle button component
function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  return (
    <button onClick={toggleTheme} className="theme-toggle" title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}>
      {theme === 'dark' ? <FiSun className="text-sm" /> : <FiMoon className="text-sm" />}
    </button>
  );
}

export default function SuperAdmin() {
  const navigate = useNavigate();
  const { user, userRole, signInWithEmail, signUpWithEmail, logOut, loading: authLoading } = useAuth();
  const { theme } = useTheme();

  const isDark = theme === 'dark';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [securityKey, setSecurityKey] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [authError, setAuthError] = useState('');

  const [restaurants, setRestaurants] = useState([]);
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('restaurants');

  // Modal State — Create/Edit Restaurant
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newRest, setNewRest] = useState({
    id: '',
    name: '',
    description: '',
    logoUrl: '',
    themeColor: '#10b981',
    taxRate: 8,
    planId: '',
    kdsLimit: '2',
    address: '',
    contact: ''
  });
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [adminMobile, setAdminMobile] = useState('');
  const [createError, setCreateError] = useState('');
  const [isUploadingLogoImg, setIsUploadingLogoImg] = useState(false);

  // Plan Modal State — Create/Edit
  const [isPlanModalOpen, setIsPlanModalOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState(null);
  const [planForm, setPlanForm] = useState({
    name: '',
    monthlyPrice: '',
    yearlyPrice: '',
    restaurantLimit: 1,
    staffLimit: 5,
    orderLimit: 500,
    durationMonths: 1,
    features: '',
    isActive: true
  });
  const [planError, setPlanError] = useState('');

  // Password Reset Feature States
  const [isResetPasswordOpen, setIsResetPasswordOpen] = useState(false);
  const [selectedRestForReset, setSelectedRestForReset] = useState(null);
  const [resetOption, setResetOption] = useState('auto'); // 'auto' or 'manual'
  const [manualPasswordInput, setManualPasswordInput] = useState('');
  const [generatedPassword, setGeneratedPassword] = useState('');
  const [resetSuccess, setResetSuccess] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [resetError, setResetError] = useState('');
  const [copySuccess, setCopySuccess] = useState(false);

  // Platform Settings
  const [commissionRate, setCommissionRate] = useState(2.5);
  const [supportEmail, setSupportEmail] = useState('support@tabletap.in');
  const [settingsSaved, setSettingsSaved] = useState(false);

  // Load data on login
  useEffect(() => {
    async function loadData() {
      setLoading(true);
      const [restData, planData] = await Promise.all([getRestaurants(), getSubscriptionPlans()]);
      setRestaurants(restData);
      setPlans(planData);
      setLoading(false);
    }
    if (user && userRole === 'super_admin') {
      loadData();
    }
  }, [user, userRole]);

  // Reload data helper
  const reloadData = async () => {
    const [restData, planData] = await Promise.all([getRestaurants(), getSubscriptionPlans()]);
    setRestaurants(restData);
    setPlans(planData);
  };

  // ── Auth ──────────────────────────────────────
  const handleAuthSubmit = async (e) => {
    e.preventDefault();
    setAuthError('');

    if (isSignUp) {
      if (!email || !password || !securityKey) {
        setAuthError('Please fill in all fields.');
        return;
      }
      try {
        // Step 1: Read system/settings
        const systemSettingsRef = doc(db, 'system', 'settings');
        const systemSettingsSnap = await getDoc(systemSettingsRef);

        if (!systemSettingsSnap.exists()) {
          setAuthError('Unable to verify Security Key. Please try again.');
          return;
        }

        // Step 2: Read superAdminSecurityKey
        const systemData = systemSettingsSnap.data();
        const correctKey = systemData?.superAdminSecurityKey;

        if (!correctKey) {
          setAuthError('Unable to verify Security Key. Please try again.');
          return;
        }

        // Step 3: Compare with the Security Key entered by the user
        if (securityKey !== correctKey) {
          setAuthError('Invalid Security Key. Please contact the system owner.');
          return;
        }

        // Key is valid! Continue the existing registration flow
        await signUpWithEmail(email, password, 'super_admin');
      } catch (err) {
        console.error('Firestore security key verification error:', err);
        setAuthError('Unable to verify Security Key. Please try again.');
      }
    } else {
      if (!email || !password) {
        setAuthError('Please fill in all fields.');
        return;
      }
      try {
        await signInWithEmail(email, password);
      } catch (err) {
        setAuthError(err.message || 'Authentication failed. Please check your credentials.');
      }
    }
  };

  // ── Create Restaurant ─────────────────────────
  const handleCreateRestaurant = async (e) => {
    e.preventDefault();
    setCreateError('');
    if (!newRest.id || !newRest.name) { setCreateError('Slug ID and Name are required.'); return; }
    if (!adminEmail || !adminPassword) { setCreateError('Manager email and password are required.'); return; }

    const recordId = newRest.id.trim().toLowerCase().replace(/\s+/g, '_');
    const selectedPlan = plans.find(p => p.id === newRest.planId);

    const record = {
      ...newRest,
      id: recordId,
      contact: adminMobile || newRest.contact,
      status: 'active',
      subscriptionStatus: 'active',
      planId: selectedPlan?.id || null,
      planName: selectedPlan?.name || 'Custom',
      planMonthlyPrice: selectedPlan?.monthlyPrice || 0,
      subscriptionExpiry: new Date(Date.now() + ((selectedPlan?.durationMonths || 12) * 30 * 24 * 60 * 60 * 1000)).toISOString().split('T')[0],
      createdAt: new Date().toISOString()
    };

    setLoading(true);
    try {
      await createRestaurant(record);

      // Create restaurant admin user in Firestore users collection (Firestore-only auth, consistent with AuthProvider)
      const emailId = adminEmail.trim().toLowerCase();
      const existingDoc = await getDoc(doc(db, 'users', emailId));
      if (existingDoc.exists()) {
        setCreateError('An account with this manager email already exists.');
        setLoading(false);
        return;
      }
      await setDoc(doc(db, 'users', emailId), {
        uid: emailId,
        email: adminEmail.trim(),
        password: adminPassword,
        role: 'restaurant_admin',
        restaurantId: recordId,
        phone: adminMobile || '',
        name: newRest.name,
        createdAt: new Date().toISOString()
      });

      await reloadData();
      setIsModalOpen(false);
      resetRestaurantForm();
    } catch (err) {
      console.error('Error deploying restaurant:', err);
      setCreateError('Failed to deploy restaurant: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const resetRestaurantForm = () => {
    setNewRest({ id: '', name: '', description: '', logoUrl: '', themeColor: '#10b981', taxRate: 8, planId: '', kdsLimit: '2', address: '', contact: '' });
    setAdminEmail('');
    setAdminPassword('');
    setAdminMobile('');
    setCreateError('');
  };

  // ── Restaurant Actions ────────────────────────
  const handleResetPasswordClick = (restaurant) => {
    setSelectedRestForReset(restaurant);
    setResetOption('auto');
    setManualPasswordInput('');
    setResetError('');
    setResetSuccess(false);
    setCopySuccess(false);
    setIsResetPasswordOpen(true);
  };

  const handleResetPasswordSubmit = async (e) => {
    e.preventDefault();
    setResetError('');
    setIsResetting(true);

    let tempPassword = '';
    if (resetOption === 'auto') {
      const prefixes = ['ED', 'Cafe', 'Easy', 'Tap', 'Dine', 'Table', 'Chef', 'Food'];
      const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
      const digits = Math.floor(10000 + Math.random() * 90000); // 5 digits
      tempPassword = `${prefix}@${digits}`;
    } else {
      if (!manualPasswordInput.trim()) {
        setResetError('Please enter a temporary password.');
        setIsResetting(false);
        return;
      }
      if (manualPasswordInput.length < 6) {
        setResetError('Manual password must be at least 6 characters long.');
        setIsResetting(false);
        return;
      }
      tempPassword = manualPasswordInput.trim();
    }

    try {
      // 1. Query users collection to find the restaurant_admin
      const usersRef = collection(db, 'users');
      const q = query(
        usersRef,
        where('restaurantId', '==', selectedRestForReset.id),
        where('role', '==', 'restaurant_admin')
      );
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        throw new Error('No administrator user account found for this restaurant.');
      }

      // 2. Update password in user doc
      const userDocRef = querySnapshot.docs[0].ref;
      await updateDoc(userDocRef, {
        password: tempPassword
      });

      // 3. Update metadata in restaurant doc
      const restDocRef = doc(db, 'restaurants', selectedRestForReset.id);
      await updateDoc(restDocRef, {
        lastPasswordResetAt: new Date().toISOString(),
        usesTemporaryPassword: true
      });

      setGeneratedPassword(tempPassword);
      setResetSuccess(true);
    } catch (err) {
      console.error('Error resetting password:', err);
      setResetError(err.message || 'Failed to reset password.');
    } finally {
      setIsResetting(false);
    }
  };

  const [suspendModal, setSuspendModal] = useState({ isOpen: false, id: '', currentStatus: '' });

  const handleSuspendClick = (id, currentStatus) => {
    if (currentStatus === 'active') {
      setSuspendModal({ isOpen: true, id, currentStatus });
    } else {
      handleSuspend(id, currentStatus);
    }
  };

  const handleSuspend = async (id, currentStatus) => {
    const nextStatus = currentStatus === 'active' ? 'suspended' : 'active';
    setLoading(true);
    await updateRestaurant(id, { status: nextStatus });
    await reloadData();
    setLoading(false);
    setSuspendModal({ isOpen: false, id: '', currentStatus: '' });
  };

  const handleRenew = async (id) => {
    const plan = plans.find(p => p.id === restaurants.find(r => r.id === id)?.planId);
    const months = plan?.durationMonths || 12;
    const nextExpiry = new Date(Date.now() + (months * 30 * 24 * 60 * 60 * 1000)).toISOString().split('T')[0];
    setLoading(true);
    await updateRestaurant(id, { status: 'active', subscriptionStatus: 'active', subscriptionExpiry: nextExpiry });
    await reloadData();
    setLoading(false);
  };

  const handleDelete = async (id) => {
    if (window.confirm('Are you absolutely sure you want to delete this restaurant from TableTap?')) {
      setLoading(true);
      await deleteRestaurant(id);
      await reloadData();
      setLoading(false);
    }
  };

  const handleAssignPlan = async (restId, planId) => {
    const plan = plans.find(p => p.id === planId);
    await updateRestaurant(restId, {
      planId: plan?.id || null,
      planName: plan?.name || 'Custom',
      planMonthlyPrice: plan?.monthlyPrice || 0
    });
    await reloadData();
  };

  // ── Plan CRUD ─────────────────────────────────
  const openCreatePlan = () => {
    setEditingPlan(null);
    setPlanForm({ name: '', monthlyPrice: '', yearlyPrice: '', restaurantLimit: 1, staffLimit: 5, orderLimit: 500, durationMonths: 1, features: '', isActive: true });
    setPlanError('');
    setIsPlanModalOpen(true);
  };

  const openEditPlan = (plan) => {
    setEditingPlan(plan);
    setPlanForm({
      name: plan.name,
      monthlyPrice: plan.monthlyPrice,
      yearlyPrice: plan.yearlyPrice || '',
      restaurantLimit: plan.restaurantLimit || 1,
      staffLimit: plan.staffLimit || 5,
      orderLimit: plan.orderLimit || 500,
      durationMonths: plan.durationMonths || 1,
      features: Array.isArray(plan.features) ? plan.features.join(', ') : (plan.features || ''),
      isActive: plan.isActive !== false
    });
    setPlanError('');
    setIsPlanModalOpen(true);
  };

  const handleSavePlan = async (e) => {
    e.preventDefault();
    setPlanError('');
    if (!planForm.name || !planForm.monthlyPrice) { setPlanError('Plan name and monthly price are required.'); return; }

    const featuresArray = planForm.features
      ? planForm.features.split(',').map(f => f.trim()).filter(Boolean)
      : [];

    const planData = {
      name: planForm.name.trim(),
      monthlyPrice: Number(planForm.monthlyPrice),
      yearlyPrice: planForm.yearlyPrice ? Number(planForm.yearlyPrice) : null,
      restaurantLimit: Number(planForm.restaurantLimit),
      staffLimit: Number(planForm.staffLimit),
      orderLimit: Number(planForm.orderLimit),
      durationMonths: Number(planForm.durationMonths),
      features: featuresArray,
      isActive: planForm.isActive
    };

    setLoading(true);
    try {
      if (editingPlan) {
        await updateSubscriptionPlan(editingPlan.id, planData);
      } else {
        const planId = `plan_${Date.now()}`;
        await createSubscriptionPlan({ ...planData, id: planId, createdAt: new Date().toISOString() });
      }
      await reloadData();
      setIsPlanModalOpen(false);
    } catch (err) {
      setPlanError('Failed to save plan: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleTogglePlan = async (plan) => {
    await updateSubscriptionPlan(plan.id, { isActive: !plan.isActive });
    await reloadData();
  };

  const handleDeletePlan = async (planId) => {
    if (window.confirm('Delete this subscription plan? Restaurants on this plan will retain their current settings.')) {
      setLoading(true);
      await deleteSubscriptionPlan(planId);
      await reloadData();
      setLoading(false);
    }
  };

  // ── Settings ──────────────────────────────────
  const handleSaveSettings = (e) => {
    e.preventDefault();
    setSettingsSaved(true);
    setTimeout(() => setSettingsSaved(false), 3000);
  };

  // ── Calculations ──────────────────────────────
  const activeSubs = restaurants.filter(r => r.subscriptionStatus === 'active' && r.status === 'active').length;
  const mrr = restaurants.reduce((acc, r) => {
    if (r.status !== 'active') return acc;
    const plan = plans.find(p => p.id === r.planId);
    return acc + (plan?.monthlyPrice || r.planMonthlyPrice || 0);
  }, 0);

  // ── Shared input style ────────────────────────
  const inputCls = `w-full themed-input border rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-emerald-500 transition-colors`;
  const labelCls = `block text-xs font-semibold themed-muted uppercase tracking-wider mb-1`;

  // ═══════════════════════════════════════════════
  // LOGIN SCREEN
  // ═══════════════════════════════════════════════
  if (!user) {
    return (
      <div className={`min-h-screen ${isDark ? 'bg-slate-950 text-white' : 'bg-slate-100 text-slate-900'} font-sans flex items-center justify-center p-4`}>
        {/* Theme toggle in corner */}
        <div className="absolute top-4 right-4">
          <ThemeToggle />
        </div>

        <div className={`w-full max-w-md p-8 rounded-2xl border shadow-2xl animate-fade-in ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
          <div className="flex items-center gap-2 mb-6">
            <button onClick={() => navigate('/')} className={`${isDark ? 'text-slate-400 hover:text-white' : 'text-slate-400 hover:text-slate-800'} transition-colors`}>
              <FiArrowLeft className="text-xl" />
            </button>
            <span className="text-emerald-400 text-xs font-semibold uppercase tracking-widest bg-emerald-500/10 px-2.5 py-1 rounded">
              Super Admin Gate
            </span>
          </div>

          <h2 className="text-2xl font-bold font-display tracking-tight mb-2">
            {isSignUp ? 'Create Super Admin' : 'TableTap Platform Control'}
          </h2>
          <p className={`text-sm font-light mb-6 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
            {isSignUp ? 'Register a master user for platform orchestration.' : 'Sign in to access the SaaS orchestration dashboard.'}
          </p>

          <form onSubmit={handleAuthSubmit} className="space-y-4">
            <div>
              <label className={labelCls}>Email Address</label>
              <div className="relative">
                <FiMail className={`absolute left-3 top-3.5 ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
                <input
                  type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@tabletap.in"
                  className={`w-full ${isDark ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-200 text-slate-800'} border rounded-xl py-2.5 pl-10 pr-4 text-sm focus:outline-none focus:border-emerald-500 transition-colors`}
                  required
                />
              </div>
            </div>
            <div>
              <label className={labelCls}>Password</label>
              <div className="relative">
                <FiLock className={`absolute left-3 top-3.5 ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
                <input
                  type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className={`w-full ${isDark ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-200 text-slate-800'} border rounded-xl py-2.5 pl-10 pr-4 text-sm focus:outline-none focus:border-emerald-500 transition-colors`}
                  required
                />
              </div>
            </div>
            {isSignUp && (
              <div>
                <label className={labelCls}>Security Key</label>
                <div className="relative">
                  <FiLock className={`absolute left-3 top-3.5 ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
                  <input
                    type="password" value={securityKey} onChange={(e) => setSecurityKey(e.target.value)}
                    placeholder="Enter Security Key"
                    className={`w-full ${isDark ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-200 text-slate-800'} border rounded-xl py-2.5 pl-10 pr-4 text-sm focus:outline-none focus:border-emerald-500 transition-colors`}
                    required
                  />
                </div>
              </div>
            )}
            {authError && <p className="text-xs text-rose-400 mt-2 flex items-center gap-1"><FiAlertTriangle /> {authError}</p>}
            <button
              type="submit" disabled={authLoading}
              className="w-full bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 py-3 rounded-xl font-semibold text-sm shadow-lg transition-all cursor-pointer text-slate-950 flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {authLoading ? (<><div className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" /><span>Processing...</span></>) : (isSignUp ? 'Register Master Admin' : 'Verify Credentials')}
            </button>
          </form>

          <div className="mt-4 text-center">
            <button onClick={() => { setIsSignUp(!isSignUp); setAuthError(''); setSecurityKey(''); }} className="text-xs text-emerald-400 hover:underline">
              {isSignUp ? 'Already have an admin account? Sign In' : 'Need to register a master account? Sign Up'}
            </button>
          </div>
          <div className={`mt-6 border-t ${isDark ? 'border-slate-800' : 'border-slate-100'} pt-4 text-[11px] ${isDark ? 'text-slate-500' : 'text-slate-400'} text-center`}>
            Orchestration layer protected by Firestore credentials. Only authorized super-admins allowed.
          </div>
        </div>
      </div>
    );
  }

  // ─── Access Denied ──────────────────────────────
  if (userRole !== 'super_admin') {
    return (
      <div className={`min-h-screen ${isDark ? 'bg-slate-950 text-white' : 'bg-slate-100 text-slate-900'} font-sans flex items-center justify-center p-4`}>
        <div className={`w-full max-w-md p-8 rounded-2xl border shadow-2xl text-center ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
          <FiAlertTriangle className="text-amber-400 text-5xl mx-auto mb-4 animate-bounce" />
          <h2 className="text-2xl font-bold font-display tracking-tight mb-2">Access Denied</h2>
          <p className={`text-sm font-light mb-6 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
            Your current account ({user.email}) does not have permission to view the Super Admin Control Center.
          </p>
          <div className="flex flex-col gap-3">
            <button onClick={() => logOut()} className={`w-full py-2.5 rounded-xl text-sm font-semibold transition-all cursor-pointer ${isDark ? 'bg-slate-800 hover:bg-slate-700' : 'bg-slate-100 hover:bg-slate-200'}`}>
              Sign Out from Account
            </button>
            <button onClick={() => navigate('/')} className={`w-full bg-transparent border py-2.5 rounded-xl text-sm transition-all ${isDark ? 'border-slate-800 hover:border-slate-700 text-slate-400' : 'border-slate-200 hover:border-slate-300 text-slate-500'}`}>
              Return to Launchpad
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════
  // MAIN DASHBOARD
  // ═══════════════════════════════════════════════
  return (
    <div className={`min-h-screen font-sans flex flex-col md:flex-row ${isDark ? 'bg-slate-950 text-slate-100' : 'bg-slate-100 text-slate-800'}`}>

      {/* Sidebar */}
      <aside className={`w-full md:w-64 p-6 flex flex-col justify-between shrink-0 border-r ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
        <div>
          <div className="flex items-center gap-3 mb-8">
            <div className="w-8 h-8 rounded bg-emerald-500 flex items-center justify-center font-bold text-slate-950 text-lg">TT</div>
            <div>
              <h2 className="font-bold font-display text-sm tracking-wide">TableTap SaaS</h2>
              <p className="text-[10px] text-emerald-400">Master Console</p>
            </div>
          </div>

          <nav className="space-y-1">
            {[
              { id: 'restaurants', label: 'Restaurants', icon: <FiServer className="text-lg" /> },
              { id: 'plans', label: 'Subscription Plans', icon: <FiLayers className="text-lg" /> },
              { id: 'settings', label: 'Platform Settings', icon: <FiSettings className="text-lg" /> },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-all text-left cursor-pointer ${activeTab === tab.id
                    ? 'bg-emerald-500/10 text-emerald-400'
                    : isDark ? 'text-slate-400 hover:text-white hover:bg-slate-800/50' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
                  }`}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
            <button onClick={() => navigate('/')} className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm text-left transition-all cursor-pointer ${isDark ? 'text-slate-400 hover:text-white hover:bg-slate-800/50' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'}`}>
              <FiHome className="text-lg" /> Developer Landing
            </button>
          </nav>
        </div>

        <div className={`border-t pt-4 mt-6 ${isDark ? 'border-slate-800' : 'border-slate-200'}`}>
          <div className={`flex items-center justify-between text-xs mb-3 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="truncate max-w-[130px]">{user.email}</span>
            </div>
            <ThemeToggle />
          </div>
          <button onClick={() => logOut()} className={`w-full flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-medium cursor-pointer transition-all ${isDark ? 'bg-slate-800 hover:bg-slate-700 text-slate-300' : 'bg-slate-100 hover:bg-slate-200 text-slate-600'}`}>
            <FiPower /> Sign Out
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-6 md:p-10 overflow-y-auto max-w-7xl mx-auto w-full">

        {/* ── TAB: RESTAURANTS ─────────────────── */}
        {activeTab === 'restaurants' && (
          <div className="space-y-8 animate-fade-in">
            <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div>
                <h1 className="text-3xl font-bold font-display tracking-tight">SaaS Command Center</h1>
                <p className={`text-sm font-light mt-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Deploy, inspect, suspend, and renew restaurant storefront subscriptions.</p>
              </div>
              <button onClick={() => { resetRestaurantForm(); setIsModalOpen(true); }} className="px-4 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold rounded-xl text-sm transition-all shadow-lg flex items-center gap-1.5 cursor-pointer">
                <FiPlus /> Deploy New Restaurant
              </button>
            </header>

            {/* Stats Grid */}
            <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {[
                { label: 'Active Subscribers', value: `${activeSubs} / ${restaurants.length}`, sub: 'Active restaurant clients', icon: <FiCheckCircle />, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
                { label: 'Estimated MRR', value: INR(mrr), sub: 'Monthly Recurring Revenue', icon: '₹', color: 'text-amber-400', bg: 'bg-amber-500/10' },
                { label: 'Platform Commission', value: `${commissionRate}%`, sub: 'Per processed QR transaction', icon: <FiActivity />, color: 'text-sky-400', bg: 'bg-sky-500/10' },
                { label: 'Total Plans', value: `${plans.filter(p => p.isActive).length} Active`, sub: `${plans.length} total plans created`, icon: <FiLayers />, color: 'text-purple-400', bg: 'bg-purple-500/10' },
              ].map(stat => (
                <div key={stat.label} className={`p-6 rounded-2xl border shadow-xl ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
                  <div className="flex justify-between items-center mb-4">
                    <span className={`text-xs font-medium uppercase tracking-wider ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{stat.label}</span>
                    <div className={`w-8 h-8 rounded-lg ${stat.bg} ${stat.color} flex items-center justify-center font-bold text-sm`}>{stat.icon}</div>
                  </div>
                  <h3 className={`text-2xl font-extrabold font-mono ${isDark ? 'text-white' : 'text-slate-900'}`}>{stat.value}</h3>
                  <p className={`text-xs mt-2 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{stat.sub}</p>
                </div>
              ))}
            </section>

            {/* Restaurants Table */}
            <section className={`rounded-2xl overflow-hidden shadow-xl border ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
              <div className={`px-6 py-4 border-b flex justify-between items-center ${isDark ? 'border-slate-800' : 'border-slate-200'}`}>
                <h2 className={`font-bold font-display text-base ${isDark ? 'text-white' : 'text-slate-900'}`}>Subscriber Storefront Registry</h2>
                <div className={`text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Live — Firestore + localStorage</div>
              </div>
              {loading ? (
                <div className="p-12 text-center text-sm">
                  <FiRefreshCw className="animate-spin text-emerald-400 text-2xl mx-auto mb-3" />
                  <span className={isDark ? 'text-slate-400' : 'text-slate-500'}>Loading restaurant data...</span>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-sm">
                    <thead>
                      <tr className={`border-b text-xs font-semibold uppercase tracking-wider ${isDark ? 'border-slate-800 text-slate-400' : 'border-slate-200 text-slate-400 bg-slate-50'}`}>
                        <th className="px-6 py-3.5">Store Details</th>
                        <th className="px-6 py-3.5">Pricing Plan</th>
                        <th className="px-6 py-3.5">Assign Plan</th>
                        <th className="px-6 py-3.5">KDS Limit</th>
                        <th className="px-6 py-3.5">Expiry Date</th>
                        <th className="px-6 py-3.5">Status</th>
                        <th className="px-6 py-3.5">Subscription</th>
                        <th className="px-6 py-3.5 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className={`divide-y ${isDark ? 'divide-slate-800' : 'divide-slate-100'}`}>
                      {restaurants.map((rest) => {
                        const assignedPlan = plans.find(p => p.id === rest.planId);
                        return (
                          <tr key={rest.id} className={`transition-colors ${isDark ? 'hover:bg-slate-800/40' : 'hover:bg-slate-50'}`}>
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-3">
                                <img src={rest.logoUrl || "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&q=80&w=200"} alt={rest.name} className={`w-10 h-10 rounded-lg object-cover ${isDark ? 'bg-slate-800' : 'bg-slate-100'}`} onError={(e) => { e.target.src = "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&q=80&w=200" }} />
                                <div>
                                  <div className={`font-bold text-sm ${isDark ? 'text-white' : 'text-slate-900'}`}>{rest.name}</div>
                                  <div className={`text-xs max-w-xs truncate ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{rest.description}</div>
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <div className={`font-mono text-xs font-semibold ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>{assignedPlan?.name || rest.planName || 'No Plan'}</div>
                              <div className={`text-[10px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{assignedPlan ? `₹${assignedPlan.monthlyPrice}/mo` : rest.planMonthlyPrice ? `₹${rest.planMonthlyPrice}/mo` : '—'}</div>
                            </td>
                            <td className="px-6 py-4">
                              <select
                                value={rest.planId || ''}
                                onChange={(e) => handleAssignPlan(rest.id, e.target.value)}
                                className={`text-xs rounded-lg px-2 py-1.5 border focus:outline-none focus:border-emerald-500 ${isDark ? 'bg-slate-800 border-slate-700 text-slate-200' : 'bg-slate-50 border-slate-200 text-slate-700'}`}
                              >
                                <option value="">No Plan</option>
                                {plans.filter(p => p.isActive).map(p => (
                                  <option key={p.id} value={p.id}>{p.name} — ₹{p.monthlyPrice}/mo</option>
                                ))}
                              </select>
                            </td>
                            <td className="px-6 py-4 font-mono text-xs font-semibold">
                              {rest.kdsLimit || 'Unlimited'}
                            </td>
                            <td className={`px-6 py-4 font-mono text-xs ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{rest.subscriptionExpiry}</td>
                            <td className="px-6 py-4">
                              <span className={`inline-flex items-center gap-1 text-[11px] px-2.5 py-0.5 rounded-full font-bold uppercase ${rest.status === 'active' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'}`}>
                                {rest.status === 'active' ? <FiCheckCircle /> : <FiXCircle />} {rest.status}
                              </span>
                            </td>
                            <td className="px-6 py-4">
                              <span className={`inline-flex items-center gap-1 text-[11px] px-2.5 py-0.5 rounded-full font-bold uppercase ${rest.subscriptionStatus === 'active' ? 'bg-sky-500/10 text-sky-400 border border-sky-500/20' : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'}`}>
                                {rest.subscriptionStatus === 'active' ? 'Active' : 'Expired'}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-right">
                              <div className="inline-flex gap-2">
                                <button onClick={() => handleSuspendClick(rest.id, rest.status)} className={`px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-all cursor-pointer ${isDark ? 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700/50' : 'bg-slate-100 hover:bg-slate-200 text-slate-600 border-slate-200'}`}>
                                  {rest.status === 'active' ? 'Suspend' : 'Unsuspend'}
                                </button>
                                <button onClick={() => handleRenew(rest.id)} className="px-2.5 py-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-xs text-emerald-400 transition-all font-medium border border-emerald-500/20 cursor-pointer">
                                  Renew
                                </button>
                                <button onClick={() => handleResetPasswordClick(rest)} className="px-2.5 py-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-xs text-amber-500 hover:text-amber-400 transition-all font-medium border border-amber-500/20 cursor-pointer">
                                  Reset Password
                                </button>
                                <button onClick={() => handleDelete(rest.id)} className="px-2.5 py-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-xs text-rose-400 transition-all font-medium border border-rose-500/20 cursor-pointer">
                                  <FiTrash2 />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                      {restaurants.length === 0 && (
                        <tr><td colSpan="7" className={`text-center py-10 text-sm ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>No restaurants deployed yet. Click "Deploy New Restaurant" to get started.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </div>
        )}

        {/* ── TAB: SUBSCRIPTION PLANS ──────────── */}
        {activeTab === 'plans' && (
          <div className="space-y-8 animate-fade-in">
            <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div>
                <h1 className="text-3xl font-bold font-display tracking-tight">Subscription Plans</h1>
                <p className={`text-sm font-light mt-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Create, edit, and manage all subscription tiers. Assign plans to restaurants dynamically.</p>
              </div>
              <button onClick={openCreatePlan} className="px-4 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold rounded-xl text-sm transition-all shadow-lg flex items-center gap-1.5 cursor-pointer">
                <FiPlus /> Create New Plan
              </button>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {plans.map(plan => (
                <div key={plan.id} className={`rounded-2xl border p-6 flex flex-col justify-between shadow-xl transition-all ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'} ${!plan.isActive ? 'opacity-60' : ''}`}>
                  <div className="space-y-4">
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className={`font-bold text-lg font-display ${isDark ? 'text-white' : 'text-slate-900'}`}>{plan.name}</h3>
                        <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${plan.isActive ? 'bg-emerald-500/10 text-emerald-400' : 'bg-slate-500/10 text-slate-400'}`}>
                          {plan.isActive ? 'Active' : 'Disabled'}
                        </span>
                      </div>
                      <div className="text-right">
                        <div className={`text-2xl font-extrabold font-mono ${isDark ? 'text-white' : 'text-slate-900'}`}>₹{plan.monthlyPrice}<span className="text-xs font-normal text-slate-400">/mo</span></div>
                        {plan.yearlyPrice && <div className="text-xs text-slate-400">₹{plan.yearlyPrice}/yr</div>}
                      </div>
                    </div>

                    <div className={`grid grid-cols-3 gap-2 text-center text-xs border rounded-xl p-3 ${isDark ? 'border-slate-800 bg-slate-800/40' : 'border-slate-100 bg-slate-50'}`}>
                      <div><div className="font-bold">{plan.restaurantLimit}</div><div className={isDark ? 'text-slate-500' : 'text-slate-400'}>Restaurants</div></div>
                      <div><div className="font-bold">{plan.staffLimit}</div><div className={isDark ? 'text-slate-500' : 'text-slate-400'}>Staff</div></div>
                      <div><div className="font-bold">{plan.orderLimit}</div><div className={isDark ? 'text-slate-500' : 'text-slate-400'}>Orders</div></div>
                    </div>

                    {plan.features && plan.features.length > 0 && (
                      <div className="space-y-1">
                        {plan.features.map((f, i) => (
                          <div key={i} className="flex items-center gap-1.5 text-xs">
                            <FiCheckCircle className="text-emerald-400 shrink-0" />
                            <span className={isDark ? 'text-slate-300' : 'text-slate-600'}>{f}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    <div className={`text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                      Duration: {plan.durationMonths} month{plan.durationMonths !== 1 ? 's' : ''}
                    </div>
                  </div>

                  <div className="flex gap-2 pt-4 border-t mt-4" style={{ borderColor: isDark ? '#1e293b' : '#f1f5f9' }}>
                    <button onClick={() => openEditPlan(plan)} className={`flex-1 py-1.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1 cursor-pointer transition-all ${isDark ? 'bg-slate-800 hover:bg-slate-700 text-slate-200' : 'bg-slate-100 hover:bg-slate-200 text-slate-700'}`}>
                      <FiEdit3 /> Edit
                    </button>
                    <button onClick={() => handleTogglePlan(plan)} className={`flex-1 py-1.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1 cursor-pointer transition-all ${plan.isActive ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20 hover:bg-amber-500/20' : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20'}`}>
                      {plan.isActive ? <FiToggleRight /> : <FiToggleLeft />}
                      {plan.isActive ? 'Disable' : 'Enable'}
                    </button>
                    <button onClick={() => handleDeletePlan(plan.id)} className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 transition-all border border-rose-500/20 cursor-pointer">
                      <FiTrash2 />
                    </button>
                  </div>
                </div>
              ))}
              {plans.length === 0 && (
                <div className={`col-span-full py-16 text-center rounded-2xl border border-dashed ${isDark ? 'border-slate-700 text-slate-500' : 'border-slate-300 text-slate-400'}`}>
                  <FiLayers className="text-3xl mx-auto mb-3 opacity-50" />
                  <p className="font-medium">No subscription plans yet.</p>
                  <p className="text-xs mt-1">Create your first plan to start assigning them to restaurants.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── TAB: PLATFORM SETTINGS ───────────── */}
        {activeTab === 'settings' && (
          <div className="space-y-8 animate-fade-in max-w-3xl">
            <div>
              <h1 className="text-3xl font-bold font-display tracking-tight">Platform Settings</h1>
              <p className={`text-sm font-light mt-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Modify platform-wide fee commissions, system emails, and toggle maintenance states.</p>
            </div>

            <form onSubmit={handleSaveSettings} className={`p-6 rounded-2xl border shadow-xl space-y-6 ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
              <h2 className={`font-bold font-display text-base flex items-center gap-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                <FiSettings className="text-emerald-400" /> Global Orchestrator Configuration
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Platform Commission Rate (%)</label>
                  <input type="number" step="0.1" value={commissionRate} onChange={(e) => setCommissionRate(e.target.value)} className={`w-full ${isDark ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-200 text-slate-800'} border rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-emerald-500`} />
                </div>
                <div>
                  <label className={labelCls}>Default Support Contact Email</label>
                  <input type="email" value={supportEmail} onChange={(e) => setSupportEmail(e.target.value)} className={`w-full ${isDark ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-200 text-slate-800'} border rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-emerald-500`} />
                </div>
              </div>
              <button type="submit" className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold rounded-lg text-xs transition-all shadow-lg flex items-center gap-1 cursor-pointer">
                Save Configuration
              </button>
              {settingsSaved && <p className="text-xs text-emerald-400 flex items-center gap-1 animate-pulse font-medium">✓ Global settings synchronized!</p>}
            </form>
          </div>
        )}
      </main>

      {/* ═══ DEPLOY RESTAURANT MODAL ═══════════════ */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className={`w-full max-w-lg rounded-2xl border p-6 shadow-2xl animate-fade-in my-4 ${isDark ? 'bg-slate-900 border-slate-800 text-slate-100' : 'bg-white border-slate-200 text-slate-800'}`}>
            <div className="flex justify-between items-center mb-6">
              <h3 className={`text-lg font-bold font-display ${isDark ? 'text-white' : 'text-slate-900'}`}>Deploy Restaurant Instance</h3>
              <button onClick={() => { setIsModalOpen(false); resetRestaurantForm(); }} className={isDark ? 'text-slate-400 hover:text-white' : 'text-slate-400 hover:text-slate-800'}><FiXCircle className="text-xl" /></button>
            </div>

            {createError && <p className="text-xs text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-lg px-3 py-2 mb-4 flex items-center gap-1"><FiAlertTriangle /> {createError}</p>}

            <form onSubmit={handleCreateRestaurant} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Unique Restaurant Slug ID</label>
                  <input type="text" required placeholder="e.g. taco_palace" value={newRest.id} onChange={(e) => setNewRest({ ...newRest, id: e.target.value })} className={`w-full ${isDark ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-200'} border rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-emerald-500`} />
                </div>
                <div>
                  <label className={labelCls}>Restaurant Name</label>
                  <input type="text" required placeholder="e.g. Taco Palace" value={newRest.name} onChange={(e) => setNewRest({ ...newRest, name: e.target.value })} className={`w-full ${isDark ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-200'} border rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-emerald-500`} />
                </div>
              </div>

              <div>
                <label className={labelCls}>Description / Tagline</label>
                <input type="text" placeholder="Authentic Indian street food and chaat..." value={newRest.description} onChange={(e) => setNewRest({ ...newRest, description: e.target.value })} className={`w-full ${isDark ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-200'} border rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-emerald-500`} />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                <div>
                  <label className={labelCls}>Theme Color</label>
                  <input type="color" value={newRest.themeColor} onChange={(e) => setNewRest({ ...newRest, themeColor: e.target.value })} className={`w-full ${isDark ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-200'} border rounded-xl h-9 px-1 py-1 focus:outline-none cursor-pointer`} />
                </div>
                <div>
                  <label className={labelCls}>Tax Rate (%)</label>
                  <input type="number" value={newRest.taxRate} onChange={(e) => setNewRest({ ...newRest, taxRate: Number(e.target.value) })} className={`w-full ${isDark ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-200'} border rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-emerald-500`} />
                </div>
                <div>
                  <label className={labelCls}>Subscription Plan</label>
                  <select value={newRest.planId} onChange={(e) => setNewRest({ ...newRest, planId: e.target.value })} className={`w-full ${isDark ? 'bg-slate-950 border-slate-800 text-slate-200' : 'bg-slate-50 border-slate-200 text-slate-700'} border rounded-xl px-2 py-2 text-xs focus:outline-none focus:border-emerald-500`}>
                    <option value="">No Plan</option>
                    {plans.filter(p => p.isActive).map(p => (
                      <option key={p.id} value={p.id}>{p.name} — ₹{p.monthlyPrice}/mo</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>KDS Limit</label>
                  <select value={newRest.kdsLimit} onChange={(e) => setNewRest({ ...newRest, kdsLimit: e.target.value })} className={`w-full ${isDark ? 'bg-slate-950 border-slate-800 text-slate-200' : 'bg-slate-50 border-slate-200 text-slate-700'} border rounded-xl px-2 py-2 text-xs focus:outline-none focus:border-emerald-500`}>
                    <option value="1">1 Kitchen</option>
                    <option value="2">2 Kitchens</option>
                    <option value="3">3 Kitchens</option>
                    <option value="5">5 Kitchens</option>
                    <option value="Unlimited">Unlimited</option>
                  </select>
                </div>
              </div>

              <div>
                <ImageUploader
                  value={newRest.logoUrl || ''}
                  onChange={(val) => setNewRest({ ...newRest, logoUrl: val })}
                  onUploadingStateChange={setIsUploadingLogoImg}
                  label="Store Logo Image"
                  isDark={isDark}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Physical Address</label>
                  <input type="text" placeholder="123 MG Road, Bengaluru" value={newRest.address} onChange={(e) => setNewRest({ ...newRest, address: e.target.value })} className={`w-full ${isDark ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-200'} border rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-emerald-500`} />
                </div>
                <div>
                  <label className={labelCls}><FiPhone className="inline mr-1" />Mobile Number</label>
                  <input type="text" placeholder="+91 98765 43210" value={adminMobile} onChange={(e) => setAdminMobile(e.target.value)} className={`w-full ${isDark ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-200'} border rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-emerald-500`} />
                </div>
              </div>

              {/* Manager login credentials */}
              <div className={`border-t pt-4 ${isDark ? 'border-slate-800/80' : 'border-slate-200'}`}>
                <h4 className="text-xs font-bold text-emerald-400 mb-3 uppercase tracking-wider">Manager Login Credentials</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className={labelCls}><FiMail className="inline mr-1" />Gmail / Login Email</label>
                    <input type="email" required placeholder="manager@restaurant.com" value={adminEmail} onChange={(e) => setAdminEmail(e.target.value)} className={`w-full ${isDark ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-200'} border rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-emerald-500`} />
                  </div>
                  <div>
                    <label className={labelCls}><FiLock className="inline mr-1" />Login Password</label>
                    <input type="password" required minLength={6} placeholder="Min. 6 characters" value={adminPassword} onChange={(e) => setAdminPassword(e.target.value)} className={`w-full ${isDark ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-200'} border rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-emerald-500`} />
                  </div>
                </div>
              </div>

              <div className="pt-4 flex justify-end gap-3">
                <button type="button" onClick={() => { setIsModalOpen(false); resetRestaurantForm(); }} className={`px-4 py-2 rounded-xl text-xs font-medium cursor-pointer ${isDark ? 'bg-slate-800 hover:bg-slate-700 text-slate-300' : 'bg-slate-100 hover:bg-slate-200 text-slate-600'}`}>Cancel</button>
                <button
                  type="submit"
                  disabled={loading || isUploadingLogoImg}
                  className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold text-xs cursor-pointer disabled:opacity-50"
                >
                  {isUploadingLogoImg ? 'Uploading Logo...' : (loading ? 'Deploying...' : 'Confirm Deployment')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ═══ PLAN CREATE/EDIT MODAL ═════════════════ */}
      {isPlanModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className={`w-full max-w-lg rounded-2xl border p-6 shadow-2xl animate-fade-in my-4 ${isDark ? 'bg-slate-900 border-slate-800 text-slate-100' : 'bg-white border-slate-200 text-slate-800'}`}>
            <div className="flex justify-between items-center mb-6">
              <h3 className={`text-lg font-bold font-display ${isDark ? 'text-white' : 'text-slate-900'}`}>{editingPlan ? 'Edit Subscription Plan' : 'Create Subscription Plan'}</h3>
              <button onClick={() => setIsPlanModalOpen(false)} className={isDark ? 'text-slate-400 hover:text-white' : 'text-slate-400 hover:text-slate-800'}><FiXCircle className="text-xl" /></button>
            </div>

            {planError && <p className="text-xs text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-lg px-3 py-2 mb-4 flex items-center gap-1"><FiAlertTriangle /> {planError}</p>}

            <form onSubmit={handleSavePlan} className="space-y-4">
              <div>
                <label className={labelCls}>Plan Name</label>
                <input type="text" required placeholder="e.g. Starter, Growth, Enterprise" value={planForm.name} onChange={(e) => setPlanForm({ ...planForm, name: e.target.value })} className={`w-full ${isDark ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-200'} border rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-emerald-500`} />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Monthly Price (₹)</label>
                  <input type="number" required min="0" placeholder="999" value={planForm.monthlyPrice} onChange={(e) => setPlanForm({ ...planForm, monthlyPrice: e.target.value })} className={`w-full ${isDark ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-200'} border rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-emerald-500`} />
                </div>
                <div>
                  <label className={labelCls}>Yearly Price (₹, optional)</label>
                  <input type="number" min="0" placeholder="9999" value={planForm.yearlyPrice} onChange={(e) => setPlanForm({ ...planForm, yearlyPrice: e.target.value })} className={`w-full ${isDark ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-200'} border rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-emerald-500`} />
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div>
                  <label className={labelCls}>Restaurants</label>
                  <input type="number" min="1" value={planForm.restaurantLimit} onChange={(e) => setPlanForm({ ...planForm, restaurantLimit: e.target.value })} className={`w-full ${isDark ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-200'} border rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-emerald-500`} />
                </div>
                <div>
                  <label className={labelCls}>Staff Limit</label>
                  <input type="number" min="1" value={planForm.staffLimit} onChange={(e) => setPlanForm({ ...planForm, staffLimit: e.target.value })} className={`w-full ${isDark ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-200'} border rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-emerald-500`} />
                </div>
                <div>
                  <label className={labelCls}>Order Limit</label>
                  <input type="number" min="1" value={planForm.orderLimit} onChange={(e) => setPlanForm({ ...planForm, orderLimit: e.target.value })} className={`w-full ${isDark ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-200'} border rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-emerald-500`} />
                </div>
                <div>
                  <label className={labelCls}>Duration (mo)</label>
                  <input type="number" min="1" value={planForm.durationMonths} onChange={(e) => setPlanForm({ ...planForm, durationMonths: e.target.value })} className={`w-full ${isDark ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-200'} border rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-emerald-500`} />
                </div>
              </div>

              <div>
                <label className={labelCls}>Features (comma-separated)</label>
                <input type="text" placeholder="QR Menus, Live Orders, Analytics, Priority Support" value={planForm.features} onChange={(e) => setPlanForm({ ...planForm, features: e.target.value })} className={`w-full ${isDark ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-200'} border rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-emerald-500`} />
              </div>

              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={planForm.isActive} onChange={(e) => setPlanForm({ ...planForm, isActive: e.target.checked })} className="rounded" />
                <span className={`text-sm font-medium ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Plan is Active (visible for assignment)</span>
              </label>

              <div className="pt-4 flex justify-end gap-3">
                <button type="button" onClick={() => setIsPlanModalOpen(false)} className={`px-4 py-2 rounded-xl text-xs font-medium cursor-pointer ${isDark ? 'bg-slate-800 hover:bg-slate-700 text-slate-300' : 'bg-slate-100 hover:bg-slate-200 text-slate-600'}`}>Cancel</button>
                <button type="submit" disabled={loading} className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold text-xs cursor-pointer disabled:opacity-50">
                  {loading ? 'Saving...' : editingPlan ? 'Update Plan' : 'Create Plan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Suspend Confirmation Modal */}
      {suspendModal.isOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className={`w-full max-w-md rounded-2xl p-6 shadow-2xl border transition-all ${isDark ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-150 text-slate-900'
            }`}>
            <h3 className={`text-lg font-bold font-display tracking-tight mb-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>
              Suspend Restaurant
            </h3>
            <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-600'} mb-6 leading-relaxed`}>
              This restaurant will immediately lose access to EasyDine until it is reactivated.
            </p>
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setSuspendModal({ isOpen: false, id: '', currentStatus: '' })}
                className={`px-4 py-2 rounded-xl text-xs font-medium cursor-pointer transition-all ${isDark ? 'bg-slate-800 hover:bg-slate-700 text-slate-300' : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                  }`}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleSuspend(suspendModal.id, suspendModal.currentStatus)}
                className="px-4 py-2 rounded-xl bg-rose-500 hover:bg-rose-600 text-white font-bold text-xs cursor-pointer transition-all shadow-lg shadow-rose-500/20"
              >
                Suspend
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reset Password Modal */}
      {isResetPasswordOpen && selectedRestForReset && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className={`w-full max-w-md rounded-2xl p-6 shadow-2xl border transition-all ${isDark ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-150 text-slate-900'
            }`}>
            {!resetSuccess ? (
              <>
                <h3 className={`text-lg font-bold font-display tracking-tight mb-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  Reset Restaurant Password
                </h3>
                <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'} mb-4 leading-relaxed`}>
                  This will replace the restaurant's current password with a temporary password. The restaurant owner should log in using this temporary password and immediately create a new password from Account Settings.
                </p>

                <form onSubmit={handleResetPasswordSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400">Password Option</label>
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => setResetOption('auto')}
                        className={`p-3 rounded-xl border text-xs font-bold text-center cursor-pointer transition-all ${resetOption === 'auto'
                            ? 'bg-amber-500/10 border-amber-500 text-amber-500'
                            : isDark ? 'bg-slate-950 border-slate-800 text-slate-400 hover:bg-slate-800' : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                          }`}
                      >
                        Auto-Generate
                      </button>
                      <button
                        type="button"
                        onClick={() => setResetOption('manual')}
                        className={`p-3 rounded-xl border text-xs font-bold text-center cursor-pointer transition-all ${resetOption === 'manual'
                            ? 'bg-amber-500/10 border-amber-500 text-amber-500'
                            : isDark ? 'bg-slate-950 border-slate-800 text-slate-400 hover:bg-slate-800' : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                          }`}
                      >
                        Manual Entry
                      </button>
                    </div>
                  </div>

                  {resetOption === 'manual' && (
                    <div className="animate-fade-in">
                      <label className="block text-xs font-semibold uppercase tracking-wider mb-1 text-slate-400">Temporary Password</label>
                      <input
                        type="text"
                        required
                        value={manualPasswordInput}
                        onChange={(e) => setManualPasswordInput(e.target.value)}
                        placeholder="Minimum 6 characters"
                        className={`w-full px-3.5 py-2 text-sm rounded-xl border focus:outline-none focus:border-amber-500 transition-all ${isDark ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'
                          }`}
                      />
                    </div>
                  )}

                  {resetError && (
                    <p className="text-xs text-rose-500 flex items-center gap-1 mt-1">
                      <FiAlertTriangle /> {resetError}
                    </p>
                  )}

                  <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                    <button
                      type="button"
                      disabled={isResetting}
                      onClick={() => {
                        setIsResetPasswordOpen(false);
                        setSelectedRestForReset(null);
                        setResetError('');
                      }}
                      className={`px-4 py-2 rounded-xl text-xs font-medium cursor-pointer transition-all ${isDark ? 'bg-slate-800 hover:bg-slate-700 text-slate-300' : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                        }`}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isResetting}
                      className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs cursor-pointer transition-all shadow-lg"
                    >
                      {isResetting ? 'Resetting...' : 'Reset Password'}
                    </button>
                  </div>
                </form>
              </>
            ) : (
              <div className="text-center py-4">
                <div className="w-12 h-12 bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 rounded-full flex items-center justify-center mx-auto mb-4">
                  <FiCheckCircle className="text-2xl" />
                </div>
                <h3 className={`text-lg font-bold font-display tracking-tight mb-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  Password Reset Successfully
                </h3>
                <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'} mb-6`}>
                  Share this temporary password with the restaurant admin so they can secure their account.
                </p>

                <div className={`p-4 rounded-xl border mb-6 text-center transition-all ${isDark ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-200'
                  }`}>
                  <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider mb-1">Temporary Password</p>
                  <p className="text-lg font-black font-mono tracking-wide text-amber-500 select-all">
                    {generatedPassword}
                  </p>
                </div>

                <div className="flex gap-3 justify-center">
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(generatedPassword);
                      setCopySuccess(true);
                      setTimeout(() => setCopySuccess(false), 2000);
                    }}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${copySuccess
                        ? 'bg-emerald-500 text-white'
                        : isDark ? 'bg-slate-800 hover:bg-slate-700 text-slate-300' : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                      }`}
                  >
                    {copySuccess ? 'Copied!' : 'Copy Password'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsResetPasswordOpen(false);
                      setSelectedRestForReset(null);
                      setResetSuccess(false);
                      setGeneratedPassword('');
                    }}
                    className="px-6 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs cursor-pointer transition-all shadow-lg"
                  >
                    Done
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
