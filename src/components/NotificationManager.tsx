import React, { useState } from "react";
import { useNotifications } from "../hooks/useNotifications";
import { Bell, BellOff, Check, AlertCircle, Play, Sparkles } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

export function NotificationManager() {
  const {
    permission,
    token,
    requestPermission,
    playTestSound,
    notifications,
    setNotifications
  } = useNotifications();

  const [isOpen, setIsOpen] = useState(false);

  // Ask for permissions and assign
  const handleEnable = async () => {
    const activeToken = await requestPermission();
    if (activeToken) {
      alert("התראות Push הופעלו בהצלחה ב-SabanOS! סנכרון המכשיר הושלם.");
    } else if (Notification.permission === "denied") {
      alert("גישת ההתראות נחסמה בדפדפן. יש לאפשר אותה בהגדרות הכתובת.");
    }
  };

  return (
    <div className="relative" id="notifications-pwa-manager">
      {/* Primary Trigger Bell */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`p-2.5 rounded-full border shadow-2xs transition-all active:scale-90 flex items-center justify-center relative ${
          permission === "granted"
            ? "bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100"
            : permission === "denied"
            ? "bg-rose-50 border-rose-100 text-rose-600 hover:bg-rose-100"
            : "bg-gray-50 border-gray-200 text-gray-500 hover:bg-gray-100"
        }`}
        id="btn-pwa-push-alerts"
      >
        {permission === "granted" ? (
          <Bell className="w-4 h-4" />
        ) : (
          <BellOff className="w-4 h-4" />
        )}
        
        {/* Permission Active dot badge */}
        {permission === "granted" && (
          <span className="absolute top-1 right-1 w-2 h-2 bg-emerald-500 rounded-full animate-ping" />
        )}
      </button>

      {/* Popover pane */}
      <AnimatePresence>
        {isOpen && (
          <>
            <div 
              className="fixed inset-0 z-40 outline-none"
              onClick={() => setIsOpen(false)} 
            />
            <motion.div
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.95 }}
              className="absolute left-0 mt-2.5 w-72 bg-white/95 backdrop-blur-2xl border border-gray-150 rounded-[2rem] p-5 shadow-2xl z-50 text-right"
              id="notifications-pwa-popover"
            >
              <h3 className="text-xs font-black text-gray-900 uppercase tracking-wide border-b border-gray-100 pb-2 mb-3">
                הגדרות התראות Push & צלצול
              </h3>

              <div className="space-y-4">
                {/* Status Indicator */}
                <div className="flex items-start gap-3">
                  <div className={`mt-0.5 p-1.5 rounded-xl ${
                    permission === "granted" ? "bg-emerald-50 text-emerald-600" : "bg-amber-50 text-amber-600"
                  }`}>
                    {permission === "granted" ? <Check className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-gray-900">
                      {permission === "granted" ? "התראות Push פעילות" : "התראות Push כבויות"}
                    </h4>
                    <p className="text-[10px] text-gray-400 leading-normal mt-0.5">
                      {permission === "granted" 
                        ? "הדפדפן והמכשיר רשומים לקבלת עדכונים מסדרני SabanOS." 
                        : "התראות ההדחיפה מאפשרות לקבל עדכוני נסיעה ועגינה ברקע."}
                    </p>
                  </div>
                </div>

                {/* Token debug snippet for developers */}
                {token && (
                  <div className="bg-gray-50 border border-gray-150 rounded-xl p-2.5">
                    <span className="text-[8px] font-black text-gray-400 block uppercase">FCM Device Token</span>
                    <input
                      readOnly
                      onClick={(e) => {
                        (e.target as HTMLInputElement).select();
                        navigator.clipboard.writeText(token);
                        alert("טוקן ההתקן הועתק ללוח!");
                      }}
                      value={token}
                      className="w-full text-[8px] font-mono text-gray-500 bg-transparent border-0 focus:outline-none mt-1 cursor-pointer truncate text-left"
                    />
                  </div>
                )}

                {/* Actions */}
                <div className="pt-2 border-t border-gray-100 space-y-2">
                  {permission !== "granted" ? (
                    <button
                      onClick={handleEnable}
                      className="w-full bg-gray-900 hover:bg-black text-white py-2.5 rounded-xl text-[10px] font-extrabold flex items-center justify-center gap-2 shadow-sm transition-all"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                      הפעל התראות מכשיר
                    </button>
                  ) : (
                    <button
                      onClick={playTestSound}
                      className="w-full bg-gray-50 border border-gray-200 text-gray-800 hover:bg-gray-100 py-2.5 rounded-xl text-[10px] font-extrabold flex items-center justify-center gap-2 transition-all active:scale-95"
                    >
                      <Play className="w-3.5 h-3.5 text-amber-500" />
                      בדוק צלצול התראה (Audio)
                    </button>
                  )}
                </div>

                {/* Received alerts list */}
                {notifications.length > 0 && (
                  <div className="pt-3 border-t border-gray-100">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-[9px] font-black text-gray-400 uppercase tracking-wider">התראות אחרונות בשטח</span>
                      <button
                        onClick={() => setNotifications([])}
                        className="text-[8px] font-bold text-rose-500 hover:underline"
                      >
                        נקה הכל
                      </button>
                    </div>
                    <div className="space-y-2 max-h-36 overflow-y-auto pr-1">
                      {notifications.map((notif) => (
                        <div key={notif.id} className="bg-gray-50/70 border border-gray-150 rounded-xl p-2 text-right">
                          <h5 className="text-[10px] font-black text-gray-900">{notif.title}</h5>
                          <p className="text-[9px] text-gray-500 mt-0.5 leading-relaxed">{notif.body}</p>
                          <span className="text-[8px] text-gray-400 font-mono mt-1 block">
                            {notif.timestamp.toLocaleTimeString("he-IL", { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
