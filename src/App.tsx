/**
 * SabanOS - H. Saban Logistics Premium Operational Platform
 */

import React, { useState, useEffect } from "react";
import { onAuthStateChanged, User as FirebaseUser } from "firebase/auth";
import { collection, onSnapshot, getDocs } from "firebase/firestore";
import { auth, signInWithGoogle, signOutUser, db } from "./firebase";
import { seedInitialFirestoreData } from "./components/seed";
import { KanbanView } from "./components/KanbanView";
import { NoaChatRoom } from "./components/NoaChatRoom";
import { InventoryCustomerView } from "./components/InventoryCustomerView";
import { DriversView } from "./components/DriversView";
import { RemindersOverview } from "./components/RemindersOverview";
import { NotificationManager } from "./components/NotificationManager";
import { Driver, Order, InventoryItem } from "./types";
import { 
  Briefcase, MessageSquare, Shield, HelpCircle, LogOut, Kanban, Box, Users, HardHat, Bell, Key, Sparkles, AlertTriangle, Search, Clock, MapPin, ChevronRight
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

export default function App() {
  const [user, setUser] = useState<any>(null);
  const [loadingAuth, setLoadingAuth] = useState(true);
  
  // Real-time globally synced drivers, orders, and inventory
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);

  // High Priority Unacknowledged Orders Alerts Modal State
  const [pendingAlerts, setPendingAlerts] = useState<Order[]>([]);
  const isInitialLoadRef = React.useRef(true);
  const [toasts, setToasts] = useState<Array<{ id: string; title: string; description: string }>>([]);

  const addToast = (title: string, description: string) => {
    const id = Date.now().toString() + Math.random().toString();
    setToasts(prev => [...prev, { id, title, description }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 5000);
  };

  // Navigation tab key: kanban | chat | inventory | drivers
  const [activeTab, setActiveTab] = useState<"kanban" | "chat" | "inventory" | "drivers">("kanban");
  const [globalSearchQuery, setGlobalSearchQuery] = useState("");
  const [isNoaSidebarOpen, setIsNoaSidebarOpen] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState<boolean>(true);
  const [lastUpdated, setLastUpdated] = useState<string>("");

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
    if (!autoRefresh) {
      getDocs(collection(db, "drivers")).then((snap) => {
        const list: Driver[] = [];
        snap.forEach((d) => {
          list.push({ ...d.data(), id: d.id } as Driver);
        });
        setDrivers(list);
        setLastUpdated(new Date().toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit", second: "2-digit" }));
      }).catch(err => console.error(err));
      return;
    }
    const unsub = onSnapshot(collection(db, "drivers"), (snap) => {
      const list: Driver[] = [];
      snap.forEach((d) => {
        list.push({ ...d.data(), id: d.id } as Driver);
      });
      setDrivers(list);
      setLastUpdated(new Date().toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit", second: "2-digit" }));
    });
    return () => unsub();
  }, [user, autoRefresh]);

  // Sync orders for real-time activity and pending status counts
  useEffect(() => {
    if (!user) return;
    if (!autoRefresh) {
      getDocs(collection(db, "orders")).then((snap) => {
        const list: Order[] = [];
        snap.forEach((d) => {
          list.push({ ...d.data(), id: d.id } as Order);
        });
        setOrders(list);
        setLastUpdated(new Date().toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit", second: "2-digit" }));
      }).catch(err => console.error(err));
      return;
    }
    const unsub = onSnapshot(collection(db, "orders"), (snap) => {
      const list: Order[] = [];
      snap.forEach((d) => {
        list.push({ ...d.data(), id: d.id } as Order);
      });

      // Audit real-time change triggers for alert mechanisms
      if (isInitialLoadRef.current) {
        isInitialLoadRef.current = false;
      } else {
        snap.docChanges().forEach((change) => {
          if (change.type === "added") {
            const newOrder = { ...change.doc.data(), id: change.doc.id } as Order;
            if (newOrder.status === "pending") {
              // Add to unacknowledged pending alerts queue (avoiding duplicates)
              setPendingAlerts((prev) => {
                if (prev.some((o) => o.id === newOrder.id || o.orderNumber === newOrder.orderNumber)) {
                  return prev;
                }
                return [...prev, newOrder];
              });

              // Play Dual-Tone Frequency Synthesizer sound safely
              try {
                const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
                
                const playBeep = (freq: number, delay: number, duration: number) => {
                  setTimeout(() => {
                    const osc = audioCtx.createOscillator();
                    const gain = audioCtx.createGain();
                    osc.connect(gain);
                    gain.connect(audioCtx.destination);
                    osc.type = "sine";
                    osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
                    gain.gain.setValueAtTime(0.35, audioCtx.currentTime);
                    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + duration);
                    osc.start();
                    osc.stop(audioCtx.currentTime + duration);
                  }, delay * 1000);
                };

                // Sweet alerting chime
                playBeep(523.25, 0, 0.22); // C5
                playBeep(783.99, 0.16, 0.28); // G5
              } catch (e) {
                console.error("Audio synth beep failed", e);
              }

              // Visual custom Toast pop-up
              addToast(
                `הזמנה חדשה ב-SabanOS`,
                `לקוח: ${newOrder.customerName} | יעד: ${newOrder.destination}`
              );

              // Standard OS/System level Push Alert fallback
              if ("Notification" in window) {
                if (Notification.permission === "granted") {
                  new Notification(`סבן OS • הזמנה חדשה ממתינה`, {
                    body: `לקוח: ${newOrder.customerName} | פריחה: ${newOrder.items || "חומרי בניין"}`,
                    dir: "rtl"
                  });
                } else if (Notification.permission !== "denied") {
                  Notification.requestPermission().then((permission) => {
                    if (permission === "granted") {
                      new Notification(`סבן OS • הזמנה חדשה ממתינה`, {
                        body: `לקוח: ${newOrder.customerName} | פריחה: ${newOrder.items || "חומרי בניין"}`,
                        dir: "rtl"
                      });
                    }
                  });
                }
              }
            }
          }
        });
      }

      setOrders(list);
      setLastUpdated(new Date().toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit", second: "2-digit" }));
    });
    return () => unsub();
  }, [user, autoRefresh]);

  // Sync inventory levels for low stock alerts
  useEffect(() => {
    if (!user) return;
    if (!autoRefresh) {
      getDocs(collection(db, "inventory")).then((snap) => {
        const list: InventoryItem[] = [];
        snap.forEach((d) => {
          list.push({ ...d.data(), id: d.id } as InventoryItem);
        });
        setInventory(list);
        setLastUpdated(new Date().toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit", second: "2-digit" }));
      }).catch(err => console.error(err));
      return;
    }
    const unsub = onSnapshot(collection(db, "inventory"), (snap) => {
      const list: InventoryItem[] = [];
      snap.forEach((d) => {
        list.push({ ...d.data(), id: d.id } as InventoryItem);
      });
      setInventory(list);
      setLastUpdated(new Date().toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit", second: "2-digit" }));
    });
    return () => unsub();
  }, [user, autoRefresh]);

  // Manual trigger to refresh references from cloud DB
  const handleManualRefresh = async () => {
    if (!user) return;
    try {
      const [driversSnap, ordersSnap, inventorySnap] = await Promise.all([
        getDocs(collection(db, "drivers")),
        getDocs(collection(db, "orders")),
        getDocs(collection(db, "inventory")),
      ]);

      const dList: Driver[] = [];
      driversSnap.forEach((d) => {
        dList.push({ ...d.data(), id: d.id } as Driver);
      });
      setDrivers(dList);

      const oList: Order[] = [];
      ordersSnap.forEach((d) => {
        oList.push({ ...d.data(), id: d.id } as Order);
      });
      setOrders(oList);

      const iList: InventoryItem[] = [];
      inventorySnap.forEach((d) => {
        iList.push({ ...d.data(), id: d.id } as InventoryItem);
      });
      setInventory(iList);

      setLastUpdated(new Date().toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit", second: "2-digit" }));
    } catch (err) {
      console.error("Error refreshing data manually:", err);
    }
  };

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
    <div className="w-full min-h-screen bg-[#FDFDFF] relative overflow-hidden flex items-center justify-center p-0" id="saban-os-main-app">
      {/* Background Decor */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-gray-100 rounded-full blur-3xl opacity-50 -mr-48 -mt-48 pointer-events-none"></div>
      <div className="absolute bottom-0 left-0 w-80 h-80 bg-slate-200 rounded-full blur-3xl opacity-35 -ml-40 -mb-40 pointer-events-none"></div>

      <AnimatePresence mode="wait">
        {!user ? (
          <div className="w-full max-w-5xl flex flex-col md:flex-row items-center justify-center gap-10 md:gap-14 z-10 p-2 sm:p-0">
            {/* Login Device Mock Frame */}
            <div className="relative w-full max-w-md h-[100vh] sm:h-[820px] bg-white sm:rounded-[3rem] shadow-none sm:shadow-2xl border-0 sm:border-[12px] border-gray-900 overflow-hidden flex flex-col p-8 justify-between items-center text-center" dir="rtl" id="login-container">
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

              <div className="text-center text-[10px] text-gray-400 mt-4" id="login-footer">
                <p>© H. Saban Logistics & Logistics LTD 2026. כל הזכויות שמורות.</p>
                <p className="mt-1 font-mono text-[9px] opacity-75">Saban Intelligent Drive Core API v2</p>
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
        ) : (
          <div className="w-full min-h-screen flex flex-col bg-[#FDFDFF] text-right overflow-hidden" dir="rtl" id="saban-os-dashboard">
            {/* Top Professional Shared Header Bar */}
            <header className="px-6 py-4.5 bg-white border-b border-slate-200/80 flex flex-col md:flex-row justify-between items-center gap-4 shrink-0 z-30 shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
              <div className="flex items-center gap-3.5">
                <div className="w-10 h-10 bg-slate-900 rounded-2xl flex items-center justify-center text-amber-500 shadow-md">
                  <HardHat className="w-5 h-5 text-amber-400" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h1 className="text-lg font-black font-sans tracking-tight text-slate-900">SabanOS v2.10</h1>
                    <span className="bg-emerald-50 text-emerald-700 text-[10px] font-bold px-2.5 py-0.5 rounded-full border border-emerald-200 animate-pulse">
                      תפעול ארצי מחובר 🟢
                    </span>
                    {lastUpdated && (
                      <span className="text-[10px] font-mono text-slate-500 bg-slate-50 border border-slate-200/60 px-2.5 py-0.5 rounded-xl flex items-center gap-1.5" title="עודכן לאחרונה">
                        <span className="relative flex h-1.5 w-1.5">
                          <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${autoRefresh ? "bg-indigo-400" : "bg-amber-400"}`}></span>
                          <span className={`relative inline-flex rounded-full h-1.5 w-1.5 ${autoRefresh ? "bg-indigo-600" : "bg-amber-500"}`}></span>
                        </span>
                        <span>עודכן: {lastUpdated}</span>
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-gray-400 font-medium">ח. סבן לוגיסטיקה ושירותי שינוע והספקה</p>
                </div>
              </div>

              {/* Global Real-Time Search Bar */}
              <div className="relative w-full max-w-xs md:max-w-[200px] lg:max-w-[280px] xl:max-w-xs shrink-0" id="header-global-search">
                <input
                  type="text"
                  placeholder="חיפוש גלובלי (הזמנות, נהגים, מלאי)..."
                  value={globalSearchQuery}
                  onChange={(e) => setGlobalSearchQuery(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200/80 rounded-2xl py-2.5 pr-9 pl-4 text-xs text-slate-900 focus:outline-none focus:ring-1.5 focus:ring-slate-900 focus:bg-white transition-all text-right placeholder-gray-400 font-medium shadow-3xs"
                  dir="rtl"
                />
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-450 pointer-events-none" />
              </div>

              {/* Segmented Controller Tab Selector */}
              <nav className="bg-slate-100/80 p-1.5 rounded-2xl flex items-center gap-1 border border-slate-200/50">
                <button
                  onClick={() => setActiveTab("kanban")}
                  className={`flex items-center gap-1.5 font-sans px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    activeTab === "kanban"
                      ? "bg-slate-900 text-white shadow-sm"
                      : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/40"
                  }`}
                >
                  <Kanban className="w-4 h-4" />
                  <span>לוח קנבן ונועה AI 🎛️</span>
                </button>

                <button
                  onClick={() => setActiveTab("chat")}
                  className={`flex items-center gap-1.5 font-sans px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    activeTab === "chat"
                      ? "bg-slate-900 text-white shadow-sm"
                      : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/40"
                  }`}
                >
                  <MessageSquare className="w-4 h-4" />
                  <span>חדר צ'אט מלא 💬</span>
                </button>

                <button
                  onClick={() => setActiveTab("inventory")}
                  className={`flex items-center gap-1.5 font-sans px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    activeTab === "inventory"
                      ? "bg-slate-900 text-white shadow-sm"
                      : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/40"
                  }`}
                >
                  <Box className="w-4 h-4" />
                  <span>קטלוג ומלאי 📦</span>
                </button>

                <button
                  onClick={() => setActiveTab("drivers")}
                  className={`flex items-center gap-1.5 font-sans px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    activeTab === "drivers"
                      ? "bg-slate-900 text-white shadow-sm"
                      : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/40"
                  }`}
                >
                  <Users className="w-4 h-4" />
                  <span>צי הנהגים 🚛</span>
                </button>
              </nav>

              {/* User Profiler and Session Closure */}
              <div className="flex items-center gap-3">
                {/* Auto Refresh Toggle control switch */}
                <div className="flex items-center gap-2 bg-slate-50 border border-slate-200/60 p-1.5 px-3 rounded-2xl select-none" id="header-settings-refresh-toggle">
                  <div className="flex flex-col text-right">
                    <span className="text-[10px] font-black text-slate-700 leading-tight">עדכון אוטומטי</span>
                    <span className="text-[8.5px] text-gray-400 leading-none">{autoRefresh ? "פעיל (חי)" : "סנכרון מושהה"}</span>
                  </div>
                  
                  <button
                    onClick={() => setAutoRefresh(!autoRefresh)}
                    className={`w-9 h-5 rounded-full p-0.5 transition-all outline-none duration-300 relative flex items-center cursor-pointer ${
                      autoRefresh ? "bg-indigo-600 justify-end" : "bg-slate-300 justify-start"
                    }`}
                    aria-label="Toggle Auto Refresh"
                    type="button"
                  >
                    <span className="w-4 h-4 rounded-full bg-white shadow-xs" />
                  </button>

                  {!autoRefresh && (
                    <button
                      onClick={handleManualRefresh}
                      type="button"
                      className="mr-1 shadow-3xs p-1 px-2.5 bg-white hover:bg-slate-100 border border-slate-250 text-indigo-700 rounded-lg text-[9px] font-black transition-all active:scale-95 cursor-pointer flex items-center gap-1"
                      title="משוך נתונים עדכניים מהענן כעת"
                    >
                      <span>🔄</span>
                      <span>רענן</span>
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-2 bg-slate-50 border border-slate-200/60 p-1.5 pl-3 rounded-2xl select-none">
                  <img
                    src={user?.photoURL || "https://images.unsplash.com/photo-1590650511194-6152ab2ac61f?w=100&q=80"}
                    alt="User Profile"
                    className="w-7 h-7 rounded-xl object-cover border border-slate-200 shadow-sm"
                  />
                  <div className="text-right">
                    <p className="text-[11px] font-black text-slate-800 leading-none">{user?.displayName || "ח. סבן (מנהל)"}</p>
                    <span className="text-[9px] font-mono text-gray-400">סדרן מורשה</span>
                  </div>
                </div>

                <button
                  onClick={handleSignOut}
                  className="p-2.5 rounded-xl border border-rose-100 hover:bg-rose-50 text-rose-600 transition-all active:scale-95 cursor-pointer shadow-3xs"
                  title="התנתק מהמערכת"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            </header>

            {/* Render Active Window Block */}
            <div className="flex-1 w-full overflow-hidden flex flex-col relative" ref={mainRef}>
              {activeTab === "kanban" && (
                <div className="flex-1 w-full max-w-full mx-auto grid grid-cols-1 xl:grid-cols-12 overflow-hidden h-full" id="dashboard-kanban-split">
                  {/* Left (or central RTL) workspace for KanbanView */}
                  <div className={`flex flex-col h-full bg-[#FDFDFF] transition-all duration-350 min-w-0 ${
                    isNoaSidebarOpen ? "xl:col-span-8 2xl:col-span-9" : "xl:col-span-12"
                  }`} id="kanban-panel-container">
                    
                    {/* Floating ribbon control to Toggle sidebar */}
                    <div className="px-6 py-2.5 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center shrink-0 font-sans select-none">
                      <button 
                        onClick={() => setIsNoaSidebarOpen(!isNoaSidebarOpen)}
                        className="flex items-center gap-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-[11px] font-black px-3.5 py-1.5 rounded-xl border border-indigo-100 transition-all active:scale-95 cursor-pointer"
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                        <span>{isNoaSidebarOpen ? "◀ הסתר עוזרת נועה AI" : "▶ הצג עוזרת נועה AI 💬"}</span>
                      </button>
                      
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] bg-slate-100 border border-slate-200 text-slate-550 px-2.5 py-1 rounded-md font-black font-mono">
                          {orders.filter(o => o.status !== "delivered").length} משלוחים פעילים בסבב
                        </span>
                      </div>
                    </div>

                    <div className="flex-1 overflow-y-auto min-w-0 pb-12">
                      <KanbanView drivers={drivers} setActiveTab={setActiveTab} globalSearchQuery={globalSearchQuery} />
                    </div>
                  </div>

                  {/* Sidebar workspace for compact Noa Chat Room */}
                  <AnimatePresence mode="popLayout">
                    {isNoaSidebarOpen && (
                      <motion.div
                        initial={{ opacity: 0, x: 25 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 25 }}
                        transition={{ duration: 0.25 }}
                        className="xl:col-span-4 2xl:col-span-3 flex flex-col h-full bg-[#FAFBFD] border-r border-slate-200/60 overflow-hidden shrink-0"
                        id="sidebar-noa-container"
                      >
                        <div className="flex-grow h-full p-4 xl:p-5 overflow-hidden">
                          <NoaChatRoom isSidebarMode={true} />
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}

              {activeTab === "chat" && (
                <div className="flex-grow w-full h-full overflow-hidden">
                  <NoaChatRoom isSidebarMode={false} />
                </div>
              )}

              {activeTab === "inventory" && (
                <div className="flex-1 overflow-y-auto h-full p-6 max-w-7xl mx-auto w-full">
                  <InventoryCustomerView globalSearchQuery={globalSearchQuery} />
                </div>
              )}

              {activeTab === "drivers" && (
                <div className="flex-1 overflow-y-auto h-full p-6 max-w-7xl mx-auto w-full">
                  <DriversView drivers={drivers} globalSearchQuery={globalSearchQuery} />
                </div>
              )}
            </div>
          </div>
        )}
      </AnimatePresence>

      {/* Real-time Toast Notifications Float Stack */}
      <div className="fixed bottom-5 right-5 z-100 flex flex-col gap-2.5 max-w-sm pointer-events-none" dir="rtl">
        <AnimatePresence>
          {toasts.map((t) => (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ duration: 0.25 }}
              className="bg-slate-900 border border-slate-800 text-white rounded-2xl p-4 shadow-2xl flex items-start gap-3 pointer-events-auto select-none"
            >
              <div className="p-2 bg-indigo-500/10 rounded-xl">
                <Sparkles className="w-5 h-5 text-indigo-400 animate-pulse" />
              </div>
              <div className="text-right">
                <h4 className="text-xs font-black text-slate-100">{t.title}</h4>
                <p className="text-[11px] text-gray-400 font-medium mt-0.5">{t.description}</p>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* HIGH PRIORITY BLOCKING ALERTS INTERCEPTOR MODAL */}
      <AnimatePresence>
        {pendingAlerts.length > 0 && (
          <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-md flex items-center justify-center z-[99999] p-4 sm:p-6" dir="rtl">
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 30 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 30 }}
              transition={{ type: "spring", bounce: 0.2, duration: 0.45 }}
              className="w-full max-w-xl rounded-[40px] bg-white border border-rose-500/25 p-8 shadow-[0_0_60px_-15px_rgba(239,68,68,0.4)] relative overflow-hidden font-sans"
            >
              {/* Alert Glow Bar */}
              <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-red-500 via-amber-500 to-rose-600 animate-pulse" />

              <div className="flex items-center gap-4 border-b border-slate-100 pb-5 mb-6">
                <div className="p-3 bg-red-100 text-red-600 rounded-2xl animate-bounce">
                  <AlertTriangle className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-xl font-black text-slate-900 font-sans tracking-tight">כניסת הזמנה דחופה וממתינה לאישור!</h2>
                    <span className="bg-red-500 text-white text-[9.5px] font-bold px-2.5 py-0.5 rounded-full animate-pulse">
                      חדש בעננים 🔔
                    </span>
                  </div>
                  <p className="text-xs text-gray-400 font-medium">אנא קרא ואשר את פירטי ההזמנה הבאה למניעת סתירות בסידור</p>
                </div>

                <div className="mr-auto text-left">
                  <span className="text-[11px] font-mono font-bold bg-slate-100 text-gray-500 px-3 py-1 rounded-full">
                    התראה {pendingAlerts.length} מתוך {pendingAlerts.length}
                  </span>
                </div>
              </div>

              {/* Dynamic Presentation Card of the first pendingAlert */}
              {(() => {
                const activeAlert = pendingAlerts[0];
                return (
                  <div className="space-y-5">
                    <div className="p-5 rounded-3xl bg-slate-50 border border-slate-100 space-y-4">
                      
                      {/* Customer info */}
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 bg-indigo-50 text-indigo-700 rounded-xl flex items-center justify-center font-bold text-xs select-none">
                          👤
                        </div>
                        <div className="text-right">
                          <p className="text-[10px] text-gray-400 font-bold leading-none">לקוח רשום</p>
                          <h3 className="text-base font-black text-slate-800 tracking-tight">{activeAlert.customerName || "לקוח מזדמן / לא מוגדר"}</h3>
                        </div>
                      </div>

                      {/* Location Destination */}
                      <div className="flex items-start gap-3">
                        <div className="w-9 h-9 bg-emerald-50 text-emerald-700 rounded-xl flex items-center justify-center shrink-0">
                          <MapPin className="w-4 h-4" />
                        </div>
                        <div className="text-right">
                          <p className="text-[10px] text-gray-400 font-bold leading-none">יעד וכתובת אתר הפריקה</p>
                          <p className="text-sm font-semibold text-slate-800">{activeAlert.destination || "כתובת חסרה"}</p>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4 pt-2">
                        {/* Time details */}
                        <div className="flex items-center gap-2.5 bg-white p-3 rounded-2xl border border-slate-100/60">
                          <Clock className="w-4.5 h-4.5 text-indigo-500 shrink-0" />
                          <div className="text-right">
                            <span className="text-[9.5px] text-gray-400 block leading-none font-bold">תאריך ושעה מבוקשת</span>
                            <strong className="text-xs text-slate-800">{activeAlert.date || "היום"} | {activeAlert.time || "מיידי"}</strong>
                          </div>
                        </div>

                        {/* Order ID tracking code */}
                        <div className="flex items-center gap-2.5 bg-white p-3 rounded-2xl border border-slate-100/60">
                          <Key className="w-4.5 h-4.5 text-amber-500 shrink-0" />
                          <div className="text-right">
                            <span className="text-[9.5px] text-gray-400 block leading-none font-bold">קוד סידור פנימי</span>
                            <span className="text-xs font-mono font-bold text-slate-800 tracking-wider">#{activeAlert.orderNumber || activeAlert.id?.substring(0, 6) || "N/A"}</span>
                          </div>
                        </div>
                      </div>

                      {/* Content of Materials */}
                      <div className="p-4 bg-amber-500/5 hover:bg-amber-500/10 transition-all border border-amber-550/10 rounded-2xl">
                        <span className="text-[10px] font-black text-amber-700 block mb-1">תכולת המשא והחומרים המפורטים:</span>
                        <p className="text-xs font-semibold text-slate-800 font-sans leading-relaxed">{activeAlert.items || "לא פורטו חומרי בניין בסמל הנוכחי"}</p>
                      </div>

                      {/* Special Driver constraint badge if applicable */}
                      {activeAlert.driverName && (
                        <div className="p-3 bg-indigo-50 border border-indigo-100 rounded-xl text-xs text-indigo-900 font-bold flex items-center gap-2">
                          <div className="w-2 h-2 bg-indigo-600 rounded-full animate-ping shrink-0" />
                          <span>נהג משויך אוטומטית בהזמנה זו: {activeAlert.driverName}</span>
                        </div>
                      )}
                    </div>

                    {/* Acknowledge Button */}
                    <button
                      type="button"
                      onClick={() => {
                        // Dismiss the top (first) alert from sequence queue
                        setPendingAlerts((prev) => prev.slice(1));
                      }}
                      className="w-full bg-slate-900 hover:bg-slate-950 text-white font-black py-4 px-6 rounded-2xl text-xs transition-all active:scale-95 flex items-center justify-center gap-2 cursor-pointer shadow-lg hover:shadow-xl mt-4"
                    >
                      <ChevronRight className="w-4 h-4 text-gray-300" />
                      <span>קראתי, הבנתי ואשר קבלת נתונים אלו ✔️</span>
                    </button>
                  </div>
                );
              })()}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
