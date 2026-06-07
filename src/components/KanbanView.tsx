import React, { useState, useEffect } from "react";
import { collection, updateDoc, doc, addDoc, onSnapshot, getDocs, setDoc, query, orderBy } from "firebase/firestore";
import { db, handleFirestoreError, OperationType } from "../firebase";
import { Order, Driver } from "../types";

import { 
  Package, MapPin, Truck, Calendar, Clock, Play, CheckCircle, XCircle, ChevronLeft, ChevronRight, Fuel, AlertCircle, Plus, Search, Layers, FileText, User, Navigation 
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface KanbanViewProps {
  drivers: Driver[];
}

export function KanbanView({ drivers }: KanbanViewProps) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  
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

  const filteredOrders = orders.filter(o => 
    (o.customerName || '').toLowerCase().includes((searchQuery || '').toLowerCase()) || 
    (o.orderNumber || '').toLowerCase().includes((searchQuery || '').toLowerCase()) || 
    (o.destination && o.destination.toLowerCase().includes((searchQuery || '').toLowerCase()))
  );

  const getStatusHebrew = (status: Order["status"]) => {
    switch (status) {
      case "pending": return "ממתין";
      case "in_transit": return "בדרך לשטח";
      case "delivered": return "נמסר";
      case "canceled": return "בוטל";
    }
  };

  const getStatusColor = (status: Order["status"]) => {
    switch (status) {
      case "pending": return "bg-amber-100 text-amber-800 border-amber-200";
      case "in_transit": return "bg-sky-100 text-sky-800 border-sky-200";
      case "delivered": return "bg-emerald-100 text-emerald-800 border-emerald-200";
      case "canceled": return "bg-rose-100 text-rose-800 border-rose-200";
    }
  };

  const columns: Order["status"][] = ["pending", "in_transit", "delivered"];

  return (
    <div className="flex flex-col flex-1 bg-[#FDFDFF] pb-24 text-right" dir="rtl" id="kanban-view-container">
      {/* Header operations with premium clean minimalistic white background and solid buttons */}
      <div className="bg-white px-5 py-4 border-b border-gray-100 shadow-2xs" id="kanban-header">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h2 className="text-xl font-black text-gray-900 tracking-tight">מעקב משלוחים</h2>
            <p className="text-[10px] uppercase tracking-widest text-[#B5BAC9] font-bold">ניהול צד שרשרת אספקה</p>
          </div>
          <motion.button 
            whileTap={{ scale: 0.95 }}
            onClick={() => setIsAddOpen(true)}
            className="bg-gray-900 hover:bg-black text-white font-bold py-2.5 px-4 rounded-xl shadow-md flex items-center gap-1.5 text-xs transition-colors"
            id="btn-new-order"
          >
            <Plus className="w-4 h-4 text-white" />
            <span>הזמנה חדשה</span>
          </motion.button>
        </div>

        {/* Real-time search query search bar */}
        <div className="relative">
          <input 
            type="text"
            placeholder="חיפוש קטלוג לקוח, מס' הזמנה, או כתובת..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-gray-50 border border-gray-200 rounded-2xl py-2.5 pr-10 pl-4 text-xs text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-950 transition-all text-right placeholder-gray-400"
            id="kanban-search-input"
          />
          <Search className="absolute right-3.5 top-3.5 w-4 h-4 text-gray-400 pointer-events-none" />
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 text-gray-500" id="kanban-loader">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mb-2"></div>
          <p className="text-xs font-semibold">טוען הזמנות שרשרת אספקה...</p>
        </div>
      ) : (
        <div className="px-5 mt-4 overflow-y-auto flex-1 space-y-5">
          {/* Dashboard Stats exactly as shown in Artistic Flair theme mockup */}
          <section className="grid grid-cols-2 gap-3" id="kanban-dashboard-stats-card">
            <div className="p-4 rounded-3xl bg-gray-50/80 border border-gray-100 flex flex-col gap-1 text-right">
              <span className="text-gray-400 text-[10px] font-bold uppercase tracking-wide">כלל ההזמנות</span>
              <span className="text-2xl font-black text-gray-900">{orders.length}</span>
            </div>
            <div className="p-4 rounded-3xl bg-gray-900 text-white flex flex-col gap-1 shadow-lg text-right">
              <span className="text-gray-400/90 text-[10px] font-bold uppercase tracking-wide">נהגים רשומים</span>
              <span className="text-2xl font-black text-amber-400">{drivers.length}</span>
            </div>
          </section>

          {/* Kanban Lanes */}
          <div className="flex flex-col gap-5" id="kanban-lanes">
            {columns.map((st) => {
              const colOrders = filteredOrders.filter(o => o.status === st);
              return (
                <div key={st} className="bg-gray-50/50 p-4.5 rounded-[2rem] border border-gray-100/80" id={`kanban-lane-${st}`}>
                  {/* Lane Title & Count badge */}
                  <div className="flex justify-between items-center mb-3.5 px-1">
                    <span className="font-extrabold text-gray-900 text-xs flex items-center gap-1.5 uppercase tracking-wide">
                      <span className={`w-2 h-2 rounded-full ${
                        st === 'pending' ? 'bg-amber-450' : st === 'in_transit' ? 'bg-sky-500' : 'bg-emerald-500'
                      }`}></span>
                      {getStatusHebrew(st)}
                    </span>
                    <span className="text-[10px] bg-gray-200/60 text-gray-800 font-extrabold px-2.5 py-0.5 rounded-full">
                      {colOrders.length}
                    </span>
                  </div>

                  {colOrders.length === 0 ? (
                    <div className="border border-dashed border-gray-200 rounded-2xl p-6 text-center text-gray-400 text-xs font-semibold">
                      אין פעילות בסטטוס זה
                    </div>
                  ) : (
                    <div className="flex flex-col gap-3">
                      {colOrders.map((o) => {
                        const driver = drivers.find(d => d.id === o.driverId);
                        const statusColors = 
                          st === 'pending' ? 'bg-amber-400' : st === 'in_transit' ? 'bg-sky-400' : 'bg-emerald-500';
                        return (
                          <motion.div 
                            key={o.id}
                            layoutId={o.id}
                            onClick={() => setSelectedOrder(o)}
                            className="bg-white/80 backdrop-blur-xl p-4 rounded-[1.8rem] border border-gray-150/80 shadow-xs hover:border-gray-300 hover:shadow-xs cursor-pointer transition-all relative overflow-hidden flex flex-col gap-2 text-right"
                            id={`order-card-${o.orderNumber}`}
                          >
                            {/* Artistic Flair side-stripe height highlight */}
                            <div className={`absolute right-0 top-0 bottom-0 w-1 ${statusColors}`}></div>
                            
                            <div className="flex justify-between items-start">
                              <div>
                                <p className="font-extrabold text-xs text-gray-900 leading-tight">
                                  {o.customerName}
                                </p>
                                <p className="text-[9px] text-[#9CA3AF] mt-1 font-mono tracking-wide">
                                  הזמנה #{o.orderNumber} • ויסות {o.warehouse || "מחסן א'"}
                                </p>
                              </div>
                              <span className={`px-2 py-0.5 text-[8px] font-black rounded-full uppercase tracking-tight ${
                                st === 'pending' ? 'bg-amber-50 text-amber-700' : st === 'in_transit' ? 'bg-sky-50 text-sky-700' : 'bg-emerald-50 text-emerald-700'
                              }`}>
                                {getStatusHebrew(st)}
                              </span>
                            </div>
                            
                            {/* Driver Assign & Location Details representation */}
                            <div className="flex items-center gap-2 mt-1 px-0.5">
                              <div className="w-5.5 h-5.5 rounded-full bg-gray-150 border border-white flex items-center justify-center text-[8px] font-bold text-gray-700 select-none shrink-0 font-serif italic shadow-2xs">
                                {driver ? driver.name.charAt(0) : "S"}
                              </div>
                              <p className="text-[10px] text-gray-500 leading-none truncate">
                                <span>נהג: {driver ? driver.name : "לא שובץ"} • יעד: {o.destination}</span>
                              </p>
                            </div>

                            {o.eta && (
                              <div className="mt-1 pt-1.5 border-t border-gray-100 flex items-center gap-1.5 text-[9px] text-gray-500">
                                <Clock className="w-3 h-3 text-[#9CA3AF]" />
                                <span className="font-medium truncate max-w-[90%] text-[#6B7280]">
                                  {o.eta}
                                </span>
                              </div>
                            )}
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

      {/* 1. EDIT / DETAIL DRAWER OVERLAY */}
      <AnimatePresence>
        {selectedOrder && (
          <div className="fixed inset-0 bg-black/60 z-50 flex items-end justify-center" id="detail-overlay">
            <motion.div 
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 220 }}
              className="bg-[#FDFDFF] w-full max-w-md rounded-t-3xl min-h-[75vh] p-6 text-right flex flex-col justify-between border-t border-gray-200"
              id="detail-container"
            >
              <div>
                {/* Close lever */}
                <div className="w-12 h-1.5 bg-gray-300 rounded-full mx-auto mb-4" onClick={() => setSelectedOrder(null)}></div>
                
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <span className="text-xs font-mono font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                      הזמנה {selectedOrder.orderNumber}
                    </span>
                    <h2 className="text-lg font-bold text-gray-900 mt-2">{selectedOrder.customerName}</h2>
                  </div>
                  <button 
                    onClick={() => setSelectedOrder(null)}
                    className="text-gray-400 hover:text-gray-600 bg-gray-100 p-1.5 rounded-full"
                  >
                    <XCircle className="w-6 h-6" />
                  </button>
                </div>

                <div className="space-y-4 text-sm mt-3 overflow-y-auto max-h-[50vh]">
                  {/* Status pills control */}
                  <div>
                    <span className="text-xs text-gray-450 block mb-2 font-semibold">סטטוס משלוח פעיל</span>
                    <div className="flex gap-2">
                      <button 
                        onClick={() => selectedOrder.id && updateOrderStatus(selectedOrder.id, "pending")}
                        className={`flex-1 py-2 rounded-xl text-xs font-bold border transition-all flex items-center justify-center gap-1 ${
                          selectedOrder.status === "pending" ? "bg-amber-100 border-amber-300 text-amber-800 shadow-inner" : "bg-gray-50 border-gray-200 text-gray-600"
                        }`}
                      >
                        <Clock className="w-3.5 h-3.5" />
                        ממתין
                      </button>
                      <button 
                        onClick={() => selectedOrder.id && updateOrderStatus(selectedOrder.id, "in_transit")}
                        className={`flex-1 py-2 rounded-xl text-xs font-bold border transition-all flex items-center justify-center gap-1 ${
                          selectedOrder.status === "in_transit" ? "bg-sky-100 border-sky-300 text-sky-800 shadow-inner" : "bg-gray-50 border-gray-200 text-gray-600"
                        }`}
                      >
                        <Play className="w-3.5 h-3.5" />
                        בדרך לשטח
                      </button>
                      <button 
                        onClick={() => selectedOrder.id && updateOrderStatus(selectedOrder.id, "delivered")}
                        className={`flex-1 py-2 rounded-xl text-xs font-bold border transition-all flex items-center justify-center gap-1 ${
                          selectedOrder.status === "delivered" ? "bg-emerald-100 border-emerald-300 text-emerald-800 shadow-inner" : "bg-gray-50 border-gray-200 text-gray-600"
                        }`}
                      >
                        <CheckCircle className="w-3.5 h-3.5" />
                        נמסר
                      </button>
                    </div>
                  </div>

                  {/* Core details mapping table */}
                  <div className="bg-gray-50 p-4 rounded-2xl border border-gray-205 space-y-3.5">
                    <div className="flex items-start gap-2.5">
                      <MapPin className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
                      <div>
                        <span className="text-xs text-gray-450 block">כתובת יעד לפריקה</span>
                        <span className="font-medium text-gray-800 text-sm">{selectedOrder.destination}</span>
                      </div>
                    </div>

                    {selectedOrder.items && (
                      <div className="flex items-start gap-2.5">
                        <Package className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
                        <div>
                          <span className="text-xs text-gray-450 block">פירוט ציוד ומטען</span>
                          <span className="font-medium text-gray-800 text-sm">{selectedOrder.items}</span>
                        </div>
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-4">
                      <div className="flex items-start gap-2">
                        <Calendar className="w-4 h-4 text-gray-505 flex-shrink-0" />
                        <div>
                          <span className="text-xs text-gray-450 block">תאריך אספקה</span>
                          <span className="text-xs font-medium text-gray-800">{selectedOrder.date}</span>
                        </div>
                      </div>
                      <div className="flex items-start gap-2">
                        <Clock className="w-4 h-4 text-gray-505 flex-shrink-0" />
                        <div>
                          <span className="text-xs text-gray-450 block">שעת יציאה מתוכננת</span>
                          <span className="text-xs font-medium text-gray-800">{selectedOrder.time || "לא צוין"}</span>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 pt-1">
                      <div>
                        <span className="text-xs text-gray-450 block">מחסן אספקה מקור</span>
                        <span className="text-xs font-medium text-gray-800">{selectedOrder.warehouse || "חצר אשדוד"}</span>
                      </div>
                      <div>
                        <span className="text-xs text-gray-450 block">תשלום ומסמכים קשורים</span>
                        <span className="text-xs font-mono text-gray-800">{selectedOrder.documentIds || "-"}</span>
                      </div>
                    </div>
                  </div>

                  {/* Driver allocation & AI prediction trigger */}
                  <div>
                    <label className="text-xs font-semibold text-gray-650 block mb-1">נהג משובץ במערכת</label>
                    <select
                      value={selectedOrder.driverId || ""}
                      onChange={(e) => selectedOrder.id && handleAssignDriverAndEta(selectedOrder.id, e.target.value, selectedOrder.eta || "טרם חושב")}
                      className="w-full bg-white border border-gray-300 rounded-xl py-2 px-3 text-sm text-gray-800 focus:ring-1 focus:ring-amber-500 outline-none"
                    >
                      <option value="">-- בחר נהג לשיבוץ --</option>
                      {drivers.map(d => (
                        <option key={d.id} value={d.id}>
                          {d.name} ({d.vehicleType === 'crane' ? 'מנוף' : 'משאית'})
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Target prediction box */}
                  <div className="bg-amber-50/70 border border-amber-200/90 rounded-2xl p-4 flex flex-col gap-2.5">
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-bold text-amber-800 flex items-center gap-1">
                        <Layers className="w-3.5 h-3.5 text-amber-600" />
                        חיזוי זמן הגעה משוער (ETA AI)
                      </span>
                      <button 
                        onClick={() => handlePredictEtaAPI(selectedOrder)}
                        className="bg-gray-900 text-white text-[10px] font-bold px-2 py-1 rounded-lg hover:bg-black transition-all flex items-center gap-1"
                      >
                        <Navigation className="w-3 h-3 text-amber-500" />
                        עדכן חיזוי
                      </button>
                    </div>
                    <div>
                      <p className="text-xs text-gray-700 leading-relaxed font-mono bg-white p-2 rounded-lg border border-amber-100">
                        {selectedOrder.eta || "ממתין לפקודת חישוב מצב כבישים..."}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-gray-150 flex gap-3">
                <button 
                  onClick={() => setSelectedOrder(null)}
                  className="flex-1 bg-gray-900 text-white font-bold py-2.5 rounded-xl text-center text-sm"
                >
                  אישור וסגירה
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 2. ADD NEW ORDER DIALOG OVERLAY */}
      <AnimatePresence>
        {isAddOpen && (
          <div className="fixed inset-0 bg-black/60 z-50 flex items-end justify-center" id="add-order-overlay">
            <motion.div 
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 220 }}
              className="bg-[#FDFDFF] w-full max-w-md rounded-t-3xl max-h-[90vh] p-6 text-right flex flex-col justify-between border-t border-gray-200 overflow-y-auto"
              id="add-order-container"
            >
              <form onSubmit={handleCreateOrder} className="space-y-4">
                <div className="flex justify-between items-center mb-2">
                  <h2 className="text-lg font-bold text-gray-900">קליטת הזמנת שטח חדשה</h2>
                  <button 
                    type="button"
                    onClick={() => setIsAddOpen(false)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <XCircle className="w-6 h-6" />
                  </button>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-semibold text-gray-600 block mb-1">שם הלקוח לפריקה *</label>
                    <input 
                      type="text"
                      required
                      placeholder="לדוגמה: אשטרום הנדסה"
                      value={formData.customerName}
                      onChange={(e) => setFormData({ ...formData, customerName: e.target.value })}
                      className="w-full bg-white border border-gray-300 rounded-xl py-2 px-3 text-sm text-gray-850 outline-none focus:border-amber-500"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-semibold text-gray-600 block mb-1">מספר הזמנה *</label>
                      <input 
                        type="text"
                        required
                        placeholder="ORD-7751"
                        value={formData.orderNumber}
                        onChange={(e) => setFormData({ ...formData, orderNumber: e.target.value })}
                        className="w-full bg-white border border-gray-300 rounded-xl py-2 px-3 text-sm text-gray-850 outline-none focus:border-amber-500"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-gray-600 block mb-1">מלווה מסמכים (תעודה)</label>
                      <input 
                        type="text"
                        placeholder="#T-998"
                        value={formData.documentIds}
                        onChange={(e) => setFormData({ ...formData, documentIds: e.target.value })}
                        className="w-full bg-white border border-gray-300 rounded-xl py-2 px-3 text-sm text-gray-850 outline-none focus:border-amber-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-gray-600 block mb-1">כתובת יעד לפריקה *</label>
                    <input 
                      type="text"
                      required
                      placeholder="רחוב פלוני 42, ראש העין"
                      value={formData.destination}
                      onChange={(e) => setFormData({ ...formData, destination: e.target.value })}
                      className="w-full bg-white border border-gray-300 rounded-xl py-2 px-3 text-sm text-gray-850 outline-none focus:border-amber-500"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-gray-600 block mb-1">תיאור תכולה ומטען</label>
                    <textarea 
                      placeholder="שקי מלט במשקל 2 טון, שרשרת, מנופי עומס קל"
                      rows={2}
                      value={formData.items}
                      onChange={(e) => setFormData({ ...formData, items: e.target.value })}
                      className="w-full bg-white border border-gray-300 rounded-xl py-2 px-3 text-sm text-gray-850 outline-none focus:border-amber-500"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-semibold text-gray-600 block mb-1">תאריך הפצה</label>
                      <input 
                        type="date"
                        value={formData.date}
                        onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                        className="w-full bg-white border border-gray-300 rounded-xl py-2 px-3 text-sm text-gray-850 outline-none focus:border-amber-500"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-gray-600 block mb-1">שעת יציאה</label>
                      <input 
                        type="time"
                        value={formData.time}
                        onChange={(e) => setFormData({ ...formData, time: e.target.value })}
                        className="w-full bg-white border border-gray-300 rounded-xl py-2 px-3 text-sm text-gray-850 outline-none focus:border-amber-500"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-semibold text-gray-600 block mb-1">מחסן אספקה</label>
                      <select 
                        value={formData.warehouse}
                        onChange={(e) => setFormData({ ...formData, warehouse: e.target.value })}
                        className="w-full bg-white border border-gray-300 rounded-xl py-2 px-3 text-sm text-gray-850 outline-none"
                      >
                        <option value="חצר אשדוד">חצר אשדוד</option>
                        <option value="חצר שפד'ן">חצר שפד'ן</option>
                        <option value="מרלו'ג רמלה">מרלו'ג רמלה</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-gray-600 block mb-1">נהג משויך</label>
                      <select 
                        value={formData.driverId}
                        onChange={(e) => setFormData({ ...formData, driverId: e.target.value })}
                        className="w-full bg-white border border-gray-300 rounded-xl py-2 px-3 text-sm text-gray-850 outline-none"
                      >
                        <option value="">-- ללא נהג משויך --</option>
                        {drivers.map(d => (
                          <option key={d.id} value={d.id}>{d.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t border-gray-150 flex gap-3">
                  <button 
                    type="button"
                    onClick={() => setIsAddOpen(false)}
                    className="flex-1 bg-gray-100 text-gray-700 font-bold py-2.5 rounded-xl text-center text-sm border border-gray-200"
                  >
                    ביטול
                  </button>
                  <button 
                    type="submit"
                    className="flex-1 bg-gray-900 hover:bg-black text-white font-bold py-2.5 rounded-xl text-center text-sm font-bold shadow-md"
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
