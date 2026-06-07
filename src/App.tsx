/**
 * SabanOS - H. Saban Logistics Premium Operational Platform
 */

import React, { useState, useEffect } from "react";
import { onAuthStateChanged, User as FirebaseUser } from "firebase/auth";
import { collection, onSnapshot } from "firebase/firestore";
import { auth, signInWithGoogle, signOutUser, db } from "./firebase";
import { seedInitialFirestoreData } from "./components/seed";
import { KanbanView } from "./components/KanbanView";
import { NoaChatView } from "./components/NoaChatView";
import { InventoryCustomerView } from "./components/InventoryCustomerView";
import { DriversView } from "./components/DriversView";
import { RemindersOverview } from "./components/RemindersOverview";
import { NotificationManager } from "./components/NotificationManager";
import { Driver, Order, InventoryItem } from "./types";
import { 
  Briefcase, MessageSquare, Shield, HelpCircle, LogOut, Kanban, Box, Users, HardHat, Bell, Key, Sparkles, AlertTriangle
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

export default function App() {
  const [user, setUser] = useState<any>(null);
  const [loadingAuth, setLoadingAuth] = useState(true);
  
  // Real-time globally synced drivers, orders, and inventory
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);

  // Navigation tab key: kanban | chat | inventory | drivers
  const [activeTab, setActiveTab] = useState<"kanban" | "chat" | "inventory" | "drivers">("kanban");

  // Refs and logic to preserve and restore scroll state on tab change
  const mainRef = React.useRef<HTMLDivElement>(null);
  const scrollPositions = React.useRef<Record<string, number>>({
    kanban: 0,
    chat: 0,
    inventory: 0,
    drivers: 0,
  });

  const handleScroll = () => {
    if (!mainRef.current) return;
    scrollPositions.current[activeTab] = mainRef.current.scrollTop;
  };

  useEffect(() => {
    if (!mainRef.current) return;
    
    const originalScrollBehavior = mainRef.current.style.scrollBehavior;
    mainRef.current.style.scrollBehavior = "auto";
    mainRef.current.scrollTop = scrollPositions.current[activeTab] || 0;
    
    const timeoutId = setTimeout(() => {
      if (mainRef.current) {
        mainRef.current.style.scrollBehavior = originalScrollBehavior;
      }
    }, 50);

    return () => clearTimeout(timeoutId);
  }, [activeTab]);

  // Track initial Firestore seeding status
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        // Seed the firestore instance with mock orders / inventory if empty
        await seedInitialFirestoreData();
      } else {
        setUser(null);
      }
      setLoadingAuth(false);
    });
    return () => unsub();
  }, []);

  // Sync drivers list for assignments across app
  useEffect(() => {
    if (!user) return;
    const unsub = onSnapshot(collection(db, "drivers"), (snap) => {
      const list: Driver[] = [];
      snap.forEach((d) => {
        list.push({ ...d.data(), id: d.id } as Driver);
      });
      setDrivers(list);
    });
    return () => unsub();
  }, [user]);

  // Sync orders for real-time activity and pending status counts
  useEffect(() => {
    if (!user) return;
    const unsub = onSnapshot(collection(db, "orders"), (snap) => {
      const list: Order[] = [];
      snap.forEach((d) => {
        list.push({ ...d.data(), id: d.id } as Order);
      });
      setOrders(list);
    });
    return () => unsub();
  }, [user]);

  // Sync inventory levels for low stock alerts
  useEffect(() => {
    if (!user) return;
    const unsub = onSnapshot(collection(db, "inventory"), (snap) => {
      const list: InventoryItem[] = [];
      snap.forEach((d) => {
        list.push({ ...d.data(), id: d.id } as InventoryItem);
      });
      setInventory(list);
    });
    return () => unsub();
  }, [user]);

  const handleDemoBypass = async () => {
    // Custom sandbox bypass login using fake user state for iframe flexibility
    const mockUser = {
      uid: "sandbox_dispatcher_saban",
      displayName: "ח. סבן (מנהל מערכת)",
      email: "hsaban2025@gmail.com",
      emailVerified: true,
      photoURL: "https://images.unsplash.com/photo-1590650511194-6152ab2ac61f?w=100&q=80"
    };
    setUser(mockUser);
    await seedInitialFirestoreData();
    setLoadingAuth(false);
  };

  const handleSignOut = async () => {
    try {
      await signOutUser();
      setUser(null);
    } catch (e) {
      console.error(e);
    }
  };

  // Derived dynamic metrics for color-coded status badges on bottom navigation
  const pendingJobsCount = orders.filter(
    (o) => o.status === "pending" || o.status === "in_transit"
  ).length;

  const lowStockCount = inventory.filter(
    (item) => item.currentStock < item.minStock
  ).length;

  const activeDriversCount = drivers.filter(
    (d) => d.status === "active" || d.status === "busy"
  ).length;

  if (loadingAuth) {
    return (
      <div className="min-h-screen bg-[#FDFDFF] flex flex-col justify-center items-center text-right p-6" dir="rtl" id="app-auth-checker">
        <motion.div 
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }}
          className="w-10 h-10 border-4 border-amber-500 border-t-transparent rounded-full mb-4"
        />
        <h2 className="text-md font-bold text-gray-900 font-sans">מאתחל מערכת סנכרון SabanOS...</h2>
        <p className="text-xs text-gray-400 mt-1 font-mono">H. Saban Logistics OS v2.10</p>
      </div>
    );
  }

  return (
    <div className="w-full min-h-screen bg-[#FDFDFF] relative overflow-hidden flex items-center justify-center p-0 sm:p-4 md:p-8" id="saban-os-main-app">
      {/* Background Decor */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-gray-100 rounded-full blur-3xl opacity-50 -mr-48 -mt-48 pointer-events-none"></div>
      <div className="absolute bottom-0 left-0 w-80 h-80 bg-slate-200 rounded-full blur-3xl opacity-35 -ml-40 -mb-40 pointer-events-none"></div>

      <div className="w-full max-w-5xl flex flex-col md:flex-row items-center justify-center gap-10 md:gap-14 z-10 p-2 sm:p-0">
        {/* Actual App Content container - mimics a premium device frame on desktop */}
        <div className="relative w-full max-w-md h-[100vh] sm:h-[820px] bg-white sm:rounded-[3rem] shadow-none sm:shadow-2xl border-0 sm:border-[12px] border-gray-900 overflow-hidden flex flex-col" dir="rtl">
          {/* Mock Status Bar */}
          <div className="w-full h-8 flex justify-between items-center px-8 pt-4 pb-1 text-gray-900 bg-white/40 backdrop-blur-md shrink-0">
            <span className="text-xs font-bold tracking-tight">09:41</span>
            <div className="flex gap-1.5 items-center">
              <span className="text-[10px] font-mono opacity-60">SabanOS</span>
              <div className="w-4 h-2.5 border border-gray-900 rounded-sm p-0.5 flex">
                <div className="w-full h-full bg-gray-900 rounded-2xs"></div>
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-hidden flex flex-col relative">
            <AnimatePresence mode="wait">
              {!user ? (
                /* Premium Glassmorphic Login Layout screen */
                <motion.div 
                  key="login-view"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex-1 w-full flex flex-col justify-between items-center px-6 py-8 bg-gradient-to-b from-[#FAFBFD] to-[#F2F4F8] text-right text-gray-900 overflow-y-auto" 
                  dir="rtl"
                  id="login-view"
                >
                  {/* Top Brand Info */}
                  <div className="text-center w-full mt-6" id="login-brand-meta">
                    <div className="inline-block bg-gray-900 text-amber-500 p-4 rounded-3xl shadow-lg mb-4">
                      <HardHat className="w-10 h-10 animate-bounce" />
                    </div>
                    <h1 className="text-3xl font-black tracking-tighter text-gray-900 font-sans">SabanOS</h1>
                    <p className="text-[10px] uppercase tracking-widest text-gray-400 font-bold">H. Saban Logistics</p>
                    <div className="text-[10px] bg-amber-50 text-amber-800 border border-amber-100 py-1 px-3.5 rounded-full inline-block mt-3 font-bold">
                      ח. סבן לוגיסטיקה והובלות
                    </div>
                  </div>

                  {/* Core Action triggers */}
                  <div className="w-full max-w-sm bg-white/70 backdrop-blur-md p-6 rounded-[2rem] border border-white/60 shadow-xl space-y-4 my-auto" id="login-actions-box">
                    <h2 className="text-xs font-bold text-gray-900 text-center mb-1">כניסה מאובטחת לשירות שטח וסדרנים</h2>
                    
                    <button 
                      onClick={signInWithGoogle}
                      className="w-full bg-white hover:bg-gray-50 text-gray-850 font-bold py-3.5 px-4 rounded-2xl shadow border border-gray-200/90 flex items-center justify-center gap-2.5 text-xs transition-all active:scale-98"
                      id="btn-google-login"
                    >
                      <Key className="w-4 h-4 text-amber-500" />
                      <span>כניסה באמצעות שירות Google</span>
                    </button>

                    <div className="flex items-center gap-2 justify-center py-1" id="login-separator">
                      <div className="h-[1px] bg-gray-200 flex-1" />
                      <span className="text-[9px] text-gray-400 font-bold uppercase tracking-wider">או כניסת הדגמה מהירה</span>
                      <div className="h-[1px] bg-gray-200 flex-1" />
                    </div>

                    {/* Demo Sandbox connection bypass for seamless evaluation inside blocked iFrames */}
                    <button 
                      onClick={handleDemoBypass}
                      className="w-full bg-gray-900 hover:bg-black text-white font-bold py-3.5 px-4 rounded-2xl shadow-md flex items-center justify-center gap-2.5 text-xs transition-all active:scale-98"
                      id="btn-sandbox-login"
                    >
                      <Sparkles className="w-4 h-4 text-amber-400" />
                      <span>כניסה מהירה (גרסת הדגמה ללא פופ-אפ)</span>
                    </button>

                    <p className="text-[10px] text-gray-500 leading-relaxed text-center">
                      * כפתור הדמו עוקף מגבלות דפדפן וחוסמי פופ-אפ בתוך iFrames של עבודה לפיתוח.
                    </p>
                  </div>

                  {/* Footer rights metadata */}
                  <div className="text-center text-[10px] text-gray-400 mt-4" id="login-footer">
                    <p>© H. Saban Logistics & Logistics LTD 2026. כל הזכויות שמורות.</p>
                    <p className="mt-1 font-mono text-[9px] opacity-75">Saban Intelligent Drive Core API v2</p>
                  </div>
                </motion.div>
              ) : (
                /* Active Application Screens Frame */
                <motion.div 
                  key="app-view"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex-1 w-full relative h-full flex flex-col overflow-hidden bg-[#FDFDFF]"
                  id="workspace-view"
                >
                  {/* Minimal App Navigation Header Rail */}
                  <header className="bg-white/90 backdrop-blur-xl px-5 py-4 flex justify-between items-center border-b border-gray-100 shrink-0" id="app-top-header">
                    <div className="text-right">
                      <h1 className="text-2xl font-black text-gray-900 tracking-tighter leading-tight font-sans">SabanOS</h1>
                      <p className="text-[10px] uppercase tracking-widest text-[#B5BAC9] font-bold">H. Saban Logistics</p>
                    </div>

                    {/* Header Right utilities features */}
                    <div className="flex items-center gap-2">
                      {/* Push Alerts & Chime sound trigger */}
                      <NotificationManager />

                      {/* Reminders Pill indicator popups */}
                      <RemindersOverview />

                      {/* Display user avatar or elegant serif monogram "S" / First initial */}
                      <div className="w-9 h-9 rounded-full bg-gray-900 hover:bg-black text-white flex items-center justify-center font-serif italic text-base shadow-md cursor-pointer transition-all active:scale-95" title={user.displayName || "משתמש סבן"}>
                        {user.displayName ? user.displayName.charAt(0) : "S"}
                      </div>

                      <button 
                        onClick={handleSignOut}
                        title="נתק מערכת"
                        className="p-2 bg-gray-50 hover:bg-gray-100 text-gray-650 hover:text-rose-600 rounded-full transition-all active:scale-90"
                        id="btn-sign-out"
                      >
                        <LogOut className="w-4 h-4" />
                      </button>
                    </div>
                  </header>

                  {/* Active view component map routing switcher with scroll-preservation keeping views mounted */}
                  <main 
                    ref={mainRef}
                    onScroll={handleScroll}
                    className="flex-1 flex flex-col overflow-y-auto pb-32 sm:pb-28 bg-[#FDFDFF] scroll-smooth"
                  >
                    <div className={activeTab === "kanban" ? "" : "hidden"} id="tab-holder-kanban">
                      <KanbanView drivers={drivers} setActiveTab={setActiveTab} />
                    </div>
                    <div className={activeTab === "chat" ? "" : "hidden"} id="tab-holder-chat">
                      <NoaChatView />
                    </div>
                    <div className={activeTab === "inventory" ? "" : "hidden"} id="tab-holder-inventory">
                      <InventoryCustomerView />
                    </div>
                    <div className={activeTab === "drivers" ? "" : "hidden"} id="tab-holder-drivers">
                      <DriversView drivers={drivers} />
                    </div>
                  </main>

                  {/* STRICT FIXED BOTTOM NAVIGATION BAR: Strict Bottom Navigation Bar for core views (Kanban, Chat, List, Drivers) */}
                  <nav className="fixed sm:absolute bottom-0 left-0 right-0 w-full bg-white/95 backdrop-blur-xl border-t border-gray-150/70 shadow-[0_-8px_30px_rgb(0,0,0,0.06)] px-4 pt-4 pb-[calc(1rem+env(safe-area-inset-bottom))] z-50 flex justify-around items-center" id="strict-bottom-nav">
                    <button 
                      onClick={() => {
                        if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
                          try { navigator.vibrate(12); } catch (e) {}
                        }
                        setActiveTab("kanban");
                      }}
                      className="flex flex-col items-center justify-center flex-1 relative active:scale-90 transition-all duration-150 cursor-pointer select-none"
                      id="nav-tab-kanban"
                      style={{ minWidth: "48px", minHeight: "48px" }}
                    >
                      <div className={`relative w-14 h-14 rounded-2xl flex items-center justify-center transition-all duration-200 ${
                        activeTab === "kanban" ? "bg-gray-900 text-white shadow-lg shadow-gray-900/20" : "bg-transparent text-gray-400"
                      }`}>
                        <Kanban className="w-6.5 h-6.5" />
                        {pendingJobsCount > 0 && (
                          <span className="absolute -top-1 -right-1 flex h-5.5 w-5.5 items-center justify-center rounded-full bg-amber-500 text-[10px] font-black text-white ring-2 ring-white shadow-xs">
                            {pendingJobsCount}
                          </span>
                        )}
                      </div>
                      <span className={`text-[10px] mt-1.5 transition-colors font-black ${
                        activeTab === "kanban" ? "text-gray-950 font-black" : "text-gray-400 font-bold"
                      }`}>לוח</span>
                    </button>

                    <button 
                      onClick={() => {
                        if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
                          try { navigator.vibrate(12); } catch (e) {}
                        }
                        setActiveTab("chat");
                      }}
                      className="flex flex-col items-center justify-center flex-1 relative active:scale-90 transition-all duration-150 cursor-pointer select-none"
                      id="nav-tab-chat"
                      style={{ minWidth: "48px", minHeight: "48px" }}
                    >
                      <div className={`relative w-14 h-14 rounded-2xl flex items-center justify-center transition-all duration-200 ${
                        activeTab === "chat" ? "bg-gray-900 text-white shadow-lg shadow-gray-900/20" : "bg-transparent text-gray-400"
                      }`}>
                        <MessageSquare className="w-6.5 h-6.5" />
                        <span className="absolute -top-0.5 -right-0.5 flex h-3 w-3">
                          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-indigo-400 opacity-75"></span>
                          <span className="relative inline-flex h-3 w-3 rounded-full bg-indigo-500"></span>
                        </span>
                      </div>
                      <span className={`text-[10px] mt-1.5 transition-colors font-black ${
                        activeTab === "chat" ? "text-gray-950 font-black" : "text-gray-400 font-bold"
                      }`}>AI צ'אט</span>
                    </button>

                    <button 
                      onClick={() => {
                        if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
                          try { navigator.vibrate(12); } catch (e) {}
                        }
                        setActiveTab("inventory");
                      }}
                      className="flex flex-col items-center justify-center flex-1 relative active:scale-90 transition-all duration-150 cursor-pointer select-none"
                      id="nav-tab-inventory"
                      style={{ minWidth: "48px", minHeight: "48px" }}
                    >
                      <div className={`relative w-14 h-14 rounded-2xl flex items-center justify-center transition-all duration-200 ${
                        activeTab === "inventory" ? "bg-gray-900 text-white shadow-lg shadow-gray-900/20" : "bg-transparent text-gray-400"
                      }`}>
                        <Box className="w-6.5 h-6.5" />
                        {lowStockCount > 0 && (
                          <span className="absolute -top-1 -right-1 flex h-5.5 w-5.5 items-center justify-center rounded-full bg-rose-600 text-[10px] font-black text-white ring-2 ring-white animate-pulse shadow-xs">
                             {lowStockCount}
                          </span>
                        )}
                      </div>
                      <span className={`text-[10px] mt-1.5 transition-colors font-black ${
                        activeTab === "inventory" ? "text-gray-950 font-black" : "text-gray-400 font-bold"
                      }`}>מלאי</span>
                    </button>

                    <button 
                      onClick={() => {
                        if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
                          try { navigator.vibrate(12); } catch (e) {}
                        }
                        setActiveTab("drivers");
                      }}
                      className="flex flex-col items-center justify-center flex-1 relative active:scale-90 transition-all duration-150 cursor-pointer select-none"
                      id="nav-tab-drivers"
                      style={{ minWidth: "48px", minHeight: "48px" }}
                    >
                      <div className={`relative w-14 h-14 rounded-2xl flex items-center justify-center transition-all duration-200 ${
                        activeTab === "drivers" ? "bg-gray-900 text-white shadow-lg shadow-gray-900/20" : "bg-transparent text-gray-400"
                      }`}>
                        <Users className="w-6.5 h-6.5" />
                        {activeDriversCount > 0 && (
                          <span className="absolute -top-1 -right-1 flex h-5.5 w-5.5 items-center justify-center rounded-full bg-emerald-500 text-[10px] font-black text-white ring-2 ring-white shadow-xs">
                            {activeDriversCount}
                          </span>
                        )}
                      </div>
                      <span className={`text-[10px] mt-1.5 transition-colors font-black ${
                        activeTab === "drivers" ? "text-gray-950 font-black" : "text-gray-400 font-bold"
                      }`}>נהגים</span>
                    </button>
                  </nav>

                  {/* Safe Area Indicator */}
                  <div className="absolute bottom-1.5 left-1/2 transform -translate-x-1/2 w-32 h-1 bg-gray-200 rounded-full z-50 pointer-events-none hidden sm:block"></div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Side Info Panel - True to the "Artistic Flair" mock presentation setup */}
        <div className="hidden md:flex flex-col text-right max-w-xs" dir="rtl" id="desktop-artistic-sidebar">
          <h2 className="text-4xl font-black text-gray-900 leading-none mb-3 tracking-tighter">SabanOS<br/>Core Platform</h2>
          <p className="text-gray-500 mb-6 font-medium text-xs leading-relaxed">
            מערכת תפעול ענן עם לוח פיקוד קנבן תעשייתי, סנכרון לוגיסטי בזמן אמת, ממשק ניהול מלאי מתקדם, וצ'אט עוזרת קולית נועה AI.
          </p>
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 rounded-full bg-gray-900"></div>
              <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">ממשק אלגנטי בגימור זכוכית</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 rounded-full bg-gray-900"></div>
              <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">סנכרון Firestore בזמן אמת</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 rounded-full bg-gray-900"></div>
              <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">ניהול צי הובלות ומנופים חכם</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
