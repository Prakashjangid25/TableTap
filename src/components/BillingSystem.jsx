import React, { useState, useEffect } from 'react';
import { 
  FiSearch, 
  FiPlus, 
  FiMinus, 
  FiTrash2, 
  FiDollarSign, 
  FiCheck, 
  FiX, 
  FiPrinter, 
  FiDownload, 
  FiPercent, 
  FiShoppingCart,
  FiShoppingBag,
  FiUser
} from 'react-icons/fi';
import { jsPDF } from 'jspdf';
import { db } from '../firebase';
import { 
  collection, 
  doc, 
  addDoc,
  getDocs,
  query, 
  orderBy, 
  limit, 
  writeBatch,
  serverTimestamp
} from 'firebase/firestore';

// Global cache for fetched font to avoid multiple network calls
let cachedRobotoFontBase64 = null;

async function getRobotoFontBase64() {
  if (cachedRobotoFontBase64) return cachedRobotoFontBase64;
  
  const urls = [
    'https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.1.66/fonts/Roboto/Roboto-Regular.ttf',
    'https://fonts.gstatic.com/s/notosans/v36/o-0IIpQlx3QUlC5A4PNr5TRA.ttf'
  ];

  for (const url of urls) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);
      const response = await fetch(url, { signal: controller.signal });
      clearTimeout(timeoutId);
      if (!response.ok) continue;
      const arrayBuffer = await response.arrayBuffer();
      
      let binary = '';
      const bytes = new Uint8Array(arrayBuffer);
      const len = bytes.byteLength;
      for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      cachedRobotoFontBase64 = window.btoa(binary);
      return cachedRobotoFontBase64;
    } catch (error) {
      console.warn(`Failed to fetch font from ${url}:`, error);
    }
  }
  return null;
}

