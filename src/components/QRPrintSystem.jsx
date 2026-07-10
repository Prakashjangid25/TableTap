import React, { useState, useEffect, useRef } from 'react';
import { 
  FiPrinter, 
  FiDownload, 
  FiX, 
  FiLayout, 
  FiType, 
  FiSliders, 
  FiMaximize,
  FiCheck,
  FiInfo
} from 'react-icons/fi';

export default function QRPrintSystem({ isOpen, onClose, table, restaurant, isDark }) {
  if (!isOpen || !table) return null;

  const tableName = table.tableName || 'Table';
  const restaurantName = restaurant?.name || 'Our Restaurant';
  
  // Scannable link for the table
  const scanLink = `${window.location.origin}/customer?r=${restaurant?.id}&t=${table.id}`;
  // QR image from reliable public API
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(scanLink)}`;

  // Print system customization states
  const [selectedTemplate, setSelectedTemplate] = useState('modern'); // 'modern' | 'vintage' | 'indigo' | 'minimalist'
  const [accentColor, setAccentColor] = useState('#10b981'); // default emerald
  const [primaryText, setPrimaryText] = useState('Scan to View Menu');
  const [secondaryText, setSecondaryText] = useState('Scan • Order • Enjoy');
  const [cardSize, setCardSize] = useState('a6'); // 'a6' | 'a5' | 'compact'
  const [showLogo, setShowLogo] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [notice, setNotice] = useState('');

  // Preset accent colors
  const colorPresets = [
    { name: 'Emerald', hex: '#10b981' },
    { name: 'Gold/Amber', hex: '#d97706' },
    { name: 'Royal Indigo', hex: '#6366f1' },
    { name: 'Rose Red', hex: '#f43f5e' },
    { name: 'Classic Slate', hex: '#475569' },
    { name: 'Deep Black', hex: '#000000' }
  ];

  // Set default accent colors based on selected templates
  useEffect(() => {
    if (selectedTemplate === 'vintage') {
      setAccentColor('#d97706'); // Amber gold
    } else if (selectedTemplate === 'indigo') {
      setAccentColor('#6366f1'); // Indigo
    } else if (selectedTemplate === 'modern') {
      setAccentColor('#10b981'); // Emerald
    } else if (selectedTemplate === 'minimalist') {
      setAccentColor('#000000'); // Black
    }
  }, [selectedTemplate]);

  // Helper helper to get dynamic layout styling
  const getCardStyle = () => {
    switch (selectedTemplate) {
      case 'vintage':
        return {
          fontFamily: 'Georgia, serif',
          borderColor: accentColor,
          textColor: '#1e293b'
        };
      case 'indigo':
        return {
          fontFamily: 'system-ui, sans-serif',
          borderColor: accentColor,
          textColor: '#1e1b4b'
        };
      case 'minimalist':
        return {
          fontFamily: 'monospace',
          borderColor: '#e2e8f0',
          textColor: '#0f172a'
        };
      default: // modern
        return {
          fontFamily: 'system-ui, sans-serif',
          borderColor: accentColor,
          textColor: '#0f172a'
        };
    }
  };

  const currentStyle = getCardStyle();

  // Helper to trigger high-fidelity isolated iframe printing
  const handlePrint = () => {
    // Create temporary hidden iframe
    const iframe = document.createElement('iframe');
    iframe.style.position = 'absolute';
    iframe.style.width = '0px';
    iframe.style.height = '0px';
    iframe.style.border = 'none';
    document.body.appendChild(iframe);

    const iframeDoc = iframe.contentWindow.document;

    // Get specific layout size values in mm
    let cardWidth = '105mm';
    let cardHeight = '148mm'; // A6
    if (cardSize === 'a5') {
      cardWidth = '148mm';
      cardHeight = '210mm';
    } else if (cardSize === 'compact') {
      cardWidth = '74mm';
      cardHeight = '105mm'; // A7
    }

    // Dynamic styles to inject into print document
    const isVintage = selectedTemplate === 'vintage';
    const isMinimal = selectedTemplate === 'minimalist';
    
    const fontImport = `@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,600;0,800;1,400&family=Space+Grotesk:wght@500;700&family=Plus+Jakarta+Sans:wght@500;700;800&family=Fira+Code:wght@500&display=swap');`;

    let titleFontClass = 'font-sans';
    let bodyFontClass = 'font-sans';
    
    if (isVintage) {
      titleFontClass = 'font-serif';
      bodyFontClass = 'font-serif';
    } else if (isMinimal) {
      titleFontClass = 'font-mono';
      bodyFontClass = 'font-mono';
    }

    iframeDoc.write(`
      <html>
        <head>
          <title>Print QR - ${tableName}</title>
          <style>
            ${fontImport}
            
            body {
              margin: 0;
              padding: 0;
              background: white;
              display: flex;
              align-items: center;
              justify-content: center;
              height: 100vh;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
            
            @page {
              size: auto;
              margin: 0;
            }
            
            .font-sans {
              font-family: 'Plus Jakarta Sans', system-ui, sans-serif;
            }
            
            .font-serif {
              font-family: 'Playfair Display', Georgia, serif;
            }
            
            .font-mono {
              font-family: 'Fira Code', monospace;
            }
            
            .print-card {
              width: ${cardWidth};
              height: ${cardHeight};
              box-sizing: border-box;
              background: white;
              border: 12px solid ${accentColor};
              border-radius: 24px;
              padding: 24px;
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: space-between;
              text-align: center;
              position: relative;
            }

            ${isVintage ? `
              .print-card::after {
                content: '';
                position: absolute;
                top: 8px;
                left: 8px;
                right: 8px;
                bottom: 8px;
                border: 2px solid ${accentColor};
                border-radius: 12px;
                pointer-events: none;
              }
            ` : ''}

            ${isMinimal ? `
              .print-card {
                border-width: 4px;
                border-color: #000000;
                border-radius: 0px;
              }
            ` : ''}

            .logo-header {
              font-size: 28px;
              margin-bottom: 4px;
            }

            .restaurant-name {
              font-size: 16px;
              font-weight: 800;
              text-transform: uppercase;
              letter-spacing: 0.1em;
              color: #0f172a;
              margin: 0;
            }

            .table-number {
              font-size: 28px;
              font-weight: 800;
              color: ${accentColor};
              margin: 12px 0 4px 0;
              text-transform: uppercase;
              letter-spacing: -0.02em;
            }

            .qr-wrapper {
              border: 2px solid #e2e8f0;
              padding: 12px;
              background: white;
              border-radius: 16px;
              margin: 12px 0;
              display: flex;
              align-items: center;
              justify-content: center;
            }

            .qr-image {
              width: 140mm;
              max-width: 170px;
              height: 140mm;
              max-height: 170px;
            }

            .primary-instruction {
              font-size: 16px;
              font-weight: 700;
              color: #1e293b;
              margin: 4px 0;
            }

            .secondary-instruction {
              font-size: 11px;
              color: #64748b;
              font-weight: 500;
              margin: 0;
            }

            .footer-tag {
              font-size: 9px;
              font-weight: 700;
              color: #94a3b8;
              text-transform: uppercase;
              letter-spacing: 0.15em;
              margin-top: 12px;
            }
          </style>
        </head>
        <body>
          <div class="print-card ${bodyFontClass}">
            <div>
              ${showLogo ? `<div class="logo-header">🍽️</div>` : ''}
              <h1 class="restaurant-name ${titleFontClass}">${restaurantName}</h1>
            </div>

            <div>
              <h2 class="table-number ${titleFontClass}">${tableName}</h2>
              <div class="qr-wrapper">
                <img class="qr-image" src="${qrUrl}" alt="QR Code" />
              </div>
            </div>

            <div>
              <p class="primary-instruction">${primaryText}</p>
              <p class="secondary-instruction">${secondaryText}</p>
              <div class="footer-tag">Powered by TableTap</div>
            </div>
          </div>

          <script>
            window.onload = function() {
              // Give extra time for external QR API to resolve and load image completely
              setTimeout(function() {
                window.print();
                setTimeout(function() {
                  window.parent.document.body.removeChild(iframe);
                }, 500);
              }, 800);
            };
          </script>
        </body>
      </html>
    `);
    iframeDoc.close();
  };

  // Helper to render to high-res canvas and download as PNG
  const handleDownloadPNG = () => {
    setIsGenerating(true);
    setNotice('');
    
    const canvas = document.createElement('canvas');
    canvas.width = 1000;
    canvas.height = 1414; // High resolution A6 aspect ratio (1:1.414)
    const ctx = canvas.getContext('2d');

    // Fill background
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Dynamic sizing & spacing values
    const isVintage = selectedTemplate === 'vintage';
    const isMinimal = selectedTemplate === 'minimalist';

    // Draw main outer card border
    ctx.strokeStyle = isMinimal ? '#000000' : accentColor;
    ctx.lineWidth = isMinimal ? 10 : 36;
    
    // Draw rounded or square card outline
    const borderPadding = isMinimal ? 20 : 0;
    const cornerRadius = isMinimal ? 0 : 54;
    
    if (cornerRadius > 0) {
      drawRoundedRect(ctx, 18, 18, canvas.width - 36, canvas.height - 36, cornerRadius);
    } else {
      ctx.beginPath();
      ctx.rect(borderPadding, borderPadding, canvas.width - borderPadding * 2, canvas.height - borderPadding * 2);
    }
    ctx.stroke();

    // Vintage inner border style
    if (isVintage) {
      ctx.strokeStyle = accentColor;
      ctx.lineWidth = 4;
      drawRoundedRect(ctx, 42, 42, canvas.width - 84, canvas.height - 84, 32);
      ctx.stroke();
    }

    // Set font styles based on template
    const titleFont = isVintage ? 'italic bold 38px Georgia' : isMinimal ? 'bold 36px monospace' : 'bold 36px "Plus Jakarta Sans", sans-serif';
    const tableFont = isVintage ? 'bold 74px Georgia' : isMinimal ? 'bold 72px monospace' : 'extrabold 74px "Plus Jakarta Sans", sans-serif';
    const instructionFont = isVintage ? 'bold 38px Georgia' : isMinimal ? 'bold 36px monospace' : 'bold 38px "Plus Jakarta Sans", sans-serif';
    const subInstructionFont = isVintage ? '24px Georgia' : isMinimal ? '22px monospace' : '500 24px "Plus Jakarta Sans", sans-serif';
    const footerFont = isMinimal ? 'bold 18px monospace' : '800 18px "Plus Jakarta Sans", sans-serif';

    // 1. Draw Logo
    let contentY = 120;
    if (showLogo) {
      ctx.font = '56px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('🍽️', canvas.width / 2, contentY);
      contentY += 90;
    }

    // 2. Draw Restaurant Name
    ctx.font = titleFont;
    ctx.fillStyle = '#0f172a';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(restaurantName.toUpperCase(), canvas.width / 2, contentY);

    // 3. Draw Table Label
    ctx.font = tableFont;
    ctx.fillStyle = isMinimal ? '#000000' : accentColor;
    ctx.fillText(tableName.toUpperCase(), canvas.width / 2, 430);

    // 4. Load & draw QR Code image with anonymous CORS setup
    const qrImg = new Image();
    qrImg.crossOrigin = 'anonymous';
    qrImg.src = qrUrl;

    qrImg.onload = () => {
      // Draw outer box for QR
      ctx.strokeStyle = '#e2e8f0';
      ctx.lineWidth = 4;
      const qrBoxSize = 440;
      const qrX = canvas.width / 2 - qrBoxSize / 2;
      const qrY = 510;
      
      drawRoundedRect(ctx, qrX, qrY, qrBoxSize, qrBoxSize, 32);
      ctx.stroke();

      // Draw loaded QR Code image slightly smaller inside the box
      const imgOffset = 30;
      ctx.drawImage(qrImg, qrX + imgOffset, qrY + imgOffset, qrBoxSize - imgOffset * 2, qrBoxSize - imgOffset * 2);

      // 5. Draw Primary text instructions
      ctx.font = instructionFont;
      ctx.fillStyle = '#1e293b';
      ctx.fillText(primaryText, canvas.width / 2, 1040);

      // 6. Draw Secondary text details
      ctx.font = subInstructionFont;
      ctx.fillStyle = '#64748b';
      ctx.fillText(secondaryText, canvas.width / 2, 1110);

      // 7. Footer Powered by TableTap
      ctx.font = footerFont;
      ctx.fillStyle = '#94a3b8';
      ctx.fillText('POWERED BY TABLETAP', canvas.width / 2, 1280);

      try {
        // Trigger client download of canvas output data url
        const link = document.createElement('a');
        link.download = `TableTap_QR_${tableName.replace(/\s+/g, '_')}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
        setIsGenerating(false);
      } catch (err) {
        console.error('Canvas export error:', err);
        setNotice('CORS restriction prevented direct image generation. Please use the Print option and select "Save as PDF"!');
        setIsGenerating(false);
      }
    };

    qrImg.onerror = () => {
      setIsGenerating(false);
      setNotice('Could not load QR code image for PNG generation. Please try again.');
    };
  };

  // Helper rounded rectangle generator for 2D canvas context
  const drawRoundedRect = (ctx, x, y, width, height, radius) => {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
  };

  // Triggers print dialog which has high resolution PDF generation built-in
  const handleDownloadPDF = () => {
    setNotice('Opening vector PDF generator. Tip: Select "Save as PDF" in your print destination.');
    setTimeout(() => {
      handlePrint();
    }, 400);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-fade-in">
      <div className={`relative w-full max-w-5xl rounded-3xl shadow-2xl overflow-hidden flex flex-col md:flex-row border ${
        isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'
      }`}>
        
        {/* Close Button */}
        <button 
          onClick={onClose}
          className={`absolute top-4 right-4 z-10 p-2 rounded-xl transition-all ${
            isDark ? 'bg-slate-800 text-slate-400 hover:text-white' : 'bg-slate-100 text-slate-500 hover:text-slate-900'
          }`}
          title="Close Preview"
        >
          <FiX className="text-lg" />
        </button>

        {/* Left Customizer Panel */}
        <div className={`p-6 md:p-8 flex-1 flex flex-col justify-between ${
          isDark ? 'bg-slate-900 text-white' : 'bg-white text-slate-800'
        }`}>
          <div className="space-y-6">
            <div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-500/10 text-amber-500 border border-amber-500/20 mb-3">
                🖨 Premium Print System
              </div>
              <h3 className="text-2xl font-bold font-display tracking-tight">QR Design Studio</h3>
              <p className={`text-xs mt-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                Customize and output professional table stands for {tableName}.
              </p>
            </div>

            {/* Template Selector */}
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <FiLayout className="text-xs" /> Design Template
              </label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { id: 'modern', name: 'Emerald Modern' },
                  { id: 'vintage', name: 'Vintage Gold' },
                  { id: 'indigo', name: 'Royal Indigo' },
                  { id: 'minimalist', name: 'Minimalist Black' }
                ].map(tpl => (
                  <button
                    key={tpl.id}
                    onClick={() => setSelectedTemplate(tpl.id)}
                    className={`p-3 rounded-xl border text-xs font-bold transition-all text-left flex items-center justify-between ${
                      selectedTemplate === tpl.id
                        ? 'border-amber-500 bg-amber-500/5 text-amber-500'
                        : isDark ? 'border-slate-800 hover:border-slate-700 bg-slate-950/30' : 'border-slate-200 hover:border-slate-300 bg-slate-50/50'
                    }`}
                  >
                    {tpl.name}
                    {selectedTemplate === tpl.id && <FiCheck className="text-sm shrink-0" />}
                  </button>
                ))}
              </div>
            </div>

            {/* Accent Color Palette */}
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <FiSliders className="text-xs" /> Custom Branding Color
              </label>
              <div className="flex flex-wrap gap-2 pt-1">
                {colorPresets.map(preset => (
                  <button
                    key={preset.hex}
                    onClick={() => setAccentColor(preset.hex)}
                    style={{ backgroundColor: preset.hex }}
                    className={`w-7 h-7 rounded-full border-2 transition-transform active:scale-95 flex items-center justify-center ${
                      accentColor === preset.hex 
                        ? 'border-white ring-2 ring-amber-500 scale-110' 
                        : 'border-transparent hover:scale-105'
                    }`}
                    title={preset.name}
                  >
                    {accentColor === preset.hex && (
                      <span className="text-white text-[10px] drop-shadow">✓</span>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Content Customization Inputs */}
            <div className="space-y-3">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <FiType className="text-xs" /> Card Typography & Branding
              </label>
              <div className="space-y-2">
                <input 
                  type="text" 
                  value={primaryText} 
                  onChange={(e) => setPrimaryText(e.target.value)}
                  placeholder="Primary Text"
                  className={`w-full text-xs rounded-xl border px-3 py-2 focus:outline-none focus:border-amber-500 ${
                    isDark ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-200'
                  }`}
                />
                <input 
                  type="text" 
                  value={secondaryText} 
                  onChange={(e) => setSecondaryText(e.target.value)}
                  placeholder="Secondary Subtext"
                  className={`w-full text-xs rounded-xl border px-3 py-2 focus:outline-none focus:border-amber-500 ${
                    isDark ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-200'
                  }`}
                />
              </div>

              {/* Logo Toggle */}
              <div className="flex items-center justify-between pt-1">
                <span className="text-xs font-semibold">Show Table Icon Header</span>
                <button 
                  onClick={() => setShowLogo(!showLogo)}
                  className={`w-10 h-6 rounded-full p-1 transition-colors ${
                    showLogo ? 'bg-amber-500' : 'bg-slate-700'
                  }`}
                >
                  <div className={`w-4 h-4 rounded-full bg-white transition-transform ${
                    showLogo ? 'translate-x-4' : 'translate-x-0'
                  }`} />
                </button>
              </div>
            </div>

            {/* Stand Sizes */}
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <FiMaximize className="text-xs" /> Stand Size Preset
              </label>
              <div className="flex gap-2">
                {[
                  { id: 'a6', name: 'Table Tent (A6)', desc: '105 x 148 mm' },
                  { id: 'a5', name: 'Large Stand (A5)', desc: '148 x 210 mm' },
                  { id: 'compact', name: 'Compact Tag (A7)', desc: '74 x 105 mm' }
                ].map(sz => (
                  <button
                    key={sz.id}
                    onClick={() => setCardSize(sz.id)}
                    className={`flex-1 p-2 rounded-xl border text-center transition-all ${
                      cardSize === sz.id
                        ? 'border-amber-500 bg-amber-500/5 text-amber-500'
                        : isDark ? 'border-slate-800 hover:border-slate-700 text-slate-400 bg-slate-950/20' : 'border-slate-200 hover:border-slate-300 text-slate-600 bg-slate-50'
                    }`}
                  >
                    <div className="text-[11px] font-bold">{sz.name}</div>
                    <div className="text-[9px] opacity-75 mt-0.5">{sz.desc}</div>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Bottom Action Section */}
          <div className="pt-6 border-t border-slate-800/10 mt-6 space-y-3">
            {notice && (
              <div className="p-3 rounded-xl text-[11px] bg-amber-500/10 text-amber-500 border border-amber-500/20 flex gap-1.5 items-start">
                <FiInfo className="text-xs shrink-0 mt-0.5" />
                <span>{notice}</span>
              </div>
            )}
            
            <div className="flex flex-col gap-2">
              <button 
                onClick={handlePrint}
                className="w-full bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-slate-950 font-bold py-3 px-4 rounded-xl text-sm transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg"
              >
                <FiPrinter className="text-base" /> Print Table Stand
              </button>

              <div className="grid grid-cols-2 gap-2">
                <button 
                  onClick={handleDownloadPDF}
                  className={`py-2 px-3 rounded-xl font-bold text-xs transition-colors border flex items-center justify-center gap-1.5 ${
                    isDark ? 'border-slate-800 hover:bg-slate-800/60 text-slate-300 bg-slate-950/20' : 'border-slate-200 hover:bg-slate-50 text-slate-600'
                  }`}
                >
                  <FiDownload className="text-xs" /> Save PDF
                </button>
                <button 
                  onClick={handleDownloadPNG}
                  disabled={isGenerating}
                  className={`py-2 px-3 rounded-xl font-bold text-xs transition-colors border flex items-center justify-center gap-1.5 disabled:opacity-50 ${
                    isDark ? 'border-slate-800 hover:bg-slate-800/60 text-slate-300 bg-slate-950/20' : 'border-slate-200 hover:bg-slate-50 text-slate-600'
                  }`}
                >
                  <FiDownload className="text-xs" /> {isGenerating ? 'Generating...' : 'Save PNG'}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Right Live Preview Panel */}
        <div className={`p-6 md:p-8 flex items-center justify-center min-h-[400px] md:min-h-0 md:w-[420px] shrink-0 ${
          isDark ? 'bg-slate-950' : 'bg-slate-50'
        }`}>
          <div className="text-center w-full max-w-[280px]">
            <p className={`text-[10px] font-bold tracking-wider uppercase mb-3 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
              LIVE TABLE CARD PREVIEW
            </p>

            {/* The actual preview card rendering */}
            <div 
              style={{ 
                fontFamily: currentStyle.fontFamily,
                borderColor: selectedTemplate === 'minimalist' ? '#000000' : accentColor,
                borderWidth: selectedTemplate === 'minimalist' ? '4px' : '12px',
                borderRadius: selectedTemplate === 'minimalist' ? '0px' : '24px'
              }}
              className="bg-white border rounded-[24px] p-6 shadow-xl w-full aspect-[1/1.414] flex flex-col justify-between items-center text-center relative select-none animate-fade-in"
            >
              {selectedTemplate === 'vintage' && (
                <div 
                  style={{ borderColor: accentColor }}
                  className="absolute inset-1.5 border border-dashed rounded-[16px] pointer-events-none" 
                />
              )}

              {/* Logo + Restaurant Name */}
              <div>
                {showLogo && <div className="text-2xl mb-1">🍽️</div>}
                <h4 className="text-[11px] font-extrabold text-slate-800 uppercase tracking-widest leading-none">
                  {restaurantName}
                </h4>
              </div>

              {/* Table Number + QR Code container */}
              <div className="w-full flex flex-col items-center">
                <h5 
                  style={{ color: selectedTemplate === 'minimalist' ? '#000000' : accentColor }}
                  className="text-2xl font-extrabold uppercase tracking-tight mb-2"
                >
                  {tableName}
                </h5>
                <div className="p-2 border border-slate-100 rounded-xl bg-white shadow-sm flex items-center justify-center">
                  <img src={qrUrl} alt="QR Code" className="w-32 h-32" />
                </div>
              </div>

              {/* Action instructions */}
              <div className="space-y-0.5">
                <p className="text-xs font-bold text-slate-800 leading-tight">
                  {primaryText}
                </p>
                <p className="text-[9px] font-medium text-slate-400">
                  {secondaryText}
                </p>
                <div className="text-[8px] font-extrabold text-slate-300 tracking-wider uppercase mt-2 leading-none">
                  Powered by TableTap
                </div>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
