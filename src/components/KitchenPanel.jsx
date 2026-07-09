import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { 
  FiClock, 
  FiCheckCircle, 
  FiVolume2, 
  FiVolumeX, 
  FiPlay, 
  FiChevronLeft,
  FiShoppingBag,
  FiBell,
  FiCheck,
  FiCoffee
} from 'react-icons/fi';
import { getOrders, updateOrderStatus, getRestaurants } from '../dbService';

export default function KitchenPanel() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const restIdFromUrl = searchParams.get('r') || 'gourmet_garden';

  const [selectedRestId, setSelectedRestId] = useState(restIdFromUrl);
  const [restaurants, setRestaurants] = useState([]);
  const [currentRest, setCurrentRest] = useState(null);
  
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [lastOrderCount, setLastOrderCount] = useState(0);
  const [notification, setNotification] = useState('');

  // Active elapsed-time timers state (re-renders every second)
  const [secondsElapsed, setSecondsElapsed] = useState(0);

  useEffect(() => {
    async function loadMeta() {
      const list = await getRestaurants();
      setRestaurants(list);
      const matched = list.find(r => r.id === selectedRestId);
      setCurrentRest(matched);
    }
    loadMeta();
  }, [selectedRestId]);

  useEffect(() => {
    let interval;
    async function fetchOrders() {
      if (!selectedRestId) return;
      const data = await getOrders(selectedRestId);
      setOrders(data);

      // Simple notification trigger if new orders are placed
      const activeCount = data.filter(o => o.status === 'pending' || o.status === 'accepted').length;
      if (activeCount > lastOrderCount && lastOrderCount > 0) {
        if (soundEnabled) {
          triggerChime();
        }
        setNotification('🔔 Alert: New incoming order submitted!');
        setTimeout(() => setNotification(''), 4000);
      }
      setLastOrderCount(activeCount);
    }

    fetchOrders();
    interval = setInterval(fetchOrders, 4000); // Polling Firestore/LocalStorage

    return () => clearInterval(interval);
  }, [selectedRestId, lastOrderCount, soundEnabled]);

  // Global ticking timer for active orders' age
  useEffect(() => {
    const timer = setInterval(() => {
      setSecondsElapsed(prev => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const triggerChime = () => {
    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();
      osc.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      osc.frequency.setValueAtTime(587.33, audioCtx.currentTime); // D5 note
      gainNode.gain.setValueAtTime(0.3, audioCtx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 1);
      osc.start();
      osc.stop(audioCtx.currentTime + 1);
    } catch (e) {
      console.warn("Audio Context blocked by browser safety standard.", e);
    }
  };

  const handleUpdateStatus = async (orderId, nextStatus) => {
    await updateOrderStatus(selectedRestId, orderId, nextStatus);
    const data = await getOrders(selectedRestId);
    setOrders(data);
  };

  // Filter orders by categories
  const preparingOrders = orders.filter(o => o.status === 'preparing' || o.status === 'accepted');
  const readyOrders = orders.filter(o => o.status === 'ready' || o.status === 'served');
  const completedOrders = orders.filter(o => o.status === 'completed').slice(0, 8); // top 8 completed
  const pendingOrders = orders.filter(o => o.status === 'pending');

  const getOrderAge = (createdAt) => {
    const orderTime = new Date(createdAt).getTime();
    const now = Date.now();
    const diffSecs = Math.max(0, Math.floor((now - orderTime) / 1000));
    const mins = Math.floor(diffSecs / 60);
    const secs = diffSecs % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs} min`;
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans flex flex-col">
      
      {/* Top Navigation */}
      <header className="bg-slate-900 border-b border-slate-800 px-6 py-4 flex flex-col sm:flex-row justify-between items-center gap-4 shrink-0">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => navigate('/')} 
            className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors cursor-pointer"
            title="Return to Launchpad"
          >
            <FiChevronLeft className="text-xl" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold font-display tracking-tight text-white">Kitchen Display System (KDS)</h1>
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
            </div>
            <div className="flex items-center gap-3 mt-1.5 text-xs text-slate-400">
              <span>Selected Store:</span>
              <select 
                value={selectedRestId}
                onChange={(e) => setSelectedRestId(e.target.value)}
                className="bg-slate-800 border border-slate-700 rounded px-2.5 py-0.5 text-xs font-semibold text-amber-400 focus:outline-none"
              >
                {restaurants.map(r => (
                  <option key={r.id} value={r.id}>{r.name}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Action controllers */}
        <div className="flex items-center gap-3">
          {notification && (
            <div className="text-xs bg-amber-500/10 border border-amber-500/30 text-amber-400 px-3 py-1.5 rounded-xl font-medium animate-bounce flex items-center gap-1.5">
              <FiBell />
              {notification}
            </div>
          )}

          <button 
            onClick={() => {
              setSoundEnabled(!soundEnabled);
              if (!soundEnabled) triggerChime();
            }}
            className={`p-2 rounded-lg border text-sm font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
              soundEnabled 
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
                : 'bg-slate-800 text-slate-400 border-slate-700'
            }`}
          >
            {soundEnabled ? <FiVolume2 className="text-base" /> : <FiVolumeX className="text-base" />}
            <span>{soundEnabled ? 'Chime Active' : 'Chime Off'}</span>
          </button>
        </div>
      </header>

      {/* Main Kanban Content Area */}
      <main className="flex-1 p-6 overflow-x-auto select-none">
        
        {/* Incoming queue banner if pending exist */}
        {pendingOrders.length > 0 && (
          <div className="bg-amber-500 text-slate-950 px-6 py-3 rounded-2xl mb-8 flex justify-between items-center shadow-lg">
            <div className="flex items-center gap-3">
              <span className="p-1.5 bg-slate-950 text-amber-400 rounded-full text-sm animate-pulse"><FiBell /></span>
              <p className="text-sm font-extrabold tracking-tight">
                Pending Approval Queue: {pendingOrders.length} customer {pendingOrders.length === 1 ? 'order' : 'orders'} waiting for staff to cook!
              </p>
            </div>
            <div className="flex gap-2">
              {pendingOrders.map(order => (
                <button 
                  key={order.id}
                  onClick={() => handleUpdateStatus(order.id, 'preparing')}
                  className="px-3 py-1 bg-slate-950 hover:bg-slate-900 text-white rounded-lg text-xs font-bold transition-all cursor-pointer"
                >
                  Cook {order.tableName || 'Table'}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 min-h-[500px]">
          
          {/* COLUMN 1: PREPARING (UNDER COOKING) */}
          <div className="rounded-2xl bg-slate-900/40 border border-slate-800 p-4 flex flex-col h-full">
            <div className="flex justify-between items-center pb-3 border-b border-slate-800 mb-4">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-indigo-500" />
                <h3 className="font-bold text-white text-base">Preparing / Cooking</h3>
              </div>
              <span className="bg-indigo-500/10 text-indigo-400 font-mono text-xs font-bold px-2 py-0.5 rounded-full">
                {preparingOrders.length}
              </span>
            </div>

            <div className="space-y-4 flex-1 overflow-y-auto max-h-[600px] pr-1">
              {preparingOrders.map(order => (
                <div key={order.id} className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-4 shadow hover:border-indigo-500/50 transition-colors animate-fade-in">
                  
                  {/* Card Header details */}
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="text-lg font-bold font-display text-white">{order.tableName || 'Table'}</h4>
                      <p className="text-[10px] text-slate-500 font-mono">Order: #{order.id}</p>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] text-indigo-400 font-mono flex items-center gap-1 bg-indigo-500/10 px-2 py-0.5 rounded-full font-bold uppercase">
                        <FiClock className="animate-spin" style={{ animationDuration: '8s' }} />
                        {getOrderAge(order.createdAt)}
                      </span>
                    </div>
                  </div>

                  {/* Cooking Items list */}
                  <div className="space-y-1.5 border-t border-b border-slate-800/60 py-2 text-sm text-slate-200">
                    {order.items.map((it, idx) => (
                      <div key={idx} className="flex justify-between font-medium">
                        <span>{it.name}</span>
                        <span className="font-bold text-indigo-400 font-mono bg-indigo-500/10 px-1.5 rounded">x{it.quantity}</span>
                      </div>
                    ))}
                  </div>

                  {/* Customer Notes */}
                  {order.notes && (
                    <div className="p-2.5 rounded bg-rose-500/5 border border-rose-500/10 text-rose-400 text-xs font-light">
                      <span className="font-bold block text-[10px] uppercase tracking-wider mb-0.5">Chef Instruction:</span>
                      "{order.notes}"
                    </div>
                  )}

                  {/* Actions */}
                  <button 
                    onClick={() => handleUpdateStatus(order.id, 'ready')}
                    className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white font-bold text-xs rounded-lg transition-all flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <FiCheck /> Mark Food Ready
                  </button>

                </div>
              ))}
              {preparingOrders.length === 0 && (
                <div className="text-center py-12 text-slate-500 text-xs font-light flex flex-col items-center gap-2">
                  <FiCoffee className="text-2xl text-slate-600" />
                  <span>No dishes are currently cooking in the kitchen.</span>
                </div>
              )}
            </div>
          </div>

          {/* COLUMN 2: READY FOR SERVER DISPATCH */}
          <div className="rounded-2xl bg-slate-900/40 border border-slate-800 p-4 flex flex-col h-full">
            <div className="flex justify-between items-center pb-3 border-b border-slate-800 mb-4">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-pink-500" />
                <h3 className="font-bold text-white text-base">Ready (Awaiting Server)</h3>
              </div>
              <span className="bg-pink-500/10 text-pink-400 font-mono text-xs font-bold px-2 py-0.5 rounded-full">
                {readyOrders.length}
              </span>
            </div>

            <div className="space-y-4 flex-1 overflow-y-auto max-h-[600px] pr-1">
              {readyOrders.map(order => (
                <div key={order.id} className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-4 shadow hover:border-pink-500/50 transition-colors animate-fade-in">
                  
                  {/* Card Header */}
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="text-lg font-bold font-display text-white">{order.tableName || 'Table'}</h4>
                      <p className="text-[10px] text-slate-500 font-mono">Order: #{order.id}</p>
                    </div>
                    <span className="text-[10px] bg-pink-500/10 text-pink-400 border border-pink-500/20 px-2 py-0.5 rounded font-bold uppercase">
                      Ready to Serve
                    </span>
                  </div>

                  {/* Ordered Items list */}
                  <div className="space-y-1.5 border-t border-b border-slate-800/60 py-2 text-sm text-slate-200">
                    {order.items.map((it, idx) => (
                      <div key={idx} className="flex justify-between font-medium">
                        <span>{it.name}</span>
                        <span className="font-bold text-pink-400 font-mono bg-pink-500/10 px-1.5 rounded">x{it.quantity}</span>
                      </div>
                    ))}
                  </div>

                  <button 
                    onClick={() => handleUpdateStatus(order.id, 'completed')}
                    className="w-full py-2 bg-pink-600 hover:bg-pink-500 active:bg-pink-700 text-white font-bold text-xs rounded-lg transition-all flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <FiCheckCircle /> Serve & Close Ticket
                  </button>

                </div>
              ))}
              {readyOrders.length === 0 && (
                <div className="text-center py-12 text-slate-500 text-xs font-light flex flex-col items-center gap-2">
                  <FiCheck className="text-2xl text-slate-600" />
                  <span>No completed dishes are waiting for pickup.</span>
                </div>
              )}
            </div>
          </div>

          {/* COLUMN 3: COMPLETED INVOICES */}
          <div className="rounded-2xl bg-slate-900/40 border border-slate-800 p-4 flex flex-col h-full">
            <div className="flex justify-between items-center pb-3 border-b border-slate-800 mb-4">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-emerald-500" />
                <h3 className="font-bold text-white text-base">Completed Tickets</h3>
              </div>
              <span className="bg-emerald-500/10 text-emerald-400 font-mono text-xs font-bold px-2 py-0.5 rounded-full">
                {completedOrders.length}
              </span>
            </div>

            <div className="space-y-4 flex-1 overflow-y-auto max-h-[600px] pr-1">
              {completedOrders.map(order => (
                <div key={order.id} className="p-4 rounded-xl bg-slate-900/50 border border-slate-800/80 text-slate-400 space-y-3 animate-fade-in">
                  
                  <div className="flex justify-between items-center">
                    <div>
                      <h4 className="font-bold font-display text-slate-300">{order.tableName || 'Table'}</h4>
                      <p className="text-[9px] text-slate-600 font-mono">Invoice: #{order.id}</p>
                    </div>
                    <span className="text-[10px] text-emerald-400 bg-emerald-500/5 border border-emerald-500/10 px-2 py-0.5 rounded uppercase font-bold">
                      Completed
                    </span>
                  </div>

                  <div className="space-y-1 text-xs text-slate-500 border-t border-slate-800/40 pt-2">
                    {order.items.map((it, idx) => (
                      <div key={idx} className="flex justify-between">
                        <span>{it.name}</span>
                        <span>x{it.quantity}</span>
                      </div>
                    ))}
                  </div>

                </div>
              ))}
              {completedOrders.length === 0 && (
                <div className="text-center py-12 text-slate-500 text-xs font-light">
                  No tickets have been closed in this session.
                </div>
              )}
            </div>
          </div>

        </div>

      </main>

    </div>
  );
}