export default function BillingSystem({ 
  products = [], 
  categories = [], 
  tables = [], 
  currentRest, 
  isDark,
  orders = [],
  onShowStatus 
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [cart, setCart] = useState([]);
  
  // Modal states
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [billNumber, setBillNumber] = useState('ED-1001');
  const [orderType, setOrderType] = useState('Table'); // 'Table' or 'Parcel'
  const [selectedTableNumber, setSelectedTableNumber] = useState('');
  const [gstEnabled, setGstEnabled] = useState(true);
  const [serviceChargeEnabled, setServiceChargeEnabled] = useState(false);
  const [serviceChargeRate, setServiceChargeRate] = useState(5); // 5% standard
  
  const [isSaving, setIsSaving] = useState(false);

  // Generate next sequential bill number on mount / preview trigger
  const generateNextBillNumber = async () => {
    if (!currentRest?.id) return;
    try {
      const billsRef = collection(db, 'restaurants', currentRest.id, 'bills');
      const q = query(billsRef, orderBy('createdAt', 'desc'), limit(1));
      const snap = await getDocs(q);
      
      if (!snap.empty) {
        const lastBill = snap.docs[0].data();
        const lastNumStr = lastBill.billNumber || 'ED-1000';
        // Extract digits
        const match = lastNumStr.match(/\d+/);
        if (match) {
          const nextNum = parseInt(match[0], 10) + 1;
          setBillNumber(`ED-${nextNum}`);
        } else {
          setBillNumber('ED-1001');
        }
      } else {
        setBillNumber('ED-1001');
      }
    } catch (err) {
      console.error("Error generating bill number: ", err);
      // Fallback
      setBillNumber(`ED-${Math.floor(1000 + Math.random() * 9000)}`);
    }
  };

  useEffect(() => {
    if (isPreviewOpen) {
      generateNextBillNumber();
    }
  }, [isPreviewOpen]);

  // Handle manual item selection / cart controls
  const handleAddToCart = (product) => {
    setCart(prev => {
      const existing = prev.find(item => item.id === product.id);
      if (existing) {
        return prev.map(item => 
          item.id === product.id 
            ? { ...item, quantity: item.quantity + 1, subtotal: (item.quantity + 1) * item.price }
            : item
        );
      } else {
        return [...prev, {
          id: product.id,
          name: product.name,
          price: Number(product.price),
          quantity: 1,
          subtotal: Number(product.price)
        }];
      }
    });
  };

  const handleUpdateQuantity = (productId, delta) => {
    setCart(prev => {
      return prev.map(item => {
        if (item.id === productId) {
          const newQty = item.quantity + delta;
          if (newQty <= 0) return null;
          return { ...item, quantity: newQty, subtotal: newQty * item.price };
        }
        return item;
      }).filter(Boolean);
    });
  };

  const handleRemoveFromCart = (productId) => {
    setCart(prev => prev.filter(item => item.id !== productId));
  };

  const handleClearCart = () => {
    setCart([]);
  };

  // Filter products by search query and category
  const filteredProducts = products.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          (p.description && p.description.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesCategory = selectedCategory === 'all' || p.categoryId === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  // Calculate dynamic pricing metrics
  const getPricingMetrics = (itemsList) => {
    const subtotal = itemsList.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const taxRate = currentRest?.taxRate ? Number(currentRest.taxRate) : 5; // Fallback to 5% GST
    const gstAmount = gstEnabled ? (subtotal * taxRate) / 100 : 0;
    const serviceChargeAmount = serviceChargeEnabled ? (subtotal * serviceChargeRate) / 100 : 0;
    const grandTotal = subtotal + gstAmount + serviceChargeAmount;

    return {
      subtotal,
      taxRate,
      gstAmount,
      serviceChargeAmount,
      grandTotal
    };
  };

  const metrics = getPricingMetrics(cart);

  // Trigger PDF Generation
  const downloadPDFReceipt = async (billData) => {
    try {
      if (onShowStatus) {
        onShowStatus("Preparing PDF...");
      }
      const base64Font = await getRobotoFontBase64();
      const pdfFont = base64Font ? 'Roboto' : 'helvetica';
      const currencySymbol = base64Font ? '₹' : 'Rs.';

      const doc = new jsPDF({
        unit: 'mm',
        format: 'a4'
      });

      if (base64Font) {
        doc.addFileToVFS('Roboto-Regular.ttf', base64Font);
        doc.addFont('Roboto-Regular.ttf', 'Roboto', 'normal');
        doc.addFont('Roboto-Regular.ttf', 'Roboto', 'bold');
        doc.addFont('Roboto-Regular.ttf', 'Roboto', 'italic');
        doc.setFont('Roboto', 'normal');
      } else {
        doc.setFont('helvetica', 'normal');
      }

      // Style setups
      doc.setFont(pdfFont, 'normal');
      
      // Header border/box
      doc.setDrawColor(220, 220, 220);
      doc.setLineWidth(0.5);
      doc.line(10, 10, 200, 10);
      
      // Restaurant Details
      doc.setFontSize(22);
      doc.setFont(pdfFont, 'bold');
      doc.setTextColor(245, 158, 11); // Amber color for brand
      doc.text(currentRest?.name || 'EASYDINE', 15, 22);

      doc.setFontSize(10);
      doc.setFont(pdfFont, 'normal');
      doc.setTextColor(100, 100, 100);
      if (currentRest?.address) {
        doc.text(currentRest.address, 15, 28);
      }
      if (currentRest?.contact) {
        doc.text(`Contact: ${currentRest.contact}`, 15, 33);
      }

      // Title & Right Side metadata
      doc.setFontSize(16);
      doc.setFont(pdfFont, 'bold');
      doc.setTextColor(30, 41, 59);
      doc.text("TAX INVOICE", 140, 22);

      doc.setFontSize(9);
      doc.setFont(pdfFont, 'normal');
      doc.setTextColor(80, 80, 80);
      doc.text(`Bill No: ${billData.billNumber}`, 140, 28);
      doc.text(`Date: ${billData.date}  ${billData.time}`, 140, 33);
      doc.text(`Type: ${billData.orderType}`, 140, 38);
      if (billData.orderType === 'Table') {
        doc.text(`Table: ${billData.tableNumber || 'N/A'}`, 140, 43);
      }

      doc.line(10, 48, 200, 48);

      // Items Table Header
      let y = 56;
      doc.setFont(pdfFont, 'bold');
      doc.setFontSize(10);
      doc.setTextColor(30, 41, 59);
      doc.text("Item Name", 15, y);
      doc.text("Price", 110, y, { align: "right" });
      doc.text("Qty", 140, y, { align: "right" });
      doc.text("Total", 185, y, { align: "right" });

      doc.line(10, y + 3, 200, y + 3);
      y += 10;

      // Items List
      doc.setFont(pdfFont, 'normal');
      doc.setFontSize(9.5);
      doc.setTextColor(60, 60, 60);

      billData.items.forEach((item) => {
        // Prevent overflow of item name
        const itemName = item.name.length > 45 ? item.name.substring(0, 42) + '...' : item.name;
        doc.text(itemName, 15, y);
        doc.text(`${currencySymbol}${item.price.toFixed(2)}`, 110, y, { align: "right" });
        doc.text(String(item.quantity), 140, y, { align: "right" });
        doc.text(`${currencySymbol}${item.subtotal.toFixed(2)}`, 185, y, { align: "right" });
        y += 8;
      });

      doc.line(10, y, 200, y);
      y += 8;

      // Calculations panel on right
      const summaryX = 135;
      doc.setFontSize(10);
      doc.setTextColor(100, 100, 100);
      doc.text("Subtotal:", summaryX, y);
      doc.setFont(pdfFont, 'bold');
      doc.text(`${currencySymbol}${billData.subtotal.toFixed(2)}`, 185, y, { align: "right" });
      y += 6;

      if (billData.gstEnabled) {
        doc.setFont(pdfFont, 'normal');
        doc.text(`GST (${billData.gstRate}%):`, summaryX, y);
        doc.setFont(pdfFont, 'bold');
        doc.text(`${currencySymbol}${billData.gstAmount.toFixed(2)}`, 185, y, { align: "right" });
        y += 6;
      }

      if (billData.serviceChargeEnabled) {
        doc.setFont(pdfFont, 'normal');
        doc.text(`Service Charge (${billData.serviceChargeRate}%):`, summaryX, y);
        doc.setFont(pdfFont, 'bold');
        doc.text(`${currencySymbol}${billData.serviceChargeAmount.toFixed(2)}`, 185, y, { align: "right" });
        y += 6;
      }

      doc.line(125, y, 200, y);
      y += 8;

      // Grand Total
      doc.setFontSize(13);
      doc.setFont(pdfFont, 'bold');
      doc.setTextColor(245, 158, 11);
      doc.text("GRAND TOTAL:", summaryX, y);
      doc.text(`${currencySymbol}${billData.grandTotal.toFixed(2)}`, 185, y, { align: "right" });

      y += 15;
      doc.setDrawColor(240, 240, 240);
      doc.line(10, y, 200, y);
      
      // Footer
      y += 8;
      doc.setFont(pdfFont, 'italic');
      doc.setFontSize(9);
      doc.setTextColor(140, 140, 140);
      doc.text("Thank you for your business! Please visit again.", 105, y, { align: "center" });

      if (currentRest?.showPoweredBy) {
        y += 6;
        doc.setFont(pdfFont, 'normal');
        doc.setFontSize(8);
        doc.setTextColor(160, 160, 160);
        doc.text("Powered by EasyDine", 105, y, { align: "center" });
      }

      doc.save(`${billData.billNumber}.pdf`);
      if (onShowStatus) {
        onShowStatus("PDF Downloaded successfully!");
      }
    } catch (err) {
      console.error("PDF generation failed: ", err);
      alert("Failed to generate PDF. Please check console for details.");
    }
  };

  // Trigger Print Receipt (Formatted for thermal layout or A4)
  const printReceipt = (billData) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert("Please allow popups to print.");
      return;
    }

    printWindow.document.write(`
      <html>
        <head>
          <title>Print Bill - ${billData.billNumber}</title>
          <style>
            @media print {
              body { margin: 0; padding: 15px; font-family: 'Courier New', Courier, monospace; }
            }
            body {
              font-family: 'Courier New', Courier, monospace;
              max-width: 350px;
              margin: 0 auto;
              padding: 10px;
              color: #000;
              background: #fff;
            }
            .text-center { text-align: center; }
            .text-right { text-align: right; }
            .bold { font-weight: bold; }
            .divider { border-top: 1px dashed #000; margin: 8px 0; }
            .flex { display: flex; justify-content: space-between; }
            .items-table { width: 100%; border-collapse: collapse; margin: 8px 0; }
            .items-table th, .items-table td { text-align: left; padding: 4px 0; font-size: 12px; }
            .items-table th.right, .items-table td.right { text-align: right; }
            .grand-total { font-size: 16px; font-weight: bold; margin-top: 8px; }
          </style>
        </head>
        <body>
          <div class="text-center">
            ${currentRest?.logoUrl ? `<img src="${currentRest.logoUrl}" style="max-height: 40px; margin-bottom: 4px; border-radius: 4px;" /><br/>` : ''}
            <span class="bold" style="font-size: 16px;">${currentRest?.name || 'EASYDINE'}</span><br/>
            ${currentRest?.address ? `<span style="font-size: 10px;">${currentRest.address}</span><br/>` : ''}
            ${currentRest?.contact ? `<span style="font-size: 10px;">Tel: ${currentRest.contact}</span><br/>` : ''}
            <span class="bold" style="font-size: 12px; display: inline-block; margin-top: 4px; border: 1px solid #000; padding: 1px 6px;">TAX INVOICE</span>
          </div>
          
          <div class="divider" style="margin-top: 12px;"></div>
          <div class="flex" style="font-size: 11px;">
            <div>Bill No: <span class="bold">${billData.billNumber}</span></div>
            <div>Date: ${billData.date}</div>
          </div>
          <div class="flex" style="font-size: 11px;">
            <div>Type: <span class="bold">${billData.orderType}</span></div>
            <div>Time: ${billData.time}</div>
          </div>
          ${billData.orderType === 'Table' ? `<div style="font-size: 11px;">Table: <span class="bold">${billData.tableNumber || 'N/A'}</span></div>` : ''}
          <div class="divider"></div>
          
          <table class="items-table">
            <thead>
              <tr>
                <th>Item</th>
                <th class="right">Qty</th>
                <th class="right">Price</th>
                <th class="right">Total</th>
              </tr>
            </thead>
            <tbody>
              ${billData.items.map(it => `
                <tr>
                  <td>${it.name}</td>
                  <td class="right">${it.quantity}</td>
                  <td class="right">₹${it.price.toFixed(2)}</td>
                  <td class="right">₹${it.subtotal.toFixed(2)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
          
          <div class="divider"></div>
          <div class="flex" style="font-size: 11px;">
            <span>Subtotal:</span>
            <span>₹${billData.subtotal.toFixed(2)}</span>
          </div>
          ${billData.gstEnabled ? `
          <div class="flex" style="font-size: 11px;">
            <span>GST (${billData.gstRate}%):</span>
            <span>₹${billData.gstAmount.toFixed(2)}</span>
          </div>
          ` : ''}
          ${billData.serviceChargeEnabled ? `
          <div class="flex" style="font-size: 11px;">
            <span>Service Charge (${billData.serviceChargeRate}%):</span>
            <span>₹${billData.serviceChargeAmount.toFixed(2)}</span>
          </div>
          ` : ''}
          
          <div class="divider"></div>
          <div class="flex grand-total">
            <span>GRAND TOTAL:</span>
            <span>₹${billData.grandTotal.toFixed(2)}</span>
          </div>
          <div class="divider" style="border-top: 2px double #000; margin-top: 4px;"></div>
          
          <div class="text-center" style="font-size: 10px; margin-top: 15px;">
            <span>Thank you for dining with us!</span><br/>
            <span style="font-weight: bold;">Visit Again</span>
            ${currentRest?.showPoweredBy ? `
              <div style="font-size: 8px; color: #888; margin-top: 10px;">Powered by EasyDine</div>
            ` : ''}
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 300);
  };

  // Final Action: Save Bill
  const handleSaveBill = async () => {
    if (!currentRest?.id) return;
    if (cart.length === 0) {
      alert("Your bill items list is empty.");
      return;
    }

    if (orderType === 'Table' && !selectedTableNumber) {
      alert("Please select or enter a table number.");
      return;
    }

    setIsSaving(true);
    try {
      const now = new Date();
      const dateStr = now.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
      const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });

      const billData = {
        billNumber,
        orderType,
        tableNumber: orderType === 'Table' ? selectedTableNumber : null,
        items: cart,
        subtotal: metrics.subtotal,
        gstEnabled,
        gstRate: metrics.taxRate,
        gstAmount: metrics.gstAmount,
        serviceChargeEnabled,
        serviceChargeRate,
        serviceChargeAmount: metrics.serviceChargeAmount,
        grandTotal: metrics.grandTotal,
        date: dateStr,
        time: timeStr,
        createdAt: now.toISOString()
      };

      // 1. Add record to /restaurants/{id}/bills
      await addDoc(collection(db, 'restaurants', currentRest.id, 'bills'), billData);

      // 2. If Table Order is selected, and there is a physical table with that number,
      // let's mark its active orders as completed!
      if (orderType === 'Table' && selectedTableNumber) {
        // Find matching table id from physical tables
        const matchingTable = tables.find(t => 
          String(t.tableName || t.tableNo || '') === String(selectedTableNumber) || 
          t.id === selectedTableNumber
        );
        if (matchingTable) {
          const activeOrders = orders.filter(o => 
            o.tableId === matchingTable.id && 
            ['pending', 'accepted', 'preparing', 'ready', 'served'].includes(o.status)
          );

          if (activeOrders.length > 0) {
            const batch = writeBatch(db);
            activeOrders.forEach(o => {
              const orderRef = doc(db, 'restaurants', currentRest.id, 'orders', o.id);
              batch.update(orderRef, { status: 'completed' });
            });
            await batch.commit();
          }
        }
      }

      if (onShowStatus) {
        onShowStatus(`Bill ${billNumber} saved successfully!`);
      }

      // Reset and close
      setCart([]);
      setIsPreviewOpen(false);
    } catch (err) {
      console.error("Error saving bill: ", err);
      alert("Failed to save bill. See console.");
    } finally {
      setIsSaving(false);
    }
  };

  const activeCategoryObject = categories.find(c => c.id === selectedCategory);

  return (
    <div className="space-y-6 animate-fade-in">
      
      {/* Title Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className={`text-3xl font-black font-display tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
            Billing System
          </h1>
          <p className={`text-sm mt-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
            Select menu items to generate premium bills instantly. Support parcel or table seating.
          </p>
        </div>
      </div>

      {/* Grid container: Left is Food selector, Right is active cart */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* LEFT COLUMN: Food Menu (8 cols) */}
        <div className="lg:col-span-7 xl:col-span-8 space-y-6">
          
          {/* Controls Bar: Search & Category filters */}
          <div className={`p-4 rounded-2xl border flex flex-col md:flex-row gap-4 justify-between items-center ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
            
            {/* Search Input */}
            <div className="relative w-full md:w-80">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-slate-400">
                <FiSearch />
              </span>
              <input
                type="text"
                placeholder="Search food item (e.g. Paneer)..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={`w-full pl-10 pr-4 py-2 rounded-xl text-sm border focus:outline-none focus:ring-2 focus:ring-amber-500/50 transition-all ${
                  isDark 
                    ? 'bg-slate-950 border-slate-800 text-slate-100 placeholder-slate-500' 
                    : 'bg-slate-50 border-slate-200 text-slate-800 placeholder-slate-400'
                }`}
              />
              {searchQuery && (
                <button 
                  onClick={() => setSearchQuery('')}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-amber-500"
                >
                  <FiX />
                </button>
              )}
            </div>

            {/* Category pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto w-full md:w-auto pb-1 no-scrollbar">
              <button
                onClick={() => setSelectedCategory('all')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                  selectedCategory === 'all'
                    ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/10'
                    : isDark ? 'bg-slate-800 hover:bg-slate-700 text-slate-300' : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                }`}
              >
                All Items
              </button>
              {categories.map(cat => (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                    selectedCategory === cat.id
                      ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/10'
                      : isDark ? 'bg-slate-800 hover:bg-slate-700 text-slate-300' : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                  }`}
                >
                  {cat.name}
                </button>
              ))}
            </div>

          </div>

          {/* Grid of Products */}
          {filteredProducts.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {filteredProducts.map(prod => {
                const cartItem = cart.find(item => item.id === prod.id);
                const catName = categories.find(c => c.id === prod.categoryId)?.name || 'General';
                
                return (
                  <div 
                    key={prod.id} 
                    className={`rounded-2xl border p-4 flex flex-col justify-between gap-4 transition-all hover:shadow-md ${
                      cartItem 
                        ? 'border-amber-500/40 bg-amber-500/[0.02]' 
                        : isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200/80'
                    }`}
                  >
                    <div className="space-y-2">
                      <div className="flex justify-between items-start gap-2">
                        <span className="px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-wider bg-slate-500/10 text-slate-400">
                          {catName}
                        </span>
                        <span className="text-sm font-mono font-bold text-amber-500">
                          ₹{prod.price}
                        </span>
                      </div>

                      <div>
                        <h4 className={`text-sm font-bold tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
                          {prod.name}
                        </h4>
                        {prod.description && (
                          <p className={`text-[11px] mt-0.5 line-clamp-2 leading-relaxed ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                            {prod.description}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Action button / Qty control */}
                    <div className="pt-2 border-t border-dashed border-slate-100/10 flex items-center justify-between">
                      {cartItem ? (
                        <div className="flex items-center gap-2.5 bg-amber-500/10 rounded-xl p-1 border border-amber-500/20">
                          <button
                            onClick={() => handleUpdateQuantity(prod.id, -1)}
                            className="w-7 h-7 rounded-lg bg-amber-500 text-slate-950 flex items-center justify-center hover:bg-amber-600 transition-colors cursor-pointer"
                          >
                            <FiMinus className="text-xs stroke-[3px]" />
                          </button>
                          <span className={`text-xs font-mono font-black ${isDark ? 'text-white' : 'text-slate-900'}`}>
                            {cartItem.quantity}
                          </span>
                          <button
                            onClick={() => handleUpdateQuantity(prod.id, 1)}
                            className="w-7 h-7 rounded-lg bg-amber-500 text-slate-950 flex items-center justify-center hover:bg-amber-600 transition-colors cursor-pointer"
                          >
                            <FiPlus className="text-xs stroke-[3px]" />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => handleAddToCart(prod)}
                          className={`w-full py-2 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                            isDark 
                              ? 'bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white' 
                              : 'bg-slate-100 hover:bg-slate-200 text-slate-700 hover:text-slate-950'
                          }`}
                        >
                          <FiPlus className="text-xs" /> Add to Bill
                        </button>
                      )}
                    </div>

                  </div>
                );
              })}
            </div>
          ) : (
            <div className={`p-12 text-center rounded-2xl border border-dashed ${isDark ? 'border-slate-800 text-slate-500' : 'border-slate-300 text-slate-400'}`}>
              <FiCoffee className="text-4xl mx-auto mb-3 opacity-40 text-amber-500 animate-bounce" />
              <p className="text-sm font-semibold">No food items found matching your query.</p>
              <p className="text-xs opacity-60 mt-0.5">Try searching with a different keyword or category pill.</p>
            </div>
          )}

        </div>

        {/* RIGHT COLUMN: Active Cart Panel (4 cols) */}
        <div className="lg:col-span-5 xl:col-span-4 lg:sticky lg:top-6 space-y-6">
          <div className={`rounded-2xl border overflow-hidden shadow-md flex flex-col ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
            
            {/* Cart Header */}
            <div className={`p-4 border-b flex justify-between items-center ${isDark ? 'border-slate-800 bg-slate-950/20' : 'border-slate-100 bg-slate-50'}`}>
              <div className="flex items-center gap-2">
                <FiShoppingCart className="text-amber-500 text-lg" />
                <h3 className={`text-sm font-black font-display uppercase tracking-wider ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  Selected items ({cart.length})
                </h3>
              </div>
              {cart.length > 0 && (
                <button
                  onClick={handleClearCart}
                  className="text-xs text-rose-500 hover:text-rose-600 font-bold transition-all cursor-pointer flex items-center gap-1"
                >
                  <FiTrash2 /> Clear All
                </button>
              )}
            </div>

            {/* Cart Items list */}
            <div className="p-4 max-h-[300px] overflow-y-auto divide-y divide-dashed divide-slate-100/10 space-y-3">
              {cart.length > 0 ? (
                cart.map(item => (
                  <div key={item.id} className="pt-3 flex items-start justify-between gap-3 text-sm">
                    <div className="space-y-0.5 max-w-[150px]">
                      <h5 className={`font-bold tracking-tight truncate ${isDark ? 'text-white' : 'text-slate-900'}`}>
                        {item.name}
                      </h5>
                      <span className="text-[10px] text-slate-400 font-mono">
                        ₹{item.price} each
                      </span>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-950 rounded-lg p-0.5 border dark:border-slate-800">
                        <button
                          onClick={() => handleUpdateQuantity(item.id, -1)}
                          className="w-5 h-5 rounded bg-amber-500 text-slate-950 flex items-center justify-center hover:bg-amber-600 transition-colors cursor-pointer"
                        >
                          <FiMinus className="text-[10px]" />
                        </button>
                        <span className="w-5 text-center text-xs font-mono font-bold">
                          {item.quantity}
                        </span>
                        <button
                          onClick={() => handleUpdateQuantity(item.id, 1)}
                          className="w-5 h-5 rounded bg-amber-500 text-slate-950 flex items-center justify-center hover:bg-amber-600 transition-colors cursor-pointer"
                        >
                          <FiPlus className="text-[10px]" />
                        </button>
                      </div>

                      <button
                        onClick={() => handleRemoveFromCart(item.id)}
                        className="text-rose-500 hover:text-rose-600 p-1 cursor-pointer"
                      >
                        <FiX className="text-sm" />
                      </button>
                    </div>

                  </div>
                ))
              ) : (
                <div className="py-12 text-center text-xs text-slate-500 space-y-2">
                  <FiShoppingCart className="text-3xl mx-auto opacity-20 text-slate-400" />
                  <p>Your billing cart is empty.</p>
                  <p className="opacity-60 text-[10px]">Select food products on the left menu to start crafting a receipt.</p>
                </div>
              )}
            </div>

            {/* Pricing Summary */}
            {cart.length > 0 && (
              <div className={`p-4 border-t space-y-2.5 text-xs ${isDark ? 'border-slate-800 bg-slate-950/20' : 'border-slate-100 bg-slate-50'}`}>
                <div className="flex justify-between">
                  <span className="text-slate-400">Subtotal</span>
                  <span className="font-mono font-bold">₹{metrics.subtotal.toLocaleString()}</span>
                </div>
                
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-1.5 cursor-pointer text-slate-400">
                    <input 
                      type="checkbox" 
                      checked={gstEnabled} 
                      onChange={(e) => setGstEnabled(e.target.checked)} 
                      className="rounded accent-amber-500"
                    />
                    <span>GST ({metrics.taxRate}%)</span>
                  </label>
                  <span className="font-mono font-semibold">₹{metrics.gstAmount.toLocaleString()}</span>
                </div>

                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-1.5 cursor-pointer text-slate-400">
                    <input 
                      type="checkbox" 
                      checked={serviceChargeEnabled} 
                      onChange={(e) => setServiceChargeEnabled(e.target.checked)} 
                      className="rounded accent-amber-500"
                    />
                    <span>Service Charge (5%)</span>
                  </label>
                  <span className="font-mono font-semibold">₹{metrics.serviceChargeAmount.toLocaleString()}</span>
                </div>

                <div className="divider"></div>

                <div className="flex justify-between items-center pt-2">
                  <span className="font-bold text-sm">Grand Total</span>
                  <span className="font-mono text-lg font-black text-amber-500">₹{metrics.grandTotal.toLocaleString()}</span>
                </div>

                <button
                  onClick={() => setIsPreviewOpen(true)}
                  className="w-full mt-4 py-3 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black rounded-xl text-sm transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer"
                >
                  <FiDollarSign /> Generate Bill
                </button>
              </div>
            )}

          </div>
        </div>

      </div>

      {/* REUSABLE PREMIUM RECEIPT PREVIEW DIALOG / MODAL */}
      {isPreviewOpen && (
        <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-md flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className={`w-full max-w-4xl rounded-3xl border shadow-2xl overflow-hidden animate-fade-in ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
            
            {/* Modal Header */}
            <div className={`p-5 border-b flex justify-between items-center ${isDark ? 'border-slate-800 bg-slate-950/20' : 'border-slate-100 bg-slate-50'}`}>
              <div className="flex items-center gap-2 text-amber-500">
                <FiDollarSign className="text-xl" />
                <h3 className={`text-lg font-black font-display uppercase tracking-wider ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  Professional Bill Designer
                </h3>
              </div>
              <button 
                onClick={() => setIsPreviewOpen(false)}
                className={`p-1.5 rounded-xl transition-all cursor-pointer hover:text-rose-500 ${isDark ? 'hover:bg-slate-800 text-slate-400' : 'hover:bg-slate-100 text-slate-500'}`}
              >
                <FiX className="text-lg" />
              </button>
            </div>

            {/* Split layout in Modal: Left is Controls/Edit, Right is Receipt representation */}
            <div className="grid grid-cols-1 md:grid-cols-12 divide-y md:divide-y-0 md:divide-x divide-dashed divide-slate-100/10">
              
              {/* LEFT COLUMN: Receipt configuration & live editor (7 cols) */}
              <div className="md:col-span-7 p-6 space-y-6 max-h-[650px] overflow-y-auto">
                <div>
                  <h4 className={`text-xs font-black uppercase tracking-wider mb-2.5 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                    1. Select Order Type & Location
                  </h4>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setOrderType('Table')}
                      className={`p-3.5 rounded-2xl border flex items-center justify-center gap-2 transition-all cursor-pointer font-bold ${
                        orderType === 'Table'
                          ? 'border-amber-500 bg-amber-500/10 text-amber-500'
                          : isDark ? 'border-slate-800 bg-slate-950/40 text-slate-400 hover:border-slate-700' : 'border-slate-200 bg-slate-50 text-slate-500 hover:border-slate-300'
                      }`}
                    >
                      <FiUser /> Seated Table
                    </button>
                    <button
                      type="button"
                      onClick={() => setOrderType('Parcel')}
                      className={`p-3.5 rounded-2xl border flex items-center justify-center gap-2 transition-all cursor-pointer font-bold ${
                        orderType === 'Parcel'
                          ? 'border-amber-500 bg-amber-500/10 text-amber-500'
                          : isDark ? 'border-slate-800 bg-slate-950/40 text-slate-400 hover:border-slate-700' : 'border-slate-200 bg-slate-50 text-slate-500 hover:border-slate-300'
                      }`}
                    >
                      <FiShoppingBag /> Takeaway Parcel
                    </button>
                  </div>
                </div>

                {orderType === 'Table' && (
                  <div className="animate-fade-in space-y-3">
                    <label className={`block text-xs font-bold uppercase tracking-wider ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                      Select or Enter Table Number
                    </label>
                    <div className="flex gap-2">
                      <select
                        value={selectedTableNumber}
                        onChange={(e) => setSelectedTableNumber(e.target.value)}
                        className={`flex-1 p-3 rounded-xl border text-sm focus:outline-none focus:border-amber-500 transition-colors ${
                          isDark 
                            ? 'bg-slate-950 border-slate-800 text-slate-200' 
                            : 'bg-slate-50 border-slate-200 text-slate-800'
                        }`}
                      >
                        <option value="">-- Choose Seated Table --</option>
                        {tables.map(tbl => (
                          <option key={tbl.id} value={tbl.tableName || tbl.tableNo || ''}>
                            {tbl.tableName || tbl.tableNo}
                          </option>
                        ))}
                      </select>
                      
                      {/* Custom input override */}
                      <input
                        type="text"
                        placeholder="Or custom No..."
                        value={selectedTableNumber}
                        onChange={(e) => setSelectedTableNumber(e.target.value)}
                        className={`w-32 p-3 rounded-xl border text-sm focus:outline-none focus:border-amber-500 transition-colors ${
                          isDark 
                            ? 'bg-slate-950 border-slate-800 text-slate-200' 
                            : 'bg-slate-50 border-slate-200 text-slate-800'
                        }`}
                      />
                    </div>
                  </div>
                )}

                <div className="space-y-3">
                  <h4 className={`text-xs font-black uppercase tracking-wider ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                    2. Edit Bill Items & Quantities
                  </h4>
                  
                  <div className={`rounded-2xl border divide-y overflow-hidden max-h-56 overflow-y-auto ${
                    isDark ? 'bg-slate-950 border-slate-800 divide-slate-800/60' : 'bg-slate-50 border-slate-200 divide-slate-200'
                  }`}>
                    {cart.map(item => (
                      <div key={item.id} className="p-3.5 flex justify-between items-center text-xs">
                        <div className="space-y-0.5">
                          <h5 className="font-bold">{item.name}</h5>
                          <span className="font-mono text-slate-500">₹{item.price} each</span>
                        </div>
                        
                        <div className="flex items-center gap-3">
                          <div className="flex items-center gap-1.5 bg-white dark:bg-slate-900 border dark:border-slate-800 rounded-lg p-0.5">
                            <button
                              onClick={() => handleUpdateQuantity(item.id, -1)}
                              className="w-5 h-5 rounded bg-amber-500 text-slate-950 flex items-center justify-center cursor-pointer"
                            >
                              <FiMinus className="text-[10px]" />
                            </button>
                            <span className="w-6 text-center font-mono font-bold">{item.quantity}</span>
                            <button
                              onClick={() => handleUpdateQuantity(item.id, 1)}
                              className="w-5 h-5 rounded bg-amber-500 text-slate-950 flex items-center justify-center cursor-pointer"
                            >
                              <FiPlus className="text-[10px]" />
                            </button>
                          </div>
                          
                          <button
                            onClick={() => handleRemoveFromCart(item.id)}
                            className="text-rose-500 hover:text-rose-600 p-1 cursor-pointer"
                          >
                            <FiTrash2 />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={() => setIsPreviewOpen(false)}
                    className={`w-full py-2.5 rounded-xl text-xs font-black border transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                      isDark 
                        ? 'border-slate-800 hover:border-slate-700 bg-slate-950/40 text-slate-300' 
                        : 'border-slate-200 hover:border-slate-300 bg-slate-50 text-slate-600'
                    }`}
                  >
                    + Add More Menu Items
                  </button>
                </div>

                <div className="space-y-3 pt-3 border-t border-dashed border-slate-100/10">
                  <h4 className={`text-xs font-black uppercase tracking-wider ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                    3. Configure Taxes & Surcharges
                  </h4>
                  <div className="grid grid-cols-2 gap-4">
                    <label className={`p-3 rounded-xl border flex items-center justify-between cursor-pointer ${
                      gstEnabled ? 'border-amber-500/30 bg-amber-500/[0.02]' : 'border-slate-200 dark:border-slate-800'
                    }`}>
                      <span className="text-xs font-bold flex items-center gap-1">
                        <FiPercent className="text-amber-500" /> Apply GST ({metrics.taxRate}%)
                      </span>
                      <input 
                        type="checkbox" 
                        checked={gstEnabled} 
                        onChange={(e) => setGstEnabled(e.target.checked)} 
                        className="rounded accent-amber-500 scale-110"
                      />
                    </label>

                    <label className={`p-3 rounded-xl border flex items-center justify-between cursor-pointer ${
                      serviceChargeEnabled ? 'border-amber-500/30 bg-amber-500/[0.02]' : 'border-slate-200 dark:border-slate-800'
                    }`}>
                      <span className="text-xs font-bold flex items-center gap-1">
                        <FiPercent className="text-amber-500" /> Service Charge ({serviceChargeRate}%)
                      </span>
                      <input 
                        type="checkbox" 
                        checked={serviceChargeEnabled} 
                        onChange={(e) => setServiceChargeEnabled(e.target.checked)} 
                        className="rounded accent-amber-500 scale-110"
                      />
                    </label>
                  </div>
                </div>

              </div>

              {/* RIGHT COLUMN: Realistic Invoice / Receipt Preview (5 cols) */}
              <div className={`md:col-span-5 p-6 flex flex-col justify-between ${isDark ? 'bg-slate-950' : 'bg-slate-50'}`}>
                
                {/* Paper Representation */}
                <div className="bg-white text-slate-900 rounded-2xl p-5 shadow-lg border border-slate-200 max-w-sm mx-auto w-full font-mono text-left text-[11px] leading-relaxed relative">
                  
                  {/* Decorative Header jagged edge mock */}
                  <div className="absolute top-0 inset-x-0 h-1 bg-amber-500 rounded-t-2xl" />

                  {/* Header Details */}
                  <div className="text-center pt-2 pb-3">
                    {currentRest?.logoUrl ? (
                      <img src={currentRest.logoUrl} alt="Logo" className="max-h-12 mx-auto mb-2.5 rounded object-contain" />
                    ) : null}
                    <h5 className="font-bold text-sm tracking-tight">{currentRest?.name || 'EASYDINE RESTAURANT'}</h5>
                    {currentRest?.address && <p className="text-[9px] text-slate-500 mt-0.5">{currentRest.address}</p>}
                    {currentRest?.contact && <p className="text-[9px] text-slate-500">Contact: {currentRest.contact}</p>}
                    <span className="inline-block border border-slate-900 px-3 py-0.5 font-bold uppercase tracking-widest text-[9px] mt-2.5">
                      TAX INVOICE
                    </span>
                  </div>

                  <div className="border-t border-dashed border-slate-300 my-2.5"></div>

                  {/* Metadata Row */}
                  <div className="grid grid-cols-2 gap-1 font-semibold text-[9px] text-slate-600">
                    <div>Bill No: <span className="text-slate-900 font-bold">{billNumber}</span></div>
                    <div className="text-right">Date: {new Date().toLocaleDateString('en-GB')}</div>
                    <div>Type: <span className="text-slate-900 font-bold">{orderType}</span></div>
                    <div className="text-right">Time: {new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}</div>
                    {orderType === 'Table' && (
                      <div className="col-span-2 font-black text-amber-600">
                        Table: {selectedTableNumber || 'Not Chosen'}
                      </div>
                    )}
                  </div>

                  <div className="border-t border-dashed border-slate-300 my-2.5"></div>

                  {/* Receipt Items list */}
                  <div className="space-y-2">
                    <div className="grid grid-cols-12 font-bold text-slate-700 border-b border-slate-200 pb-1.5 mb-1.5 text-[9px]">
                      <div className="col-span-6">Item</div>
                      <div className="col-span-2 text-right">Qty</div>
                      <div className="col-span-2 text-right">Price</div>
                      <div className="col-span-2 text-right">Total</div>
                    </div>

                    {cart.map(item => (
                      <div key={item.id} className="grid grid-cols-12 text-slate-800 py-0.5">
                        <div className="col-span-6 font-bold truncate">{item.name}</div>
                        <div className="col-span-2 text-right">{item.quantity}</div>
                        <div className="col-span-2 text-right">₹{item.price}</div>
                        <div className="col-span-2 text-right font-bold">₹{item.subtotal}</div>
                      </div>
                    ))}
                  </div>

                  <div className="border-t border-dashed border-slate-300 my-3"></div>

                  {/* Pricing Breakdown */}
                  <div className="space-y-1.5 font-medium text-slate-700 text-[10px]">
                    <div className="flex justify-between">
                      <span>Subtotal</span>
                      <span>₹{metrics.subtotal.toFixed(2)}</span>
                    </div>

                    {gstEnabled && (
                      <div className="flex justify-between">
                        <span>GST ({metrics.taxRate}%)</span>
                        <span>₹{metrics.gstAmount.toFixed(2)}</span>
                      </div>
                    )}

                    {serviceChargeEnabled && (
                      <div className="flex justify-between">
                        <span>Service Charge ({serviceChargeRate}%)</span>
                        <span>₹{metrics.serviceChargeAmount.toFixed(2)}</span>
                      </div>
                    )}

                    <div className="border-t border-dashed border-slate-300 pt-2 flex justify-between font-bold text-slate-900 text-xs">
                      <span>GRAND TOTAL</span>
                      <span className="text-amber-600">₹{metrics.grandTotal.toFixed(2)}</span>
                    </div>
                  </div>

                  {/* Thermal tear decoration line */}
                  <div className="border-t border-dashed border-slate-300 mt-5 mb-2.5"></div>
                  <div className="text-center text-[9px] text-slate-400 italic">
                    Power by EasyDine • Thank you!
                  </div>
                </div>

                {/* Final Interactive actions footer */}
                <div className="space-y-2.5 pt-6 border-t border-dashed border-slate-100/10 w-full">
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => printReceipt({
                        billNumber,
                        orderType,
                        tableNumber: selectedTableNumber,
                        items: cart,
                        subtotal: metrics.subtotal,
                        gstEnabled,
                        gstRate: metrics.taxRate,
                        gstAmount: metrics.gstAmount,
                        serviceChargeEnabled,
                        serviceChargeRate,
                        serviceChargeAmount: metrics.serviceChargeAmount,
                        grandTotal: metrics.grandTotal,
                        date: new Date().toLocaleDateString('en-GB'),
                        time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
                      })}
                      className={`py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer border ${
                        isDark 
                          ? 'border-slate-800 bg-slate-900 hover:bg-slate-800 text-white' 
                          : 'border-slate-200 bg-white hover:bg-slate-100 text-slate-800'
                      }`}
                    >
                      <FiPrinter /> Print Receipt
                    </button>
                    <button
                      onClick={() => downloadPDFReceipt({
                        billNumber,
                        orderType,
                        tableNumber: selectedTableNumber,
                        items: cart,
                        subtotal: metrics.subtotal,
                        gstEnabled,
                        gstRate: metrics.taxRate,
                        gstAmount: metrics.gstAmount,
                        serviceChargeEnabled,
                        serviceChargeRate,
                        serviceChargeAmount: metrics.serviceChargeAmount,
                        grandTotal: metrics.grandTotal,
                        date: new Date().toLocaleDateString('en-GB'),
                        time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
                      })}
                      className={`py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer border ${
                        isDark 
                          ? 'border-slate-800 bg-slate-900 hover:bg-slate-800 text-white' 
                          : 'border-slate-200 bg-white hover:bg-slate-100 text-slate-800'
                      }`}
                    >
                      <FiDownload /> Download PDF
                    </button>
                  </div>

                  <button
                    onClick={handleSaveBill}
                    disabled={isSaving || cart.length === 0 || (orderType === 'Table' && !selectedTableNumber)}
                    className="w-full py-3 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-40 disabled:cursor-not-allowed text-slate-950 font-black rounded-xl text-xs tracking-wide transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer"
                  >
                    {isSaving ? 'Processing...' : (
                      <>
                        <FiCheck className="stroke-[3px]" /> Save & Close Bill
                      </>
                    )}
                  </button>
                </div>

              </div>

            </div>

          </div>
        </div>
      )}

    </div>
  );
}

// ── REUSABLE MODAL TRIGGERABLE FROM OUTSIDE ──────────────────────
export function ReusableBillPreviewModal({
  isOpen,
  onClose,
  initialItems = [],
  tableNumber,
  currentRest,
  isDark,
  tables = [],
  orders = [],
  onShowStatus
}) {
  const [billNumber, setBillNumber] = useState('ED-1001');
  const [orderType, setOrderType] = useState('Table');
  const [selectedTableNumber, setSelectedTableNumber] = useState(tableNumber || '');
  const [items, setItems] = useState(initialItems || []);
  const [gstEnabled, setGstEnabled] = useState(true);
  const [serviceChargeEnabled, setServiceChargeEnabled] = useState(false);
  const [serviceChargeRate, setServiceChargeRate] = useState(5);
  const [isSaving, setIsSaving] = useState(false);

  // Sync initial state props
  useEffect(() => {
    if (initialItems) {
      setItems(initialItems);
    }
  }, [initialItems]);

  useEffect(() => {
    if (tableNumber) {
      setSelectedTableNumber(tableNumber);
    }
  }, [tableNumber]);

  // Generate sequence
  const fetchNextBillNumber = async () => {
    if (!currentRest?.id) return;
    try {
      const billsRef = collection(db, 'restaurants', currentRest.id, 'bills');
      const q = query(billsRef, orderBy('createdAt', 'desc'), limit(1));
      const snap = await getDocs(q);
      
      if (!snap.empty) {
        const lastBill = snap.docs[0].data();
        const lastNumStr = lastBill.billNumber || 'ED-1000';
        const match = lastNumStr.match(/\d+/);
        if (match) {
          const nextNum = parseInt(match[0], 10) + 1;
          setBillNumber(`ED-${nextNum}`);
        } else {
          setBillNumber('ED-1001');
        }
      } else {
        setBillNumber('ED-1001');
      }
    } catch (err) {
      console.error("Error: ", err);
      setBillNumber(`ED-${Math.floor(1000 + Math.random() * 9000)}`);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchNextBillNumber();
    }
  }, [isOpen]);

  const handleUpdateQuantity = (productId, delta) => {
    setItems(prev => {
      return prev.map(item => {
        if (item.id === productId) {
          const newQty = item.quantity + delta;
          if (newQty <= 0) return null;
          return { ...item, quantity: newQty, subtotal: newQty * item.price };
        }
        return item;
      }).filter(Boolean);
    });
  };

  const handleRemoveItem = (productId) => {
    setItems(prev => prev.filter(item => item.id !== productId));
  };

  const subtotal = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const taxRate = currentRest?.taxRate ? Number(currentRest.taxRate) : 5;
  const gstAmount = gstEnabled ? (subtotal * taxRate) / 100 : 0;
  const serviceChargeAmount = serviceChargeEnabled ? (subtotal * serviceChargeRate) / 100 : 0;
  const grandTotal = subtotal + gstAmount + serviceChargeAmount;

  const downloadPDF = async () => {
    try {
      if (onShowStatus) {
        onShowStatus("Preparing PDF...");
      }
      const base64Font = await getRobotoFontBase64();
      const pdfFont = base64Font ? 'Roboto' : 'helvetica';
      const currencySymbol = base64Font ? '₹' : 'Rs.';

      const doc = new jsPDF({ unit: 'mm', format: 'a4' });

      if (base64Font) {
        doc.addFileToVFS('Roboto-Regular.ttf', base64Font);
        doc.addFont('Roboto-Regular.ttf', 'Roboto', 'normal');
        doc.addFont('Roboto-Regular.ttf', 'Roboto', 'bold');
        doc.addFont('Roboto-Regular.ttf', 'Roboto', 'italic');
        doc.setFont('Roboto', 'normal');
      } else {
        doc.setFont('helvetica', 'normal');
      }

      doc.setFont(pdfFont, 'normal');
      doc.setDrawColor(220, 220, 220);
      doc.setLineWidth(0.5);
      doc.line(10, 10, 200, 10);
      
      doc.setFontSize(22);
      doc.setFont(pdfFont, 'bold');
      doc.setTextColor(245, 158, 11);
      doc.text(currentRest?.name || 'EASYDINE', 15, 22);

      doc.setFontSize(10);
      doc.setFont(pdfFont, 'normal');
      doc.setTextColor(100, 100, 100);
      if (currentRest?.address) doc.text(currentRest.address, 15, 28);
      if (currentRest?.contact) doc.text(`Contact: ${currentRest.contact}`, 15, 33);

      doc.setFontSize(16);
      doc.setFont(pdfFont, 'bold');
      doc.setTextColor(30, 41, 59);
      doc.text("TAX INVOICE", 140, 22);

      doc.setFontSize(9);
      doc.setFont(pdfFont, 'normal');
      doc.setTextColor(80, 80, 80);
      doc.text(`Bill No: ${billNumber}`, 140, 28);
      doc.text(`Date: ${new Date().toLocaleDateString('en-GB')}`, 140, 33);
      doc.text(`Type: ${orderType}`, 140, 38);
      if (orderType === 'Table') {
        doc.text(`Table: ${selectedTableNumber || 'N/A'}`, 140, 43);
      }

      doc.line(10, 48, 200, 48);

      let y = 56;
      doc.setFont(pdfFont, 'bold');
      doc.setFontSize(10);
      doc.setTextColor(30, 41, 59);
      doc.text("Item Name", 15, y);
      doc.text("Price", 110, y, { align: "right" });
      doc.text("Qty", 140, y, { align: "right" });
      doc.text("Total", 185, y, { align: "right" });

      doc.line(10, y + 3, 200, y + 3);
      y += 10;

      doc.setFont(pdfFont, 'normal');
      doc.setFontSize(9.5);
      doc.setTextColor(60, 60, 60);

      items.forEach((item) => {
        const name = item.name.length > 45 ? item.name.substring(0, 42) + '...' : item.name;
        doc.text(name, 15, y);
        doc.text(`${currencySymbol}${item.price.toFixed(2)}`, 110, y, { align: "right" });
        doc.text(String(item.quantity), 140, y, { align: "right" });
        doc.text(`${currencySymbol}${item.subtotal.toFixed(2)}`, 185, y, { align: "right" });
        y += 8;
      });

      doc.line(10, y, 200, y);
      y += 8;

      const summaryX = 135;
      doc.setFontSize(10);
      doc.setTextColor(100, 100, 100);
      doc.text("Subtotal:", summaryX, y);
      doc.setFont(pdfFont, 'bold');
      doc.text(`${currencySymbol}${subtotal.toFixed(2)}`, 185, y, { align: "right" });
      y += 6;

      if (gstEnabled) {
        doc.setFont(pdfFont, 'normal');
        doc.text(`GST (${taxRate}%):`, summaryX, y);
        doc.setFont(pdfFont, 'bold');
        doc.text(`${currencySymbol}${gstAmount.toFixed(2)}`, 185, y, { align: "right" });
        y += 6;
      }

      if (serviceChargeEnabled) {
        doc.setFont(pdfFont, 'normal');
        doc.text(`Service Charge (${serviceChargeRate}%):`, summaryX, y);
        doc.setFont(pdfFont, 'bold');
        doc.text(`${currencySymbol}${serviceChargeAmount.toFixed(2)}`, 185, y, { align: "right" });
        y += 6;
      }

      doc.line(125, y, 200, y);
      y += 8;

      doc.setFontSize(13);
      doc.setFont(pdfFont, 'bold');
      doc.setTextColor(245, 158, 11);
      doc.text("GRAND TOTAL:", summaryX, y);
      doc.text(`${currencySymbol}${grandTotal.toFixed(2)}`, 185, y, { align: "right" });

      y += 15;
      doc.setDrawColor(240, 240, 240);
      doc.line(10, y, 200, y);
      
      y += 8;
      doc.setFont(pdfFont, 'italic');
      doc.setFontSize(9);
      doc.setTextColor(140, 140, 140);
      doc.text("Thank you for your business! Please visit again.", 105, y, { align: "center" });

      if (currentRest?.showPoweredBy) {
        y += 6;
        doc.setFont(pdfFont, 'normal');
        doc.setFontSize(8);
        doc.setTextColor(160, 160, 160);
        doc.text("Powered by EasyDine", 105, y, { align: "center" });
      }

      doc.save(`${billNumber}.pdf`);
      if (onShowStatus) {
        onShowStatus("PDF Downloaded successfully!");
      }
    } catch (err) {
      console.error("PDF generation failed: ", err);
    }
  };

  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert("Please allow popups to print.");
      return;
    }

    const dateStr = new Date().toLocaleDateString('en-GB');
    const timeStr = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

    printWindow.document.write(`
      <html>
        <head>
          <title>Print Bill - ${billNumber}</title>
          <style>
            @media print {
              body { margin: 0; padding: 15px; font-family: 'Courier New', Courier, monospace; }
            }
            body {
              font-family: 'Courier New', Courier, monospace;
              max-width: 350px;
              margin: 0 auto;
              padding: 10px;
              color: #000;
              background: #fff;
            }
            .text-center { text-align: center; }
            .bold { font-weight: bold; }
            .divider { border-top: 1px dashed #000; margin: 8px 0; }
            .flex { display: flex; justify-content: space-between; }
            .items-table { width: 100%; border-collapse: collapse; margin: 8px 0; }
            .items-table th, .items-table td { text-align: left; padding: 4px 0; font-size: 12px; }
            .items-table th.right, .items-table td.right { text-align: right; }
            .grand-total { font-size: 16px; font-weight: bold; margin-top: 8px; }
          </style>
        </head>
        <body>
          <div class="text-center">
            ${currentRest?.logoUrl ? `<img src="${currentRest.logoUrl}" style="max-height: 40px; margin-bottom: 4px; border-radius: 4px;" /><br/>` : ''}
            <span class="bold" style="font-size: 16px;">${currentRest?.name || 'EASYDINE'}</span><br/>
            ${currentRest?.address ? `<span style="font-size: 10px;">${currentRest.address}</span><br/>` : ''}
            ${currentRest?.contact ? `<span style="font-size: 10px;">Tel: ${currentRest.contact}</span><br/>` : ''}
            <span class="bold" style="font-size: 12px; display: inline-block; margin-top: 4px; border: 1px solid #000; padding: 1px 6px;">TAX INVOICE</span>
          </div>
          
          <div class="divider" style="margin-top: 12px;"></div>
          <div class="flex" style="font-size: 11px;">
            <div>Bill No: <span class="bold">${billNumber}</span></div>
            <div>Date: ${dateStr}</div>
          </div>
          <div class="flex" style="font-size: 11px;">
            <div>Type: <span class="bold">${orderType}</span></div>
            <div>Time: ${timeStr}</div>
          </div>
          ${orderType === 'Table' ? `<div style="font-size: 11px;">Table: <span class="bold">${selectedTableNumber || 'N/A'}</span></div>` : ''}
          <div class="divider"></div>
          
          <table class="items-table">
            <thead>
              <tr>
                <th>Item</th>
                <th class="right">Qty</th>
                <th class="right">Price</th>
                <th class="right">Total</th>
              </tr>
            </thead>
            <tbody>
              ${items.map(it => `
                <tr>
                  <td>${it.name}</td>
                  <td class="right">${it.quantity}</td>
                  <td class="right">₹${it.price.toFixed(2)}</td>
                  <td class="right">₹${it.subtotal.toFixed(2)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
          
          <div class="divider"></div>
          <div class="flex" style="font-size: 11px;">
            <span>Subtotal:</span>
            <span>₹${subtotal.toFixed(2)}</span>
          </div>
          ${gstEnabled ? `
          <div class="flex" style="font-size: 11px;">
            <span>GST (${taxRate}%):</span>
            <span>₹${gstAmount.toFixed(2)}</span>
          </div>
          ` : ''}
          ${serviceChargeEnabled ? `
          <div class="flex" style="font-size: 11px;">
            <span>Service Charge (${serviceChargeRate}%):</span>
            <span>₹${serviceChargeAmount.toFixed(2)}</span>
          </div>
          ` : ''}
          
          <div class="divider"></div>
          <div class="flex grand-total">
            <span>GRAND TOTAL:</span>
            <span>₹${grandTotal.toFixed(2)}</span>
          </div>
          <div class="divider" style="border-top: 2px double #000; margin-top: 4px;"></div>
          
          <div class="text-center" style="font-size: 10px; margin-top: 15px;">
            <span>Thank you for dining with us!</span><br/>
            <span style="font-weight: bold;">Visit Again</span>
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 300);
  };

  const handleSave = async () => {
    if (!currentRest?.id) return;
    if (items.length === 0) {
      alert("Bill is empty.");
      return;
    }
    if (orderType === 'Table' && !selectedTableNumber) {
      alert("Please select a table.");
      return;
    }

    setIsSaving(true);
    try {
      const now = new Date();
      const dateStr = now.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
      const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });

      const billData = {
        billNumber,
        orderType,
        tableNumber: orderType === 'Table' ? selectedTableNumber : null,
        items,
        subtotal,
        gstEnabled,
        gstRate: taxRate,
        gstAmount,
        serviceChargeEnabled,
        serviceChargeRate,
        serviceChargeAmount,
        grandTotal,
        date: dateStr,
        time: timeStr,
        createdAt: now.toISOString()
      };

      // Save document
      await addDoc(collection(db, 'restaurants', currentRest.id, 'bills'), billData);

      // If Table is selected, mark all active orders for that table as completed
      if (orderType === 'Table' && selectedTableNumber) {
        const matchingTable = tables.find(t => 
          String(t.tableName || t.tableNo || '') === String(selectedTableNumber) || 
          t.id === selectedTableNumber
        );
        if (matchingTable) {
          const activeOrders = orders.filter(o => 
            o.tableId === matchingTable.id && 
            ['pending', 'accepted', 'preparing', 'ready', 'served'].includes(o.status)
          );

          if (activeOrders.length > 0) {
            const batch = writeBatch(db);
            activeOrders.forEach(o => {
              const orderRef = doc(db, 'restaurants', currentRest.id, 'orders', o.id);
              batch.update(orderRef, { status: 'completed' });
            });
            await batch.commit();
          }
        }
      }

      if (onShowStatus) {
        onShowStatus(`Bill ${billNumber} saved successfully!`);
      }

      onClose();
    } catch (err) {
      console.error("Save failed: ", err);
      alert("Failed to save bill.");
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-md flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className={`w-full max-w-4xl rounded-3xl border shadow-2xl overflow-hidden animate-fade-in ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
        
        {/* Header */}
        <div className={`p-5 border-b flex justify-between items-center ${isDark ? 'border-slate-800 bg-slate-950/20' : 'border-slate-100 bg-slate-50'}`}>
          <div className="flex items-center gap-2 text-amber-500">
            <FiDollarSign className="text-xl animate-pulse" />
            <h3 className={`text-lg font-black font-display uppercase tracking-wider ${isDark ? 'text-white' : 'text-slate-900'}`}>
              Table Bill Creator
            </h3>
          </div>
          <button 
            onClick={onClose}
            className={`p-1.5 rounded-xl transition-all cursor-pointer hover:text-rose-500 ${isDark ? 'hover:bg-slate-800 text-slate-400' : 'hover:bg-slate-100 text-slate-500'}`}
          >
            <FiX className="text-lg" />
          </button>
        </div>

        {/* Content columns */}
        <div className="grid grid-cols-1 md:grid-cols-12 divide-y md:divide-y-0 md:divide-x divide-dashed divide-slate-100/10">
          
          {/* Controls (7 cols) */}
          <div className="md:col-span-7 p-6 space-y-6 max-h-[600px] overflow-y-auto">
            <div>
              <h4 className={`text-xs font-black uppercase tracking-wider mb-2.5 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                1. Order Settings
              </h4>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setOrderType('Table')}
                  className={`p-3 rounded-xl border flex items-center justify-center gap-2 transition-all cursor-pointer font-bold ${
                    orderType === 'Table'
                      ? 'border-amber-500 bg-amber-500/10 text-amber-500'
                      : isDark ? 'border-slate-800 bg-slate-950/40 text-slate-400' : 'border-slate-200 bg-slate-50 text-slate-500'
                  }`}
                >
                  <FiUser /> Seated Table
                </button>
                <button
                  type="button"
                  onClick={() => setOrderType('Parcel')}
                  className={`p-3 rounded-xl border flex items-center justify-center gap-2 transition-all cursor-pointer font-bold ${
                    orderType === 'Parcel'
                      ? 'border-amber-500 bg-amber-500/10 text-amber-500'
                      : isDark ? 'border-slate-800 bg-slate-950/40 text-slate-400' : 'border-slate-200 bg-slate-50 text-slate-500'
                  }`}
                >
                  <FiShoppingBag /> Takeaway Parcel
                </button>
              </div>
            </div>

            {orderType === 'Table' && (
              <div className="space-y-1">
                <label className={`block text-xs font-bold uppercase tracking-wider ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                  Table Number
                </label>
                <input
                  type="text"
                  disabled
                  value={
                    (selectedTableNumber || '').toLowerCase().startsWith('table') || (selectedTableNumber || '').toLowerCase().startsWith('counter')
                      ? selectedTableNumber
                      : `Table ${selectedTableNumber}`
                  }
                  className={`w-full p-3 rounded-xl border text-sm font-semibold opacity-85 ${
                    isDark ? 'bg-slate-950 border-slate-800 text-slate-400' : 'bg-slate-100 border-slate-200 text-slate-600'
                  }`}
                />
              </div>
            )}

            <div className="space-y-3">
              <h4 className={`text-xs font-black uppercase tracking-wider ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                2. Live Order Items
              </h4>
              
              <div className={`rounded-xl border divide-y overflow-hidden max-h-56 overflow-y-auto ${
                isDark ? 'bg-slate-950 border-slate-800 divide-slate-800/60' : 'bg-slate-50 border-slate-200 divide-slate-200'
              }`}>
                {items.map(item => (
                  <div key={item.id} className="p-3 flex justify-between items-center text-xs">
                    <div className="space-y-0.5">
                      <h5 className="font-bold">{item.name}</h5>
                      <span className="font-mono text-slate-500">₹{item.price} each</span>
                    </div>
                    
                    <div className="flex items-center gap-2.5">
                      <div className="flex items-center gap-1.5 bg-white dark:bg-slate-900 border dark:border-slate-800 rounded-lg p-0.5">
                        <button
                          onClick={() => handleUpdateQuantity(item.id, -1)}
                          className="w-5 h-5 rounded bg-amber-500 text-slate-950 flex items-center justify-center cursor-pointer"
                        >
                          <FiMinus className="text-[10px]" />
                        </button>
                        <span className="w-6 text-center font-mono font-bold">{item.quantity}</span>
                        <button
                          onClick={() => handleUpdateQuantity(item.id, 1)}
                          className="w-5 h-5 rounded bg-amber-500 text-slate-950 flex items-center justify-center cursor-pointer"
                        >
                          <FiPlus className="text-[10px]" />
                        </button>
                      </div>
                      
                      <button
                        onClick={() => handleRemoveItem(item.id)}
                        className="text-rose-500 hover:text-rose-600 p-1 cursor-pointer"
                      >
                        <FiTrash2 />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-3 pt-3 border-t border-dashed border-slate-100/10">
              <h4 className={`text-xs font-black uppercase tracking-wider ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                3. Configure Taxes & Surcharges
              </h4>
              <div className="grid grid-cols-2 gap-4">
                <label className={`p-3 rounded-xl border flex items-center justify-between cursor-pointer ${
                  gstEnabled ? 'border-amber-500/30 bg-amber-500/[0.02]' : 'border-slate-200 dark:border-slate-800'
                }`}>
                  <span className="text-xs font-bold flex items-center gap-1">
                    <FiPercent className="text-amber-500" /> Apply GST ({taxRate}%)
                  </span>
                  <input 
                    type="checkbox" 
                    checked={gstEnabled} 
                    onChange={(e) => setGstEnabled(e.target.checked)} 
                    className="rounded accent-amber-500 scale-110"
                  />
                </label>

                <label className={`p-3 rounded-xl border flex items-center justify-between cursor-pointer ${
                  serviceChargeEnabled ? 'border-amber-500/30 bg-amber-500/[0.02]' : 'border-slate-200 dark:border-slate-800'
                }`}>
                  <span className="text-xs font-bold flex items-center gap-1">
                    <FiPercent className="text-amber-500" /> Service Charge ({serviceChargeRate}%)
                  </span>
                  <input 
                    type="checkbox" 
                    checked={serviceChargeEnabled} 
                    onChange={(e) => setServiceChargeEnabled(e.target.checked)} 
                    className="rounded accent-amber-500 scale-110"
                  />
                </label>
              </div>
            </div>

          </div>

          {/* Receipt View (5 cols) */}
          <div className={`md:col-span-5 p-6 flex flex-col justify-between ${isDark ? 'bg-slate-950' : 'bg-slate-50'}`}>
            
            <div className="bg-white text-slate-900 rounded-2xl p-5 shadow-lg border border-slate-200 max-w-sm mx-auto w-full font-mono text-left text-[11px] leading-relaxed relative">
              <div className="absolute top-0 inset-x-0 h-1 bg-amber-500 rounded-t-2xl" />
              
              <div className="text-center pt-2 pb-3">
                {currentRest?.logoUrl && <img src={currentRest.logoUrl} alt="Logo" className="max-h-12 mx-auto mb-2.5 rounded object-contain" />}
                <h5 className="font-bold text-sm tracking-tight">{currentRest?.name || 'EASYDINE'}</h5>
                {currentRest?.address && <p className="text-[9px] text-slate-500 mt-0.5">{currentRest.address}</p>}
                {currentRest?.contact && <p className="text-[9px] text-slate-500">Contact: {currentRest.contact}</p>}
                <span className="inline-block border border-slate-900 px-3 py-0.5 font-bold uppercase tracking-widest text-[9px] mt-2.5">
                  TAX INVOICE
                </span>
              </div>

              <div className="border-t border-dashed border-slate-300 my-2.5" />

              <div className="grid grid-cols-2 gap-1 font-semibold text-[9px] text-slate-600">
                <div>Bill No: <span className="text-slate-900 font-bold">{billNumber}</span></div>
                <div className="text-right">Date: {new Date().toLocaleDateString('en-GB')}</div>
                <div>Type: <span className="text-slate-900 font-bold">{orderType}</span></div>
                <div className="text-right">Time: {new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}</div>
                {orderType === 'Table' && (
                  <div className="col-span-2 font-black text-amber-600">
                    Table: {selectedTableNumber || 'N/A'}
                  </div>
                )}
              </div>

              <div className="border-t border-dashed border-slate-300 my-2.5" />

              <div className="space-y-2">
                <div className="grid grid-cols-12 font-bold text-slate-700 border-b border-slate-200 pb-1.5 mb-1.5 text-[9px]">
                  <div className="col-span-6">Item</div>
                  <div className="col-span-2 text-right">Qty</div>
                  <div className="col-span-2 text-right">Price</div>
                  <div className="col-span-2 text-right">Total</div>
                </div>

                {items.map(it => (
                  <div key={it.id} className="grid grid-cols-12 text-slate-800 py-0.5 animate-fade-in">
                    <div className="col-span-6 font-bold truncate">{it.name}</div>
                    <div className="col-span-2 text-right">{it.quantity}</div>
                    <div className="col-span-2 text-right">₹{it.price}</div>
                    <div className="col-span-2 text-right font-bold">₹{it.subtotal}</div>
                  </div>
                ))}
              </div>

              <div className="border-t border-dashed border-slate-300 my-3" />

              <div className="space-y-1.5 font-medium text-slate-700 text-[10px]">
                <div className="flex justify-between">
                  <span>Subtotal</span>
                  <span>₹{subtotal.toFixed(2)}</span>
                </div>

                {gstEnabled && (
                  <div className="flex justify-between">
                    <span>GST ({taxRate}%)</span>
                    <span>₹{gstAmount.toFixed(2)}</span>
                  </div>
                )}

                {serviceChargeEnabled && (
                  <div className="flex justify-between">
                    <span>Service Charge ({serviceChargeRate}%)</span>
                    <span>₹{serviceChargeAmount.toFixed(2)}</span>
                  </div>
                )}

                <div className="border-t border-dashed border-slate-300 pt-2 flex justify-between font-bold text-slate-900 text-xs">
                  <span>GRAND TOTAL</span>
                  <span className="text-amber-600 font-black">₹{grandTotal.toFixed(2)}</span>
                </div>
              </div>

              <div className="border-t border-dashed border-slate-300 mt-5 mb-2.5" />
              <div className="text-center text-[9px] text-slate-400 italic">
                Power by EasyDine • Thank you!
              </div>
            </div>

            <div className="space-y-2.5 pt-6 border-t border-dashed border-slate-100/10 w-full">
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={handlePrint}
                  className={`py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer border ${
                    isDark ? 'border-slate-800 bg-slate-900 text-white hover:bg-slate-800' : 'border-slate-200 bg-white text-slate-800 hover:bg-slate-100'
                  }`}
                >
                  <FiPrinter /> Print Receipt
                </button>
                <button
                  onClick={downloadPDF}
                  className={`py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer border ${
                    isDark ? 'border-slate-800 bg-slate-900 text-white hover:bg-slate-800' : 'border-slate-200 bg-white text-slate-800 hover:bg-slate-100'
                  }`}
                >
                  <FiDownload /> Download PDF
                </button>
              </div>

              <button
                onClick={handleSave}
                disabled={isSaving || items.length === 0 || (orderType === 'Table' && !selectedTableNumber)}
                className="w-full py-3 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-40 disabled:cursor-not-allowed text-slate-950 font-black rounded-xl text-xs tracking-wide transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer"
              >
                {isSaving ? 'Processing...' : (
                  <>
                    <FiCheck className="stroke-[3px]" /> Save & Close Bill
                  </>
                )}
              </button>
            </div>

          </div>

        </div>

      </div>
    </div>
  );
}
