import React, { useState, useEffect, useRef } from 'react';
import {
  FiPlus,
  FiTrash2,
  FiEdit2,
  FiUsers,
  FiMap,
  FiLayers,
  FiDollarSign,
  FiMove,
  FiCheck,
  FiX,
  FiAlertTriangle,
  FiGrid
} from 'react-icons/fi';
import { ReusableBillPreviewModal } from './BillingSystem';
import { db } from '../firebase';
import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  updateDoc,
  onSnapshot,
  query,
  orderBy,
  writeBatch
} from 'firebase/firestore';
import { useTheme } from '../contexts/ThemeContext';

// Error Handler conformant to firebase-integration guidelines
const OperationType = {
  CREATE: 'create',
  UPDATE: 'update',
  DELETE: 'delete',
  LIST: 'list',
  GET: 'get',
  WRITE: 'write',
};

function handleFirestoreError(error, operationType, path) {
  const errInfo = {
    error: error instanceof Error ? error.message : String(error),
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Render modern blueprint top-view chairs absolute-positioned around the tables
const renderChairs = (capacity, isOccupied) => {
  const chairBaseCls = `absolute w-3.5 h-3.5 rounded-md border transition-all duration-300 pointer-events-none ${isOccupied
      ? 'bg-rose-500/20 border-rose-500/60 shadow-[0_0_6px_rgba(244,63,94,0.3)] animate-pulse'
      : 'bg-emerald-500/10 border-emerald-500/40 shadow-[0_0_4px_rgba(16,185,129,0.15)]'
    }`;

  let chairs = [];
  if (capacity === 2) {
    chairs = [
      { style: { left: '-8px', top: 'calc(50% - 7px)' } },
      { style: { right: '-8px', top: 'calc(50% - 7px)' } }
    ];
  } else if (capacity === 4) {
    chairs = [
      { style: { left: '-8px', top: 'calc(50% - 7px)' } },
      { style: { right: '-8px', top: 'calc(50% - 7px)' } },
      { style: { top: '-8px', left: 'calc(50% - 7px)' } },
      { style: { bottom: '-8px', left: 'calc(50% - 7px)' } }
    ];
  } else if (capacity === 6) {
    chairs = [
      { style: { left: '-8px', top: '25%' } },
      { style: { left: '-8px', top: '75%' } },
      { style: { right: '-8px', top: '25%' } },
      { style: { right: '-8px', top: '75%' } },
      { style: { top: '-8px', left: 'calc(50% - 7px)' } },
      { style: { bottom: '-8px', left: 'calc(50% - 7px)' } }
    ];
  } else {
    chairs = [
      { style: { left: '-8px', top: '25%' } },
      { style: { left: '-8px', top: '75%' } },
      { style: { right: '-8px', top: '25%' } },
      { style: { right: '-8px', top: '75%' } },
      { style: { top: '-8px', left: '25%' } },
      { style: { top: '-8px', left: '75%' } },
      { style: { bottom: '-8px', left: '25%' } },
      { style: { bottom: '-8px', left: '75%' } }
    ];
  }

  return chairs.map((chair, i) => (
    <div key={i} className={chairBaseCls} style={chair.style} />
  ));
};

export default function FloorMapManager({ restaurantId, physicalTables, orders, currentRest }) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const containerRef = useRef(null);

  // States
  const [floors, setFloors] = useState([]);
  const [activeFloorId, setActiveFloorId] = useState('');
  const [floorTables, setFloorTables] = useState([]);

  // Bill Modal states
  const [isBillModalOpen, setIsBillModalOpen] = useState(false);
  const [billInitialItems, setBillInitialItems] = useState([]);
  const [billTableNo, setBillTableNo] = useState('');

  // Table Details Popup & Drag/Click Detection
  const [selectedTableForPopup, setSelectedTableForPopup] = useState(null);
  const hasDraggedRef = useRef(false);

  // Floor CRUD forms
  const [showAddFloor, setShowAddFloor] = useState(false);
  const [newFloorName, setNewFloorName] = useState('');
  const [editingFloorId, setEditingFloorId] = useState(null);
  const [editingFloorName, setEditingFloorName] = useState('');

  // Table Add / Edit Form
  const [showAddTable, setShowAddTable] = useState(false);
  const [selectedPhysicalTableId, setSelectedPhysicalTableId] = useState('');
  const [tableCapacity, setTableCapacity] = useState(4);
  const [editingTableId, setEditingTableId] = useState(null);
  const [editingCapacity, setEditingCapacity] = useState(4);

  // Dragging states
  const [draggingTableId, setDraggingTableId] = useState(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  // Status message
  const [statusMessage, setStatusMessage] = useState('');

  // 1. Fetch Floors in Real-Time
  useEffect(() => {
    if (!restaurantId) return;

    const floorsPath = `restaurants/${restaurantId}/floors`;
    const floorsRef = collection(db, floorsPath);
    const q = query(floorsRef, orderBy('order', 'asc'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      setFloors(list);

      // Auto-select first floor if none is active
      if (list.length > 0 && !activeFloorId) {
        setActiveFloorId(list[0].id);
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, floorsPath);
    });

    return unsubscribe;
  }, [restaurantId, activeFloorId]);

  // 2. Fetch Floor Tables in Real-Time for the Active Floor
  useEffect(() => {
    if (!restaurantId || !activeFloorId) {
      setFloorTables([]);
      return;
    }

    const tablesPath = `restaurants/${restaurantId}/floors/${activeFloorId}/floorTables`;
    const tablesRef = collection(db, tablesPath);

    const unsubscribe = onSnapshot(tablesRef, (snapshot) => {
      const list = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      setFloorTables(list);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, tablesPath);
    });

    return unsubscribe;
  }, [restaurantId, activeFloorId]);

  // Toast indicator helper
  const showStatus = (msg) => {
    setStatusMessage(msg);
    setTimeout(() => setStatusMessage(''), 3000);
  };

  // ── Floor CRUD Operations ────────────────────────────────
  const handleAddFloor = async (e) => {
    e.preventDefault();
    if (!newFloorName.trim()) return;

    const floorId = `floor_${Date.now()}`;
    const floorPath = `restaurants/${restaurantId}/floors/${floorId}`;

    try {
      await setDoc(doc(db, 'restaurants', restaurantId, 'floors', floorId), {
        id: floorId,
        restaurantId,
        name: newFloorName.trim(),
        order: floors.length + 1,
        createdAt: new Date().toISOString()
      });
      setNewFloorName('');
      setShowAddFloor(false);
      setActiveFloorId(floorId);
      showStatus(`Floor "${newFloorName}" created!`);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, floorPath);
    }
  };

  const handleRenameFloor = async (e) => {
    e.preventDefault();
    if (!editingFloorName.trim() || !editingFloorId) return;

    const floorPath = `restaurants/${restaurantId}/floors/${editingFloorId}`;
    try {
      await updateDoc(doc(db, 'restaurants', restaurantId, 'floors', editingFloorId), {
        name: editingFloorName.trim()
      });
      setEditingFloorId(null);
      setEditingFloorName('');
      showStatus("Floor renamed successfully!");
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, floorPath);
    }
  };

  const handleDeleteFloor = async (floorId, floorName) => {
    if (!window.confirm(`Are you absolutely sure you want to delete "${floorName}"? All table layouts on this floor will be permanently cleared.`)) return;

    const floorPath = `restaurants/${restaurantId}/floors/${floorId}`;
    try {
      // Create batch to delete floorTables first, then the floor itself
      const batch = writeBatch(db);

      // Delete all floorTables under this floor
      for (const ft of floorTables) {
        batch.delete(doc(db, 'restaurants', restaurantId, 'floors', floorId, 'floorTables', ft.id));
      }

      // Delete floor document
      batch.delete(doc(db, 'restaurants', restaurantId, 'floors', floorId));

      await batch.commit();

      // Select another floor if available
      const remainingFloors = floors.filter(f => f.id !== floorId);
      if (remainingFloors.length > 0) {
        setActiveFloorId(remainingFloors[0].id);
      } else {
        setActiveFloorId('');
      }

      showStatus(`Floor "${floorName}" and its tables deleted.`);
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, floorPath);
    }
  };

  // ── Floor Table CRUD Operations ──────────────────────────
  const handleAddTableToFloor = async (e) => {
    e.preventDefault();
    if (!selectedPhysicalTableId || !activeFloorId) return;

    const physTable = physicalTables.find(t => t.id === selectedPhysicalTableId);
    if (!physTable) return;

    const floorTablePath = `restaurants/${restaurantId}/floors/${activeFloorId}/floorTables/${physTable.id}`;

    try {
      await setDoc(doc(db, 'restaurants', restaurantId, 'floors', activeFloorId, 'floorTables', physTable.id), {
        id: physTable.id,
        tableName: physTable.tableName,
        capacity: Number(tableCapacity),
        x: 45 + Math.random() * 10, // slightly off-center
        y: 45 + Math.random() * 10,
        floorId: activeFloorId,
        createdAt: new Date().toISOString()
      });
      setSelectedPhysicalTableId('');
      setTableCapacity(4);
      setShowAddTable(false);
      showStatus(`Table "${physTable.tableName}" placed on floor map!`);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, floorTablePath);
    }
  };

  const handleUpdateTableCapacity = async (e) => {
    e.preventDefault();
    if (!editingTableId || !activeFloorId) return;

    const floorTablePath = `restaurants/${restaurantId}/floors/${activeFloorId}/floorTables/${editingTableId}`;
    try {
      await updateDoc(doc(db, 'restaurants', restaurantId, 'floors', activeFloorId, 'floorTables', editingTableId), {
        capacity: Number(editingCapacity)
      });
      setEditingTableId(null);
      showStatus("Table capacity updated!");
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, floorTablePath);
    }
  };

  const handleRemoveTableFromFloor = async (tableId, tableName) => {
    if (!window.confirm(`Remove "${tableName}" from this floor layout? (This does NOT delete the physical Table QR code).`)) return;

    const floorTablePath = `restaurants/${restaurantId}/floors/${activeFloorId}/floorTables/${tableId}`;
    try {
      await deleteDoc(doc(db, 'restaurants', restaurantId, 'floors', activeFloorId, 'floorTables', tableId));
      showStatus(`"${tableName}" removed from layout.`);
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, floorTablePath);
    }
  };

  const handleMarkAvailable = async (tableId) => {
    const activeOrders = orders.filter(o =>
      o.tableId === tableId &&
      ['pending', 'accepted', 'preparing', 'ready', 'served'].includes(o.status)
    );

    if (activeOrders.length === 0) return;

    try {
      const batch = writeBatch(db);
      activeOrders.forEach(o => {
        const orderRef = doc(db, 'restaurants', restaurantId, 'orders', o.id);
        batch.update(orderRef, { status: 'completed' });
      });
      await batch.commit();
      showStatus("Table marked as Available!");
    } catch (err) {
      console.error("Error marking table available: ", err);
      showStatus("Failed to mark table as Available.");
    }
  };

  // ── Drag and Drop Layout Calculation ─────────────────────
  const handlePointerDown = (e, tableId, tableX, tableY) => {
    e.preventDefault();
    if (!containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    // Table coordinates are stored as percentages (0 - 100)
    const tablePxX = (tableX / 100) * rect.width;
    const tablePxY = (tableY / 100) * rect.height;

    setDraggingTableId(tableId);
    setDragOffset({
      x: clickX - tablePxX,
      y: clickY - tablePxY
    });

    hasDraggedRef.current = false; // Reset drag status on click
  };

  const handlePointerMove = (e) => {
    if (!draggingTableId || !containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    const moveX = e.clientX - rect.left;
    const moveY = e.clientY - rect.top;

    // Apply offset and constrain inside container bounds
    let newPxX = moveX - dragOffset.x;
    let newPxY = moveY - dragOffset.y;

    // Convert back to percentages (capped between 4% and 96% to keep card completely inside bounds)
    const newPctX = Math.max(5, Math.min(95, (newPxX / rect.width) * 100));
    const newPctY = Math.max(5, Math.min(95, (newPxY / rect.height) * 100));

    // If change is non-trivial, mark as dragged
    const currentTable = floorTables.find(t => t.id === draggingTableId);
    if (currentTable) {
      const diffX = Math.abs(currentTable.x - newPctX);
      const diffY = Math.abs(currentTable.y - newPctY);
      if (diffX > 0.3 || diffY > 0.3) {
        hasDraggedRef.current = true;
      }
    }

    // Update locally instantly for butter-smooth visual response
    setFloorTables(prev => prev.map(t => {
      if (t.id === draggingTableId) {
        return { ...t, x: newPctX, y: newPctY };
      }
      return t;
    }));
  };

  const handlePointerUp = async () => {
    if (!draggingTableId) return;

    const wasDragging = hasDraggedRef.current;
    const currentTableId = draggingTableId;
    setDraggingTableId(null);

    if (wasDragging) {
      const draggedTable = floorTables.find(t => t.id === currentTableId);
      if (draggedTable) {
        const floorTablePath = `restaurants/${restaurantId}/floors/${activeFloorId}/floorTables/${currentTableId}`;
        try {
          await updateDoc(doc(db, 'restaurants', restaurantId, 'floors', activeFloorId, 'floorTables', currentTableId), {
            x: Number(draggedTable.x.toFixed(2)),
            y: Number(draggedTable.y.toFixed(2))
          });
        } catch (err) {
          handleFirestoreError(err, OperationType.UPDATE, floorTablePath);
        }
      }
    } else {
      // Show details popup
      const clickedTable = floorTables.find(t => t.id === currentTableId);
      if (clickedTable) {
        setSelectedTableForPopup(clickedTable);
      }
    }
  };

  // ── Seating Status and Billing Calculations ───────────────
  const getTableMetrics = (tableId) => {
    // 1. Get active orders for this table
    const activeOrders = orders.filter(o =>
      o.tableId === tableId &&
      ['pending', 'accepted', 'preparing', 'ready', 'served'].includes(o.status)
    );

    // 2. Occupied if any active order exists
    const isOccupied = activeOrders.length > 0;

    // 3. Current Bill total
    const currentBill = activeOrders.reduce((sum, o) => sum + (o.grandTotal || 0), 0);

    return {
      status: isOccupied ? 'Occupied' : 'Available',
      currentBill
    };
  };

  // List of physical tables not yet placed on ANY floor layout
  // Note: We want to fetch all tables placed across ALL floors to prevent placing a physical table twice!
  const [allPlacedTableIds, setAllPlacedTableIds] = useState(new Set());

  useEffect(() => {
    if (!restaurantId || floors.length === 0) {
      setAllPlacedTableIds(new Set());
      return;
    }

    const unsubscribes = floors.map(fl => {
      return onSnapshot(collection(db, 'restaurants', restaurantId, 'floors', fl.id, 'floorTables'), (snap) => {
        const ids = snap.docs.map(doc => doc.id);
        setAllPlacedTableIds(prev => {
          const updated = new Set(prev);
          // Clean up older items from this floor
          floorTables.filter(t => t.floorId === fl.id).forEach(t => updated.delete(t.id));
          // Add new items
          ids.forEach(id => updated.add(id));
          return updated;
        });
      });
    });

    return () => unsubscribes.forEach(unsub => unsub());
  }, [restaurantId, floors]);

  const availablePhysicalTables = physicalTables.filter(pt => !allPlacedTableIds.has(pt.id));

  // Styles
  const cardBg = isDark ? 'bg-slate-900/90 border-slate-800' : 'bg-white border-slate-200/80';
  const controlBtnCls = `p-2 rounded-xl border flex items-center justify-center transition-all cursor-pointer ${isDark
      ? 'border-slate-800 hover:bg-slate-800 text-slate-300'
      : 'border-slate-200 hover:bg-slate-50 text-slate-600'
    }`;

  const formInputCls = `w-full border rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-amber-500 transition-colors ${isDark
      ? 'bg-slate-950 border-slate-800 text-white placeholder:text-slate-600'
      : 'bg-slate-50 border-slate-200 text-slate-800'
    }`;

  return (
    <div className="animate-fade-in space-y-6">

      {/* Header and Add Floor Panel */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className={`text-3xl font-bold font-display tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>Floor Map Manager</h1>
          <p className={`text-sm mt-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
            Visually coordinate seating capacities, track real-time table occupancy, and calculate active orders.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {statusMessage && (
            <span className="text-xs font-semibold text-emerald-500 bg-emerald-500/10 px-3 py-1.5 rounded-lg animate-pulse">
              {statusMessage}
            </span>
          )}

          <button
            onClick={() => setShowAddFloor(!showAddFloor)}
            className="px-4 py-2.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded-xl text-sm transition-all shadow-md flex items-center gap-1.5 cursor-pointer"
          >
            <FiPlus /> Add Floor
          </button>
        </div>
      </div>

      {/* Add Floor Inline Form */}
      {showAddFloor && (
        <form onSubmit={handleAddFloor} className={`p-5 rounded-2xl border max-w-md animate-fade-in space-y-3 ${cardBg}`}>
          <h3 className={`font-bold text-sm ${isDark ? 'text-white' : 'text-slate-900'}`}>Create New Restaurant Floor</h3>
          <div className="flex gap-2">
            <input
              type="text"
              required
              placeholder="e.g. Ground Floor, VIP Terrace"
              value={newFloorName}
              onChange={(e) => setNewFloorName(e.target.value)}
              className={formInputCls}
            />
            <button type="submit" className="px-4 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded-xl text-sm transition-all shadow shrink-0">
              Create
            </button>
          </div>
        </form>
      )}

      {/* Floors Selection Bar / Pills */}
      {floors.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200/10 pb-4">
          <div className="flex flex-wrap items-center gap-2">
            {floors.map(fl => {
              const isSelected = fl.id === activeFloorId;
              return (
                <div key={fl.id} className="relative group flex items-center">
                  {editingFloorId === fl.id ? (
                    <form onSubmit={handleRenameFloor} className="flex items-center gap-1">
                      <input
                        type="text"
                        value={editingFloorName}
                        onChange={(e) => setEditingFloorName(e.target.value)}
                        className="border rounded-lg px-2 py-1 text-xs focus:outline-none focus:border-amber-500 bg-slate-900 text-white w-28"
                        required
                        autoFocus
                      />
                      <button type="submit" className="p-1 bg-emerald-500 text-white rounded hover:bg-emerald-600"><FiCheck className="text-xs" /></button>
                      <button type="button" onClick={() => setEditingFloorId(null)} className="p-1 bg-rose-500 text-white rounded hover:bg-rose-600"><FiX className="text-xs" /></button>
                    </form>
                  ) : (
                    <div className="flex items-center">
                      <button
                        onClick={() => setActiveFloorId(fl.id)}
                        className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${isSelected
                            ? 'bg-amber-500 text-slate-950 shadow'
                            : isDark ? 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800' : 'bg-slate-100 text-slate-600 hover:bg-slate-200 border border-slate-200/50'
                          }`}
                      >
                        <FiLayers className="text-sm shrink-0" />
                        <span>{fl.name}</span>
                      </button>

                      {/* Hover Actions */}
                      <div className="ml-1 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => {
                            setEditingFloorId(fl.id);
                            setEditingFloorName(fl.name);
                          }}
                          title="Rename floor"
                          className={`p-1.5 rounded-lg text-xs hover:bg-amber-500/10 hover:text-amber-500 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}
                        >
                          <FiEdit2 />
                        </button>
                        <button
                          onClick={() => handleDeleteFloor(fl.id, fl.name)}
                          title="Delete floor"
                          className="p-1.5 rounded-lg text-xs text-rose-500 hover:bg-rose-500/10"
                        >
                          <FiTrash2 />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Add Table trigger */}
          {activeFloorId && (
            <button
              onClick={() => setShowAddTable(!showAddTable)}
              className="px-3 py-1.5 border border-dashed rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all hover:border-amber-500 hover:text-amber-500 cursor-pointer text-slate-400 border-slate-700"
            >
              <FiPlus /> Place Table on Map
            </button>
          )}
        </div>
      )}

      {/* Add Table form panel */}
      {showAddTable && activeFloorId && (
        <form onSubmit={handleAddTableToFloor} className={`p-6 rounded-2xl border max-w-lg animate-fade-in space-y-4 ${cardBg}`}>
          <div className="flex justify-between items-center">
            <h3 className={`font-bold text-base ${isDark ? 'text-white' : 'text-slate-900'}`}>Place Physical Table on Map</h3>
            <button type="button" onClick={() => setShowAddTable(false)} className="text-slate-400 hover:text-rose-500"><FiX /></button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider mb-1.5 text-slate-400">Select Existing QR Table</label>
              <select
                required
                value={selectedPhysicalTableId}
                onChange={(e) => setSelectedPhysicalTableId(e.target.value)}
                className={formInputCls}
              >
                <option value="">-- Choose Table QR --</option>
                {availablePhysicalTables.map(t => (
                  <option key={t.id} value={t.id}>{t.tableName}</option>
                ))}
              </select>
              {availablePhysicalTables.length === 0 && (
                <p className="text-[10px] text-rose-400 mt-1 flex items-center gap-1"><FiAlertTriangle /> All QR tables have already been placed!</p>
              )}
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider mb-1.5 text-slate-400">Seating Capacity</label>
              <select
                value={tableCapacity}
                onChange={(e) => setTableCapacity(Number(e.target.value))}
                className={formInputCls}
              >
                <option value="2">2 Seater</option>
                <option value="4">4 Seater</option>
                <option value="6">6 Seater</option>
                <option value="8">8 Seater</option>
                <option value="10">10 Seater</option>
                <option value="12">12 Seater</option>
              </select>
            </div>
          </div>

          <div className="flex gap-2 justify-end pt-2">
            <button type="button" onClick={() => setShowAddTable(false)} className={`px-4 py-2 rounded-xl text-xs font-semibold ${isDark ? 'bg-slate-800 text-slate-400' : 'bg-slate-100 text-slate-500'}`}>Cancel</button>
            <button type="submit" disabled={!selectedPhysicalTableId} className="px-4 py-2 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl text-xs font-bold text-slate-950 shadow">Place Table</button>
          </div>
        </form>
      )}

      {/* Main Floor Layout Blueprint Canvas */}
      {activeFloorId ? (
        <div className="space-y-3">
          <div className="flex justify-between items-center text-xs text-slate-400">
            <span className="flex items-center gap-1.5 font-medium"><FiMove className="animate-pulse" /> Hold and Drag tables to custom position them. Layouts auto-save.</span>
            <span className="font-mono text-[11px]">{floorTables.length} Tables placed</span>
          </div>

          {/* Dotted Blueprint Grid Container */}
          <div
            ref={containerRef}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerLeave={handlePointerUp}
            className={`relative w-full h-[580px] overflow-hidden rounded-2xl border border-dashed shadow-inner transition-all select-none ${isDark
                ? 'bg-slate-950 border-slate-800 bg-[radial-gradient(rgba(245,158,11,0.08)_1px,transparent_1px)] bg-[size:24px_24px]'
                : 'bg-slate-50 border-slate-300/80 bg-[radial-gradient(rgba(217,119,6,0.07)_1px,transparent_1px)] bg-[size:24px_24px]'
              }`}
          >
            {/* Blueprint Grid Label */}
            <div className="absolute top-4 left-4 font-mono text-[10px] uppercase tracking-widest pointer-events-none select-none text-slate-500">
              [ Grid System Coordinates: Dynamic % ]
            </div>

            {/* Render absolute positioned tables */}
            {floorTables.map(tbl => {
              const metrics = getTableMetrics(tbl.id);
              const isOccupied = metrics.status === 'Occupied';
              const isDragging = draggingTableId === tbl.id;

              return (
                <div
                  key={tbl.id}
                  className={`absolute group touch-none cursor-grab -translate-x-1/2 -translate-y-1/2 w-44 h-32 rounded-[32px] border transition-all duration-300 select-none ${isDragging
                      ? 'cursor-grabbing border-amber-500 shadow-[0_25px_40px_-8px_rgba(0,0,0,0.9)] scale-105 ring-4 ring-amber-500/20 z-40'
                      : `border-[#8a6640] bg-gradient-to-br from-[#2c1d11] via-[#3d2a19] to-[#1f130a] shadow-[0_12px_24px_-4px_rgba(0,0,0,0.6),inset_0_2px_4px_rgba(255,255,255,0.1),0_0_15px_rgba(138,102,64,0.15)] z-10 hover:shadow-[0_20px_35px_-8px_rgba(0,0,0,0.8),inset_0_2px_4px_rgba(255,255,255,0.15),0_0_20px_rgba(245,158,11,0.25)] hover:border-amber-500/80 hover:scale-[1.04] hover:z-20`
                    }`}
                  style={{
                    left: `${tbl.x}%`,
                    top: `${tbl.y}%`
                  }}
                  onPointerDown={(e) => handlePointerDown(e, tbl.id, tbl.x, tbl.y)}
                >
                  {/* Render architectural chairs absolute-positioned around the card */}
                  {renderChairs(tbl.capacity, isOccupied)}

                  {/* Golden brass concentric inner rings representing luxurious dining plate set */}
                  <div className="absolute inset-2 border border-[#8a6640]/30 rounded-[26px] pointer-events-none" />
                  <div className="absolute inset-5 border border-dashed border-[#8a6640]/15 rounded-[20px] pointer-events-none flex items-center justify-center" />

                  {/* Handle indicator / dragging status */}
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-1.5 py-0.5 rounded-full bg-slate-900 text-[8px] font-mono font-bold tracking-widest pointer-events-none select-none uppercase text-amber-500/80 opacity-0 group-hover:opacity-100 transition-opacity">
                    {isDragging ? 'DRAGGING' : 'HOLD TO DRAG'}
                  </div>

                  {/* Inline Edit/Delete Controls */}
                  <div className="absolute top-2.5 right-2.5 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all duration-200 z-30" onPointerDown={(e) => e.stopPropagation()}>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingTableId(tbl.id);
                        setEditingCapacity(tbl.capacity);
                      }}
                      title="Edit seating capacity"
                      className="p-1 rounded bg-slate-950/80 text-amber-400 hover:text-white hover:bg-amber-500/30 transition-all cursor-pointer"
                    >
                      <FiEdit2 className="text-[10px]" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRemoveTableFromFloor(tbl.id, tbl.tableName);
                      }}
                      title="Remove from layout"
                      className="p-1 rounded bg-slate-950/80 text-rose-400 hover:text-white hover:bg-rose-500/30 transition-all cursor-pointer"
                    >
                      <FiTrash2 className="text-[10px]" />
                    </button>
                  </div>

                  {/* Table Capacity Inline Editor */}
                  {editingTableId === tbl.id && (
                    <div onPointerDown={(e) => e.stopPropagation()} className="absolute inset-0 bg-slate-950/95 rounded-[32px] flex flex-col justify-center items-center p-3 gap-2 z-50 animate-fade-in text-white text-xs border border-amber-500/25">
                      <span className="font-bold text-amber-400 text-[11px] uppercase tracking-wider">Set Capacity</span>
                      <select
                        value={editingCapacity}
                        onChange={(e) => setEditingCapacity(Number(e.target.value))}
                        className="bg-slate-900 border border-slate-800 rounded-lg px-2 py-1 text-xs text-white focus:outline-none focus:ring-1 focus:ring-amber-500"
                      >
                        {[2, 4, 6, 8, 10, 12].map(n => <option key={n} value={n}>{n} Seater</option>)}
                      </select>
                      <div className="flex gap-2">
                        <button onClick={handleUpdateTableCapacity} className="p-1 bg-emerald-500 text-slate-950 rounded font-bold hover:bg-emerald-600 cursor-pointer"><FiCheck className="text-xs" /></button>
                        <button onClick={() => setEditingTableId(null)} className="p-1 bg-rose-500 text-white rounded font-bold hover:bg-rose-600 cursor-pointer"><FiX className="text-xs" /></button>
                      </div>
                    </div>
                  )}

                  {/* AVAILABLE STATE FIELD DISPLAY */}
                  {!isOccupied && (
                    <div className="flex flex-col h-full justify-between p-4 relative z-10 select-none text-left">
                      {/* Table Number and Capacity */}
                      <div className="flex justify-between items-start">
                        <div className="flex flex-col">
                          <span className="text-[9px] text-amber-500/80 font-mono uppercase tracking-wider font-bold">Table</span>
                          <h4 className="text-sm font-extrabold text-amber-100 tracking-tight font-display">{tbl.tableName}</h4>
                        </div>
                        <span className="text-[9px] font-bold uppercase font-mono text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded-md border border-amber-500/20 flex items-center gap-1 shrink-0">
                          <FiUsers className="text-[10px]" /> {tbl.capacity} Pax
                        </span>
                      </div>

                      {/* QR Name */}
                      <div className="my-1">
                        <span className="text-[8px] text-amber-500/40 uppercase tracking-widest block font-mono">QR Assigned</span>
                        <span className="text-[11px] font-semibold text-slate-300 truncate block max-w-[110px]">{tbl.tableName} QR</span>
                      </div>

                      {/* Available Status */}
                      <div className="flex items-center justify-between">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-extrabold bg-emerald-500/15 text-emerald-400 border border-emerald-500/20 uppercase tracking-wider">
                          <span className="h-1 w-1 rounded-full bg-emerald-400 animate-pulse" />
                          Available
                        </span>
                      </div>
                    </div>
                  )}

                  {/* OCCUPIED STATE FIELD DISPLAY */}
                  {isOccupied && (
                    <div className="flex flex-col h-full justify-between p-4 relative z-10 select-none text-left">
                      {/* Table Number and Capacity */}
                      <div className="flex justify-between items-start">
                        <div className="flex flex-col">
                          <span className="text-[9px] text-amber-500/80 font-mono uppercase tracking-wider font-bold">Table</span>
                          <h4 className="text-sm font-extrabold text-amber-100 tracking-tight font-display">{tbl.tableName}</h4>
                        </div>
                        <span className="text-[9px] font-bold uppercase font-mono text-rose-400 bg-rose-500/10 px-1.5 py-0.5 rounded-md border border-rose-500/20 flex items-center gap-1 shrink-0">
                          <FiUsers className="text-[10px]" /> {tbl.capacity} Pax
                        </span>
                      </div>

                      {/* Current Bill */}
                      <div className="my-1 flex justify-between items-center bg-black/40 px-2 py-1 rounded-xl border border-amber-500/5">
                        <div className="flex flex-col">
                          <span className="text-[7px] text-amber-500/60 uppercase tracking-widest font-mono">Bill</span>
                          <span className="text-xs font-mono font-black text-amber-400">
                            ₹{metrics.currentBill.toLocaleString()}
                          </span>
                        </div>
                        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[8px] font-extrabold bg-rose-500/15 text-rose-400 border border-rose-500/20 uppercase tracking-wider">
                          Occupied
                        </span>
                      </div>

                      {/* Mark Available Button */}
                      <button
                        onPointerDown={(e) => e.stopPropagation()} // Stop drag interaction
                        onClick={(e) => {
                          e.stopPropagation();
                          handleMarkAvailable(tbl.id);
                        }}
                        className="w-full py-1 bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold rounded-xl text-[10px] flex items-center justify-center gap-1 transition-all shadow-md cursor-pointer border border-emerald-400/20"
                      >
                        <FiCheck className="stroke-[3px] text-[10px]" /> Mark Available
                      </button>
                    </div>
                  )}
                </div>
              );
            })}

            {/* Empty layout state */}
            {floorTables.length === 0 && (
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none select-none text-center p-6">
                <FiGrid className="text-5xl text-slate-600 mb-3 animate-pulse" />
                <h4 className={`text-base font-bold mb-1 ${isDark ? 'text-slate-300' : 'text-slate-800'}`}>Visual Blueprint Canvas</h4>
                <p className="text-xs text-slate-500 max-w-sm">
                  This floor has no table positions defined yet. Click "Place Table on Map" to add your physical QR tables to this floor.
                </p>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className={`p-10 rounded-2xl border text-center border-dashed ${isDark ? 'border-slate-800' : 'border-slate-300'}`}>
          <FiMap className="text-5xl mx-auto text-amber-500 mb-4 animate-bounce" />
          <h2 className={`text-lg font-bold mb-1 ${isDark ? 'text-white' : 'text-slate-900'}`}>Create Your First Floor</h2>
          <p className="text-sm text-slate-500 max-w-md mx-auto mb-6">
            Get started by adding floors (e.g., Ground Floor, Rooftop Lounge) to map out your physical restaurant layouts dynamically.
          </p>
          <button
            onClick={() => setShowAddFloor(true)}
            className="px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded-xl text-sm transition-all shadow-md inline-flex items-center gap-1.5 cursor-pointer"
          >
            <FiPlus /> New Floor
          </button>
        </div>
      )}

      {/* Table Details Modal Popup */}
      {selectedTableForPopup && (() => {
        const tbl = selectedTableForPopup;
        const metrics = getTableMetrics(tbl.id);
        const isOccupied = metrics.status === 'Occupied';

        // Filter all orders (active or past) for this table
        const tableOrders = orders.filter(o => o.tableId === tbl.id);

        return (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
            <div className={`w-full max-w-lg rounded-3xl border shadow-2xl overflow-hidden ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>

              {/* Modal Header */}
              <div className={`p-6 border-b flex justify-between items-center ${isDark ? 'border-slate-800 bg-slate-900/50' : 'border-slate-100 bg-slate-50'}`}>
                <div>
                  <h3 className={`text-xl font-black font-display tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
                    Layout Details: {tbl.tableName}
                  </h3>
                  <p className={`text-xs mt-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                    Real-time table coordinates & session activity logs.
                  </p>
                </div>
                <button
                  onClick={() => setSelectedTableForPopup(null)}
                  className={`p-2 rounded-xl transition-all cursor-pointer hover:text-rose-500 ${isDark ? 'hover:bg-slate-800 text-slate-400' : 'hover:bg-slate-100 text-slate-500'}`}
                >
                  <FiX className="text-lg" />
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-6 space-y-6">
                {/* Top Info Cards Grid */}
                <div className="grid grid-cols-2 gap-4">

                  {/* Table Identification */}
                  <div className={`p-4 rounded-2xl border ${isDark ? 'bg-slate-950/40 border-slate-800' : 'bg-slate-50/50 border-slate-200'}`}>
                    <span className="text-[10px] uppercase font-mono tracking-wider text-slate-400 block mb-1">Assigned QR</span>
                    <span className={`text-sm font-bold truncate block ${isDark ? 'text-white' : 'text-slate-800'}`}>
                      {tbl.tableName} QR
                    </span>
                    <span className="text-[10px] text-slate-500 font-mono block mt-1">Ref ID: {tbl.id}</span>
                  </div>

                  {/* Table Status */}
                  <div className={`p-4 rounded-2xl border ${isDark ? 'bg-slate-950/40 border-slate-800' : 'bg-slate-50/50 border-slate-200'}`}>
                    <span className="text-[10px] uppercase font-mono tracking-wider text-slate-400 block mb-1">Status</span>
                    <div className="flex items-center gap-1.5 mt-1">
                      <span className={`h-2.5 w-2.5 rounded-full ${isOccupied ? 'bg-rose-500 animate-pulse' : 'bg-emerald-500'}`} />
                      <span className={`text-sm font-black ${isOccupied ? 'text-rose-500' : 'text-emerald-500'}`}>
                        {isOccupied ? 'Occupied' : 'Available'}
                      </span>
                    </div>
                  </div>

                </div>

                {/* Current Bill - Only if Occupied */}
                {isOccupied && (
                  <div className={`p-5 rounded-2xl border flex items-center justify-between ${isDark ? 'bg-amber-500/5 border-amber-500/20' : 'bg-amber-50/60 border-amber-200'}`}>
                    <div className="space-y-0.5">
                      <span className="text-[10px] uppercase font-mono tracking-wider text-amber-600 font-bold block">Current Bill</span>
                      <span className={`text-2xl font-mono font-black ${isDark ? 'text-amber-400' : 'text-amber-600'}`}>
                        ₹{metrics.currentBill.toLocaleString()}
                      </span>
                    </div>
                    <span className="text-[11px] font-mono font-semibold text-slate-400">Includes all active table orders</span>
                  </div>
                )}

                {/* View Orders section */}
                <div className="space-y-2.5">
                  <h4 className={`text-xs uppercase font-mono tracking-wider font-extrabold ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                    Active Session Orders
                  </h4>

                  <div className={`rounded-2xl border overflow-hidden divide-y max-h-56 overflow-y-auto ${isDark ? 'bg-slate-950 border-slate-800 divide-slate-800' : 'bg-slate-50 border-slate-200 divide-slate-200'}`}>
                    {tableOrders.length > 0 ? (
                      tableOrders.map(order => {
                        const isActive = ['pending', 'accepted', 'preparing', 'ready', 'served'].includes(order.status);

                        return (
                          <div key={order.id} className="p-4 space-y-2 text-left">
                            <div className="flex justify-between items-center text-xs">
                              <span className="font-mono font-bold text-amber-500">{order.id}</span>
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${order.status === 'completed'
                                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                  : isActive
                                    ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20 animate-pulse'
                                    : 'bg-slate-500/10 text-slate-400 border border-slate-500/20'
                                }`}>
                                {order.status}
                              </span>
                            </div>

                            {/* Items List */}
                            <div className="space-y-1 pl-1">
                              {order.items?.map((it, idx) => (
                                <div key={idx} className={`text-xs flex justify-between ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                                  <span>{it.quantity}x {it.name}</span>
                                  <span className="font-mono text-slate-500">₹{it.price * it.quantity}</span>
                                </div>
                              ))}
                            </div>

                            {/* Grand Total */}
                            <div className="flex justify-between items-center pt-1.5 border-t border-dashed border-slate-200/5 text-xs font-semibold">
                              <span className="text-slate-400">Grand Total</span>
                              <span className="font-mono text-amber-500 font-bold">₹{order.grandTotal || 0}</span>
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <div className="p-6 text-center text-xs text-slate-500">
                        No active or past orders found for this table.
                      </div>
                    )}
                  </div>
                </div>

                {/* Generate Bill Button */}
                {isOccupied && (
                  <button
                    onClick={() => {
                      // Gather all active orders for this table
                      const activeOrders = orders.filter(o =>
                        o.tableId === tbl.id &&
                        ['pending', 'accepted', 'preparing', 'ready', 'served'].includes(o.status)
                      );

                      // Aggregate items by name or id
                      const aggregatedItems = [];
                      activeOrders.forEach(order => {
                        order.items?.forEach(item => {
                          const existing = aggregatedItems.find(it => it.name === item.name || it.id === item.id);
                          if (existing) {
                            existing.quantity += Number(item.quantity || 1);
                            existing.subtotal += Number(item.price || 0) * Number(item.quantity || 1);
                          } else {
                            aggregatedItems.push({
                              id: item.id || item.productId || Math.random().toString(),
                              name: item.name,
                              price: Number(item.price || 0),
                              quantity: Number(item.quantity || 1),
                              subtotal: Number(item.price || 0) * Number(item.quantity || 1)
                            });
                          }
                        });
                      });

                      setBillInitialItems(aggregatedItems);
                      setBillTableNo(tbl.tableName || tbl.tableNo || '');
                      setIsBillModalOpen(true);
                      setSelectedTableForPopup(null);
                    }}
                    className="w-full py-3 bg-amber-500 hover:bg-amber-600 text-slate-950 font-extrabold rounded-2xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-amber-500/10 hover:shadow-xl hover:scale-[1.01] cursor-pointer mb-2.5"
                  >
                    <FiDollarSign className="stroke-[3px] text-lg" /> Generate Bill
                  </button>
                )}

                {/* Mark Available Button */}
                {isOccupied && (
                  <button
                    onClick={async () => {
                      await handleMarkAvailable(tbl.id);
                      setSelectedTableForPopup(null);
                    }}
                    className="w-full py-3 bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-extrabold rounded-2xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-emerald-500/10 hover:shadow-xl hover:scale-[1.01] cursor-pointer"
                  >
                    <FiCheck className="stroke-[3px] text-lg" /> Mark Table as Available
                  </button>
                )}

              </div>

            </div>
          </div>
        );
      })()}

      <ReusableBillPreviewModal
        isOpen={isBillModalOpen}
        onClose={() => setIsBillModalOpen(false)}
        initialItems={billInitialItems}
        tableNumber={billTableNo}
        currentRest={currentRest}
        isDark={isDark}
        tables={physicalTables}
        orders={orders}
        onShowStatus={showStatus}
      />
    </div>
  );
}
