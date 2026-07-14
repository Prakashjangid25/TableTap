import React, { useState, useRef } from 'react';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { storage } from '../firebase';
import { UploadCloud, Image as ImageIcon, Link as LinkIcon, X, RefreshCw, AlertCircle, CheckCircle, Loader2 } from 'lucide-react';

export default function ImageUploader({
    value,
    onChange,
    onUploadingStateChange,
    label = "Upload Image",
    isDark = false,
    maxSizeMB = 5
}) {
    const [uploadMethod, setUploadMethod] = useState('upload'); // 'upload' or 'url'
    const [progress, setProgress] = useState(0);
    const [isUploading, setIsUploading] = useState(false);
    const [error, setError] = useState('');
    const [dragActive, setDragActive] = useState(false);
    const fileInputRef = useRef(null);

    const handleUploadingState = (state) => {
        setIsUploading(state);
        if (onUploadingStateChange) {
            onUploadingStateChange(state);
        }
    };

    const validateAndUploadFile = (file) => {
        setError('');

        if (!file) return;

        // Validate type
        const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
        if (!validTypes.includes(file.type)) {
            setError('Unsupported file format. Please upload JPG, JPEG, PNG, or WEBP.');
            return;
        }

        // Validate size
        const maxSizeBytes = maxSizeMB * 1024 * 1024;
        if (file.size > maxSizeBytes) {
            setError(`File is too large. Maximum size allowed is ${maxSizeMB}MB.`);
            return;
        }

        // Start upload to Firebase Storage
        handleUploadingState(true);
        setProgress(0);

        const fileExtension = file.name.split('.').pop();
        const fileName = `uploads/${Date.now()}_${Math.random().toString(36).substring(2, 8)}.${fileExtension}`;
        const storageRef = ref(storage, fileName);

        const uploadTask = uploadBytesResumable(storageRef, file);

        uploadTask.on(
            'state_changed',
            (snapshot) => {
                const percentage = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
                setProgress(percentage);
            },
            (err) => {
                console.error("Firebase Storage Upload Error:", err);
                setError('Upload failed. Please try again.');
                handleUploadingState(false);
            },
            async () => {
                try {
                    const downloadUrl = await getDownloadURL(uploadTask.snapshot.ref);
                    onChange(downloadUrl);
                    setError('');
                } catch (getUrlErr) {
                    console.error("Error getting download URL:", getUrlErr);
                    setError('Failed to retrieve image URL after upload.');
                } finally {
                    handleUploadingState(false);
                }
            }
        );
    };

    const handleFileChange = (e) => {
        const file = e.target.files?.[0];
        if (file) {
            validateAndUploadFile(file);
        }
    };

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

        const file = e.dataTransfer?.files?.[0];
        if (file) {
            validateAndUploadFile(file);
        }
    };

    const triggerFileInput = () => {
        fileInputRef.current?.click();
    };

    const handleRemoveImage = () => {
        onChange('');
        setProgress(0);
        setError('');
    };

    return (
        <div className="space-y-2.5">
            <div className="flex items-center justify-between">
                <label className={`text-xs font-bold uppercase tracking-wider ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                    {label}
                </label>

                {/* Toggle between Upload and URL */}
                <div className={`flex rounded-lg p-0.5 border ${isDark ? 'bg-slate-950 border-slate-800' : 'bg-slate-100 border-slate-200'}`}>
                    <button
                        type="button"
                        onClick={() => {
                            setUploadMethod('upload');
                            setError('');
                        }}
                        className={`px-2.5 py-1 text-[10px] font-bold rounded-md transition-all cursor-pointer flex items-center gap-1 ${uploadMethod === 'upload'
                                ? isDark ? 'bg-slate-800 text-white shadow-sm' : 'bg-white text-slate-800 shadow-sm'
                                : 'text-slate-500 hover:text-slate-700'
                            }`}
                    >
                        <UploadCloud size={11} />
                        Upload
                    </button>
                    <button
                        type="button"
                        onClick={() => {
                            setUploadMethod('url');
                            setError('');
                        }}
                        className={`px-2.5 py-1 text-[10px] font-bold rounded-md transition-all cursor-pointer flex items-center gap-1 ${uploadMethod === 'url'
                                ? isDark ? 'bg-slate-800 text-white shadow-sm' : 'bg-white text-slate-800 shadow-sm'
                                : 'text-slate-500 hover:text-slate-700'
                            }`}
                    >
                        <LinkIcon size={11} />
                        Image URL
                    </button>
                </div>
            </div>

            {value ? (
                /* Image Preview Box */
                <div className={`relative rounded-xl border p-3 flex items-center gap-4 group transition-all ${isDark ? 'bg-slate-900/50 border-slate-800' : 'bg-slate-50 border-slate-200'
                    }`}>
                    <div className="relative w-16 h-16 rounded-lg overflow-hidden border border-slate-200/50 dark:border-slate-800/50 bg-slate-100 dark:bg-slate-950 flex-shrink-0">
                        <img
                            src={value}
                            alt="Preview"
                            className="w-full h-full object-cover"
                            onError={(e) => {
                                e.target.src = "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&q=80&w=400";
                            }}
                        />
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className={`text-xs font-semibold truncate ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>
                            {value.startsWith('data:') ? 'Base64 Encoded Image' : value.split('/').pop().split('?')[0]}
                        </p>
                        <p className="text-[10px] text-slate-400 truncate mt-0.5">
                            {value}
                        </p>
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                        {uploadMethod === 'upload' && (
                            <button
                                type="button"
                                onClick={triggerFileInput}
                                className={`p-1.5 rounded-lg border transition-all cursor-pointer hover:scale-105 ${isDark ? 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-300' : 'bg-white hover:bg-slate-100 border-slate-200 text-slate-600'
                                    }`}
                                title="Replace Image"
                            >
                                <RefreshCw size={13} />
                            </button>
                        )}
                        <button
                            type="button"
                            onClick={handleRemoveImage}
                            className="p-1.5 rounded-lg border border-rose-500/20 bg-rose-500/5 hover:bg-rose-500/10 text-rose-500 transition-all cursor-pointer hover:scale-105"
                            title="Remove Image"
                        >
                            <X size={13} />
                        </button>
                    </div>
                </div>
            ) : (
                /* Input Controls */
                <div>
                    {uploadMethod === 'upload' ? (
                        <div
                            onDragEnter={handleDrag}
                            onDragOver={handleDrag}
                            onDragLeave={handleDrag}
                            onDrop={handleDrop}
                            onClick={triggerFileInput}
                            className={`border-2 border-dashed rounded-2xl p-5 text-center cursor-pointer transition-all flex flex-col items-center justify-center min-h-[120px] ${dragActive
                                    ? 'border-amber-500 bg-amber-500/5'
                                    : isDark
                                        ? 'border-slate-800 hover:border-slate-700 bg-slate-900/20 hover:bg-slate-900/40'
                                        : 'border-slate-200 hover:border-slate-300 bg-slate-50 hover:bg-slate-100/50'
                                }`}
                        >
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept="image/png, image/jpeg, image/jpg, image/webp"
                                onChange={handleFileChange}
                                className="hidden"
                            />

                            {isUploading ? (
                                <div className="w-full max-w-[200px] space-y-2">
                                    <Loader2 className="h-6 w-6 animate-spin text-amber-500 mx-auto" />
                                    <p className={`text-xs font-medium ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                                        Uploading image... {progress}%
                                    </p>
                                    <div className="w-full h-1 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-amber-500 rounded-full transition-all duration-300"
                                            style={{ width: `${progress}%` }}
                                        />
                                    </div>
                                </div>
                            ) : (
                                <div className="space-y-1.5">
                                    <div className={`mx-auto w-10 h-10 rounded-full flex items-center justify-center border transition-all ${isDark ? 'bg-slate-800 border-slate-700 text-slate-300' : 'bg-white border-slate-200 text-slate-500'
                                        }`}>
                                        <UploadCloud size={18} />
                                    </div>
                                    <div className="space-y-0.5">
                                        <p className={`text-xs font-semibold ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>
                                            Click to upload or drag & drop
                                        </p>
                                        <p className="text-[10px] text-slate-400">
                                            Supports PNG, JPG, JPEG, or WEBP (Max {maxSizeMB}MB)
                                        </p>
                                    </div>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="relative">
                            <input
                                type="url"
                                value={value || ''}
                                onChange={(e) => onChange(e.target.value)}
                                placeholder="https://images.unsplash.com/..."
                                className={`w-full px-3.5 py-2 text-xs rounded-xl border focus:outline-none focus:border-amber-500 transition-all ${isDark ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'
                                    }`}
                            />
                            <div className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400">
                                <ImageIcon size={14} />
                            </div>
                        </div>
                    )}
                </div>
            )}

            {error && (
                <div className="text-[11px] text-rose-500 flex items-center gap-1.5 bg-rose-500/5 border border-rose-500/10 px-3 py-2 rounded-xl">
                    <AlertCircle size={13} className="flex-shrink-0" />
                    <span>{error}</span>
                </div>
            )}
        </div>
    );
}
