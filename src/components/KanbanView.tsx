import React, { useState, useEffect } from "react";
import { collection, updateDoc, doc, onSnapshot, setDoc } from "firebase/firestore";
import { db, handleFirestoreError, OperationType } from "../firebase";
import { Order, Driver } from "../types";

import { 
  Package, MapPin, Truck, Calendar, Clock, Play, CheckCircle, XCircle, Plus, Search, Layers, Navigation, ChevronRight, Check, Sparkles, Filter, MessageSquare, Users
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface KanbanViewProps {
  drivers: Driver[];
  setActiveTab?: (tab: "kanban" | "chat" | "inventory" | "drivers") => void;
}

export function KanbanView({ drivers, setActiveTab }: KanbanViewProps) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [showDateRange, setShowDateRange] = useState(false);
  
  // Mobile ergonomics: Active lane selection filter for optimized mobile viewport view
  const [activeLane, setActiveLane] = useState<Order["status"] | "all">("all");

  // Create Order Form State
  const [formData, setFormData] = useState({
    customerName: "",
    orderNumber: "",
    destination: "",
    items: "",
    warehouse: "",
    driverId: "",
    time: "08:00",
    date: new Date().toISOString().split("T")[0],
    documentIds: ""
  });

  // Fetch orders with real-time updates
  useEffect(() => {
    const ordersRef = collection(db, "orders");
    const unsub = onSnapshot(ordersRef, (snapshot) => {
      const list: Order[] = [];
      snapshot.forEach((doc) => {
        list.push({ ...doc.data(), id: doc.id } as Order);
      });
      setOrders(list);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, "orders");
    });
    return () => unsub();
  }, []);

  const updateOrderStatus = async (orderId: string, newStatus: Order["status"]) => {
    try {
      const orderRef = doc(db, "orders", orderId);
      await updateDoc(orderRef, { status: newStatus });
      if (selectedOrder && selectedOrder.id === orderId) {
        setSelectedOrder(prev => prev ? { ...prev, status: newStatus } : null);
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `orders/${orderId}`);
    }
  };

  const handleAssignDriverAndEta = async (orderId: string, driverId: string, etaText: string) => {
    try {
      const orderRef = doc(db, "orders", orderId);
      await updateDoc(orderRef, { driverId, eta: etaText });
      if (selectedOrder && selectedOrder.id === orderId) {
        setSelectedOrder(prev => prev ? { ...prev, driverId, eta: etaText } : null);
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `orders/${orderId}`);
    }
  };

  const handlePredictEtaAPI = async (order: Order) => {
    if (!order.id) return;
    try {
      const assignedDriver = drivers.find(d => d.id === order.driverId) || drivers[0];
      const res = await fetch("/api/gemini/predict_eta", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderDetails: {
            destination: order.destination,
            items: order.items,
            warehouse: order.warehouse || "חצר אשדוד",
            time: order.time || "08:00"
          },
          driverStats: {
            name: assignedDriver?.name || "נהג כללי",
            vehicleType: assignedDriver?.vehicleType || "truck",
            status: assignedDriver?.status || "active"
          }
        })
      });
      const data = await res.json();
      if (data.formattedEtaMessage) {
        await handleAssignDriverAndEta(order.id, order.driverId || "", data.formattedEtaMessage);
      }
    } catch (error) {
      console.error("Failed to predict ETA:", error);
    }
  };

  const handleCreateOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.customerName || !formData.destination || !formData.orderNumber) {
      alert("נא למלא שדות חובה: לקוח, יעוד ומספר הזמנה");
      return;
    }

    try {
      const newOrder: Order = {
        customerName: formData.customerName,
        orderNumber: formData.orderNumber,
        destination: formData.destination,
        items: formData.items || "מוצרים כלליים",
        warehouse: formData.warehouse || "חצר אשדוד",
        driverId: formData.driverId || "",
        date: formData.date,
        time: formData.time,
        documentIds: formData.documentIds || "",
        status: "pending",
        eta: "ממתין לחישוב בינה מלאכותית"
      };

      const docId = formData.orderNumber.toLowerCase().trim();
      await setDoc(doc(db, "orders", docId), newOrder);

      // Reset
      setFormData({
        customerName: "",
        orderNumber: "",
        destination: "",
        items: "",
        warehouse: "חצר אשדוד",
        driverId: "",
        time: "08:00",
        date: new Date().toISOString().split("T")[0],
        documentIds: ""
      });
      setIsAddOpen(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, "orders");
    }
  };

  const setTodayPreset = () => {
    const today = new Date().toISOString().split("T")[0];
    setStartDate(today);
    setEndDate(today);
  };

  const setThisWeekPreset = () => {
    const now = new Date();
    const dayOfWeek = now.getDay(); // 0 is Sunday, 1 is Monday ... 6 is Saturday
    const start = new Date(now);
    start.setDate(now.getDate() - dayOfWeek);
    
    const end = new Date(now);
    end.setDate(now.getDate() + (6 - dayOfWeek));

    setStartDate(start.toISOString().split("T")[0]);
    setEndDate(end.toISOString().split("T")[0]);
  };

  const clearDateRange = () => {
    setStartDate("");
    setEndDate("");
  };

  const filteredOrders = orders.filter(o => {
    const matchesSearch = (o.customerName || '').toLowerCase().includes((searchQuery || '').toLowerCase()) || 
                          (o.orderNumber || '').toLowerCase().includes((searchQuery || '').toLowerCase()) || 
                          (o.destination && o.destination.toLowerCase().includes((searchQuery || '').toLowerCase()));
    
    if (!matchesSearch) return false;

    if (startDate && o.date < startDate) return false;
    if (endDate && o.date > endDate) return false;

    return true;
  });

  const getStatusHebrew = (status: Order["status"]) => {
    switch (status) {
      case "pending": return "ממתין";
      case "in_transit": return "בדרך";
      case "delivered": return "נמסר";
      case "canceled": return "בוטל";
    }
  };

  const getStatusBadgeStyles = (status: Order["status"]) => {
    switch (status) {
      case "pending": return "bg-amber-50 text-amber-800 border-amber-200/65";
      case "in_transit": return "bg-indigo-50 text-indigo-800 border-indigo-200/65";
      case "delivered": return "bg-emerald-50 text-emerald-800 border-emerald-250";
      case "canceled": return "bg-rose-50 text-rose-800 border-rose-200";
    }
  };

  const columns: Order["status"][] = ["pending", "in_transit", "delivered"];

  return (
    <div className="flex flex-col flex-grow bg-[#FDFDFF] pb-24 text-right" dir="rtl" id="kanban-view-container">
      {/* 1. Header Area: Clean breathable light container with primary dark actions */}
      <div className="bg-white/95 backdrop-blur-md px-5 pt-4 pb-3 border-b border-gray-100/90 shadow-2xs sticky top-0 z-30 flex flex-col gap-3.5" id="kanban-header">
        <div className="flex justify-between items-center">
          <div>
            <span className="text-[9px] uppercase tracking-widest text-gray-400 font-bold font-sans">לוח מעקב חכם</span>
            <h2 className="text-xl font-black text-gray-900 tracking-tight mt-0.5">משלוחי שטח</h2>
          </div>
          <motion.button 
            whileTap={{ scale: 0.95 }}
            onClick={() => setIsAddOpen(true)}
            className="bg-gray-900 hover:bg-black text-white font-extrabold py-2 px-3.5 rounded-xl shadow-xs flex items-center gap-1 text-[11px] transition-colors h-10 select-none cursor-pointer"
            id="btn-new-order"
          >
            <Plus className="w-3.5 h-3.5 text-white" />
            <span>הזמנה חדשה</span>
          </motion.button>
        </div>

        {/* 2. Unified Search Input & Date Filter Trigger */}
        <div className="flex gap-2" id="kanban-filter-row">
          <div className="relative flex-1">
            <input 
              type="text"
              placeholder="חפש לקוח, מס' הזמנה או יעד..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-gray-50 border border-gray-150 rounded-xl py-2.5 pr-9 pl-4 text-xs text-gray-900 focus:outline-none focus:ring-1.5 focus:ring-gray-900 focus:bg-white transition-all text-right placeholder-gray-400 font-medium"
              id="kanban-search-input"
            />
            <Search className="absolute right-3.5 top-3 w-4 h-4 text-gray-400 pointer-events-none" />
          </div>
          <button
            onClick={() => setShowDateRange(!showDateRange)}
            className={`px-3.5 rounded-xl border flex items-center justify-center gap-1.5 transition-all text-xs font-black select-none cursor-pointer h-[38px] ${
              showDateRange || startDate || endDate
                ? "bg-gray-900 border-gray-900 text-white shadow-xs"
                : "bg-gray-50 border-gray-150 text-gray-600 hover:bg-gray-100"
            }`}
            id="toggle-date-range-filter"
            title="סינון לפי תאריכים"
          >
            <Calendar className="w-4 h-4" />
            <span className="hidden sm:inline">תאריכים</span>
            {(startDate || endDate) && (
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse"></span>
            )}
          </button>
        </div>

        {/* Expanded Date Range Filter Panel */}
        <AnimatePresence>
          {showDateRange && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden bg-gray-50/70 border border-gray-150 rounded-2xl p-4 flex flex-col gap-3 text-right"
              id="date-range-filter-panel"
            >
              <div className="flex flex-col sm:flex-row gap-3">
                {/* Start Date */}
                <div className="flex flex-col gap-1 flex-1 relative">
                  <span className="text-[10px] font-black text-gray-400 uppercase tracking-wider block mb-1">מתאריך משלוח</span>
                  <div className="relative">
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="w-full bg-white border border-gray-150 rounded-xl py-2 px-3 pl-8 text-xs text-gray-900 focus:outline-none focus:ring-1.5 focus:ring-gray-900 transition-all text-right font-medium"
                      id="date-filter-start"
                    />
                    <Calendar className="absolute left-2.5 top-2.5 w-4 h-4 text-gray-400 pointer-events-none" />
                  </div>
                </div>

                {/* End Date */}
                <div className="flex flex-col gap-1 flex-1 relative">
                  <span className="text-[10px] font-black text-gray-400 uppercase tracking-wider block mb-1">עד תאריך משלוח</span>
                  <div className="relative">
                    <input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="w-full bg-white border border-gray-150 rounded-xl py-2 px-3 pl-8 text-xs text-gray-900 focus:outline-none focus:ring-1.5 focus:ring-gray-900 transition-all text-right font-medium"
                      id="date-filter-end"
                    />
                    <Calendar className="absolute left-2.5 top-2.5 w-4 h-4 text-gray-400 pointer-events-none" />
                  </div>
                </div>
              </div>

              {/* Presets & Actions */}
              <div className="flex items-center justify-between border-t border-gray-200/60 pt-3 mt-1">
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] text-gray-400 font-bold ml-1">קיצורים:</span>
                  <button
                    type="button"
                    onClick={setTodayPreset}
                    className="px-3 py-1.5 text-[10px] font-black bg-white border border-gray-150 rounded-lg text-gray-700 hover:bg-gray-100 transition-all active:scale-95 cursor-pointer"
                    id="preset-today"
                  >
                    היום
                  </button>
                  <button
                    type="button"
                    onClick={setThisWeekPreset}
                    className="px-3 py-1.5 text-[10px] font-black bg-white border border-gray-150 rounded-lg text-gray-700 hover:bg-gray-100 transition-all active:scale-95 cursor-pointer"
                    id="preset-this-week"
                  >
                    השבוע
                  </button>
                </div>
                
                {(startDate || endDate) && (
                  <button
                    type="button"
                    onClick={clearDateRange}
                    className="px-3 py-1.5 text-[10px] font-black bg-rose-50 border border-rose-100 rounded-lg text-rose-600 hover:bg-rose-100 transition-all flex items-center gap-1 active:scale-95 cursor-pointer"
                    id="btn-clear-dates"
                  >
                    <XCircle className="w-3.5 h-3.5" />
                    <span>נקה הכל</span>
                  </button>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* 3. Mobile Navigation Slider Segment: isolate different lanes or view all */}
        <div className="flex bg-gray-50 border border-gray-100/80 p-1 rounded-xl gap-0.5" id="kanban-mobile-lane-selector">
          <button
            onClick={() => setActiveLane("all")}
            className={`flex-1 py-1.5 text-[10px] font-black rounded-lg transition-all flex items-center justify-center gap-1 ${
              activeLane === "all" ? "bg-gray-900 text-white shadow-xs" : "text-gray-400 hover:text-gray-900"
            }`}
          >
            הכל ({filteredOrders.length})
          </button>
          {columns.map((st) => {
            const count = filteredOrders.filter(o => o.status === st).length;
            const activeColor = st === "pending" ? "text-amber-500" : st === "in_transit" ? "text-indigo-500" : "text-emerald-500";
            return (
              <button
                key={st}
                onClick={() => setActiveLane(st)}
                className={`flex-1 py-1.5 text-[10px] font-black rounded-lg transition-all flex items-center justify-center gap-1 ${
                  activeLane === st ? "bg-gray-900 text-white shadow-xs" : "text-gray-400 hover:text-gray-900"
                }`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${
                  st === "pending" ? "bg-amber-400" : st === "in_transit" ? "bg-indigo-400" : "bg-emerald-500"
                }`} />
                <span>{getStatusHebrew(st)}</span>
                <span className="opacity-75 font-mono">({count})</span>
              </button>
            );
          })}
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-24 text-gray-500" id="kanban-loader">
          <div className="relative w-8 h-8">
            <div className="absolute inset-0 rounded-full border-2 border-gray-200"></div>
            <div className="absolute inset-0 rounded-full border-2 border-gray-900 border-t-transparent animate-spin"></div>
          </div>
          <p className="text-[11px] font-black text-gray-400 mt-4 uppercase tracking-wider">טוען משלוחים שוטפים...</p>
        </div>
      ) : (
        <div className="px-5 mt-4 overflow-y-auto flex-1 space-y-4">
          
          {/* Dashboard Enterprise Gateways & Stats */}
          {activeLane === "all" && (
            <div className="space-y-4" id="dashboard-saas-gateways">
              {/* Stats overview integrated with subtle minimalist layout */}
              <div className="grid grid-cols-2 gap-3" id="kanban-dashboard-stats-card">
                <div className="p-4 rounded-[1.25rem] bg-gray-50/75 border border-gray-150/45 flex flex-col gap-0.5 text-right">
                  <span className="text-gray-400 text-[9px] font-black uppercase tracking-widest">משלוחים בטיפול</span>
                  <span className="text-xl font-black text-gray-900 font-sans">{orders.length}</span>
                </div>
                <div className="p-4 rounded-[1.25rem] bg-gray-900 text-white flex flex-col gap-0.5 shadow-sm text-right">
                  <span className="text-gray-300/80 text-[9px] font-black uppercase tracking-widest">נהגים פעילים</span>
                  <span className="text-xl font-black text-amber-400 font-sans">{drivers.length}</span>
                </div>
              </div>

              {/* Dynamic Mobile SaaS Gateway Buttons (כפתורי השער) */}
              <div className="space-y-3">
                <div className="flex justify-between items-center px-1">
                  <span className="text-[10px] text-gray-400 font-black uppercase tracking-widest font-sans">שערי שליטה וניווט מהיר</span>
                  <span className="text-[10px] text-[#2563EB] bg-blue-50 px-2 py-0.5 rounded-md font-bold font-sans">SabanOS 2.1 PWA</span>
                </div>

                <div className="grid grid-cols-2 gap-3.5">
                  {/* Gateway 1: Primary Dark Accent - AI Assistant */}
                  <motion.button
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setActiveTab && setActiveTab("chat")}
                    className="bg-gray-955 bg-gray-900 text-white p-5 rounded-3xl shadow-lg shadow-gray-900/15 text-right flex flex-col justify-between h-40 transition-all duration-200 cursor-pointer border border-gray-850 relative overflow-hidden select-none"
                    id="gateway-noa-ai"
                  >
                    <div className="absolute top-0 left-0 w-24 h-24 bg-gradient-to-br from-indigo-500/10 to-transparent blur-xl pointer-events-none"></div>
                    <div className="w-10 h-10 rounded-2xl bg-white/10 flex items-center justify-center border border-white/5">
                      <Sparkles className="w-5.5 h-5.5 text-amber-400 animate-pulse" />
                    </div>
                    <div>
                      <h3 className="text-[13px] font-black tracking-tight flex items-center gap-1.5">
                        <span>נועה AI צ'אט</span>
                        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
                      </h3>
                      <p className="text-[9px] text-gray-300 mt-1 font-medium leading-tight">
                        מפרט לוגיסטי, חיזוי פקקים, סנכרון Comax.
                      </p>
                    </div>
                  </motion.button>

                  {/* Gateway 2: Light High-Contrast Accent - Create New Job */}
                  <motion.button
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setIsAddOpen(true)}
                    className="bg-white text-gray-900 p-5 rounded-3xl shadow-lg shadow-gray-200/50 text-right flex flex-col justify-between h-40 transition-all duration-200 cursor-pointer border border-gray-150 select-none hover:border-amber-200"
                    id="gateway-new-order"
                  >
                    <div className="w-10 h-10 rounded-2xl bg-amber-50 flex items-center justify-center border border-amber-100">
                      <Plus className="w-5.5 h-5.5 text-amber-600" />
                    </div>
                    <div>
                      <h3 className="text-[13px] font-black tracking-tight text-gray-950">הזמנה חדשה</h3>
                      <p className="text-[9px] text-gray-550 mt-1 font-medium leading-tight">
                        פתיחת כרטיס הובלה, שיבוץ מנופאי וקישורי תעודות.
                      </p>
                    </div>
                  </motion.button>
                </div>

                <div className="grid grid-cols-2 gap-3.5">
                  {/* Gateway 3: Light Accent - Inventory and Storage */}
                  <motion.button
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setActiveTab && setActiveTab("inventory")}
                    className="bg-white text-gray-900 p-5 rounded-3xl shadow-lg shadow-gray-200/50 text-right flex flex-col justify-between h-40 transition-all duration-200 cursor-pointer border border-gray-150 select-none hover:border-gray-300"
                    id="gateway-inventory"
                  >
                    <div className="w-10 h-10 rounded-2xl bg-gray-50 flex items-center justify-center border border-gray-100">
                      <Layers className="w-5.5 h-5.5 text-gray-800" />
                    </div>
                    <div>
                      <h3 className="text-[13px] font-black tracking-tight text-gray-905 text-gray-950 font-sans">מלאי וציוד עזר</h3>
                      <p className="text-[9px] text-gray-500 mt-1 font-medium leading-tight">
                        מפלסי ציוד קשירה, מחסנים ותיקי לקוח Drive.
                      </p>
                    </div>
                  </motion.button>

                  {/* Gateway 4: Light Accent - Drivers Network */}
                  <motion.button
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setActiveTab && setActiveTab("drivers")}
                    className="bg-white text-gray-900 p-5 rounded-3xl shadow-lg shadow-gray-200/50 text-right flex flex-col justify-between h-40 transition-all duration-200 cursor-pointer border border-gray-150 select-none hover:border-gray-300"
                    id="gateway-drivers"
                  >
                    <div className="w-10 h-10 rounded-2xl bg-gray-50 flex items-center justify-center border border-gray-100">
                      <Users className="w-5.5 h-5.5 text-gray-800" />
                    </div>
                    <div>
                      <h3 className="text-[13px] font-black tracking-tight text-gray-905 text-gray-950 font-sans">ניהול צי נהגים</h3>
                      <p className="text-[9px] text-gray-500 mt-1 font-medium leading-tight">
                        עדכון סטטוס פעיל, קליטת מסמכים ורישוי כלים כבדים.
                      </p>
                    </div>
                  </motion.button>
                </div>
              </div>
            </div>
          )}

          {/* Kanban Columns viewports */}
          <div className="flex flex-col gap-4" id="kanban-lanes">
            {columns.map((st) => {
              // Hide the column if mobile filters aren't matching
              if (activeLane !== "all" && activeLane !== st) return null;

              const colOrders = filteredOrders.filter(o => o.status === st);
              const laneColor = st === "pending" ? "bg-amber-400" : st === "in_transit" ? "bg-indigo-500" : "bg-emerald-500";

              return (
                <div key={st} className="bg-gray-50/50 p-4 rounded-[2rem] border border-gray-150/50" id={`kanban-lane-${st}`}>
                  {/* Title Bar */}
                  <div className="flex justify-between items-center mb-3 px-1">
                    <span className="font-black text-gray-950 text-[11px] flex items-center gap-1.5 uppercase tracking-wide">
                      <span className={`w-2 h-2 rounded-full ${laneColor}`}></span>
                      {getStatusHebrew(st) === "ממתין" ? "ממתינים לשיבוץ" : getStatusHebrew(st) === "בדרך" ? "בדרך ולוגיסטיקה" : "נמסרו בהצלחה"}
                    </span>
                    <span className="text-[9px] bg-gray-200/50 text-gray-700 font-black px-2 py-0.5 rounded-lg font-mono">
                      {colOrders.length}
                    </span>
                  </div>

                  {colOrders.length === 0 ? (
                    <div className="bg-white/40 border border-dashed border-gray-200/90 rounded-2xl p-6 text-center text-gray-400 text-[11px] font-bold">
                      אין פעילות קיימת בשלב זה
                    </div>
                  ) : (
                    <div className="flex flex-col gap-2.5">
                      {colOrders.map((o) => {
                        const driver = drivers.find(d => d.id === o.driverId);
                        
                        return (
                          <motion.div 
                            key={o.id}
                            layoutId={o.id}
                            whileTap={{ scale: 0.98 }}
                            onClick={() => setSelectedOrder(o)}
                            className="bg-white border border-gray-150/80 p-4 rounded-2xl shadow-2xs hover:border-gray-300 transition-all relative overflow-hidden flex flex-col gap-2 text-right"
                            id={`order-card-${o.orderNumber}`}
                          >
                            {/* Premium edge strip line */}
                            <div className={`absolute right-0 top-0 bottom-0 w-1.5 ${laneColor}`}></div>
                            
                            <div className="flex justify-between items-start">
                              <div>
                                <h4 className="font-extrabold text-xs text-gray-900 leading-snug">
                                  {o.customerName}
                                </h4>
                                <div className="flex items-center gap-1.5 mt-0.5">
                                  <span className="text-[9px] font-black text-amber-600 bg-amber-50 px-1.5 py-0.2 rounded font-mono">
                                    #{o.orderNumber}
                                  </span>
                                  <span className="text-[9px] text-gray-400 font-medium">
                                    • ויסות {o.warehouse || "מחסן"}
                                  </span>
                                </div>
                              </div>
                              <span className={`px-2 py-0.5 text-[8px] font-black rounded-lg uppercase tracking-tight ${getStatusBadgeStyles(st)}`}>
                                {getStatusHebrew(st)}
                              </span>
                            </div>

                            {/* Destination info */}
                            <div className="flex items-start gap-1.5 mt-1 text-[10px] text-gray-500">
                              <MapPin className="w-3.5 h-3.5 text-rose-500 shrink-0 mt-0.5" />
                              <span className="truncate leading-normal">{o.destination}</span>
                            </div>

                            {/* Driver and eta row */}
                            <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-100/75 flex-wrap gap-2">
                              <div className="flex items-center gap-1.5">
                                <div className="w-5 h-5 rounded-full bg-gray-900 text-white flex items-center justify-center text-[8px] font-black uppercase">
                                  {driver ? driver.name.charAt(0) : "S"}
                                </div>
                                <span className="text-[10px] text-gray-600 font-bold">
                                  {driver ? driver.name : "סדרן: ממתין לשיבוץ"}
                                </span>
                              </div>

                              {o.eta && (
                                <div className="flex items-center gap-1 text-[9px] text-[#D97706] font-mono bg-amber-50/50 px-2 py-0.5 rounded-lg border border-amber-100/40 max-w-full">
                                  <Clock className="w-3 h-3 text-amber-500 shrink-0" />
                                  <span className="truncate font-semibold">{o.eta}</span>
                                </div>
                              )}
                            </div>
                          </motion.div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 2. Apple-Maps Style Bottom Sheet Drawer for Details */}
      <AnimatePresence>
        {selectedOrder && (
          <div className="fixed inset-0 bg-black/55 z-50 flex items-end justify-center" id="detail-overlay">
            <motion.div 
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 26, stiffness: 210 }}
              className="bg-[#FDFDFF] w-full max-w-md rounded-t-[2.5rem] p-6 text-right flex flex-col border-t border-gray-100"
              style={{ maxHeight: "85vh" }}
              id="detail-container"
            >
              {/* Drag Handle block */}
              <div 
                className="w-12 h-1 bg-gray-300 rounded-full mx-auto mb-5 cursor-pointer" 
                onClick={() => setSelectedOrder(null)}
              />
              
              <div className="flex justify-between items-start mb-4">
                <div>
                  <span className="text-[10px] font-black text-indigo-700 bg-indigo-50 border border-indigo-150 px-2.5 py-0.5 rounded-full uppercase tracking-wider font-mono">
                    הזמנה #{selectedOrder.orderNumber}
                  </span>
                  <h3 className="text-lg font-black text-gray-900 mt-2">{selectedOrder.customerName}</h3>
                </div>
                <button 
                  onClick={() => setSelectedOrder(null)}
                  className="text-gray-400 hover:text-gray-900 bg-gray-100 hover:bg-gray-200 transition-all p-2 rounded-full cursor-pointer h-9 w-9 flex items-center justify-center"
                >
                  <XCircle className="w-5 h-5 text-gray-500" />
                </button>
              </div>

              {/* Scrollable specs frame */}
              <div className="space-y-4 text-xs overflow-y-auto max-h-[52vh] pr-1 pl-1">
                {/* Active fast status update */}
                <div>
                  <span className="text-[9px] font-black text-gray-400 block mb-1.5 uppercase tracking-wide">עדכון מצב עבודה</span>
                  <div className="grid grid-cols-3 gap-1.5">
                    <button 
                      onClick={() => selectedOrder.id && updateOrderStatus(selectedOrder.id, "pending")}
                      className={`py-2 rounded-xl text-[10px] font-black border transition-all flex items-center justify-center gap-1 cursor-pointer ${
                        selectedOrder.status === "pending" ? "bg-amber-500 border-amber-500 text-white shadow-xs" : "bg-gray-50 border-gray-150 text-gray-500 hover:bg-gray-100"
                      }`}
                    >
                      <Clock className="w-3.5 h-3.5 shrink-0" />
                      ממתין
                    </button>
                    <button 
                      onClick={() => selectedOrder.id && updateOrderStatus(selectedOrder.id, "in_transit")}
                      className={`py-2 rounded-xl text-[10px] font-black border transition-all flex items-center justify-center gap-1 cursor-pointer ${
                        selectedOrder.status === "in_transit" ? "bg-indigo-600 border-indigo-600 text-white shadow-xs" : "bg-gray-50 border-gray-150 text-gray-500 hover:bg-gray-100"
                      }`}
                    >
                      <Play className="w-3.5 h-3.5 shrink-0" />
                      בדרך
                    </button>
                    <button 
                      onClick={() => selectedOrder.id && updateOrderStatus(selectedOrder.id, "delivered")}
                      className={`py-2 rounded-xl text-[10px] font-black border transition-all flex items-center justify-center gap-1 cursor-pointer ${
                        selectedOrder.status === "delivered" ? "bg-emerald-600 border-emerald-600 text-white shadow-xs" : "bg-gray-50 border-gray-150 text-gray-500 hover:bg-gray-100"
                      }`}
                    >
                      <CheckCircle className="w-3.5 h-3.5 shrink-0" />
                      נמסר
                    </button>
                  </div>
                </div>

                {/* Info Card specifications grid */}
                <div className="bg-gray-50/70 p-4.5 rounded-[1.8rem] border border-gray-150/40 space-y-3.5">
                  <div className="flex items-start gap-2.5">
                    <MapPin className="w-4 h-4 text-rose-500 mt-0.5 flex-shrink-0" />
                    <div>
                      <span className="text-[9px] font-black text-gray-400 uppercase">יעד פריקה בשטח</span>
                      <p className="font-extrabold text-gray-900 text-[11px] mt-0.5">{selectedOrder.destination}</p>
                    </div>
                  </div>

                  {selectedOrder.items && (
                    <div className="flex items-start gap-2.5 pt-2 border-t border-gray-100">
                      <Package className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
                      <div>
                        <span className="text-[9px] font-black text-gray-400 uppercase">תכולת מטען וציוד עזר</span>
                        <p className="font-semibold text-gray-800 text-[11px] mt-0.5">{selectedOrder.items}</p>
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-4 pt-2 border-t border-gray-100">
                    <div className="flex items-start gap-2">
                      <Calendar className="w-3.5 h-3.5 text-gray-400 shrink-0 mt-0.5" />
                      <div>
                        <span className="text-[9px] font-black text-gray-400 uppercase">תאריך אספקה</span>
                        <p className="text-[10px] font-bold text-gray-800 mt-0.5">{selectedOrder.date}</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-2">
                      <Clock className="w-3.5 h-3.5 text-gray-400 shrink-0 mt-0.5" />
                      <div>
                        <span className="text-[9px] font-black text-gray-400 uppercase">שעת יציאה</span>
                        <p className="text-[10px] font-bold text-gray-800 mt-0.5">{selectedOrder.time || "לא נקבעה"}</p>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 pt-2 border-t border-gray-100">
                    <div>
                      <span className="text-[9px] font-black text-gray-400 uppercase">מחסן מקור</span>
                      <p className="text-[10px] font-bold text-gray-800 mt-0.5">{selectedOrder.warehouse || "חצר אשדוד"}</p>
                    </div>
                    <div>
                      <span className="text-[9px] font-black text-gray-400 uppercase font-sans">מסמכים / תעודות</span>
                      <p className="text-[10px] font-bold text-gray-800 mt-0.5 font-mono">{selectedOrder.documentIds || "אין מסמכים"}</p>
                    </div>
                  </div>
                </div>

                {/* Driver select picker */}
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-gray-400 uppercase tracking-wide">שיבוץ נהג ומוביל</label>
                  <select
                    value={selectedOrder.driverId || ""}
                    onChange={(e) => selectedOrder.id && handleAssignDriverAndEta(selectedOrder.id, e.target.value, selectedOrder.eta || "טרם חושב")}
                    className="w-full bg-white border border-gray-250 rounded-xl py-2 px-3 text-xs text-gray-800 focus:ring-1 focus:ring-gray-900 outline-none font-medium h-10 cursor-pointer"
                  >
                    <option value="">-- ללא שיבוץ (סדרן) --</option>
                    {drivers.map(d => (
                      <option key={d.id} value={d.id}>
                        {d.name} ({d.vehicleType === 'crane' ? 'מנוף' : 'משאית'})
                      </option>
                    ))}
                  </select>
                </div>

                {/* AI-powered prediction module */}
                <div className="bg-[#FFFBEB] border border-amber-200/70 rounded-[1.8rem] p-4 flex flex-col gap-2">
                  <div className="flex justify-between items-center flex-wrap gap-2">
                    <span className="text-[10px] font-black text-[#B45309] flex items-center gap-1 uppercase tracking-wider">
                      <Sparkles className="w-3.5 h-3.5 text-amber-500 animate-pulse" />
                      חיזוי זמן הגעה משוער (Comax & Gemini API)
                    </span>
                    <button 
                      onClick={() => handlePredictEtaAPI(selectedOrder)}
                      className="bg-gray-900 hover:bg-black text-white text-[9px] font-black px-2.5 py-1.5 rounded-lg transition-all flex items-center gap-1 cursor-pointer shadow-2xs"
                    >
                      <Navigation className="w-3 h-3 text-amber-400" />
                      עדכן חיזוי AI
                    </button>
                  </div>
                  <div className="bg-white/90 border border-amber-100 rounded-xl p-3">
                    <p className="text-[11px] text-gray-800 font-medium leading-relaxed font-mono">
                      {selectedOrder.eta || "ממתין לפקודת עיבוד זמני פקק הובלה..."}
                    </p>
                  </div>
                </div>
              </div>

              {/* Action buttons */}
              <div className="pt-4 mt-auto border-t border-gray-100 flex gap-2.5">
                <button 
                  onClick={() => setSelectedOrder(null)}
                  className="w-full bg-gray-900 hover:bg-black text-white font-black py-3 rounded-xl text-center text-xs transition-colors cursor-pointer"
                >
                  סגור ורענן
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 3. Add New Order Slide Sheet */}
      <AnimatePresence>
        {isAddOpen && (
          <div className="fixed inset-0 bg-black/55 z-50 flex items-end justify-center" id="add-order-overlay">
            <motion.div 
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 26, stiffness: 210 }}
              className="bg-[#FDFDFF] w-full max-w-md rounded-t-[2.5rem] p-6 text-right flex flex-col border-t border-gray-100 overflow-y-auto"
              style={{ maxHeight: "92vh" }}
              id="add-order-container"
            >
              <form onSubmit={handleCreateOrder} className="space-y-4">
                <div className="flex justify-between items-center border-b border-gray-100 pb-3.5">
                  <div>
                    <span className="text-[9px] uppercase tracking-widest text-[#B5BAC9] font-bold">שרשרת אספקה</span>
                    <h3 className="text-md font-black text-gray-900 mt-0.5">פתיחת הזמנה חדשה</h3>
                  </div>
                  <button 
                    type="button"
                    onClick={() => setIsAddOpen(false)}
                    className="text-gray-400 hover:text-gray-900 bg-gray-100 p-2 rounded-full cursor-pointer h-8 w-8 flex items-center justify-center"
                  >
                    <XCircle className="w-4 h-4 text-gray-500" />
                  </button>
                </div>

                <div className="space-y-3.5 text-xs">
                  <div>
                    <label className="font-extrabold text-gray-700 block mb-1">שם הלקוח / חברה קבלנית *</label>
                    <input 
                      type="text"
                      required
                      placeholder="לדוגמה: אשטרום בע''מ"
                      value={formData.customerName}
                      onChange={(e) => setFormData({ ...formData, customerName: e.target.value })}
                      className="w-full bg-white border border-gray-250 rounded-xl py-2 px-3 text-xs outline-none focus:border-gray-900 h-10"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="font-extrabold text-gray-700 block mb-1">מספר הזמנה *</label>
                      <input 
                        type="text"
                        required
                        placeholder="ORD-7751"
                        value={formData.orderNumber}
                        onChange={(e) => setFormData({ ...formData, orderNumber: e.target.value })}
                        className="w-full bg-white border border-gray-250 rounded-xl py-2 px-3 text-xs font-mono outline-none focus:border-gray-900 h-10"
                      />
                    </div>
                    <div>
                      <label className="font-extrabold text-gray-700 block mb-1">תעודת משלוח / מסמך</label>
                      <input 
                        type="text"
                        placeholder="לדוגמה: #T-998"
                        value={formData.documentIds}
                        onChange={(e) => setFormData({ ...formData, documentIds: e.target.value })}
                        className="w-full bg-white border border-gray-250 rounded-xl py-2 px-3 text-xs font-mono outline-none focus:border-gray-900 h-10"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="font-extrabold text-gray-700 block mb-1">כתובת יעד לפריקה *</label>
                    <input 
                      type="text"
                      required
                      placeholder="לדוגמה: רחוב פלוני 42, הרצליה"
                      value={formData.destination}
                      onChange={(e) => setFormData({ ...formData, destination: e.target.value })}
                      className="w-full bg-white border border-gray-250 rounded-xl py-2 px-3 text-xs outline-none focus:border-gray-900 h-10"
                    />
                  </div>

                  <div>
                    <label className="font-extrabold text-gray-700 block mb-1">פירוט ציוד, לוגים או פריטים</label>
                    <textarea 
                      placeholder="רשום מנופים, שרשראות עגינה, משקל או כמות..."
                      rows={2}
                      value={formData.items}
                      onChange={(e) => setFormData({ ...formData, items: e.target.value })}
                      className="w-full bg-white border border-gray-250 rounded-xl py-2 px-3 text-xs outline-none focus:border-gray-900"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="font-extrabold text-gray-700 block mb-1">תאריך אספקה</label>
                      <input 
                        type="date"
                        value={formData.date}
                        onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                        className="w-full bg-white border border-gray-250 rounded-xl py-2 px-3 text-xs outline-none h-10"
                      />
                    </div>
                    <div>
                      <label className="font-extrabold text-gray-700 block mb-1">שעת יציאה</label>
                      <input 
                        type="time"
                        value={formData.time}
                        onChange={(e) => setFormData({ ...formData, time: e.target.value })}
                        className="w-full bg-white border border-gray-250 rounded-xl py-2 px-3 text-xs outline-none h-10"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="font-extrabold text-gray-700 block mb-1">מחסן מקור</label>
                      <select 
                        value={formData.warehouse}
                        onChange={(e) => setFormData({ ...formData, warehouse: e.target.value })}
                        className="w-full bg-white border border-gray-250 rounded-xl py-2 px-3 text-xs outline-none h-10"
                      >
                        <option value="חצר אשדוד">חצר אשדוד</option>
                        <option value="חצר שפד'ן">חצר שפד'ן</option>
                        <option value="מרלו'ג רמלה">מרלו'ג רמלה</option>
                      </select>
                    </div>
                    <div>
                      <label className="font-extrabold text-gray-700 block mb-1">שיבוץ נהג מוקדם</label>
                      <select 
                        value={formData.driverId}
                        onChange={(e) => setFormData({ ...formData, driverId: e.target.value })}
                        className="w-full bg-white border border-gray-250 rounded-xl py-2 px-3 text-xs outline-none h-10"
                      >
                        <option value="">-- ללא נהג משויך --</option>
                        {drivers.map(d => (
                          <option key={d.id} value={d.id}>{d.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t border-gray-100 flex gap-3 mt-4">
                  <button 
                    type="button"
                    onClick={() => setIsAddOpen(false)}
                    className="flex-1 bg-gray-100 text-gray-600 font-black py-3 rounded-xl text-center text-xs border border-gray-200 cursor-pointer hover:bg-gray-150 transition-colors"
                  >
                    ביטול
                  </button>
                  <button 
                    type="submit"
                    className="flex-1 bg-gray-900 hover:bg-black text-white font-black py-3 rounded-xl text-center text-xs shadow-md cursor-pointer transition-colors"
                  >
                    צרף למערכת
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
