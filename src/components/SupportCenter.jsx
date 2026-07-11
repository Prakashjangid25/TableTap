import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  FiArrowLeft, 
  FiPhone, 
  FiMail, 
  FiBook, 
  FiCheckCircle, 
  FiChevronDown, 
  FiChevronUp, 
  FiHelpCircle,
  FiClock,
  FiActivity,
  FiSun,
  FiMoon
} from 'react-icons/fi';
import { FaWhatsapp } from 'react-icons/fa';
import { useTheme } from '../contexts/ThemeContext.jsx';

export default function SupportCenter() {
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';

  // FAQ open/close states
  const [openFaqIndex, setOpenFaqIndex] = useState(null);

  const toggleFaq = (index) => {
    setOpenFaqIndex(openFaqIndex === index ? null : index);
  };

  const faqs = [
    {
      question: "How do I generate QR Codes?",
      answer: "Go to the Restaurant Admin Dashboard, navigate to the Tables or Table QRs tab. From there, you can add new dining tables. TableTap will automatically generate a high-quality, secure QR Code mapped to that specific table."
    },
    {
      question: "How do I print QR Codes?",
      answer: "Navigate to the Table QRs tab in your Restaurant Admin Dashboard. Click the 'Print QR System' or 'Print All' button to open the premium printing layout, from which you can print directly to a physical printer or save as PDF."
    },
    {
      question: "How do I edit menu items?",
      answer: "In your Restaurant Admin Dashboard, open the Menu Catalog (or Menu Items) tab. Select any menu item to edit its price, description, images, tax settings, and availability, or click 'New Item' to add a new culinary selection."
    },
    {
      question: "How do I generate Kitchen Access Keys?",
      answer: "In the Restaurant Admin Dashboard, open the KDS Management tab. Click 'New Kitchen Screen', enter a kitchen name (e.g., Main Kitchen, Bar), and TableTap will instantly generate a secure 6-digit access key (e.g., KDS-XXXXXX) and a 4-digit PIN for that screen."
    },
    {
      question: "How do I reset my password?",
      answer: "If you are a Restaurant Admin, contact your Platform Super Admin to update your login credentials. If you are a Super Admin, you can update credentials from the platform configuration, or use Firebase Authentication's password reset features."
    },
    {
      question: "How do I update my restaurant logo?",
      answer: "Open the Store Settings tab in your Restaurant Admin Dashboard. In the restaurant details form, specify your new logo URL and click save. The logo will immediately be reflected on the customer's digital menu."
    },
    {
      question: "How do I configure payment settings?",
      answer: "Navigate to the Store Settings tab in your Restaurant Admin Dashboard. Here you can set your active UPI ID, currency, tax rates, and support preferences to ensure seamless digital payouts directly from your customers."
    },
    {
      question: "How do I contact TableTap support?",
      answer: "You can contact us 24/7 directly from this Help & Support Center! Simply use the quick buttons above to message us on WhatsApp, call our helpline, or send an email to Jangidp650@gmail.com."
    }
  ];

  const quickTips = [
    "Print your QR Codes before opening your restaurant.",
    "Test every QR after printing.",
    "Keep menu prices updated.",
    "Keep your UPI details updated.",
    "Generate Kitchen Keys only for trusted staff.",
    "Never share your Super Admin credentials.",
    "Backup important restaurant information regularly.",
    "Update your menu images for better customer experience."
  ];

  return (
    <div className={`min-h-screen ${isDark ? 'bg-slate-900 text-white' : 'bg-slate-50 text-slate-900'} font-sans pb-16 transition-colors duration-150`}>
      {/* Background glow effects */}
      <div className={`absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full ${isDark ? 'bg-rose-500/10' : 'bg-rose-500/5'} blur-[120px] pointer-events-none`} />
      <div className={`absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full ${isDark ? 'bg-amber-500/10' : 'bg-amber-500/5'} blur-[120px] pointer-events-none`} />

      {/* Main Header Nav */}
      <header className={`sticky top-0 z-30 backdrop-blur-md border-b ${isDark ? 'bg-slate-900/80 border-slate-800' : 'bg-white/80 border-slate-200'} px-6 py-4 transition-all`}>
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <button 
            onClick={() => navigate('/')} 
            className={`flex items-center gap-2 text-xs font-bold uppercase tracking-wider px-3 py-2 rounded-xl transition-all cursor-pointer ${
              isDark 
                ? 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700/50' 
                : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 shadow-sm'
            }`}
          >
            <FiArrowLeft className="text-sm" />
            <span>Back to Portal</span>
          </button>

          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse" />
            <span className="text-xs font-bold font-display uppercase tracking-widest text-rose-500">
              Support Center
            </span>
          </div>

          <button 
            onClick={toggleTheme} 
            className="theme-toggle flex items-center justify-center cursor-pointer shadow-md"
            title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
          >
            {theme === 'dark' ? <FiSun className="text-sm" /> : <FiMoon className="text-sm" />}
          </button>
        </div>
      </header>

      {/* Support Content Container */}
      <main className="max-w-4xl mx-auto px-6 pt-10 space-y-10 z-10 relative">
        
        {/* PREMIUM SUPPORT CARD (TOP) */}
        <div className={`p-8 md:p-12 rounded-3xl border relative overflow-hidden shadow-2xl flex flex-col md:flex-row items-center justify-between gap-6 ${
          isDark 
            ? 'bg-gradient-to-br from-slate-900 via-slate-900 to-rose-950/20 border-slate-800' 
            : 'bg-gradient-to-br from-white via-white to-rose-50/30 border-slate-200'
        }`}>
          <div className="space-y-3 text-center md:text-left">
            <div className="inline-flex px-3 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-widest bg-rose-500/10 text-rose-500 border border-rose-500/20">
              SaaS Assistant
            </div>
            <h1 className={`text-3xl md:text-5xl font-extrabold font-display tracking-tight leading-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
              Need Help?
            </h1>
            <p className={`text-sm md:text-base ${isDark ? 'text-slate-400' : 'text-slate-600'} max-w-md font-light`}>
              Our support team is always ready to help you. Reach out through any channel below to connect with us immediately.
            </p>
          </div>
          <div className="flex items-center justify-center w-20 h-20 md:w-28 md:h-28 rounded-2xl bg-rose-500/10 text-rose-500 border border-rose-500/20 shrink-0 shadow-lg">
            <FiHelpCircle className="text-4xl md:text-6xl animate-pulse" style={{ animationDuration: '4s' }} />
          </div>
        </div>

        {/* SUPPORT ACTION BUTTONS */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          
          {/* 1. WhatsApp Support */}
          <a 
            href="https://wa.me/919352120309"
            target="_blank"
            rel="noopener noreferrer"
            className={`group p-6 rounded-2xl border transition-all duration-300 shadow-lg flex flex-col justify-between hover:scale-[1.02] cursor-pointer ${
              isDark 
                ? 'bg-slate-900/50 border-slate-800 hover:bg-slate-800/80 hover:border-emerald-500/40' 
                : 'bg-white border-slate-200 hover:bg-slate-50 hover:border-emerald-500/40'
            }`}
          >
            <div>
              <div className="w-12 h-12 rounded-xl bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 flex items-center justify-center text-2xl mb-4 group-hover:scale-110 transition-transform">
                <FaWhatsapp />
              </div>
              <h3 className={`font-bold text-base mb-1 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                WhatsApp Support
              </h3>
              <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'} font-light mb-4`}>
                Chat instantly with a live support representative.
              </p>
            </div>
            <span className="text-xs font-bold text-emerald-500 hover:underline">
              Send Message →
            </span>
          </a>

          {/* 2. Call Support */}
          <a 
            href="tel:+919352120309"
            className={`group p-6 rounded-2xl border transition-all duration-300 shadow-lg flex flex-col justify-between hover:scale-[1.02] cursor-pointer ${
              isDark 
                ? 'bg-slate-900/50 border-slate-800 hover:bg-slate-800/80 hover:border-sky-500/40' 
                : 'bg-white border-slate-200 hover:bg-slate-50 hover:border-sky-500/40'
            }`}
          >
            <div>
              <div className="w-12 h-12 rounded-xl bg-sky-500/10 text-sky-500 border border-sky-500/20 flex items-center justify-center text-xl mb-4 group-hover:scale-110 transition-transform">
                <FiPhone />
              </div>
              <h3 className={`font-bold text-base mb-1 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                Call Support
              </h3>
              <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'} font-light mb-4`}>
                Speak directly with an expert on our hotline.
              </p>
            </div>
            <span className="text-xs font-bold text-sky-500 hover:underline">
              Call Now →
            </span>
          </a>

          {/* 3. Email Support */}
          <a 
            href="mailto:Jangidp650@gmail.com"
            className={`group p-6 rounded-2xl border transition-all duration-300 shadow-lg flex flex-col justify-between hover:scale-[1.02] cursor-pointer ${
              isDark 
                ? 'bg-slate-900/50 border-slate-800 hover:bg-slate-800/80 hover:border-rose-500/40' 
                : 'bg-white border-slate-200 hover:bg-slate-50 hover:border-rose-500/40'
            }`}
          >
            <div>
              <div className="w-12 h-12 rounded-xl bg-rose-500/10 text-rose-500 border border-rose-500/20 flex items-center justify-center text-xl mb-4 group-hover:scale-110 transition-transform">
                <FiMail />
              </div>
              <h3 className={`font-bold text-base mb-1 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                Email Support
              </h3>
              <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'} font-light mb-4`}>
                Write to our team for custom requests and sales.
              </p>
            </div>
            <span className="text-xs font-bold text-rose-500 hover:underline">
              Send Email →
            </span>
          </a>

          {/* 4. User Guide */}
          <div 
            className={`group p-6 rounded-2xl border transition-all duration-300 shadow-lg flex flex-col justify-between relative overflow-hidden ${
              isDark 
                ? 'bg-slate-900/50 border-slate-800' 
                : 'bg-white border-slate-200'
            }`}
          >
            <span className="absolute top-3 right-3 bg-amber-500/10 text-amber-500 text-[9px] px-2 py-0.5 rounded-full font-bold border border-amber-500/20 uppercase tracking-widest animate-pulse">
              Coming Soon
            </span>
            <div>
              <div className="w-12 h-12 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center justify-center text-xl mb-4">
                <FiBook />
              </div>
              <h3 className={`font-bold text-base mb-1 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                User Guide
              </h3>
              <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'} font-light mb-4`}>
                Comprehensive walkthroughs, manuals and video guides.
              </p>
            </div>
            <span className="text-xs font-bold text-slate-500 select-none">
              Not Available Yet
            </span>
          </div>

        </div>

        {/* SUPPORT STATUS */}
        <div className={`p-6 rounded-2xl border shadow-md ${isDark ? 'bg-slate-900/40 border-slate-800' : 'bg-white border-slate-200'}`}>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 divide-y md:divide-y-0 md:divide-x divide-slate-800/10 dark:divide-slate-700/30">
            {/* Status */}
            <div className="flex items-center gap-4 py-3 md:py-0">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 flex items-center justify-center text-xl shrink-0">
                <FiActivity />
              </div>
              <div>
                <span className={`text-[10px] uppercase tracking-wider font-extrabold ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Support Status</span>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-sm font-bold text-emerald-500 uppercase tracking-wider">Online</span>
                </div>
              </div>
            </div>

            {/* Working Hours */}
            <div className="flex items-center gap-4 py-3 md:py-0 md:pl-6">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-500 border border-amber-500/20 flex items-center justify-center text-xl shrink-0">
                <FiClock />
              </div>
              <div>
                <span className={`text-[10px] uppercase tracking-wider font-extrabold ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Working Hours</span>
                <p className={`text-xs font-semibold mt-0.5 ${isDark ? 'text-slate-300' : 'text-slate-800'}`}>
                  10:00 AM – 8:00 PM <span className="text-slate-500 text-[10px] font-normal">(Mon – Sat)</span>
                </p>
              </div>
            </div>

            {/* Average Response Time */}
            <div className="flex items-center gap-4 py-3 md:py-0 md:pl-6">
              <div className="w-10 h-10 rounded-xl bg-rose-500/10 text-rose-500 border border-rose-500/20 flex items-center justify-center text-xl shrink-0">
                <FiClock />
              </div>
              <div>
                <span className={`text-[10px] uppercase tracking-wider font-extrabold ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Avg Response Time</span>
                <p className={`text-xs font-bold mt-0.5 text-rose-500`}>
                  Within 15 Minutes
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* QUICK TIPS */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <h2 className={`text-xl font-bold font-display tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
              Quick Tips
            </h2>
            <div className="h-0.5 flex-1 bg-slate-800/10 dark:bg-slate-700/30 rounded" />
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {quickTips.map((tip, index) => (
              <div 
                key={index}
                className={`p-4 rounded-xl border flex items-start gap-3 shadow-sm transition-all hover:bg-slate-800/10 ${
                  isDark ? 'bg-slate-900/30 border-slate-800/80' : 'bg-white border-slate-200'
                }`}
              >
                <div className="text-emerald-500 shrink-0 mt-0.5 text-lg">
                  <FiCheckCircle />
                </div>
                <p className={`text-xs font-normal leading-relaxed ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                  {tip}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* FREQUENTLY ASKED QUESTIONS */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <h2 className={`text-xl font-bold font-display tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
              Frequently Asked Questions
            </h2>
            <div className="h-0.5 flex-1 bg-slate-800/10 dark:bg-slate-700/30 rounded" />
          </div>

          <div className="space-y-3">
            {faqs.map((faq, index) => {
              const isOpen = openFaqIndex === index;
              return (
                <div 
                  key={index}
                  className={`rounded-2xl border transition-all overflow-hidden ${
                    isDark 
                      ? 'bg-slate-900/30 border-slate-800 hover:border-slate-700' 
                      : 'bg-white border-slate-200 hover:border-slate-300 shadow-sm'
                  }`}
                >
                  <button
                    onClick={() => toggleFaq(index)}
                    className="w-full px-6 py-4 flex items-center justify-between text-left font-semibold text-xs md:text-sm select-none cursor-pointer"
                  >
                    <span className={isDark ? 'text-slate-200' : 'text-slate-800'}>{faq.question}</span>
                    <span className={`transition-transform duration-250 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                      {isOpen ? <FiChevronUp className="text-lg text-rose-500" /> : <FiChevronDown className="text-lg" />}
                    </span>
                  </button>
                  
                  {/* Smooth height expand transition */}
                  <div 
                    className={`transition-all duration-300 ease-in-out overflow-hidden ${
                      isOpen ? 'max-h-40 border-t' : 'max-h-0'
                    } ${isDark ? 'border-slate-800/50' : 'border-slate-100'}`}
                  >
                    <div className={`p-6 text-xs md:text-sm leading-relaxed font-light ${isDark ? 'text-slate-400 bg-slate-950/20' : 'text-slate-600 bg-slate-50/40'}`}>
                      {faq.answer}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* APP INFORMATION CARD */}
        <div className={`p-8 rounded-3xl border text-center space-y-3 shadow-md ${
          isDark ? 'bg-slate-950/40 border-slate-800' : 'bg-slate-100 border-slate-200'
        }`}>
          <h4 className={`text-lg font-bold font-display ${isDark ? 'text-white' : 'text-slate-800'}`}>TableTap</h4>
          <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-600'} tracking-wide`}>
            Restaurant QR Ordering SaaS
          </p>
          <div className="flex justify-center items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest text-rose-500">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
            <span>Version 1.0.0</span>
          </div>
          <div className="h-px bg-slate-800/10 dark:bg-slate-700/30 max-w-xs mx-auto my-3" />
          <p className="text-[10px] text-slate-500 font-medium">
            Powered by TableTap
          </p>
        </div>

      </main>
    </div>
  );
}
