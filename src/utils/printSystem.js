/**
 * EasyDine Printing System
 * Provides 58mm Thermal, 80mm Thermal, and A4 Tax Invoice templates
 * with customizable restaurant preferences.
 */

export function generatePrintHTML(billData, currentRest, layoutOverride = null) {
  const layout = layoutOverride || currentRest?.printLayout || '80mm';
  const includeLogo = currentRest?.includeLogoInPrint ?? true;
  const includePoweredBy = currentRest?.includePoweredByInPrint ?? (currentRest?.showPoweredBy ?? true);

  const logoHtml = (includeLogo && currentRest?.logoUrl) 
    ? `<img src="${currentRest.logoUrl}" class="brand-logo" alt="Logo" /><br/>` 
    : '';
    
  const poweredByHtml = includePoweredBy 
    ? `<div class="powered-by">Powered by EasyDine</div>` 
    : '';

  const dateStr = billData.date || new Date().toLocaleDateString('en-GB');
  const timeStr = billData.time || new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
  const items = billData.items || [];
  const subtotal = billData.subtotal || 0;
  const discount = billData.discount || billData.discountAmount || 0;
  const gstEnabled = billData.gstEnabled ?? true;
  const gstRate = billData.gstRate ?? billData.taxRate ?? 5;
  const gstAmount = billData.gstAmount ?? billData.taxAmount ?? 0;
  const serviceChargeEnabled = billData.serviceChargeEnabled ?? false;
  const serviceChargeRate = billData.serviceChargeRate ?? 5;
  const serviceChargeAmount = billData.serviceChargeAmount ?? 0;
  const grandTotal = billData.grandTotal ?? 0;

  if (layout === 'a4') {
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>Tax Invoice - ${billData.billNumber || 'Bill'}</title>
          <style>
            @page { size: A4; margin: 15mm; }
            * { box-sizing: border-box; }
            body {
              font-family: system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
              color: #0f172a;
              background: #fff;
              margin: 0 auto;
              padding: 24px;
              max-width: 800px;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
            .header-container {
              display: flex;
              justify-content: space-between;
              align-items: flex-start;
              border-bottom: 2px solid #e2e8f0;
              padding-bottom: 20px;
              margin-bottom: 20px;
            }
            .brand-section { display: flex; align-items: center; gap: 16px; }
            .brand-logo { max-height: 56px; max-width: 140px; object-fit: contain; border-radius: 6px; }
            .brand-title { margin: 0 0 4px 0; font-size: 22px; font-weight: 800; color: #0f172a; letter-spacing: -0.5px; }
            .brand-sub { margin: 0; font-size: 12px; color: #64748b; line-height: 1.4; }
            .invoice-tag {
              background: #f8fafc;
              border: 1px solid #cbd5e1;
              padding: 8px 18px;
              border-radius: 8px;
              text-align: right;
            }
            .invoice-tag h2 { margin: 0; font-size: 18px; font-weight: 800; color: #0f172a; letter-spacing: 0.5px; }
            .invoice-tag p { margin: 2px 0 0 0; font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase; }
            
            .meta-grid {
              display: grid;
              grid-template-columns: repeat(2, 1fr);
              gap: 12px 24px;
              background: #f8fafc;
              border: 1px solid #e2e8f0;
              border-radius: 8px;
              padding: 14px 18px;
              margin-bottom: 24px;
              font-size: 13px;
            }
            .meta-row { display: flex; justify-content: space-between; }
            .meta-label { color: #64748b; font-weight: 500; }
            .meta-val { font-weight: 700; color: #0f172a; }
            
            .items-table {
              width: 100%;
              border-collapse: collapse;
              margin-bottom: 24px;
            }
            .items-table th {
              background: #0f172a;
              color: #ffffff;
              text-align: left;
              padding: 10px 14px;
              font-size: 12px;
              font-weight: 700;
              text-transform: uppercase;
              letter-spacing: 0.5px;
            }
            .items-table th.right, .items-table td.right { text-align: right; }
            .items-table td {
              padding: 12px 14px;
              border-bottom: 1px solid #e2e8f0;
              font-size: 13px;
              color: #334155;
            }
            .summary-wrap {
              display: flex;
              justify-content: flex-end;
              margin-bottom: 24px;
            }
            .summary-box { width: 300px; font-size: 13px; }
            .summary-row { display: flex; justify-content: space-between; padding: 6px 0; color: #475569; }
            .summary-row.discount { color: #059669; font-weight: 700; }
            .summary-row.total {
              font-size: 16px;
              font-weight: 800;
              color: #0f172a;
              border-top: 2px solid #0f172a;
              border-bottom: 2px double #0f172a;
              padding: 10px 0;
              margin-top: 6px;
            }
            .footer-wrap {
              text-align: center;
              border-top: 1px solid #e2e8f0;
              padding-top: 20px;
              margin-top: 30px;
              font-size: 12px;
              color: #64748b;
            }
            .powered-by { font-size: 10px; color: #94a3b8; margin-top: 8px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; }
          </style>
        </head>
        <body>
          <div class="header-container">
            <div class="brand-section">
              ${(includeLogo && currentRest?.logoUrl) ? `<img src="${currentRest.logoUrl}" class="brand-logo" alt="Logo" />` : ''}
              <div>
                <h1 class="brand-title">${currentRest?.name || 'EASYDINE'}</h1>
                ${currentRest?.address ? `<p class="brand-sub">${currentRest.address}</p>` : ''}
                ${currentRest?.contact ? `<p class="brand-sub">Phone: ${currentRest.contact}</p>` : ''}
              </div>
            </div>
            <div class="invoice-tag">
              <h2>TAX INVOICE</h2>
              <p>Original Copy</p>
            </div>
          </div>

          <div class="meta-grid">
            <div class="meta-row"><span class="meta-label">Invoice Number:</span><span class="meta-val">${billData.billNumber || 'N/A'}</span></div>
            <div class="meta-row"><span class="meta-label">Date:</span><span class="meta-val">${dateStr}</span></div>
            <div class="meta-row"><span class="meta-label">Order Type:</span><span class="meta-val">${billData.orderType || 'N/A'}</span></div>
            <div class="meta-row"><span class="meta-label">Time:</span><span class="meta-val">${timeStr}</span></div>
            ${billData.orderType === 'Table' ? `<div class="meta-row"><span class="meta-label">Table Number:</span><span class="meta-val">${billData.tableNumber || 'N/A'}</span></div>` : ''}
          </div>

          <table class="items-table">
            <thead>
              <tr>
                <th style="width: 45%;">Item Description</th>
                <th class="right" style="width: 15%;">Qty</th>
                <th class="right" style="width: 20%;">Price</th>
                <th class="right" style="width: 20%;">Amount</th>
              </tr>
            </thead>
            <tbody>
              ${items.map(it => `
                <tr>
                  <td style="font-weight: 600;">${it.name}</td>
                  <td class="right">${it.quantity}</td>
                  <td class="right">₹${Number(it.price).toFixed(2)}</td>
                  <td class="right" style="font-weight: 700;">₹${Number(it.subtotal || (it.price * it.quantity)).toFixed(2)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>

          <div class="summary-wrap">
            <div class="summary-box">
              <div class="summary-row">
                <span>Subtotal:</span>
                <span>₹${subtotal.toFixed(2)}</span>
              </div>
              ${discount > 0 ? `
                <div class="summary-row discount">
                  <span>Coupon Discount:</span>
                  <span>-₹${discount.toFixed(2)}</span>
                </div>
              ` : ''}
              ${gstEnabled ? `
                <div class="summary-row">
                  <span>GST (${gstRate}%):</span>
                  <span>₹${gstAmount.toFixed(2)}</span>
                </div>
              ` : ''}
              ${serviceChargeEnabled ? `
                <div class="summary-row">
                  <span>Service Charge (${serviceChargeRate}%):</span>
                  <span>₹${serviceChargeAmount.toFixed(2)}</span>
                </div>
              ` : ''}
              <div class="summary-row total">
                <span>Grand Total Paid:</span>
                <span>₹${grandTotal.toFixed(2)}</span>
              </div>
            </div>
          </div>

          <div class="footer-wrap">
            <p style="margin: 0 0 4px 0; font-weight: 700; color: #334155;">Thank you for dining with us!</p>
            <p style="margin: 0; font-size: 11px;">Please visit again.</p>
            ${poweredByHtml}
          </div>
        </body>
      </html>
    `;
  }

  // Thermal Templates (58mm and 80mm)
  const is58 = layout === '58mm';
  const paperWidth = is58 ? '58mm' : '80mm';
  const fontSize = is58 ? '10px' : '11px';
  const headerFontSize = is58 ? '14px' : '16px';
  const totalFontSize = is58 ? '13px' : '15px';
  const logoMaxHeight = is58 ? '32px' : '42px';
  const padding = is58 ? '2mm 1mm' : '4mm 2mm';

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>Print Bill - ${billData.billNumber || 'Bill'}</title>
        <style>
          @page { size: ${paperWidth} auto; margin: 0; }
          * { box-sizing: border-box; }
          body {
            width: ${paperWidth};
            max-width: ${paperWidth};
            margin: 0 auto;
            padding: ${padding};
            font-family: 'Courier New', Courier, monospace;
            font-size: ${fontSize};
            line-height: 1.25;
            color: #000;
            background: #fff;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .text-center { text-align: center; }
          .text-right { text-align: right; }
          .bold { font-weight: bold; }
          .divider { border-top: 1px dashed #000; margin: 5px 0; }
          .double-divider { border-top: 2px double #000; margin: 5px 0; }
          .flex { display: flex; justify-content: space-between; gap: 2px; }
          .brand-logo { max-height: ${logoMaxHeight}; margin-bottom: 3px; border-radius: 2px; }
          .items-table { width: 100%; border-collapse: collapse; margin: 4px 0; table-layout: fixed; }
          .items-table th, .items-table td { text-align: left; padding: 2px 0; font-size: ${fontSize}; word-wrap: break-word; }
          .items-table th.right, .items-table td.right { text-align: right; }
          .grand-total { font-size: ${totalFontSize}; font-weight: bold; margin-top: 4px; }
          .powered-by { font-size: 8px; color: #666; margin-top: 8px; }
        </style>
      </head>
      <body>
        <div class="text-center">
          ${logoHtml}
          <div><span class="bold" style="font-size: ${headerFontSize};">${currentRest?.name || 'EASYDINE'}</span></div>
          ${currentRest?.address ? `<div style="font-size: 9px;">${currentRest.address}</div>` : ''}
          ${currentRest?.contact ? `<div style="font-size: 9px;">Tel: ${currentRest.contact}</div>` : ''}
          <div style="margin-top: 4px;"><span class="bold" style="font-size: 11px; border: 1px solid #000; padding: 1px 5px; display: inline-block;">TAX INVOICE</span></div>
        </div>

        <div class="divider" style="margin-top: 8px;"></div>
        <div class="flex">
          <div>Bill No: <span class="bold">${billData.billNumber || 'N/A'}</span></div>
          <div>Date: ${dateStr}</div>
        </div>
        <div class="flex">
          <div>Type: <span class="bold">${billData.orderType || 'N/A'}</span></div>
          <div>Time: ${timeStr}</div>
        </div>
        ${billData.orderType === 'Table' ? `<div>Table: <span class="bold">${billData.tableNumber || 'N/A'}</span></div>` : ''}
        <div class="divider"></div>

        <table class="items-table">
          <thead>
            <tr>
              <th style="width: 45%;">Item</th>
              <th class="right" style="width: 15%;">Qty</th>
              <th class="right" style="width: 20%;">Price</th>
              <th class="right" style="width: 20%;">Total</th>
            </tr>
          </thead>
          <tbody>
            ${items.map(it => `
              <tr>
                <td>${it.name}</td>
                <td class="right">${it.quantity}</td>
                <td class="right">₹${Number(it.price).toFixed(2)}</td>
                <td class="right">₹${Number(it.subtotal || (it.price * it.quantity)).toFixed(2)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        <div class="divider"></div>
        <div class="flex">
          <span>Subtotal:</span>
          <span>₹${subtotal.toFixed(2)}</span>
        </div>
        ${discount > 0 ? `
          <div class="flex" style="font-weight: bold;">
            <span>Coupon Discount:</span>
            <span>-₹${discount.toFixed(2)}</span>
          </div>
        ` : ''}
        ${gstEnabled ? `
          <div class="flex">
            <span>GST (${gstRate}%):</span>
            <span>₹${gstAmount.toFixed(2)}</span>
          </div>
        ` : ''}
        ${serviceChargeEnabled ? `
          <div class="flex">
            <span>Service Charge (${serviceChargeRate}%):</span>
            <span>₹${serviceChargeAmount.toFixed(2)}</span>
          </div>
        ` : ''}

        <div class="divider"></div>
        <div class="flex grand-total">
          <span>GRAND TOTAL:</span>
          <span>₹${grandTotal.toFixed(2)}</span>
        </div>
        <div class="double-divider"></div>

        <div class="text-center" style="margin-top: 10px; font-size: 9px;">
          <div>Thank you for dining with us!</div>
          <div class="bold">Visit Again</div>
          ${poweredByHtml}
        </div>
      </body>
    </html>
  `;
}

export function executePrint(billData, currentRest, layoutOverride = null) {
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    alert("Please allow popups to print.");
    return;
  }

  const html = generatePrintHTML(billData, currentRest, layoutOverride);
  printWindow.document.write(html);
  printWindow.document.close();
  printWindow.focus();

  const autoOpen = currentRest?.autoOpenPrintDialog ?? true;
  if (autoOpen) {
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 300);
  }
}

export default executePrint;

