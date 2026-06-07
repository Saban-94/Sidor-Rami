import React, { useState, useEffect } from "react";
import { collection, onSnapshot, setDoc, doc, updateDoc } from "firebase/firestore";
import { db, handleFirestoreError, OperationType } from "../firebase";
import { Driver } from "../types";
import { 
  Users, UserPlus, Phone, Star, Activity, Percent, Shield, Truck, AlertCircle, Plus, XCircle, CheckCircle, Disc, HardHat
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface DriversViewProps {
  drivers: Driver[];
}

export function DriversView({ drivers }: DriversViewProps) {
  const [loading, setLoading] = useState(false);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const [driverForm, setDriverForm] = useState({
    name: "",
    phone: "",
    vehicleType: "truck" as Driver["vehicleType"],
    plateNumber: "",
    status: "active" as Driver["status"],
    totalDeliveries: 30,
    onTimeRate: 95,
    rating: 5.0
  });

  const handleUpdateStatus = async (driverId: string, newStatus: Driver["status"]) => {
    try {
      const driverRef = doc(db, "drivers", driverId);
      await updateDoc(driverRef, { status: newStatus });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `drivers/${driverId}`);
    }
  };

  const handleCreateDriver = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!driverForm.name || !driverForm.phone) {
      alert("שם נהג ומספר טלפון הם חובה!");
      return;
    }
    try {
      const newDriver: Driver = {
        name: driverForm.name,
        phone: driverForm.phone,
        vehicleType: driverForm.vehicleType,
        plateNumber: driverForm.plateNumber || "לא צוין",
        status: driverForm.status,
        totalDeliveries: Number(driverForm.totalDeliveries),
        onTimeRate: Number(driverForm.onTimeRate),
        rating: Number(driverForm.rating)
      };
      
      // Document ID based on clean lowercase name string to avoid space mismatch
      const docId = driverForm.name.toLowerCase().replace(/\s+/g, "_").trim();
      await setDoc(doc(db, "drivers", docId), newDriver);
      setIsAddOpen(false);
      
      setDriverForm({
        name: "",
        phone: "",
        vehicleType: "truck",
        plateNumber: "",
        status: "active",
        totalDeliveries: 30,
        onTimeRate: 95,
        rating: 5.0
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, "drivers");
    }
  };

  const filteredDrivers = drivers.filter(d => 
    (d.name || '').toLowerCase().includes((searchQuery || '').toLowerCase()) || 
    (d.plateNumber && d.plateNumber.toLowerCase().includes((searchQuery || '').toLowerCase())) ||
    (d.phone || '').toLowerCase().includes((searchQuery || '').toLowerCase())
  );

  const getStatusBadge = (status: Driver["status"]) => {
    switch (status) {
      case "active": return "bg-emerald-100 text-emerald-800 border-emerald-250";
      case "busy": return "bg-amber-100 text-amber-800 border-amber-250";
      case "offline": return "bg-gray-100 text-gray-550 border-gray-250";
    }
  };

  const getStatusHebrew = (status: Driver["status"]) => {
    switch (status) {
      case "active": return "פעיל בשטח";
      case "busy": return "בפריקה/עמוס";
      case "offline": return "לא פעיל / חופש";
    }
  };

  return (
    <div className="flex flex-col flex-1 bg-[#FDFDFF] pb-24 text-right" dir="rtl" id="drivers-view-container">
      {/* Header bar */}
      <div className="bg-white px-5 py-4 border-b border-gray-100 shadow-2xs" id="drivers-header">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h2 className="text-xl font-black text-gray-900 tracking-tight font-sans">ניהול צי נהגים</h2>
            <p className="text-[10px] uppercase tracking-widest text-[#B5BAC9] font-bold">מנופאים ונהגי הובלה כבדה</p>
          </div>
          <button 
            onClick={() => setIsAddOpen(true)}
            className="bg-gray-900 hover:bg-black text-white font-bold py-2.5 px-4 rounded-xl shadow-md flex items-center gap-1.5 text-xs transition-colors"
          >
            <UserPlus className="w-4 h-4 text-white" />
            <span>צירוף נהג</span>
          </button>
        </div>

        {/* Local Search input */}
        <div className="relative">
          <input 
            type="text"
            placeholder="חפש נהג בשם, טלפון, מספר רישוי..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-gray-50 border border-gray-200 rounded-2xl py-2.5 pr-10 pl-4 text-xs text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-950 transition-all text-right placeholder-gray-400 font-medium"
            id="driver-search-field"
          />
          <Users className="absolute right-3.5 top-3.5 w-4 h-4 text-gray-400 pointer-events-none" />
        </div>
      </div>

      <div className="px-5 mt-4 overflow-y-auto flex-grow">
        <div className="flex flex-col gap-4">
          {filteredDrivers.map((d) => (
            <div 
              key={d.id} 
              className="bg-white/80 backdrop-blur-xl border border-gray-150/80 rounded-[2rem] p-5 shadow-xs flex flex-col"
              id={`driver-card-${d.id}`}
            >
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-3">
                  {/* Avatar thumbnail */}
                  <div className="w-11 h-11 bg-gray-150 rounded-full flex items-center justify-center border border-white text-gray-800 font-bold relative shrink-0">
                    <span className="text-sm font-black font-sans">{d.name.charAt(0)}</span>
                    <HardHat className="absolute -bottom-1 -right-1 w-5 h-5 text-amber-500 bg-white rounded-full p-0.5 border border-gray-150" />
                  </div>

                  <div>
                    <h3 className="font-extrabold text-gray-900 text-xs flex items-center gap-1.5">
                      {d.name}
                      <span className="text-[8px] font-black uppercase text-[#B5BAC9] tracking-wider">
                        {d.vehicleType === "crane" ? "מנוף כבד" : "משאית מוביל"}
                      </span>
                    </h3>
                    <div className="flex items-center gap-1 mt-0.5 text-[10px] text-gray-500 font-medium">
                      <Phone className="w-3 h-3 text-gray-400" />
                      <a href={`tel:${d.phone}`} className="font-mono hover:underline">{d.phone}</a>
                      {d.plateNumber && <span className="text-[8px] text-gray-400 bg-gray-100 px-1 py-0.2 rounded font-mono mr-1">מספר: {d.plateNumber}</span>}
                    </div>
                  </div>
                </div>

                <span className={`text-[8px] font-black border py-0.5 px-2 rounded-full uppercase tracking-wider ${getStatusBadge(d.status)}`}>
                  {getStatusHebrew(d.status)}
                </span>
              </div>

              {/* Grid telemetry ratings */}
              <div className="grid grid-cols-3 gap-2 mt-4 pt-3 border-t border-gray-100 text-center">
                <div className="bg-gray-50 p-2.5 rounded-2xl text-right">
                  <span className="text-[8px] text-gray-400 font-bold block uppercase">דירוג עובד</span>
                  <span className="text-xs font-black text-amber-650 flex items-center gap-0.5 mt-0.5">
                    <Star className="w-3 h-3 text-amber-500 fill-amber-500" />
                    {d.rating || "5.0"}
                  </span>
                </div>
                <div className="bg-gray-50 p-2.5 rounded-2xl text-right">
                  <span className="text-[8px] text-gray-400 font-bold block uppercase">עמידה בזמנים</span>
                  <span className="text-xs font-black text-sky-850 flex items-center gap-0.5 mt-0.5">
                    <Percent className="w-3 h-3 text-sky-505" />
                    {d.onTimeRate || "100"}%
                  </span>
                </div>
                <div className="bg-gray-50 p-2.5 rounded-2xl text-right">
                  <span className="text-[8px] text-gray-400 font-bold block uppercase">סך נסיעות</span>
                  <span className="text-xs font-black text-gray-900 flex items-center gap-0.5 mt-0.5">
                    <Truck className="w-3 h-3 text-gray-500" />
                    {d.totalDeliveries || "0"}
                  </span>
                </div>
              </div>

              {/* Status fast switcher controllers */}
              <div className="mt-4 pt-3.5 border-t border-gray-100 flex items-center justify-between text-xs">
                <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">מצב זמינות:</span>
                <div className="flex gap-1.5" id={`status-switcher-${d.id}`}>
                  <button 
                    onClick={() => d.id && handleUpdateStatus(d.id, "active")}
                    className={`px-3 py-1 rounded-xl font-bold border transition-all text-[10px] ${
                      d.status === "active" ? "bg-emerald-50 border-emerald-300 text-emerald-800" : "bg-white border-gray-200 text-gray-500"
                    }`}
                  >
                    זמין בשטח
                  </button>
                  <button 
                    onClick={() => d.id && handleUpdateStatus(d.id, "busy")}
                    className={`px-3 py-1 rounded-xl font-bold border transition-all text-[10px] ${
                      d.status === "busy" ? "bg-amber-50 border-amber-300 text-amber-800" : "bg-white border-gray-200 text-gray-500"
                    }`}
                  >
                    עמוס
                  </button>
                  <button 
                    onClick={() => d.id && handleUpdateStatus(d.id, "offline")}
                    className={`px-2.5 py-1 rounded-xl font-bold border transition-all text-[10px] ${
                      d.status === "offline" ? "bg-gray-100 border-gray-305 text-gray-700" : "bg-white border-gray-250 text-gray-450"
                    }`}
                  >
                    חופש
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* CREATE DRIVER DRAWER CODES */}
      <AnimatePresence>
        {isAddOpen && (
          <div className="fixed inset-0 bg-black/60 z-50 flex items-end justify-center" id="add-driver-overlay">
            <motion.div 
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 220 }}
              className="bg-[#FDFDFF] w-full max-w-md rounded-t-3xl max-h-[90vh] p-6 text-right flex flex-col justify-between border-t border-gray-200 overflow-y-auto"
              id="add-driver-container"
            >
              <form onSubmit={handleCreateDriver} className="space-y-4">
                <div className="flex justify-between items-center">
                  <h2 className="text-md font-bold text-gray-900">גיוס וצירוף נהג חדש</h2>
                  <button 
                    type="button"
                    onClick={() => setIsAddOpen(false)}
                    className="text-gray-400 hover:text-gray-600 font-bold"
                  >
                    סגור
                  </button>
                </div>

                <div className="space-y-3 text-xs">
                  <div>
                    <label className="font-semibold block mb-1">שם מלא של הנהג *</label>
                    <input 
                      type="text"
                      required
                      placeholder="ישראל ישראלי"
                      value={driverForm.name}
                      onChange={(e) => setDriverForm({ ...driverForm, name: e.target.value })}
                      className="w-full bg-white border border-gray-300 rounded-xl py-2 px-3 text-xs"
                    />
                  </div>

                  <div>
                    <label className="font-semibold block mb-1">מספר טלפון נייד *</label>
                    <input 
                      type="text"
                      required
                      placeholder="052-xxxxxxx"
                      value={driverForm.phone}
                      onChange={(e) => setDriverForm({ ...driverForm, phone: e.target.value })}
                      className="w-full bg-white border border-gray-300 rounded-xl py-2 px-3 text-xs font-mono"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="font-semibold block mb-1">רישוי וסוג כלי</label>
                      <select 
                        value={driverForm.vehicleType}
                        onChange={(e) => setDriverForm({ ...driverForm, vehicleType: e.target.value as Driver["vehicleType"] })}
                        className="w-full bg-white border border-gray-300 rounded-xl py-2 px-3 text-xs"
                      >
                        <option value="truck">משאית מוביל</option>
                        <option value="crane">מנוף הרמה כבד</option>
                      </select>
                    </div>
                    <div>
                      <label className="font-semibold block mb-1">לוחית זיהוי</label>
                      <input 
                        type="text"
                        placeholder="77-210-99"
                        value={driverForm.plateNumber}
                        onChange={(e) => setDriverForm({ ...driverForm, plateNumber: e.target.value })}
                        className="w-full bg-white border border-gray-300 rounded-xl py-2 px-3 text-xs font-mono"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="font-semibold block mb-1">נסיעות התחלתי</label>
                      <input 
                        type="number"
                        value={driverForm.totalDeliveries}
                        onChange={(e) => setDriverForm({ ...driverForm, totalDeliveries: Number(e.target.value) })}
                        className="w-full bg-white border border-gray-300 rounded-xl py-1.5 px-2 text-xs"
                      />
                    </div>
                    <div>
                      <label className="font-semibold block mb-1">שעור עמידה %</label>
                      <input 
                        type="number"
                        value={driverForm.onTimeRate}
                        onChange={(e) => setDriverForm({ ...driverForm, onTimeRate: Number(e.target.value) })}
                        className="w-full bg-white border border-gray-300 rounded-xl py-1.5 px-2 text-xs"
                      />
                    </div>
                    <div>
                      <label className="font-semibold block mb-1">ציון (מדד כוכב)</label>
                      <input 
                        type="number"
                        step="0.1"
                        value={driverForm.rating}
                        onChange={(e) => setDriverForm({ ...driverForm, rating: Number(e.target.value) })}
                        className="w-full bg-white border border-gray-300 rounded-xl py-1.5 px-2 text-xs"
                      />
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t border-gray-150 flex gap-3">
                  <button 
                    type="button"
                    onClick={() => setIsAddOpen(false)}
                    className="flex-1 bg-gray-150 text-gray-750 font-bold py-2 rounded-xl text-center text-xs"
                  >
                    ביטול
                  </button>
                  <button 
                    type="submit"
                    className="flex-1 bg-gray-900 text-white font-bold py-2 rounded-xl text-center text-xs shadow-md"
                  >
                    צרף לצוות סבן
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
