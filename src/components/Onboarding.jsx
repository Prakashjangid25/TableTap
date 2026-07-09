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
  FiHelpCircle
} from 'react-icons/fi';
import { getRestaurants, getTables } from '../dbService';

export default function Onboarding() {
  const navigate = useNavigate();
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
    <div className="min-h-screen bg-slate-900 text-white font-sans flex flex-col items-center justify-center p-6 md:p-12 relative overflow-hidden">
      {/* Background blobs for premium gradient visual effect */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-emerald-500/10 blur-[120px]" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-amber-500/10 blur-[120px]" />

      <div className="w-full max-w-4xl z-10">
        {/* Brand Header */}
        <div className="text-center mb-10 md:mb-14">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-display text-sm font-semibold mb-4 animate-fade-in">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            TableTap v1.0 Live Sandbox
          </div>
          <h1 className="text-4xl md:text-6xl font-extrabold font-display tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-white via-slate-200 to-slate-400 mb-4 leading-tight">
            TableTap
          </h1>
          <p className="text-base md:text-xl text-slate-400 max-w-2xl mx-auto font-light leading-relaxed">
            The next-generation, high-performance contactless QR ordering & SaaS management suite for modern culinary experiences.
          </p>
        </div>

        {/* Roles Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
          
          {/* Super Admin */}
          <div 
            onClick={() => navigate('/super-admin')}
            className="group cursor-pointer p-6 rounded-2xl bg-slate-800/50 border border-slate-700/50 hover:border-emerald-500/40 hover:bg-slate-800/80 transition-all duration-300 shadow-xl flex flex-col justify-between"
          >
            <div>
              <div className="w-12 h-12 rounded-xl bg-slate-700/50 border border-slate-600/30 flex items-center justify-center text-emerald-400 group-hover:scale-110 transition-transform duration-300 mb-5">
                <FiTrendingUp className="text-2xl" />
              </div>
              <h3 className="text-xl font-bold font-display mb-2 group-hover:text-emerald-400 transition-colors">
                1. Super Admin Control Center
              </h3>
              <p className="text-slate-400 text-sm font-light leading-relaxed mb-6">
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
            className="group cursor-pointer p-6 rounded-2xl bg-slate-800/50 border border-slate-700/50 hover:border-amber-500/40 hover:bg-slate-800/80 transition-all duration-300 shadow-xl flex flex-col justify-between"
          >
            <div>
              <div className="w-12 h-12 rounded-xl bg-slate-700/50 border border-slate-600/30 flex items-center justify-center text-amber-400 group-hover:scale-110 transition-transform duration-300 mb-5">
                <FiLayout className="text-2xl" />
              </div>
              <h3 className="text-xl font-bold font-display mb-2 group-hover:text-amber-400 transition-colors">
                2. Restaurant Admin Dashboard
              </h3>
              <p className="text-slate-400 text-sm font-light leading-relaxed mb-6">
                Manage specific restaurant. Create and edit categories, items, tables, generate and download QR codes, configure taxes, logos, coupons, and orders.
              </p>
            </div>
            <div className="flex items-center text-amber-400 text-sm font-medium gap-1">
              Access Admin Console <FiChevronRight />
            </div>
          </div>

          {/* Kitchen Screen */}
          <div 
            onClick={() => navigate(`/kitchen?r=${selectedRest}`)}
            className="group cursor-pointer p-6 rounded-2xl bg-slate-800/50 border border-slate-700/50 hover:border-sky-500/40 hover:bg-slate-800/80 transition-all duration-300 shadow-xl flex flex-col justify-between"
          >
            <div>
              <div className="w-12 h-12 rounded-xl bg-slate-700/50 border border-slate-600/30 flex items-center justify-center text-sky-400 group-hover:scale-110 transition-transform duration-300 mb-5">
                <FiClock className="text-2xl" />
              </div>
              <h3 className="text-xl font-bold font-display mb-2 group-hover:text-sky-400 transition-colors">
                3. Kitchen display Screen (KDS)
              </h3>
              <p className="text-slate-400 text-sm font-light leading-relaxed mb-6">
                Live dashboard for kitchen crew. Real-time updates of preparing/ready/served foods, preparation timers, acoustic alert toggle, and chef order notes.
              </p>
            </div>
            <div className="flex items-center text-sky-400 text-sm font-medium gap-1">
              Open Kitchen Panel <FiChevronRight />
            </div>
          </div>

          {/* Customer Ordering */}
          <div className="p-6 rounded-2xl bg-slate-800/80 border border-slate-700 flex flex-col justify-between shadow-2xl relative">
            <span className="absolute top-3 right-3 bg-rose-500/10 text-rose-400 text-[10px] px-2 py-0.5 rounded-full font-bold border border-rose-500/20 uppercase tracking-widest">
              Live Customer QR Scan
            </span>
            <div>
              <div className="w-12 h-12 rounded-xl bg-slate-700/50 border border-slate-600/30 flex items-center justify-center text-rose-400 mb-5">
                <FiShoppingBag className="text-2xl" />
              </div>
              <h3 className="text-xl font-bold font-display mb-3">
                4. Customer Digital Menu
              </h3>
              <p className="text-slate-400 text-sm font-light leading-relaxed mb-5">
                Scan simulation. Choose a seeded premium restaurant and table to immediately enter the beautiful mobile-first digital menu and place mock orders.
              </p>

              {/* Simulation Selectors */}
              <div className="space-y-3 mb-6 bg-slate-900/40 p-3 rounded-lg border border-slate-700/40 text-slate-300 text-xs">
                <div className="flex justify-between items-center">
                  <span>Select Store:</span>
                  <select 
                    value={selectedRest} 
                    onChange={handleRestChange}
                    disabled={restaurants.length === 0}
                    className="bg-slate-800 border border-slate-700 rounded px-2 py-1 text-xs focus:outline-none focus:border-emerald-500 text-white disabled:opacity-50"
                  >
                    {restaurants.length === 0 ? (
                      <option value="">No active stores found</option>
                    ) : (
                      restaurants.map(r => (
                        <option key={r.id} value={r.id}>{r.name}</option>
                      ))
                    )}
                  </select>
                </div>
                <div className="flex justify-between items-center">
                  <span>Select Table:</span>
                  <select 
                    value={selectedTable} 
                    onChange={(e) => setSelectedTable(e.target.value)}
                    disabled={tables.length === 0}
                    className="bg-slate-800 border border-slate-700 rounded px-2 py-1 text-xs focus:outline-none focus:border-emerald-500 text-white disabled:opacity-50"
                  >
                    {tables.length === 0 ? (
                      <option value="">No tables configured</option>
                    ) : (
                      tables.map(t => (
                        <option key={t.id} value={t.id}>{t.tableName}</option>
                      ))
                    )}
                  </select>
                </div>
              </div>
            </div>

            <button 
              onClick={handleLaunchCustomer}
              disabled={!selectedRest || !selectedTable}
              className="w-full py-2.5 rounded-xl bg-rose-500 hover:bg-rose-600 active:bg-rose-700 text-white font-semibold text-sm transition-all shadow-lg hover:shadow-rose-500/20 flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-rose-500"
            >
              <FiCompass className="text-lg animate-spin" style={{ animationDuration: '6s' }} />
              {restaurants.length === 0 ? 'Configure a Store First' : 'Simulate QR Code Scan'}
            </button>
          </div>

        </div>

        {/* Footer info */}
        <div className="flex justify-between items-center border-t border-slate-800 pt-6 text-xs text-slate-500">
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
