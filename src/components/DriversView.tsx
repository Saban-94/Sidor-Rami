import React, { useState } from "react";
import { setDoc, doc, updateDoc } from "firebase/firestore";
import { db, handleFirestoreError, OperationType } from "../firebase";
import { Driver } from "../types";
import { 
  Users, UserPlus, Phone, Star, Percent, Truck, Plus, XCircle, HardHat, Award, Shield, Check
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface DriversViewProps {
  drivers: Driver[];
}

export function DriversView({ drivers }: DriversViewProps) {
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

  const getStatusBadgeStyles = (status: Driver["status"]) => {
    switch (status) {
      case "active": return "bg-emerald-50 text-emerald-800 border-emerald-250";
      case "busy": return "bg-amber-50 text-amber-800 border-amber-200/60";
      case "offline": return "bg-gray-100 text-gray-500 border-gray-250";
    }
  };

  const getStatusHebrew = (status: Driver["status"]) => {
    switch (status) {
      case "active": return "זמין בשטח";
      case "busy": return "בפריקה/עמוס";
      case "offline": return "לא פעיל (חופש)";
    }
  };

  return (
    <div className="flex flex-col flex-grow bg-[#FDFDFF] pb-24 text-right" dir="rtl" id="drivers-view-container">
      {/* 1. Header with pristine typography and floating controls */}
      <div className="bg-white/95 backdrop-blur-md px-5 pt-4 pb-3 border-b border-gray-100/95 shadow-2xs sticky top-0 z-30 flex flex-col gap-3" id="drivers-header">
        <div className="flex justify-between items-center">
          <div>
            <span className="text-[9px] uppercase tracking-widest text-gray-400 font-bold font-sans">צי משאיות ומנופים</span>
            <h2 className="text-xl font-black text-gray-900 tracking-tight mt-0.5">ניהול צוות נהגים</h2>
          </div>
          <motion.button 
            whileTap={{ scale: 0.95 }}
            onClick={() => setIsAddOpen(true)}
            className="bg-gray-900 hover:bg-black text-white font-extrabold py-2 px-3.5 rounded-xl shadow-xs flex items-center gap-1 text-[11px] transition-colors h-10 cursor-pointer select-none"
          >
            <UserPlus className="w-3.5 h-3.5 text-white" />
            <span>הוספת נהג</span>
          </motion.button>
        </div>

        {/* Search */}
        <div className="relative">
          <input 
            type="text"
            placeholder="חפש נהג בשם, טלפון, או לוחית..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-gray-50 border border-gray-150 rounded-xl py-2.5 pr-9 pl-4 text-xs text-gray-900 focus:outline-none focus:ring-1.5 focus:ring-gray-900 focus:bg-white transition-all text-right placeholder-gray-400 font-medium"
            id="driver-search-field"
          />
          <Users className="absolute right-3.5 top-3 w-4 h-4 text-gray-400 pointer-events-none" />
        </div>
      </div>

      {/* 2. Scrollable Drivers Frame */}
      <div className="px-5 mt-4 overflow-y-auto flex-1">
        <div className="space-y-4">
          {filteredDrivers.map((d) => (
            <div 
              key={d.id} 
              className="bg-white border border-gray-150/80 rounded-[2rem] p-5 shadow-2xs flex flex-col relative overflow-hidden"
              id={`driver-card-${d.id}`}
            >
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-3">
                  {/* Avatar design with crown for premium rating */}
                  <div className="w-12 h-12 bg-gray-100 border border-gray-150 rounded-2xl flex items-center justify-center text-gray-800 font-extrabold relative shrink-0">
                    <span className="text-sm font-black text-gray-900 font-sans">{d.name.charAt(0)}</span>
                    <div className="absolute -bottom-1 -right-1 w-5.5 h-5.5 bg-gray-900 text-amber-400 rounded-lg flex items-center justify-center border border-white p-0.5">
                      <HardHat className="w-3.5 h-3.5" />
                    </div>
                  </div>

                  <div>
                    <h3 className="font-extrabold text-[#111827] text-xs flex items-center gap-1.5 leading-snug">
                      {d.name}
                      <span className="text-[8px] font-black uppercase text-indigo-700 bg-indigo-50 border border-indigo-100 px-1.5 py-0.2 rounded-lg font-sans">
                        {d.vehicleType === "crane" ? "מנוף כבד" : "מוביל הובלות"}
                      </span>
                    </h3>
                    <div className="flex items-center gap-1.5 mt-1 text-[10px] text-gray-500 font-semibold">
                      <Phone className="w-3.5 h-3.5 text-gray-400" />
                      <a href={`tel:${d.phone}`} className="font-mono hover:underline">{d.phone}</a>
                      {d.plateNumber && (
                        <span className="text-[8px] text-gray-500 bg-gray-100 px-1.5 py-0.2 rounded font-mono">
                          מספר: {d.plateNumber}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <span className={`text-[9px] font-black border py-0.5 px-2.5 rounded-lg uppercase tracking-wider ${getStatusBadgeStyles(d.status)}`}>
                  {getStatusHebrew(d.status)}
                </span>
              </div>

              {/* Grid Statistics Segment */}
              <div className="grid grid-cols-3 gap-2.5 mt-4 pt-4 border-t border-gray-100">
                <div className="bg-gray-50/60 p-2.5 rounded-xl text-center border border-gray-100">
                  <span className="text-[8.5px] text-gray-400 font-black block uppercase tracking-wide">מדד דירוג</span>
                  <span className="text-[11px] font-black text-amber-700 flex items-center justify-center gap-0.5 mt-0.5 font-mono">
                    <Star className="w-3 h-3 text-amber-500 fill-amber-500 shrink-0" />
                    {d.rating || "5.0"}
                  </span>
                </div>
                <div className="bg-gray-50/60 p-2.5 rounded-xl text-center border border-gray-100">
                  <span className="text-[8.5px] text-gray-400 font-black block uppercase tracking-wide">עמידה בזמנים</span>
                  <span className="text-[11px] font-black text-indigo-805 flex items-center justify-center gap-0.5 mt-0.5 font-mono">
                    <Percent className="w-3 h-3 text-indigo-500 shrink-0" />
                    {d.onTimeRate || "100"}%
                  </span>
                </div>
                <div className="bg-gray-50/60 p-2.5 rounded-xl text-center border border-gray-100">
                  <span className="text-[8.5px] text-gray-400 font-black block uppercase tracking-wide font-sans">סך נסיעות</span>
                  <span className="text-[11px] font-black text-gray-900 flex items-center justify-center gap-0.5 mt-0.5 font-sans">
                    <Truck className="w-3 h-3 text-gray-400 shrink-0" />
                    {d.totalDeliveries || "0"}
                  </span>
                </div>
              </div>

              {/* Rapid Status Update row */}
              <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between text-xs">
                <span className="text-[9px] text-[#9CA3AF] font-black uppercase tracking-wider">עדכון זמינות:</span>
                <div className="flex gap-1" id={`status-switcher-${d.id}`}>
                  <button 
                    onClick={() => d.id && handleUpdateStatus(d.id, "active")}
                    className={`px-2.5 py-1.5 rounded-xl font-bold border transition-all text-[9px] cursor-pointer ${
                      d.status === "active" ? "bg-emerald-600 border-emerald-600 text-white shadow-2xs" : "bg-white border-gray-200 text-gray-500 hover:bg-gray-50"
                    }`}
                  >
                    זמין
                  </button>
                  <button 
                    onClick={() => d.id && handleUpdateStatus(d.id, "busy")}
                    className={`px-2.5 py-1.5 rounded-xl font-bold border transition-all text-[9px] cursor-pointer ${
                      d.status === "busy" ? "bg-amber-500 border-amber-500 text-white shadow-2xs" : "bg-white border-gray-200 text-gray-500 hover:bg-gray-50"
                    }`}
                  >
                    עמוס
                  </button>
                  <button 
                    onClick={() => d.id && handleUpdateStatus(d.id, "offline")}
                    className={`px-2.5 py-1.5 rounded-xl font-bold border transition-all text-[9px] cursor-pointer ${
                      d.status === "offline" ? "bg-gray-800 border-gray-800 text-white shadow-2xs" : "bg-white border-gray-200 text-gray-500 hover:bg-gray-50"
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

      {/* 3. New Driver Addition Drawer */}
      <AnimatePresence>
        {isAddOpen && (
          <div className="fixed inset-0 bg-black/60 z-50 flex items-end justify-center" id="add-driver-overlay">
            <motion.div 
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 26, stiffness: 210 }}
              className="bg-[#FDFDFF] w-full max-w-md rounded-t-[2.5rem] p-6 text-right flex flex-col border-t border-gray-100 overflow-y-auto"
              style={{ maxHeight: "90vh" }}
              id="add-driver-container"
            >
              <form onSubmit={handleCreateDriver} className="space-y-4">
                <div className="flex justify-between items-center border-b border-gray-100 pb-3">
                  <div>
                    <span className="text-[9px] uppercase tracking-widest text-gray-400 font-bold">צי כלי רכב</span>
                    <h3 className="text-md font-black text-gray-900">גיוס נהג / מנופאי חדש</h3>
                  </div>
                  <button 
                    type="button"
                    onClick={() => setIsAddOpen(false)}
                    className="text-gray-400 hover:text-gray-900 bg-gray-100 p-2 rounded-full cursor-pointer h-8 w-8 flex items-center justify-center font-bold"
                  >
                    <XCircle className="w-4 h-4 text-gray-500" />
                  </button>
                </div>

                <div className="space-y-3.5 text-xs">
                  <div>
                    <label className="font-extrabold text-gray-700 block mb-1">שם מלא של הנהג *</label>
                    <input 
                      type="text"
                      required
                      placeholder="לדוגמה: אריאל שבתאי"
                      value={driverForm.name}
                      onChange={(e) => setDriverForm({ ...driverForm, name: e.target.value })}
                      className="w-full bg-white border border-gray-250 rounded-xl py-2 px-3 text-xs h-10 outline-none focus:border-gray-900"
                    />
                  </div>

                  <div>
                    <label className="font-extrabold text-gray-700 block mb-1">מספר טלפון נייד *</label>
                    <input 
                      type="text"
                      required
                      placeholder="05x-xxxxxxx"
                      value={driverForm.phone}
                      onChange={(e) => setDriverForm({ ...driverForm, phone: e.target.value })}
                      className="w-full bg-white border border-gray-250 rounded-xl py-2 px-3 text-xs font-mono h-10 outline-none focus:border-gray-900"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="font-extrabold text-[#374151] block mb-1">סיווג רישוי כלי</label>
                      <select 
                        value={driverForm.vehicleType}
                        onChange={(e) => setDriverForm({ ...driverForm, vehicleType: e.target.value as Driver["vehicleType"] })}
                        className="w-full bg-white border border-gray-250 rounded-xl py-2 px-3 text-xs h-10 outline-none"
                      >
                        <option value="truck">مشאית מוביל</option>
                        <option value="crane">מנוף זרוע הרמה כבד</option>
                      </select>
                    </div>
                    <div>
                      <label className="font-extrabold text-[#374151] block mb-1">לוחית זיהוי</label>
                      <input 
                        type="text"
                        placeholder="לוחית רישוי צהובה..."
                        value={driverForm.plateNumber}
                        onChange={(e) => setDriverForm({ ...driverForm, plateNumber: e.target.value })}
                        className="w-full bg-white border border-gray-250 rounded-xl py-2 px-3 text-xs font-mono h-10 outline-none focus:border-gray-900"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2.5">
                    <div>
                      <label className="font-semibold text-gray-600 block mb-1 font-sans text-[10px]">נסיעות בסיס</label>
                      <input 
                        type="number"
                        value={driverForm.totalDeliveries}
                        onChange={(e) => setDriverForm({ ...driverForm, totalDeliveries: Number(e.target.value) })}
                        className="w-full bg-white border border-gray-250 rounded-xl py-2 px-3 text-xs h-10"
                      />
                    </div>
                    <div>
                      <label className="font-semibold text-gray-600 block mb-1 font-sans text-[10px]">עמידה בזמן %</label>
                      <input 
                        type="number"
                        value={driverForm.onTimeRate}
                        onChange={(e) => setDriverForm({ ...driverForm, onTimeRate: Number(e.target.value) })}
                        className="w-full bg-white border border-gray-250 rounded-xl py-2 px-3 text-xs h-10"
                      />
                    </div>
                    <div>
                      <label className="font-semibold text-gray-600 block mb-1 font-sans text-[10px]">דירוג כוכבים</label>
                      <input 
                        type="number"
                        step="0.1"
                        value={driverForm.rating}
                        onChange={(e) => setDriverForm({ ...driverForm, rating: Number(e.target.value) })}
                        className="w-full bg-white border border-gray-250 rounded-xl py-2 px-3 text-xs h-10"
                      />
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t border-gray-100 flex gap-3 mt-4">
                  <button 
                    type="button"
                    onClick={() => setIsAddOpen(false)}
                    className="flex-1 bg-gray-100 text-gray-600 font-black py-3 rounded-xl text-center text-xs border border-gray-200 cursor-pointer"
                  >
                    ביטול
                  </button>
                  <button 
                    type="submit"
                    className="flex-1 bg-gray-900 hover:bg-black text-white font-black py-3 rounded-xl text-center text-xs shadow-md cursor-pointer transition-colors"
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
