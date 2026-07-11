import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FiLayout,
  FiCompass,
  FiTrendingUp,
  FiClock,
  FiUserCheck,
  FiShoppingBag,
  FiChevronRight,
  FiHelpCircle,
  FiSun,
  FiMoon
} from 'react-icons/fi';
import { getRestaurants, getTables } from '../dbService';
import { useTheme } from '../contexts/ThemeContext.jsx';

export default function Onboarding() {
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';
  const [restaurants, setRestaurants] = useState([]);
  const [tables, setTables] = useState([]);
  const [selectedRest, setSelectedRest] = useState('');
  const [selectedTable, setSelectedTable] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        const restList = await getRestaurants();
        setRestaurants(restList);
        if (restList && restList.length > 0) {
          const firstRestId = restList[0].id;
          setSelectedRest(firstRestId);
          const tableList = await getTables(firstRestId);
          setTables(tableList);
          if (tableList && tableList.length > 0) {
            setSelectedTable(tableList[0].id);
          }
        }
      } catch (err) {
        console.error('Error loading onboarding data:', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const handleRestChange = async (e) => {
    const id = e.target.value;
    setSelectedRest(id);
    setSelectedTable('');
    setTables([]);
    try {
      const tableList = await getTables(id);
      setTables(tableList);
      if (tableList && tableList.length > 0) {
        setSelectedTable(tableList[0].id);
      }
    } catch (err) {
      console.error('Error loading tables for restaurant:', id, err);
    }
  };

  const handleLaunchCustomer = () => {
    if (selectedRest && selectedTable) {
      navigate(`/customer?r=${selectedRest}&t=${selectedTable}`);
    }
  };

  return (
    <div className={`min-h-screen ${isDark ? 'bg-slate-900 text-white' : 'bg-slate-50 text-slate-900'} font-sans flex flex-col items-center justify-center p-6 md:p-12 relative overflow-hidden transition-colors duration-150`}>
      {/* Theme Toggle in top-right */}
      <div className="absolute top-6 right-6 z-20">
        <button
          onClick={toggleTheme}
          className="theme-toggle flex items-center justify-center cursor-pointer shadow-md"
          title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
        >
          {theme === 'dark' ? <FiSun className="text-sm" /> : <FiMoon className="text-sm" />}
        </button>
      </div>

      {/* Background blobs for premium gradient visual effect */}
      <div className={`absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full ${isDark ? 'bg-emerald-500/10' : 'bg-emerald-500/5'} blur-[120px] pointer-events-none`} />
      <div className={`absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full ${isDark ? 'bg-amber-500/10' : 'bg-amber-500/5'} blur-[120px] pointer-events-none`} />

      <div className="w-full max-w-4xl z-10">
        {/* Brand Header */}
        <div className="text-center mb-10 md:mb-14">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-display text-sm font-semibold mb-4 animate-fade-in">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            TableTap v1.0 Live Sandbox
          </div>
          <h1 className={`text-4xl md:text-6xl font-extrabold font-display tracking-tight text-transparent bg-clip-text bg-gradient-to-r ${isDark ? 'from-white via-slate-200 to-slate-400' : 'from-slate-900 via-slate-800 to-slate-700'} mb-4 leading-tight`}>
            TableTap
          </h1>
          <p className={`text-base md:text-xl ${isDark ? 'text-slate-400' : 'text-slate-600'} max-w-2xl mx-auto font-light leading-relaxed`}>
            The next-generation, high-performance contactless QR ordering & SaaS management suite for modern culinary experiences.
          </p>
        </div>

        {/* Roles Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">

          {/* Super Admin */}
          <div
            onClick={() => navigate('/super-admin')}
            className={`group cursor-pointer p-6 rounded-2xl ${isDark ? 'bg-slate-800/50 border-slate-700/50 hover:bg-slate-800/80' : 'bg-white border-slate-200 hover:bg-slate-50'} hover:border-emerald-500/40 border transition-all duration-300 shadow-xl flex flex-col justify-between`}
          >
            <div>
              <div className={`w-12 h-12 rounded-xl ${isDark ? 'bg-slate-700/50 border-slate-600/30' : 'bg-slate-100 border-slate-200'} flex items-center justify-center text-emerald-400 group-hover:scale-110 border transition-transform duration-300 mb-5`}>
                <FiTrendingUp className="text-2xl" />
              </div>
              <h3 className={`text-xl font-bold font-display mb-2 ${isDark ? 'text-white' : 'text-slate-900'} group-hover:text-emerald-400 transition-colors`}>
                1. Super Admin Control Center
              </h3>
              <p className={`${isDark ? 'text-slate-400' : 'text-slate-600'} text-sm font-light leading-relaxed mb-6`}>
                Platform owner suite. Track global revenue, subscribe or suspend restaurant stores, check SaaS analytics, and manage subscription renewals.
              </p>
            </div>
            <div className="flex items-center text-emerald-400 text-sm font-medium gap-1">
              Access Control Center <FiChevronRight />
            </div>
          </div>

          {/* Restaurant Admin */}
          <div
            onClick={() => navigate('/admin')}
            className={`group cursor-pointer p-6 rounded-2xl ${isDark ? 'bg-slate-800/50 border-slate-700/50 hover:bg-slate-800/80' : 'bg-white border-slate-200 hover:bg-slate-50'} hover:border-amber-500/40 border transition-all duration-300 shadow-xl flex flex-col justify-between`}
          >
            <div>
              <div className={`w-12 h-12 rounded-xl ${isDark ? 'bg-slate-700/50 border-slate-600/30' : 'bg-slate-100 border-slate-200'} flex items-center justify-center text-amber-400 group-hover:scale-110 border transition-transform duration-300 mb-5`}>
                <FiLayout className="text-2xl" />
              </div>
              <h3 className={`text-xl font-bold font-display mb-2 ${isDark ? 'text-white' : 'text-slate-900'} group-hover:text-amber-400 transition-colors`}>
                2. Restaurant Admin Dashboard
              </h3>
              <p className={`${isDark ? 'text-slate-400' : 'text-slate-600'} text-sm font-light leading-relaxed mb-6`}>
                Manage specific restaurant. Create and edit categories, items, tables, generate and download QR codes, configure taxes, logos, coupons, and orders.
              </p>
            </div>
            <div className="flex items-center text-amber-400 text-sm font-medium gap-1">
              Access Admin Console <FiChevronRight />
            </div>
          </div>

          {/* Kitchen Screen */}
          <div
            onClick={() => navigate('/kitchen')}
            className={`group cursor-pointer p-6 rounded-2xl ${isDark ? 'bg-slate-800/50 border-slate-700/50 hover:bg-slate-800/80' : 'bg-white border-slate-200 hover:bg-slate-50'} hover:border-sky-500/40 border transition-all duration-300 shadow-xl flex flex-col justify-between`}
          >
            <div>
              <div className={`w-12 h-12 rounded-xl ${isDark ? 'bg-slate-700/50 border-slate-600/30' : 'bg-slate-100 border-slate-200'} flex items-center justify-center text-sky-400 group-hover:scale-110 border transition-transform duration-300 mb-5`}>
                <FiClock className="text-2xl" />
              </div>
              <h3 className={`text-xl font-bold font-display mb-2 ${isDark ? 'text-white' : 'text-slate-900'} group-hover:text-sky-400 transition-colors`}>
                3. Kitchen display Screen (KDS)
              </h3>
              <p className={`${isDark ? 'text-slate-400' : 'text-slate-600'} text-sm font-light leading-relaxed mb-6`}>
                Live dashboard for kitchen crew. Real-time updates of preparing/ready/served foods, preparation timers, acoustic alert toggle, and chef order notes.
              </p>
            </div>
            <div className="flex items-center text-sky-400 text-sm font-medium gap-1">
              Open Kitchen Panel <FiChevronRight />
            </div>
          </div>

          {/* Help & Support Center */}
          <div
            onClick={() => navigate('/support')}
            className={`group cursor-pointer p-6 rounded-2xl ${isDark ? 'bg-slate-800/50 border-slate-700/50 hover:bg-slate-800/80' : 'bg-white border-slate-200 hover:bg-slate-50'} hover:border-rose-500/40 border transition-all duration-300 shadow-xl flex flex-col justify-between`}
          >
            <div>
              <div className={`w-12 h-12 rounded-xl ${isDark ? 'bg-slate-700/50 border-slate-600/30' : 'bg-slate-100 border-slate-200'} flex items-center justify-center text-rose-400 group-hover:scale-110 border transition-transform duration-300 mb-5`}>
                <FiHelpCircle className="text-2xl" />
              </div>
              <h3 className={`text-xl font-bold font-display mb-2 ${isDark ? 'text-white' : 'text-slate-900'} group-hover:text-rose-400 transition-colors`}>
                4. Help & Support Center
              </h3>
              <p className={`${isDark ? 'text-slate-400' : 'text-slate-600'} text-sm font-light leading-relaxed mb-6`}>
                Got questions or need technical help? Access our direct support channels, view helpful setup tips, and find answers to frequently asked questions.
              </p>
            </div>
            <div className="flex items-center text-rose-400 text-sm font-medium gap-1">
              Open Support Center <FiChevronRight />
            </div>
          </div>

        </div>

        {/* Footer info */}
        <div className={`flex justify-between items-center border-t ${isDark ? 'border-slate-800' : 'border-slate-200'} pt-6 text-xs text-slate-500`}>
          <p>© 2026 TableTap SaaS Corporation. All rights reserved.</p>
          <div className="flex items-center gap-1">
            <FiUserCheck className="text-emerald-400 text-sm" />
            <span>Ready for Production Deployment</span>
          </div>
        </div>
      </div>
    </div>
  );
}
