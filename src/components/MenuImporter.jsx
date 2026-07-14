import React, { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import {
    createCategory,
    createProduct,
    updateProduct
} from '../dbService';
import {
    Upload,
    FileText,
    Download,
    CheckCircle,
    AlertTriangle,
    X,
    Loader2,
    ArrowRight,
    ChevronRight,
    AlertCircle,
    HelpCircle
} from 'lucide-react';

export default function MenuImporter({
    currentRest,
    categories,
    products,
    refreshCollections,
    onClose,
    isDark = false
}) {
    const [file, setFile] = useState(null);
    const [dragActive, setDragActive] = useState(false);
    const [parsedRows, setParsedRows] = useState([]);
    const [importing, setImporting] = useState(false);
    const [progress, setProgress] = useState(0);
    const [globalDuplicateAction, setGlobalDuplicateAction] = useState('skip'); // 'skip' | 'update' | 'new'
    const [summary, setSummary] = useState(null);
    const [error, setError] = useState('');
    const fileInputRef = useRef(null);

    // Download Sample CSV
    const handleDownloadCSV = () => {
        const headers = [
            "Product Name",
            "Category",
            "Price",
            "Description",
            "Popular Badge",
            "Chef Special Badge",
            "Image URL"
        ];

        const sampleRows = [
            [
                "Paneer Butter Masala",
                "Main Course",
                "349",
                "Cottage cheese cubes cooked in a rich, creamy tomato gravy with butter.",
                "true",
                "false",
                "https://images.unsplash.com/photo-1603894584373-5ac82b2ae398?auto=format&fit=crop&q=80&w=400"
            ],
            [
                "Tandoori Roti",
                "Breads",
                "49",
                "Whole wheat flour flatbread baked in a traditional clay oven.",
                "false",
                "false",
                "https://images.unsplash.com/photo-1601050690597-df056fb4ce78?auto=format&fit=crop&q=80&w=400"
            ],
            [
                "Sizzling Chocolate Brownie",
                "Desserts",
                "249",
                "Warm walnut brownie served with vanilla ice cream on a sizzler plate.",
                "true",
                "true",
                "https://images.unsplash.com/photo-1606313564200-e75d5e30476c?auto=format&fit=crop&q=80&w=400"
            ]
        ];

        const csvContent = [
            headers.join(","),
            ...sampleRows.map(row => row.map(val => `"${val.replace(/"/g, '""')}"`).join(","))
        ].join("\n");

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", `${currentRest?.name || 'Restaurant'}_Sample_Menu.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    // Download Sample Excel (.xlsx) using xlsx library
    const handleDownloadExcel = () => {
        const sampleData = [
            {
                "Product Name": "Paneer Butter Masala",
                "Category": "Main Course",
                "Price": 349,
                "Description": "Cottage cheese cubes cooked in a rich, creamy tomato gravy with butter.",
                "Popular Badge": "true",
                "Chef Special Badge": "false",
                "Image URL": "https://images.unsplash.com/photo-1603894584373-5ac82b2ae398?auto=format&fit=crop&q=80&w=400"
            },
            {
                "Product Name": "Tandoori Roti",
                "Category": "Breads",
                "Price": 49,
                "Description": "Whole wheat flour flatbread baked in a traditional clay oven.",
                "Popular Badge": "false",
                "Chef Special Badge": "false",
                "Image URL": "https://images.unsplash.com/photo-1601050690597-df056fb4ce78?auto=format&fit=crop&q=80&w=400"
            },
            {
                "Product Name": "Sizzling Chocolate Brownie",
                "Category": "Desserts",
                "Price": 249,
                "Description": "Warm walnut brownie served with vanilla ice cream on a sizzler plate.",
                "Popular Badge": "true",
                "Chef Special Badge": "true",
                "Image URL": "https://images.unsplash.com/photo-1606313564200-e75d5e30476c?auto=format&fit=crop&q=80&w=400"
            }
        ];

        const worksheet = XLSX.utils.json_to_sheet(sampleData);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Menu Sample");

        // Generate buffer and trigger download
        XLSX.writeFile(workbook, `${currentRest?.name || 'Restaurant'}_Sample_Menu.xlsx`);
    };

    // Drag & drop handlers
    const handleDrag = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.type === "dragenter" || e.type === "dragover") {
            setDragActive(true);
        } else if (e.type === "dragleave") {
            setDragActive(false);
        }
    };

    const handleDrop = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(false);

        const droppedFile = e.dataTransfer?.files?.[0];
        if (droppedFile) {
            processFile(droppedFile);
        }
    };

    const handleFileChange = (e) => {
        const selectedFile = e.target.files?.[0];
        if (selectedFile) {
            processFile(selectedFile);
        }
    };

    // Parse Header to Canonical field names
    const getCanonicalField = (header) => {
        const h = header.trim().toLowerCase().replace(/[\s_-]+/g, '');
        if (h === 'productname' || h === 'name' || h === 'title' || h === 'itemname') return 'name';
        if (h === 'category' || h === 'cat' || h === 'categoryname') return 'category';
        if (h === 'price' || h === 'cost' || h === 'rate') return 'price';
        if (h === 'description' || h === 'desc' || h === 'details') return 'description';
        if (h === 'popularbadge' || h === 'popular' || h === 'ispopular') return 'isPopular';
        if (h === 'chefspecialbadge' || h === 'chefspecial' || h === 'special' || h === 'isspecial') return 'isSpecial';
        if (h === 'imageurl' || h === 'image' || h === 'img' || h === 'imgurl') return 'imageUrl';
        return null;
    };

    // Parse and validate rows
    const processFile = (fileToProcess) => {
        setError('');
        setFile(fileToProcess);

        const reader = new FileReader();
        const fileExtension = fileToProcess.name.split('.').pop().toLowerCase();

        if (fileExtension === 'csv') {
            reader.onload = (e) => {
                try {
                    const text = e.target.result;
                    const workbook = XLSX.read(text, { type: 'string' });
                    const firstSheetName = workbook.SheetNames[0];
                    const worksheet = workbook.Sheets[firstSheetName];
                    const rawJson = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
                    parseSheetData(rawJson);
                } catch (err) {
                    console.error("CSV Parse Error:", err);
                    setError("Failed to parse CSV file. Please verify it is a valid format.");
                }
            };
            reader.readAsText(fileToProcess);
        } else if (fileExtension === 'xlsx' || fileExtension === 'xls') {
            reader.onload = (e) => {
                try {
                    const data = new Uint8Array(e.target.result);
                    const workbook = XLSX.read(data, { type: 'array' });
                    const firstSheetName = workbook.SheetNames[0];
                    const worksheet = workbook.Sheets[firstSheetName];
                    const rawJson = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
                    parseSheetData(rawJson);
                } catch (err) {
                    console.error("Excel Parse Error:", err);
                    setError("Failed to parse Excel file. Please verify it is a valid format.");
                }
            };
            reader.readAsArrayBuffer(fileToProcess);
        } else {
            setError("Unsupported file format. Please upload a .csv, .xlsx, or .xls file.");
        }
    };

    const parseSheetData = (sheetRows) => {
        if (!sheetRows || sheetRows.length < 2) {
            setError("The file appears to be empty or lacks columns.");
            return;
        }

        // Header row mapping
        const rawHeaders = sheetRows[0];
        const headerMapping = {};
        rawHeaders.forEach((header, index) => {
            if (header) {
                const canonical = getCanonicalField(String(header));
                if (canonical) {
                    headerMapping[canonical] = index;
                }
            }
        });

        // We must at least find "name" or "product name" and "price"
        if (headerMapping.name === undefined) {
            setError("Missing required column: 'Product Name' or 'Name'.");
            return;
        }

        const previewRows = [];

        // Parse subsequent rows
        for (let i = 1; i < sheetRows.length; i++) {
            const rowData = sheetRows[i];
            if (!rowData || rowData.length === 0 || rowData.every(cell => cell === null || cell === undefined || cell === '')) {
                continue; // skip empty rows
            }

            // Map row data
            const nameVal = headerMapping.name !== undefined ? String(rowData[headerMapping.name] || '').trim() : '';
            const categoryVal = headerMapping.category !== undefined ? String(rowData[headerMapping.category] || '').trim() : '';
            const priceVal = headerMapping.price !== undefined ? parseFloat(rowData[headerMapping.price]) : NaN;
            const descriptionVal = headerMapping.description !== undefined ? String(rowData[headerMapping.description] || '').trim() : '';
            const imageUrlVal = headerMapping.imageUrl !== undefined ? String(rowData[headerMapping.imageUrl] || '').trim() : '';

            let isPopularVal = false;
            if (headerMapping.isPopular !== undefined) {
                const p = String(rowData[headerMapping.isPopular]).toLowerCase().trim();
                isPopularVal = p === 'true' || p === 'yes' || p === '1';
            }

            let isSpecialVal = false;
            if (headerMapping.isSpecial !== undefined) {
                const s = String(rowData[headerMapping.isSpecial]).toLowerCase().trim();
                isSpecialVal = s === 'true' || s === 'yes' || s === '1';
            }

            // Validation check
            const isValid = nameVal !== '' && !isNaN(priceVal) && priceVal >= 0 && categoryVal !== '';

            let status = 'valid';
            let statusDetails = '';

            if (!isValid) {
                status = 'invalid';
                if (nameVal === '') statusDetails += 'Missing Name. ';
                if (categoryVal === '') statusDetails += 'Missing Category. ';
                if (isNaN(priceVal) || priceVal < 0) statusDetails += 'Invalid Price. ';
            } else {
                // Category detection
                const matchedCategory = categories.find(c => c.name.toLowerCase().trim() === categoryVal.toLowerCase().trim());
                const isExistingCategory = !!matchedCategory;

                // Duplicate product detection
                const matchedProduct = products.find(p => p.name.toLowerCase().trim() === nameVal.toLowerCase().trim());
                const isDuplicateProduct = !!matchedProduct;

                if (isDuplicateProduct) {
                    status = 'duplicate';
                    statusDetails = isExistingCategory ? 'Existing Category' : 'New Category (Will Be Created)';
                } else {
                    status = isExistingCategory ? 'existing_cat' : 'new_cat';
                    statusDetails = isExistingCategory ? 'Existing Category' : 'New Category (Will Be Created)';
                }
            }

            previewRows.push({
                index: i,
                name: nameVal,
                category: categoryVal,
                price: isNaN(priceVal) ? '' : priceVal,
                description: descriptionVal,
                imageUrl: imageUrlVal,
                isPopular: isPopularVal,
                isSpecial: isSpecialVal,
                status: status, // 'invalid' | 'duplicate' | 'existing_cat' | 'new_cat'
                statusDetails: statusDetails,
                overrideDuplicateAction: null // can be set to 'skip' | 'update' | 'new' individually
            });
        }

        if (previewRows.length === 0) {
            setError("No valid or parsed rows found in the file.");
            return;
        }

        setParsedRows(previewRows);
    };

    // Submit and run bulk import
    const handleStartImport = async () => {
        if (parsedRows.length === 0) return;

        setImporting(true);
        setProgress(0);

        // Filter valid & non-skipped items
        const rowsToProcess = parsedRows.filter(row => {
            if (row.status === 'invalid') return false;
            const dupAction = row.overrideDuplicateAction || globalDuplicateAction;
            if (row.status === 'duplicate' && dupAction === 'skip') return false;
            return true;
        });

        if (rowsToProcess.length === 0) {
            setSummary({
                importedCount: 0,
                categoriesCreatedCount: 0,
                categoriesReusedCount: 0,
                updatedCount: 0,
                skippedCount: parsedRows.length
            });
            setImporting(false);
            return;
        }

        let importedCount = 0;
        let categoriesCreatedCount = 0;
        let categoriesReusedCount = 0;
        let updatedCount = 0;
        let skippedCount = parsedRows.filter(r => r.status === 'invalid').length;

        // Track local cache of categories so we can reuse them immediately
        let currentCategoriesList = [...categories];

        // Collect all unique category names that are new
        const newCategoryNames = [];
        rowsToProcess.forEach(row => {
            const existsInDb = currentCategoriesList.some(c => c.name.toLowerCase().trim() === row.category.toLowerCase().trim());
            const existsInPendingList = newCategoryNames.some(name => name.toLowerCase().trim() === row.category.toLowerCase().trim());

            if (!existsInDb && !existsInPendingList) {
                newCategoryNames.push(row.category);
            }
        });

        // Create New Categories in Firestore
        for (let i = 0; i < newCategoryNames.length; i++) {
            const catName = newCategoryNames[i];
            const newCatId = `cat_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
            const newCategoryObj = {
                id: newCatId,
                restaurantId: currentRest.id,
                name: catName,
                order: currentCategoriesList.length + 1
            };

            try {
                await createCategory(currentRest.id, newCategoryObj);
                currentCategoriesList.push(newCategoryObj);
                categoriesCreatedCount++;
            } catch (err) {
                console.error(`Failed to create category: ${catName}`, err);
            }
        }

        // Now process the products
        const totalSteps = rowsToProcess.length;

        for (let idx = 0; idx < rowsToProcess.length; idx++) {
            const row = rowsToProcess[idx];

            // Determine the category ID
            const matchedCat = currentCategoriesList.find(c => c.name.toLowerCase().trim() === row.category.toLowerCase().trim());
            if (!matchedCat) {
                // Fallback safety (should never happen)
                skippedCount++;
                continue;
            }

            const categoryId = matchedCat.id;
            const wasExistingCategory = categories.some(c => c.id === categoryId);
            if (wasExistingCategory) {
                // Track reused count safely (only unique counts)
                categoriesReusedCount = currentCategoriesList.filter(c => categories.some(dbC => dbC.id === c.id)).length;
            }

            // Check if duplicate handling applies
            const matchedProductInDb = products.find(p => p.name.toLowerCase().trim() === row.name.toLowerCase().trim());
            const isDup = !!matchedProductInDb;
            const dupAction = row.overrideDuplicateAction || globalDuplicateAction;

            try {
                if (isDup && dupAction === 'update') {
                    // Update Existing
                    await updateProduct(currentRest.id, matchedProductInDb.id, {
                        price: Number(row.price),
                        categoryId: categoryId,
                        description: row.description,
                        imageUrl: row.imageUrl,
                        isPopular: row.isPopular,
                        isSpecial: row.isSpecial,
                        isAvailable: true
                    });
                    updatedCount++;
                } else {
                    // Create New Product
                    const newProdId = `prod_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
                    await createProduct(currentRest.id, {
                        id: newProdId,
                        restaurantId: currentRest.id,
                        name: row.name,
                        price: Number(row.price),
                        categoryId: categoryId,
                        description: row.description,
                        imageUrl: row.imageUrl,
                        isPopular: row.isPopular,
                        isSpecial: row.isSpecial,
                        isAvailable: true
                    });
                    importedCount++;
                }
            } catch (err) {
                console.error(`Failed to import product: ${row.name}`, err);
                skippedCount++;
            }

            setProgress(Math.round(((idx + 1) / totalSteps) * 100));
        }

        // Final calculations for summary
        setSummary({
            importedCount,
            categoriesCreatedCount,
            categoriesReusedCount: currentCategoriesList.length - categoriesCreatedCount,
            updatedCount,
            skippedCount: parsedRows.length - (importedCount + updatedCount)
        });

        setImporting(false);
        await refreshCollections();
    };

    const triggerFileInput = () => {
        fileInputRef.current?.click();
    };

    const resetImporter = () => {
        setFile(null);
        setParsedRows([]);
        setProgress(0);
        setSummary(null);
        setError('');
    };

    const getRowActionLabel = (row) => {
        if (row.status === 'invalid') return 'Skip (Invalid)';
        if (row.status === 'duplicate') {
            const act = row.overrideDuplicateAction || globalDuplicateAction;
            if (act === 'skip') return 'Skip (Duplicate)';
            if (act === 'update') return 'Update Existing';
            return 'Import As New';
        }
        return 'Import';
    };

    return (
        <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-fade-in">
            <div className={`w-full max-w-5xl rounded-2xl border shadow-2xl flex flex-col max-h-[90vh] overflow-hidden ${isDark ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-800'
                }`}>

                {/* Header */}
                <div className={`px-6 py-4 border-b flex items-center justify-between ${isDark ? 'border-slate-800' : 'border-slate-100'}`}>
                    <div>
                        <h3 className={`text-lg font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                            Smart Menu Import Wizard
                        </h3>
                        <p className="text-xs text-slate-400 mt-0.5">
                            Bulk import categories and dishes from CSV or Excel sheets safely.
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className={`p-1.5 rounded-lg transition-all cursor-pointer ${isDark ? 'hover:bg-slate-800 text-slate-400' : 'hover:bg-slate-100 text-slate-500'
                            }`}
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Content Area */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6">

                    {error && (
                        <div className="text-xs text-rose-500 flex items-center gap-2 bg-rose-500/10 border border-rose-500/20 px-4 py-3 rounded-xl animate-shake">
                            <AlertCircle size={16} className="shrink-0" />
                            <span>{error}</span>
                        </div>
                    )}

                    {/* Step 1: Upload or Download Sample */}
                    {!file && !summary && (
                        <div className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

                                {/* File Upload card */}
                                <div
                                    onDragEnter={handleDrag}
                                    onDragOver={handleDrag}
                                    onDragLeave={handleDrag}
                                    onDrop={handleDrop}
                                    onClick={triggerFileInput}
                                    className={`col-span-2 border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all flex flex-col items-center justify-center min-h-[220px] ${dragActive
                                            ? 'border-amber-500 bg-amber-500/5'
                                            : isDark
                                                ? 'border-slate-800 hover:border-slate-700 bg-slate-950/30 hover:bg-slate-950/50'
                                                : 'border-slate-200 hover:border-slate-300 bg-slate-50 hover:bg-slate-100/50'
                                        }`}
                                >
                                    <input
                                        ref={fileInputRef}
                                        type="file"
                                        accept=".csv, .xlsx, .xls"
                                        onChange={handleFileChange}
                                        className="hidden"
                                    />
                                    <Upload className="h-10 w-10 text-amber-500 mb-3 animate-pulse" />
                                    <h4 className={`text-sm font-bold ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>
                                        Drag & Drop your Menu file here
                                    </h4>
                                    <p className="text-xs text-slate-400 mt-1 max-w-sm">
                                        Select a CSV, Microsoft Excel (.xlsx) file containing your menu items. We will handle category and duplicates detection.
                                    </p>
                                    <button
                                        type="button"
                                        className="mt-4 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-bold rounded-xl transition-all shadow"
                                    >
                                        Browse Files
                                    </button>
                                </div>

                                {/* Templates and Help */}
                                <div className={`p-5 rounded-2xl border flex flex-col justify-between ${isDark ? 'bg-slate-950/40 border-slate-800' : 'bg-slate-50 border-slate-200'
                                    }`}>
                                    <div className="space-y-4">
                                        <div className="flex items-center gap-2">
                                            <FileText className="text-amber-500 shrink-0" size={16} />
                                            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                                                Template Downloads
                                            </h4>
                                        </div>
                                        <p className="text-xs text-slate-400 leading-relaxed">
                                            Download our pre-structured template sheets to fill in your dishes and prices for a seamless import.
                                        </p>
                                    </div>

                                    <div className="space-y-2.5 pt-4">
                                        <button
                                            onClick={handleDownloadCSV}
                                            className={`w-full py-2.5 px-3 rounded-xl border text-xs font-bold flex items-center justify-between transition-all cursor-pointer ${isDark
                                                    ? 'border-slate-800 bg-slate-900 hover:bg-slate-800 text-slate-300'
                                                    : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
                                                }`}
                                        >
                                            <span className="flex items-center gap-2">
                                                <FileText size={14} className="text-emerald-500" />
                                                Download Sample CSV
                                            </span>
                                            <Download size={12} />
                                        </button>

                                        <button
                                            onClick={handleDownloadExcel}
                                            className={`w-full py-2.5 px-3 rounded-xl border text-xs font-bold flex items-center justify-between transition-all cursor-pointer ${isDark
                                                    ? 'border-slate-800 bg-slate-900 hover:bg-slate-800 text-slate-300'
                                                    : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
                                                }`}
                                        >
                                            <span className="flex items-center gap-2">
                                                <FileText size={14} className="text-blue-500" />
                                                Download Sample Excel
                                            </span>
                                            <Download size={12} />
                                        </button>
                                    </div>
                                </div>

                            </div>

                            {/* Instructions list */}
                            <div className={`p-4 rounded-xl border text-xs space-y-2 ${isDark ? 'bg-slate-900/50 border-slate-800' : 'bg-slate-50/50 border-slate-100'
                                }`}>
                                <div className="flex items-center gap-1.5 font-bold text-amber-500">
                                    <HelpCircle size={14} />
                                    <span>Important Instructions</span>
                                </div>
                                <ul className="list-disc pl-5 space-y-1 text-slate-400">
                                    <li><strong>Category Sync:</strong> Categories are matched case-insensitively. If a category doesn't exist, we will create it automatically!</li>
                                    <li><strong>Price:</strong> Must be a non-negative number. Free items can be 0.</li>
                                    <li><strong>Badges:</strong> Enter <code>true</code> or <code>false</code> in Popular / Chef Special columns.</li>
                                </ul>
                            </div>
                        </div>
                    )}

                    {/* Step 2: Show Preview & Config */}
                    {file && parsedRows.length > 0 && !summary && (
                        <div className="space-y-6">

                            {/* Top configuration and Global Action Selector */}
                            <div className={`p-4 rounded-2xl border flex flex-col md:flex-row md:items-center justify-between gap-4 ${isDark ? 'bg-slate-950/40 border-slate-800' : 'bg-slate-50 border-slate-200'
                                }`}>
                                <div className="flex items-center gap-3">
                                    <div className={`p-2.5 rounded-xl ${isDark ? 'bg-slate-800' : 'bg-white border'}`}>
                                        <FileText size={20} className="text-amber-500" />
                                    </div>
                                    <div>
                                        <h4 className="text-sm font-bold truncate max-w-xs">{file.name}</h4>
                                        <p className="text-xs text-slate-400 mt-0.5">
                                            Found {parsedRows.length} total rows • {parsedRows.filter(r => r.status === 'invalid').length} invalid rows skipped.
                                        </p>
                                    </div>
                                </div>

                                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                                    <label className="text-xs font-bold text-slate-400">
                                        If product already exists:
                                    </label>
                                    <div className={`flex rounded-lg p-0.5 border ${isDark ? 'bg-slate-950 border-slate-800' : 'bg-slate-100 border-slate-200'}`}>
                                        <button
                                            type="button"
                                            onClick={() => setGlobalDuplicateAction('skip')}
                                            className={`px-3 py-1 text-[11px] font-bold rounded-md transition-all cursor-pointer ${globalDuplicateAction === 'skip'
                                                    ? isDark ? 'bg-slate-850 text-white shadow' : 'bg-white text-slate-800 shadow'
                                                    : 'text-slate-400 hover:text-slate-300'
                                                }`}
                                        >
                                            Skip
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setGlobalDuplicateAction('update')}
                                            className={`px-3 py-1 text-[11px] font-bold rounded-md transition-all cursor-pointer ${globalDuplicateAction === 'update'
                                                    ? isDark ? 'bg-slate-850 text-white shadow' : 'bg-white text-slate-800 shadow'
                                                    : 'text-slate-400 hover:text-slate-300'
                                                }`}
                                        >
                                            Update Existing
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setGlobalDuplicateAction('new')}
                                            className={`px-3 py-1 text-[11px] font-bold rounded-md transition-all cursor-pointer ${globalDuplicateAction === 'new'
                                                    ? isDark ? 'bg-slate-850 text-white shadow' : 'bg-white text-slate-800 shadow'
                                                    : 'text-slate-400 hover:text-slate-300'
                                                }`}
                                        >
                                            Import As New
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* Preview Table */}
                            <div className={`rounded-2xl border overflow-hidden ${isDark ? 'border-slate-800 bg-slate-950/20' : 'border-slate-200 bg-white'
                                }`}>
                                <div className="overflow-x-auto max-h-[45vh]">
                                    <table className="w-full text-left border-collapse">
                                        <thead>
                                            <tr className={`border-b text-[11px] font-bold uppercase tracking-wider ${isDark ? 'bg-slate-900 border-slate-800 text-slate-400' : 'bg-slate-50 border-slate-100 text-slate-500'
                                                }`}>
                                                <th className="px-4 py-3 text-center w-12">#</th>
                                                <th className="px-4 py-3">Product Name</th>
                                                <th className="px-4 py-3">Category</th>
                                                <th className="px-4 py-3">Price</th>
                                                <th className="px-4 py-3">Description</th>
                                                <th className="px-4 py-3 text-center">Image</th>
                                                <th className="px-4 py-3 text-center">Import Action / Status</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50 text-xs">
                                            {parsedRows.map((row, idx) => (
                                                <tr
                                                    key={idx}
                                                    className={`transition-colors ${row.status === 'invalid'
                                                            ? 'bg-rose-500/5 hover:bg-rose-500/10'
                                                            : isDark ? 'hover:bg-slate-900/50' : 'hover:bg-slate-50/50'
                                                        }`}
                                                >
                                                    <td className="px-4 py-3 text-center text-slate-400 font-mono">
                                                        {row.index}
                                                    </td>
                                                    <td className="px-4 py-3 font-semibold">
                                                        {row.name || <span className="text-rose-500 font-normal italic">Name Missing</span>}
                                                        <div className="flex gap-1.5 mt-0.5">
                                                            {row.isPopular && (
                                                                <span className="bg-amber-500/10 text-amber-500 border border-amber-500/10 px-1 py-0.2 rounded text-[9px] font-extrabold uppercase">
                                                                    Popular
                                                                </span>
                                                            )}
                                                            {row.isSpecial && (
                                                                <span className="bg-emerald-500/10 text-emerald-500 border border-emerald-500/10 px-1 py-0.2 rounded text-[9px] font-extrabold uppercase">
                                                                    Special
                                                                </span>
                                                            )}
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        {row.category ? (
                                                            <span className="font-medium text-slate-300 dark:text-slate-300">{row.category}</span>
                                                        ) : (
                                                            <span className="text-rose-500 italic">Category Missing</span>
                                                        )}
                                                    </td>
                                                    <td className="px-4 py-3 font-mono font-medium">
                                                        {row.price !== '' ? `₹${row.price}` : <span className="text-rose-500 italic">Price Missing</span>}
                                                    </td>
                                                    <td className="px-4 py-3 max-w-[180px] truncate text-slate-400" title={row.description}>
                                                        {row.description || <span className="text-slate-500 italic">None</span>}
                                                    </td>
                                                    <td className="px-4 py-3 text-center">
                                                        {row.imageUrl ? (
                                                            <img
                                                                src={row.imageUrl}
                                                                alt="preview"
                                                                className="w-8 h-8 rounded object-cover mx-auto bg-slate-800"
                                                                onError={(e) => { e.target.src = "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&q=80&w=40" }}
                                                            />
                                                        ) : (
                                                            <span className="text-slate-500 font-mono text-[10px]">-</span>
                                                        )}
                                                    </td>
                                                    <td className="px-4 py-3 text-center">
                                                        <div className="flex flex-col items-center gap-1">
                                                            {/* Status Badge */}
                                                            {row.status === 'invalid' && (
                                                                <span className="bg-rose-500/10 text-rose-500 border border-rose-500/10 px-2 py-0.5 rounded-full text-[10px] font-bold">
                                                                    Invalid Row
                                                                </span>
                                                            )}
                                                            {row.status === 'new_cat' && (
                                                                <span className="bg-blue-500/10 text-blue-500 border border-blue-500/10 px-2 py-0.5 rounded-full text-[10px] font-bold">
                                                                    New Category
                                                                </span>
                                                            )}
                                                            {row.status === 'existing_cat' && (
                                                                <span className="bg-emerald-500/10 text-emerald-500 border border-emerald-500/10 px-2 py-0.5 rounded-full text-[10px] font-bold">
                                                                    Existing Category
                                                                </span>
                                                            )}
                                                            {row.status === 'duplicate' && (
                                                                <div className="flex flex-col items-center gap-1">
                                                                    <span className="bg-amber-500/10 text-amber-500 border border-amber-500/10 px-2 py-0.5 rounded-full text-[10px] font-bold flex items-center gap-1">
                                                                        <AlertTriangle size={10} /> Duplicate Product
                                                                    </span>

                                                                    {/* Custom row action selector for duplicates */}
                                                                    <select
                                                                        value={row.overrideDuplicateAction || globalDuplicateAction}
                                                                        onChange={(e) => {
                                                                            const updatedRows = [...parsedRows];
                                                                            updatedRows[idx].overrideDuplicateAction = e.target.value;
                                                                            setParsedRows(updatedRows);
                                                                        }}
                                                                        className={`text-[9px] font-semibold border rounded px-1.5 py-0.5 focus:outline-none ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-slate-50 border-slate-200'
                                                                            }`}
                                                                    >
                                                                        <option value="skip">Skip</option>
                                                                        <option value="update">Update</option>
                                                                        <option value="new">Import As New</option>
                                                                    </select>
                                                                </div>
                                                            )}
                                                            <span className="text-[10px] text-slate-400 font-medium">
                                                                Action: {getRowActionLabel(row)}
                                                            </span>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            {/* Control Buttons */}
                            <div className="flex items-center justify-between">
                                <button
                                    type="button"
                                    onClick={resetImporter}
                                    className={`px-4 py-2 rounded-xl text-xs font-semibold cursor-pointer border ${isDark ? 'bg-slate-800 border-slate-700 hover:bg-slate-700 text-slate-300' : 'bg-slate-50 border-slate-200 hover:bg-slate-100'
                                        }`}
                                >
                                    Choose Different File
                                </button>

                                <button
                                    type="button"
                                    onClick={handleStartImport}
                                    className="px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-extrabold rounded-xl text-xs flex items-center gap-1.5 shadow cursor-pointer"
                                >
                                    Import {parsedRows.filter(r => r.status !== 'invalid' && !(r.status === 'duplicate' && (r.overrideDuplicateAction || globalDuplicateAction) === 'skip')).length} Items <ArrowRight size={14} />
                                </button>
                            </div>

                        </div>
                    )}

                    {/* Loading / Progress State */}
                    {importing && (
                        <div className="py-12 text-center space-y-4 max-w-sm mx-auto">
                            <Loader2 className="h-8 w-8 animate-spin text-amber-500 mx-auto" />
                            <div className="space-y-1">
                                <h4 className="text-sm font-bold">Importing Menu Items...</h4>
                                <p className="text-xs text-slate-400">Please do not close this window while we configure Firestore databases.</p>
                            </div>
                            <div className="space-y-1">
                                <div className="w-full h-1.5 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-amber-500 rounded-full transition-all duration-300"
                                        style={{ width: `${progress}%` }}
                                    />
                                </div>
                                <div className="flex justify-between text-[10px] font-mono text-slate-400">
                                    <span>Uploading rows...</span>
                                    <span>{progress}%</span>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Step 3: Success Summary Modal */}
                    {summary && (
                        <div className="py-6 max-w-md mx-auto text-center space-y-6 animate-fade-in">
                            <div className="mx-auto w-12 h-12 bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 rounded-full flex items-center justify-center">
                                <CheckCircle size={26} />
                            </div>

                            <div className="space-y-1">
                                <h3 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                                    Import Completed Successfully!
                                </h3>
                                <p className="text-xs text-slate-400">
                                    Your Firestore database and local application state are now fully synchronized.
                                </p>
                            </div>

                            {/* Stats Box */}
                            <div className={`p-5 rounded-2xl border text-left space-y-3 font-medium text-xs ${isDark ? 'bg-slate-950/40 border-slate-800' : 'bg-slate-50 border-slate-200'
                                }`}>
                                <div className="flex items-center justify-between text-slate-300 dark:text-slate-300">
                                    <span className="flex items-center gap-2">
                                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
                                        Products Imported (As New)
                                    </span>
                                    <span className="font-mono font-bold text-emerald-500">✔ {summary.importedCount}</span>
                                </div>

                                <div className="flex items-center justify-between text-slate-300 dark:text-slate-300">
                                    <span className="flex items-center gap-2">
                                        <span className="h-1.5 w-1.5 rounded-full bg-blue-500"></span>
                                        Categories Automatically Created
                                    </span>
                                    <span className="font-mono font-bold text-blue-500">✔ {summary.categoriesCreatedCount}</span>
                                </div>

                                <div className="flex items-center justify-between text-slate-300 dark:text-slate-300">
                                    <span className="flex items-center gap-2">
                                        <span className="h-1.5 w-1.5 rounded-full bg-indigo-500"></span>
                                        Existing Categories Reused
                                    </span>
                                    <span className="font-mono font-bold text-indigo-500">✔ {summary.categoriesReusedCount}</span>
                                </div>

                                <div className="flex items-center justify-between text-slate-300 dark:text-slate-300">
                                    <span className="flex items-center gap-2">
                                        <span className="h-1.5 w-1.5 rounded-full bg-purple-500"></span>
                                        Products Updated
                                    </span>
                                    <span className="font-mono font-bold text-purple-500">✔ {summary.updatedCount}</span>
                                </div>

                                <div className="flex items-center justify-between text-slate-300 dark:text-slate-300">
                                    <span className="flex items-center gap-2">
                                        <span className="h-1.5 w-1.5 rounded-full bg-amber-500"></span>
                                        Invalid or Skipped Rows
                                    </span>
                                    <span className="font-mono font-bold text-amber-500">⚠ {summary.skippedCount}</span>
                                </div>
                            </div>

                            <button
                                type="button"
                                onClick={onClose}
                                className="w-full py-3 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded-xl text-xs shadow cursor-pointer transition-all hover:scale-102"
                            >
                                Close Summary & View Menu
                            </button>
                        </div>
                    )}

                </div>

            </div>
        </div>
    );
}
