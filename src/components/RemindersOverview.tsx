import React, { useState, useEffect } from "react";
import { collection, onSnapshot, setDoc, doc, updateDoc, deleteDoc } from "firebase/firestore";
import { db, handleFirestoreError, OperationType } from "../firebase";
import { Reminder } from "../types";
import { 
  Bell, CheckSquare, Square, Calendar, Clock, Plus, Trash, AlertCircle, Sparkles, Pin
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

export function RemindersOverview() {
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [loading, setLoading] = useState(true);
  const [isOpen, setIsOpen] = useState(false);

  // New Reminder State
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState(new Date().toISOString().split("T")[0]);
  const [dueTime, setDueTime] = useState("09:00");
  const [orderId, setOrderId] = useState("");

  useEffect(() => {
    const remindersRef = collection(db, "reminders");
    const unsub = onSnapshot(remindersRef, (snap) => {
      const list: Reminder[] = [];
      snap.forEach(d => {
        list.push({ ...d.data(), id: d.id } as Reminder);
      });
      setReminders(list);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, "reminders");
    });
    return () => unsub();
  }, []);

  const handleToggleComplete = async (reminder: Reminder) => {
    if (!reminder.id) return;
    try {
      const rRef = doc(db, "reminders", reminder.id);
      await updateDoc(rRef, { isCompleted: !reminder.isCompleted });
    } catch (e) {
      handleFirestoreError(e, OperationType.UPDATE, `reminders/${reminder.id}`);
    }
  };

  const handleCreateReminder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    try {
      const newRem: Reminder = {
        title,
        description,
        dueDate,
        dueTime,
        isCompleted: false,
        orderId: orderId || undefined
      };
      const docId = `rem_${Date.now()}`;
      await setDoc(doc(db, "reminders", docId), newRem);
      
      // Reset form
      setTitle("");
      setDescription("");
      setDueDate(new Date().toISOString().split("T")[0]);
      setDueTime("09:00");
      setOrderId("");
      setIsOpen(false);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, "reminders");
    }
  };

  const activeReminders = reminders.filter(r => !r.isCompleted);

  return (
    <div className="text-right" dir="rtl" id="reminders-context-block">
      {/* Alert Pill status counter */}
      <button 
        onClick={() => setIsOpen(true)}
        className="relative bg-gray-50 border border-gray-200 text-gray-900 hover:bg-gray-100 font-bold p-2.5 rounded-full shadow-xs flex items-center justify-center transition-all active:scale-90"
        id="btn-alert-reminders"
      >
        <Bell className="w-4 h-4 text-gray-900" />
        {activeReminders.length > 0 && (
          <span className="absolute -top-1.5 -right-1.5 bg-gray-900 text-white font-mono font-black text-[9px] w-4.5 h-4.5 rounded-full flex items-center justify-center border border-white animate-pulse">
            {activeReminders.length}
          </span>
        )}
      </button>

      <AnimatePresence>
        {isOpen && (
          <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-xs" id="reminders-modal-overlay">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white/95 backdrop-blur-3xl w-full max-w-sm rounded-[2.5rem] p-6 shadow-2xl border border-gray-150"
              id="reminders-modal-content"
            >
              <div className="flex justify-between items-center pb-3 border-b border-gray-100">
                <h3 className="text-xs font-black text-gray-900 uppercase tracking-wide flex items-center gap-1.5 font-sans">
                  <Pin className="w-3.5 h-3.5 text-gray-900" />
                  תזכורות והתראות משרד
                </h3>
                <button 
                  onClick={() => setIsOpen(false)}
                  className="text-gray-400 hover:text-gray-900 font-extrabold text-[10px] uppercase tracking-wider"
                >
                  סגור
                </button>
              </div>

              {/* List of current Reminders */}
              <div className="py-3 max-h-[300px] overflow-y-auto space-y-2.5 my-3">
                {loading ? (
                  <p className="text-center text-xs text-gray-500">טוען תזכורות סדרן...</p>
                ) : reminders.length === 0 ? (
                  <div className="text-center py-6 text-xs text-gray-500">
                    אין תזכורות פעילות במשרד H. Saban.
                  </div>
                ) : (
                  reminders.map((rem) => (
                    <div 
                      key={rem.id}
                      className={`flex items-start gap-2.5 p-3 rounded-xl border transition-all text-xs ${
                        rem.isCompleted 
                          ? "bg-gray-50/70 border-gray-150 text-gray-450 line-through" 
                          : "bg-white border-gray-200 text-gray-800"
                      }`}
                    >
                      <button 
                        onClick={() => handleToggleComplete(rem)}
                        className="mt-0.5"
                      >
                        {rem.isCompleted ? (
                          <CheckSquare className="w-4.5 h-4.5 text-emerald-600" />
                        ) : (
                          <Square className="w-4.5 h-4.5 text-gray-400 hover:text-gray-600" />
                        )}
                      </button>
                      <div className="flex-1 text-right">
                        <div className="font-bold">{rem.title}</div>
                        {rem.description && <div className="text-[11px] text-gray-500 mt-0.5">{rem.description}</div>}
                        <div className="flex gap-2 text-[10px] text-gray-400 mt-1 font-mono">
                          <span className="flex items-center gap-0.5"><Calendar className="w-3 h-3" /> {rem.dueDate}</span>
                          {rem.dueTime && <span className="flex items-center gap-0.5"><Clock className="w-3 h-3" /> {rem.dueTime}</span>}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Add form inside dialog */}
              <form onSubmit={handleCreateReminder} className="border-t border-gray-150 pt-3.5 space-y-3 text-right">
                <h3 className="text-xs font-bold text-gray-800">רישום התראה משרדית חדשה</h3>
                
                <input 
                  type="text"
                  required
                  placeholder="כותרת התזכורת (למשל: תיאום מנוף לתל אביב)..."
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs"
                />

                <textarea 
                  placeholder="פירוט תיאור נוסף..."
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs"
                />

                <div className="grid grid-cols-2 gap-2.5 text-xs">
                  <div>
                    <label className="block text-[10px] text-gray-500 mb-0.5">תאריך יעד</label>
                    <input 
                      type="date"
                      value={dueDate}
                      onChange={(e) => setDueDate(e.target.value)}
                      className="w-full bg-gray-50 border border-gray-200 rounded-lg px-2 py-1"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-gray-500 mb-0.5">שעה</label>
                    <input 
                      type="time"
                      value={dueTime}
                      onChange={(e) => setDueTime(e.target.value)}
                      className="w-full bg-gray-50 border border-gray-200 rounded-lg px-2 py-1"
                    />
                  </div>
                </div>

                <button 
                  type="submit"
                  disabled={!title.trim()}
                  className="w-full bg-gray-900 text-white font-bold py-2 rounded-xl text-center text-xs shadow-md flex items-center justify-center gap-1 hover:bg-black transition-all disabled:opacity-40"
                >
                  <Plus className="w-4 h-4 text-amber-500" />
                  צור תזכורת במערכת
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
