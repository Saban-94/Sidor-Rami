import React, { useState, useEffect, useRef } from "react";
import { collection, doc, setDoc, updateDoc, addDoc, onSnapshot } from "firebase/firestore";
import { db } from "../firebase";
import { Order, MorningReport, InventoryItem, Driver } from "../types";
import { 
  Sparkles, SendHorizontal, Upload, Check, Clipboard, Database, FileText, RefreshCw, XCircle, Clock,
  Search, Plus, Minus, Truck, Wrench, UserCheck, MapPin, AlertCircle, Eye, EyeOff, ChevronDown,
  ChevronUp, Calendar, Phone, Trash2, Edit2, AlertTriangle, ShieldCheck
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface Message {
  id: string;
  role: "user" | "model";
  content: string;
  type?: "text" | "comax_widget" | "report_widget" | "drivers_widget" | "tasks_widget" | "inventory_widget";
}

export function NoaChatView() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "greet-1",
      role: "model",
      content: "שלום! אני נועה, העוזרת הווירטואלית של ח. סבן הובלות וכלים. אני יכולה לחזות זמני הגעה של נהגים, לקלוט לוגים של מערכת קומקס (Comax) כדי לעדכן הזמנות ומלאי, לעזור לך לרשום תזכורות או להפיק את דו\"ח הבוקר הלוגיסטי. במה נתחיל היום?",
      type: "text"
    }
  ]);
  const [inputMessage, setInputMessage] = useState("");
  const [loadingChat, setLoadingChat] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Syncing operational states
  const [allOrders, setAllOrders] = useState<Order[]>([]);
  const [inventoryList, setInventoryList] = useState<InventoryItem[]>([]);
  const [allDrivers, setAllDrivers] = useState<Driver[]>([]);
  const [reportHistory, setReportHistory] = useState<MorningReport[]>([]);

  // Smooth scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Real-time Firestore synchronization
  useEffect(() => {
    const unsubOrders = onSnapshot(collection(db, "orders"), (snap) => {
      const list: Order[] = [];
      snap.forEach(d => list.push({ ...d.data(), id: d.id } as Order));
      setAllOrders(list);
    });

    const unsubInventory = onSnapshot(collection(db, "inventory"), (snap) => {
      const list: InventoryItem[] = [];
      snap.forEach(d => list.push({ ...d.data(), id: d.id } as InventoryItem));
      setInventoryList(list);
    });

    const unsubDrivers = onSnapshot(collection(db, "drivers"), (snap) => {
      const list: Driver[] = [];
      snap.forEach(d => list.push({ ...d.data(), id: d.id } as Driver));
      setAllDrivers(list);
    });

    const unsubReports = onSnapshot(collection(db, "morning_reports"), (snap) => {
      const list: MorningReport[] = [];
      snap.forEach(d => list.push({ ...d.data(), id: d.id } as MorningReport));
      setReportHistory(list);
    });

    return () => {
      unsubOrders();
      unsubInventory();
      unsubDrivers();
      unsubReports();
    };
  }, []);

  // AI manual trigger order creating event (for button action clicks in chat)
  const createOrderFromAI = async (orderData: Partial<Order>) => {
    try {
      const orderNumber = orderData.orderNumber || `SABAN-${Date.now().toString().slice(-6)}`;
      const docId = orderNumber.toLowerCase().trim();
      
      const finalOrder: Order = {
        orderNumber,
        customerName: orderData.customerName || "לקוח לא ידוע",
        destination: orderData.destination || "לא צוין יעד משלוח",
        date: orderData.date || new Date().toISOString().split("T")[0],
        time: orderData.time || "08:00",
        items: orderData.items || "חומרי בניין לוגיסטיים",
        status: "pending",
        warehouse: orderData.warehouse || "מחסן ראשי",
        documentIds: orderData.documentIds || "",
        eta: "ממתין לשיבוץ נהג"
      };

      await setDoc(doc(db, "orders", docId), finalOrder);
      
      addSystemMessage(`✅ הזמנה **${orderNumber}** נרשמה בהצלחה בענן. המערכת מחכה לשיבוץ נהג מתאים.`);
    } catch (error) {
      console.error("Failed to create order from AI confirmation", error);
    }
  };

  const handleChatContainerClick = async (e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    const triggerBtn = target.closest("[data-order-trigger]");
    if (triggerBtn) {
      const orderDataStr = triggerBtn.getAttribute("data-order-trigger");
      if (orderDataStr) {
        try {
          const orderData = JSON.parse(orderDataStr);
          await createOrderFromAI(orderData);
        } catch (err) {
          console.error("Failed to parse trigger data", err);
        }
      }
    }
  };

  // Safe handler to append model messages internally 
  const addSystemMessage = (content: string) => {
    setMessages(prev => [
      ...prev,
      {
        id: `sys-${Date.now()}`,
        role: "model",
        content
      }
    ]);
  };

  // User chat send action
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputMessage.trim()) return;

    const userMsg = inputMessage;
    setInputMessage("");
    setMessages(prev => [...prev, { id: `user-${Date.now()}`, role: "user", content: userMsg }]);
    setLoadingChat(true);

    try {
      const response = await fetch("/api/gemini/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: userMsg,
          history: messages.map(m => ({ role: m.role, content: m.content })),
          inventory: inventoryList,
          orders: allOrders
        })
      });
      const data = await response.json();
      if (data.text) {
        let cleanText = data.text;
        if (cleanText.trim().startsWith("```")) {
          cleanText = cleanText.replace(/^```html\s*|\s*```$/gi, "").replace(/^```\s*|\s*```$/gi, "");
        }
        setMessages(prev => [...prev, { id: `model-${Date.now()}`, role: "model", content: cleanText }]);
      } else {
        addSystemMessage("מצטערת, חל שיבוש זמני בעיבוד הבקשה שלך מול שרתי הליבה.");
      }
    } catch (error) {
      console.error("Chat API error:", error);
      addSystemMessage("חיבור הרשת עם שרתי סבן-AI נכשל. אנא ודא שהסביבה מחוברת.");
    } finally {
      setLoadingChat(false);
    }
  };

  // Triggers dynamic conversational widget injection in-stream
  const triggerWidgetAction = (type: "comax_widget" | "report_widget" | "drivers_widget" | "tasks_widget" | "inventory_widget") => {
    let userText = "";
    let modelText = "";
    if (type === "comax_widget") {
      userText = "פתח שער קומקס ללוגים (Comax ERP Gateway)";
      modelText = "הנה שער הסריקה של Comax ERP. אנא הדבק את לוג המסוף או האקסל ולחץ על פענוח:";
    } else if (type === "report_widget") {
      userText = "פתח מחולל דוח בוקר לוגיסטי";
      modelText = "הנה ממשק דוח בוקר לוגיסטי. בחר תאריך וחולל את הדוח באמצעות AI:";
    } else if (type === "drivers_widget") {
      userText = "הצג לי את מצב נהגי החברה";
      modelText = "הנה מאגר הנהגים של ח. סבן הובלות בזמן אמת. באפשרותך לעדכן סטטוסים בשטח:";
    } else if (type === "tasks_widget") {
      userText = "פתח את לוח המשימות וההזמנות";
      modelText = "הנה לוח ההזמנות והמטלות הפעיל. תוכל לנהל משלוחים, לשבץ נהגים ולחזות זמני ETA:";
    } else if (type === "inventory_widget") {
      userText = "פתח את דוח מלאי החצר והכלים";
      modelText = "הנה מאגר המלאי והציוד. כפתורי הפקדים מאפשרים עדכון כמויות מיידי לענן:";
    }

    setMessages(prev => [
      ...prev,
      {
        id: `u-${Date.now()}`,
        role: "user",
        content: userText
      },
      {
        id: `w-${Date.now()}`,
        role: "model",
        content: modelText,
        type
      }
    ]);
  };

  return (
    <div className="flex flex-col flex-1 h-full overflow-hidden text-right bg-slate-50/50" dir="rtl" id="conversational-os-container">
      {/* Dynamic Agent Core Activity Status Block */}
      <div className="px-5 py-3 bg-white border-b border-gray-100 flex justify-between items-center shrink-0 shadow-3xs" id="active-noa-bar">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-2xl bg-indigo-600/95 flex items-center justify-center shrink-0 shadow-sm">
            <Sparkles className="w-4.5 h-4.5 text-white animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-black text-gray-900 font-sans tracking-tight leading-tight">נועה - סייעת קוגניטיבית</span>
              <span className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping"></span>
            </div>
            <p className="text-[10px] text-[#7E8B9B] font-bold">סנכרון מלא מקומקס & SabanOS Cloud</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="text-[9px] bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full font-black border border-indigo-100 uppercase tracking-widest font-mono">
            Zero-UI Context
          </div>
        </div>
      </div>

      {/* Primary Scrollback Stream for the entire system */}
      <div 
        className="flex-1 overflow-y-auto px-5 py-5 space-y-5 scroll-smooth bg-gradient-to-b from-[#FAFBFD] to-white" 
        onClick={handleChatContainerClick}
        id="conversational-feed-stream"
      >
        <AnimatePresence initial={false}>
          {messages.map((m) => {
            const isHtml = m.role === "model" && m.type === "text" && (
              m.content.includes("<div") || 
              m.content.includes("<p") || 
              m.content.includes("<span") || 
              m.content.includes("<button")
            );

            return (
              <motion.div 
                key={m.id}
                initial={{ opacity: 0, y: 12, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.25, ease: "easeOut" }}
                className={`flex flex-col ${m.role === "user" ? "items-start" : "items-end"}`}
              >
                {/* Visual Header Monogram inside Stream */}
                <span className="text-[9px] font-black text-[#A5ADC0] px-1.5 mb-1 select-none">
                  {m.role === "user" ? "אתה / סדרן" : "נועה AI"}
                </span>

                {m.type && m.type !== "text" ? (
                  /* Render Specialist Interactive Action Widgets right inside bubble list! */
                  <div className="w-full max-w-[94%] bg-white border border-gray-150/70 rounded-[1.8rem] shadow-[0_8px_30px_rgb(0,0,0,0.03)] p-5 text-right relative overflow-hidden ring-4 ring-slate-100/40">
                    <div className="absolute top-0 right-0 left-0 h-1.5 bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-600"></div>
                    {m.type === "comax_widget" && (
                      <ComaxInlineWidget 
                        allOrders={allOrders} 
                        inventoryList={inventoryList} 
                        onAddSystemMessage={addSystemMessage}
                      />
                    )}
                    {m.type === "report_widget" && (
                      <ReportInlineWidget 
                        allOrders={allOrders} 
                        reportHistory={reportHistory} 
                        onAddSystemMessage={addSystemMessage}
                      />
                    )}
                    {m.type === "drivers_widget" && (
                      <DriversInlineWidget 
                        allDrivers={allDrivers} 
                      />
                    )}
                    {m.type === "tasks_widget" && (
                      <TasksInlineWidget 
                        allOrders={allOrders} 
                        allDrivers={allDrivers}
                      />
                    )}
                    {m.type === "inventory_widget" && (
                      <InventoryInlineWidget 
                        inventoryList={inventoryList} 
                      />
                    )}
                  </div>
                ) : isHtml ? (
                  <div 
                    className="w-full max-w-[94%] text-right text-[11px] leading-relaxed shadow-3xs p-4 bg-white/95 border border-gray-150 rounded-[1.5rem]" 
                    dangerouslySetInnerHTML={{ __html: m.content }} 
                  />
                ) : (
                  <div className={`p-4 rounded-3xl text-[12px] leading-relaxed max-w-[85%] shadow-sm ${
                    m.role === "user" 
                      ? "bg-gray-950 text-white rounded-br-none" 
                      : "bg-[#F3F4F6] text-gray-900 rounded-bl-none border border-gray-200/60 font-medium"
                  }`}>
                    <p className="whitespace-pre-line leading-relaxed font-sans">{m.content}</p>
                  </div>
                )}
              </motion.div>
            );
          })}

          {loadingChat && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col items-end"
            >
              <span className="text-[9px] font-black text-[#A5ADC0] px-1.5 mb-1">נועה AI</span>
              <div className="bg-[#F3F4F6] border border-gray-200/60 px-4 py-3 rounded-3xl rounded-bl-none flex items-center gap-1.5 shadow-3xs">
                <span className="w-1.5 h-1.5 bg-gray-500 rounded-full animate-bounce"></span>
                <span className="w-1.5 h-1.5 bg-gray-500 rounded-full animate-bounce [animation-delay:0.15s]"></span>
                <span className="w-1.5 h-1.5 bg-gray-500 rounded-full animate-bounce [animation-delay:0.3s]"></span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        <div ref={messagesEndRef} />
      </div>

      {/* Floating Translucent Shortcuts Menu */}
      <div className="bg-gradient-to-t from-white via-white/95 to-transparent px-5 pt-3 pb-1 border-t border-gray-100 z-10 shrink-0" id="shortcut-quicktips">
        <span className="text-[9px] font-black tracking-widest text-[#B4BAC9] block mb-2 uppercase select-none">פקדים מהירים לנועה OS:</span>
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none snap-x drag-scroll">
          <button 
            onClick={() => triggerWidgetAction("comax_widget")}
            className="flex items-center gap-1.5 bg-white border border-gray-150/70 hover:border-indigo-400 px-3.5 py-2.5 rounded-full shadow-4xs text-[10.5px] font-extrabold text-gray-700 transition-all hover:bg-slate-50 cursor-pointer shrink-0 snap-end"
          >
            <Upload className="w-3.5 h-3.5 text-indigo-500" />
            <span>סריקת Comax 📥</span>
          </button>
          <button 
            onClick={() => triggerWidgetAction("report_widget")}
            className="flex items-center gap-1.5 bg-white border border-gray-150/70 hover:border-indigo-400 px-3.5 py-2.5 rounded-full shadow-4xs text-[10.5px] font-extrabold text-gray-700 transition-all hover:bg-slate-50 cursor-pointer shrink-0 snap-end"
          >
            <FileText className="w-3.5 h-3.5 text-cyan-500" />
            <span>דוח בוקר לוגיסטי 📅</span>
          </button>
          <button 
            onClick={() => triggerWidgetAction("drivers_widget")}
            className="flex items-center gap-1.5 bg-white border border-gray-150/70 hover:border-indigo-400 px-3.5 py-2.5 rounded-full shadow-4xs text-[10.5px] font-extrabold text-gray-700 transition-all hover:bg-slate-50 cursor-pointer shrink-0 snap-end"
          >
            <Truck className="w-3.5 h-3.5 text-emerald-500" />
            <span>נהגים בשטח 🚚</span>
          </button>
          <button 
            onClick={() => triggerWidgetAction("tasks_widget")}
            className="flex items-center gap-1.5 bg-white border border-gray-150/70 hover:border-indigo-400 px-3.5 py-2.5 rounded-full shadow-4xs text-[10.5px] font-extrabold text-gray-700 transition-all hover:bg-slate-50 cursor-pointer shrink-0 snap-end"
          >
            <Clipboard className="w-3.5 h-3.5 text-amber-500" />
            <span>לוח הזמנות ומשימות 📋</span>
          </button>
          <button 
            onClick={() => triggerWidgetAction("inventory_widget")}
            className="flex items-center gap-1.5 bg-white border border-gray-150/70 hover:border-indigo-400 px-3.5 py-2.5 rounded-full shadow-4xs text-[10.5px] font-extrabold text-gray-700 transition-all hover:bg-slate-50 cursor-pointer shrink-0 snap-end"
          >
            <Wrench className="w-3.5 h-3.5 text-rose-500" />
            <span>ניהול מלאי וציוד 📦</span>
          </button>
        </div>
      </div>

      {/* Main Bottom User Input Bar */}
      <div className="bg-white border-t border-gray-100 px-5 pt-3 pb-[calc(1.5rem+env(safe-area-inset-bottom))] shrink-0" id="prompt-bar">
        <form onSubmit={handleSendMessage} className="flex gap-2.5 items-center">
          <input 
            type="text"
            placeholder="כתוב הודעה שוטפת לנועה (לדוגמה: 'פעלת שוב את המלאי', או 'חזה הגעה)..."
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            className="flex-1 bg-gray-50 hover:bg-gray-100/60 focus:bg-white border border-gray-150 rounded-2xl px-4 py-3 text-[11.5px] outline-none text-right font-medium transition-all text-gray-900 placeholder-[#9CA3AF] focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 h-11"
            id="chat-prompter"
          />
          <button 
            type="submit"
            disabled={loadingChat || !inputMessage.trim()}
            className="bg-indigo-650 hover:bg-indigo-700 hover:shadow-md text-white p-3 rounded-2xl transition-all cursor-pointer disabled:opacity-40 shrink-0 w-11 h-11 flex items-center justify-center shadow-sm"
            id="chat-submit"
          >
            <SendHorizontal className="w-4.5 h-4.5 transform rotate-180" />
          </button>
        </form>
      </div>
    </div>
  );
}

/* ==========================================================================
   PART I: COMAX LOG CONVERSATIONAL BUBBLE WIDGET
   ========================================================================== */
function ComaxInlineWidget({ 
  allOrders, 
  inventoryList,
  onAddSystemMessage
}: { 
  allOrders: Order[];
  inventoryList: InventoryItem[];
  onAddSystemMessage: (content: string) => void;
}) {
  const [comaxInput, setComaxInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [parsedOrders, setParsedOrders] = useState<Order[]>([]);
  const [parsedInventory, setParsedInventory] = useState<InventoryItem[]>([]);
  const [success, setSuccess] = useState(false);

  const handleScan = async () => {
    if (!comaxInput.trim()) return;
    setLoading(true);
    try {
      const res = await fetch("/api/gemini/scan_comax", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ logText: comaxInput })
      });
      const data = await res.json();
      if (data.orders || data.inventory) {
        setParsedOrders(data.orders || []);
        setParsedInventory(data.inventory || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleMerge = async () => {
    try {
      for (const ord of parsedOrders) {
        if (!ord.orderNumber) continue;
        const docId = ord.orderNumber.toLowerCase().trim();
        await setDoc(doc(db, "orders", docId), {
          ...ord,
          eta: ord.eta || "ממתין לשיבוץ נהג"
        });
      }
      for (const item of parsedInventory) {
        if (!item.sku) continue;
        const docId = item.sku.toLowerCase().trim();
        await setDoc(doc(db, "inventory", docId), item);
      }
      setSuccess(true);
      onAddSystemMessage(`📥 קבלת Comax הושלמה! סינכרנו ${parsedOrders.length} הזמנות ו-${parsedInventory.length} פריטי מלאי ישירות לענן.`);
    } catch (e) {
      console.error(e);
    }
  };

  if (success) {
    return (
      <div className="space-y-2 py-2 text-center">
        <div className="w-10 h-10 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto shadow-4xs">
          <Check className="w-5.5 h-5.5" />
        </div>
        <h4 className="text-xs font-black text-emerald-800 leading-tight">סנכרון תעודות קומקס הצליח!</h4>
        <p className="text-[10px] text-gray-500">בסיס הנתונים SabanOS מעודכן ברגע זה.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 pt-1" id="inline-comax-portal">
      <div className="flex justify-between items-center pb-2 border-b border-gray-100">
        <span className="text-[10px] bg-slate-100 text-slate-800 font-black px-2 py-0.5 rounded">Comax ERP Gateway</span>
        <h3 className="text-xs font-black text-gray-900 flex items-center gap-1.5">
          <Upload className="w-4 h-4 text-indigo-500" />
          קולט לוגים חכם
        </h3>
      </div>

      {!parsedOrders.length && !parsedInventory.length ? (
        <div className="space-y-3">
          <p className="text-[10.5px] text-[#556987] leading-relaxed">
            הדבק את נתוני המסוף, המלאי, או האקסל החופשי מקומקס. AI נועה תפענח אותם ותייצר רשומות מותאמות:
          </p>
          <textarea 
            rows={4}
            placeholder="למשל: 'הזמנה SABAN-2092 לקוח י.א הנדסה לחצר באשדוד חומר: מלט שקים..."
            value={comaxInput}
            onChange={(e) => setComaxInput(e.target.value)}
            className="w-full bg-slate-50 border border-gray-200 rounded-2xl p-3 text-xs placeholder-gray-400 focus:bg-white outline-none text-right font-mono"
            disabled={loading}
          />
          <button
            onClick={handleScan}
            disabled={loading || !comaxInput.trim()}
            className="w-full bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white font-extrabold text-[11px] py-2 px-4 rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer"
          >
            {loading ? <RefreshCw className="w-3.5 h-3.5 animate-spin text-white" /> : <Database className="w-3.5 h-3.5" />}
            {loading ? "מפענח לוגים בשיטת AI..." : "סרוק וחלץ בעזרת AI נועה"}
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          <span className="text-[9.5px] text-[#7E8B9B] font-black uppercase tracking-wider block">רישומי קומקס שחולצו לייב:</span>
          <div className="space-y-2 max-h-[160px] overflow-y-auto pr-1">
            {parsedOrders.map((ord, idx) => (
              <div key={idx} className="bg-slate-50 p-2.5 rounded-xl border border-gray-150 flex flex-col gap-0.5 text-[10.5px]">
                <div className="flex justify-between font-extrabold text-gray-900">
                  <span>#{ord.orderNumber}</span>
                  <span>{ord.customerName}</span>
                </div>
                <div className="text-gray-500 text-[10px]">יעד: {ord.destination}</div>
                {ord.items && <div className="text-gray-600 text-[10px] font-mono mt-0.5">פריטים: {ord.items}</div>}
              </div>
            ))}
            {parsedInventory.map((item, idx) => (
              <div key={idx} className="bg-amber-50/50 p-2.5 rounded-xl border border-amber-200/50 flex flex-col gap-0.5 text-[10.5px]">
                <div className="flex justify-between font-extrabold text-amber-900">
                  <span>מק"ט: {item.sku}</span>
                  <span>{item.name}</span>
                </div>
                <div className="text-amber-800 text-[10px]">מלאי נוכחי המופק: {item.currentStock} {item.unit || "שקים"}</div>
              </div>
            ))}
          </div>

          <div className="flex gap-2 pt-2 border-t border-gray-100">
            <button 
              onClick={() => { setParsedOrders([]); setParsedInventory([]); }}
              className="flex-1 bg-white border border-gray-200 text-gray-500 hover:bg-slate-50 text-[10.5px] font-bold py-1.5 rounded-lg cursor-pointer"
            >
              ניקוי
            </button>
            <button 
              onClick={handleMerge}
              className="flex-1 bg-indigo-600 text-white font-extrabold text-[10.5px] py-1.5 rounded-lg flex items-center justify-center gap-1 cursor-pointer hover:bg-indigo-700"
            >
              <Check className="w-3.5 h-3.5 text-white" />
              עדכן מערכת SabanOS
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ==========================================================================
   PART II: DAILY MORNING REPORT WIDGET
   ========================================================================== */
function ReportInlineWidget({
  allOrders,
  reportHistory,
  onAddSystemMessage
}: {
  allOrders: Order[];
  reportHistory: MorningReport[];
  onAddSystemMessage: (content: string) => void;
}) {
  const [reportDate, setReportDate] = useState(new Date().toISOString().split("T")[0]);
  const [reportText, setReportText] = useState("");
  const [compiling, setCompiling] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [success, setSuccess] = useState(false);

  const generateReport = async () => {
    setCompiling(true);
    try {
      const activePending = allOrders.filter(o => o.status === "pending" || o.status === "in_transit");
      const deliveredCount = allOrders.filter(o => o.status === "delivered").length;
      
      const promptText = `הפק דוח בוקר לוגיסטי מסכם עבור מנהלי סבן הובלות וכלים על סמך המצב הבא:
- תאריך סקירה: ${reportDate}
- מספר הזמנות מתוכנות להיום / כרגע: ${activePending.length}
- מספר הזמנות שכבר נמסרו בהצלחה: ${deliveredCount}
- פירוט הזמנות נוכחיות:
${JSON.stringify(activePending, null, 2)}

אנא נסח דוח בעברית רהוטה ורשמית של חצי עדיפות, המלצות לנהגים בשטח (כביש בגין, מחלפים פקוקים), דגשים לגבי מנופים וכלים כבדים שצריכים עגינה מחוזקת. דוח קצר, ממוקד וענייני ללא תווים מתכנתיים.`;

      const response = await fetch("/api/gemini/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: promptText })
      });
      const data = await response.json();
      if (data.text) {
        let cleanText = data.text;
        if (cleanText.trim().startsWith("```")) {
          cleanText = cleanText.replace(/^```html\s*|\s*```$/gi, "").replace(/^```\s*|\s*```$/gi, "");
        }
        setReportText(cleanText);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setCompiling(false);
    }
  };

  const handleSave = async () => {
    if (!reportText.trim()) return;
    try {
      const newReport: MorningReport = {
        date: reportDate,
        orderIds: allOrders.map(o => o.orderNumber).join(", "),
        reportText: reportText,
        createdAt: new Date().toISOString()
      };
      const reportId = `rep_${Date.now()}`;
      await setDoc(doc(db, "morning_reports", reportId), newReport);
      setSuccess(true);
      onAddSystemMessage(`📅 דוח סדרן תפעולי לתאריך **${reportDate}** נשמר בארכיון הדו"חות.`);
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="space-y-4 pt-1" id="inline-report-generator">
      <div className="flex justify-between items-center pb-2 border-b border-gray-100">
        <span className="text-[10px] bg-cyan-50 text-cyan-800 font-black px-2 py-0.5 rounded">Logistics Summarizer</span>
        <h3 className="text-xs font-black text-gray-900 flex items-center gap-1.5">
          <FileText className="w-4 h-4 text-cyan-500" />
          מחולל דוח בוקר לוגיסטי
        </h3>
      </div>

      {success ? (
        <div className="text-center py-2 space-y-2">
          <div className="w-10 h-10 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto shadow-4xs">
            <Check className="w-5.5 h-5.5" />
          </div>
          <p className="text-xs font-black text-gray-800">היומן הלוגיסטי נשמר בהצלחה!</p>
          <button 
            onClick={() => { setSuccess(false); setReportText(""); }}
            className="text-[10px] text-indigo-600 font-extrabold focus:outline-none"
          >
            חולל דוח נוסף
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex gap-2 items-center">
            <div className="flex-1">
              <label className="text-[8px] font-black block text-gray-400 mb-1">תאריך ביאור</label>
              <input 
                type="date"
                value={reportDate}
                onChange={(e) => setReportDate(e.target.value)}
                className="w-full bg-slate-50 border border-gray-200 rounded-xl px-3 py-1.5 text-[11px] font-black text-gray-700 focus:bg-white focus:outline-none"
              />
            </div>
            <div className="flex items-end mt-4">
              <button 
                onClick={generateReport}
                disabled={compiling}
                className="bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white font-extrabold text-[10.5px] py-1.5 px-4 rounded-xl flex items-center justify-center gap-1 cursor-pointer"
              >
                {compiling ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5 text-amber-300" />}
                {compiling ? "חולל דוח..." : "חולל דוח AI"}
              </button>
            </div>
          </div>

          {reportText && (
            <div className="space-y-2 pt-2 border-t border-gray-100">
              <span className="text-[9.5px] font-black text-gray-400 block">ערוך סקירת לוגיסטיקה:</span>
              <textarea 
                rows={5}
                value={reportText}
                onChange={(e) => setReportText(e.target.value)}
                className="w-full bg-amber-50/20 border border-amber-200/40 rounded-xl p-3 text-xs leading-relaxed text-gray-800 font-mono text-right outline-none"
              />
              <div className="flex gap-2.5">
                <button 
                  onClick={() => setReportText("")}
                  className="flex-1 bg-white border border-gray-200 text-gray-500 text-[10.5px] font-bold py-1 rounded-lg cursor-pointer"
                >
                  מחק
                </button>
                <button 
                  onClick={handleSave}
                  className="flex-1 bg-indigo-600 text-white font-extrabold text-[10.5px] py-1 rounded-lg flex items-center justify-center gap-1 cursor-pointer hover:bg-indigo-700"
                >
                  <Check className="w-3.5 h-3.5 text-white" />
                  שמור יומן סדרן
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* History Archive inline rendering inside bubble */}
      <div className="pt-2.5 border-t border-slate-100">
        <button 
          onClick={() => setArchiveOpen(!archiveOpen)}
          className="w-full flex justify-between items-center text-[10.5px] font-black text-gray-700 py-1.5 hover:bg-slate-50 rounded-lg px-2"
        >
          <span className="text-[#7E8B9B]">({reportHistory.length}) דוחות</span>
          <span className="flex items-center gap-1">
            <Calendar className="w-3.5 h-3.5 text-slate-500" />
            ארכיון דוחות ויומנים
          </span>
        </button>

        {archiveOpen && (
          <div className="mt-2 space-y-2 max-h-[140px] overflow-y-auto pr-1">
            {reportHistory.length === 0 ? (
              <p className="text-[10px] text-gray-400 text-center py-2">אין דוחות קודמים שמורים.</p>
            ) : (
              reportHistory.map((rep) => (
                <div key={rep.id} className="bg-slate-50 border border-gray-150 p-3 rounded-xl text-[10px] space-y-1">
                  <div className="flex justify-between font-black text-gray-800 border-b border-gray-200 pb-1">
                    <span>תאריך: {rep.date}</span>
                    <span className="text-[8px] bg-slate-200/70 text-slate-700 px-1 py-0.2 rounded font-sans">SabanOS</span>
                  </div>
                  <p className="text-gray-650 leading-relaxed font-mono whitespace-pre-line text-right">{rep.reportText}</p>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* ==========================================================================
   PART III: DRIVERS LIVE STATUS ROSTER
   ========================================================================== */
function DriversInlineWidget({
  allDrivers
}: {
  allDrivers: Driver[];
}) {
  const [search, setSearch] = useState("");

  const handleStatusChange = async (driverId: string, newStatus: "active" | "busy" | "offline") => {
    try {
      await updateDoc(doc(db, "drivers", driverId), { status: newStatus });
    } catch (e) {
      console.error(e);
    }
  };

  const filtered = allDrivers.filter(d => 
    (d.name || "").toLowerCase().includes((search || "").toLowerCase())
  );

  return (
    <div className="space-y-4 pt-1" id="inline-drivers-manager">
      <div className="flex justify-between items-center pb-2 border-b border-gray-100">
        <span className="text-[10px] bg-emerald-50 text-emerald-800 font-black px-2 py-0.5 rounded">Roster Controller</span>
        <h3 className="text-xs font-black text-gray-900 flex items-center gap-1.5">
          <Truck className="w-4 h-4 text-emerald-500" />
          נהגים וסדרנות פעילה בשטח
        </h3>
      </div>

      {/* Roster Search Input */}
      <div className="relative">
        <input 
          type="text" 
          placeholder="חפש נהג פעיל..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full bg-slate-50 border border-gray-250/60 rounded-xl pr-8 pl-3 py-1.5 text-xs text-right outline-none placeholder-gray-400 focus:bg-white"
        />
        <Search className="w-4 h-4 text-slate-400 absolute right-2.5 top-2.5" />
      </div>

      {/* Driver Records list */}
      <div className="space-y-2.5 max-h-[220px] overflow-y-auto pr-1">
        {filtered.length === 0 ? (
          <p className="text-[10.5px] text-gray-400 text-center py-4">לא נמצאו נהגים בהתאמה.</p>
        ) : (
          filtered.map((driver) => {
            const statusColors = {
              active: "bg-emerald-500 shadow-emerald-500/20",
              busy: "bg-amber-500 shadow-amber-500/20",
              offline: "bg-slate-450 shadow-slate-450/10"
            };
            const statusLabels = {
              active: "פעיל / זמין",
              busy: "עמוס / בנסיעה",
              offline: "לא פעיל"
            };

            return (
              <div key={driver.id} className="bg-slate-50 border border-gray-150 p-3 rounded-2xl flex flex-col gap-2 tracking-tight transition-all">
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${statusColors[driver.status]}`}></span>
                    <span className="text-[10.5px] font-black text-gray-800 leading-none">{driver.name}</span>
                  </div>
                  <span className="text-[9px] bg-slate-200/80 text-gray-650 px-1.5 py-0.5 rounded-lg font-bold font-sans">
                    {driver.vehicleType === "crane" ? "🚚 משאית מנוף" : "🚛 סמיטריילר"}
                  </span>
                </div>

                <div className="flex justify-between items-center text-[10px] text-gray-500">
                  <span>מס' רכב: {driver.plateNumber || "ללא"}</span>
                  <span className="text-indigo-650 font-bold font-sans">⭐ {driver.rating || 4.9} ({driver.totalDeliveries || 0} הובלות)</span>
                </div>

                {/* Direct Inline controllers */}
                <div className="flex justify-between items-center pt-2.5 border-t border-gray-200/50">
                  <div className="flex gap-1.5">
                    <a 
                      href={`tel:${driver.phone}`}
                      className="p-1 px-2.5 bg-white border border-gray-200 hover:bg-slate-50 text-indigo-600 rounded-lg text-[9px] font-black flex items-center gap-1"
                    >
                      <Phone className="w-3 h-3" />
                      חייג
                    </a>
                  </div>

                  <div className="flex items-center gap-1">
                    <label className="text-[9px] font-black text-[#7E8B9B]">סטטוס:</label>
                    <select 
                      value={driver.status}
                      onChange={(e) => handleStatusChange(driver.id!, e.target.value as any)}
                      className="bg-white border border-gray-250 text-[#111827] text-[10px] font-black px-1.5 py-1 rounded-lg outline-none"
                    >
                      <option value="active">זמין (Active)</option>
                      <option value="busy">בנסיעה (Busy)</option>
                      <option value="offline">לא פנוי (Offline)</option>
                    </select>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

/* ==========================================================================
   PART IV: CHAT-INTEGRATED KANBAN & ORDER BROADCAST
   ========================================================================== */
function TasksInlineWidget({
  allOrders,
  allDrivers
}: {
  allOrders: Order[];
  allDrivers: Driver[];
}) {
  const [tab, setTab] = useState<"pending" | "in_transit" | "delivered">("pending");
  const [manualFormOpen, setManualFormOpen] = useState(false);
  const [search, setSearch] = useState("");

  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);
  const [loadingEtaId, setLoadingEtaId] = useState<string | null>(null);
  const [etaResult, setEtaResult] = useState<string | null>(null);

  // Manual Creation Fields
  const [newCust, setNewCust] = useState("");
  const [newDest, setNewDest] = useState("");
  const [newItems, setNewItems] = useState("");
  const [numOrder, setNumOrder] = useState("");

  const handleAssignDriver = async (orderId: string, driverId: string) => {
    try {
      await updateDoc(doc(db, "orders", orderId), { 
        driverId,
        status: "in_transit",
        eta: "נשלח לנהג - בנסיעה"
      });
    } catch (e) {
      console.error(e);
    }
  };

  const handleStatusUpdate = async (orderId: string, status: Order["status"]) => {
    try {
      await updateDoc(doc(db, "orders", orderId), { status });
    } catch (e) {
      console.error(e);
    }
  };

  const calculateEta = async (order: Order) => {
    setLoadingEtaId(order.id!);
    setEtaResult(null);
    try {
      const activeDriver = allDrivers.find(d => d.id === order.driverId);
      const res = await fetch("/api/gemini/predict_eta", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderDetails: order,
          driverStats: activeDriver || { status: "active", rating: 4.8 }
        })
      });
      const data = await res.json();
      if (data.formattedEtaMessage) {
        setEtaResult(`${data.formattedEtaMessage}\n\nהמלצה: ${data.predictionReasoning}`);
      } else {
        setEtaResult("לא ניתן היה לקבוע מדעי שיבוש ETA כרגע.");
      }
    } catch (e) {
      console.error(e);
      setEtaResult("שגיאת חיבור בחיזוי זמנים.");
    } finally {
      setLoadingEtaId(null);
    }
  };

  const handleCreateOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCust.trim() || !newDest.trim()) return;

    try {
      const orderNumber = numOrder.trim() || `SABAN-${Date.now().toString().slice(-6)}`;
      const docId = orderNumber.toLowerCase().trim();
      
      const ord: Order = {
        orderNumber,
        customerName: newCust,
        destination: newDest,
        items: newItems || "חומרי הובלה כללים",
        date: new Date().toISOString().split("T")[0],
        time: "08:00",
        status: "pending",
        warehouse: "מחסן ראשי",
        eta: "ממתין לשיבוץ נהג"
      };

      await setDoc(doc(db, "orders", docId), ord);
      setNewCust("");
      setNewDest("");
      setNewItems("");
      setNumOrder("");
      setManualFormOpen(false);
    } catch (err) {
      console.error(err);
    }
  };

  const filtered = allOrders.filter(o => {
    const sMatch = o.status === tab;
    const qMatch = (o.customerName || "").toLowerCase().includes((search || "").toLowerCase()) || 
                   (o.orderNumber || "").toLowerCase().includes((search || "").toLowerCase()) ||
                   (o.destination || "").toLowerCase().includes((search || "").toLowerCase());
    return sMatch && qMatch;
  });

  return (
    <div className="space-y-4 pt-1" id="inline-tasks-tracker">
      <div className="flex justify-between items-center pb-2 border-b border-gray-100">
        <span className="text-[10px] bg-amber-50 text-amber-800 font-black px-2 py-0.5 rounded">Dispatch Kanban</span>
        <h3 className="text-xs font-black text-gray-900 flex items-center gap-1.5">
          <Clipboard className="w-4 h-4 text-amber-500" />
          לוח ניהול הזמנות והובלות
        </h3>
      </div>

      {/* Tabs and Quick Trigger */}
      <div className="flex gap-1 bg-slate-100/80 p-1 rounded-xl">
        <button 
          onClick={() => setTab("pending")}
          className={`flex-1 text-center py-1.5 rounded-lg text-[10.5px] font-extrabold transition-all ${tab === "pending" ? "bg-white text-gray-900 shadow-3xs" : "text-gray-500"}`}
        >
          ממתין ({allOrders.filter(o => o.status === "pending").length})
        </button>
        <button 
          onClick={() => setTab("in_transit")}
          className={`flex-1 text-center py-1.5 rounded-lg text-[10.5px] font-extrabold transition-all ${tab === "in_transit" ? "bg-white text-gray-900 shadow-3xs" : "text-gray-500"}`}
        >
          בדרך ({allOrders.filter(o => o.status === "in_transit").length})
        </button>
        <button 
          onClick={() => setTab("delivered")}
          className={`flex-1 text-center py-1.5 rounded-lg text-[10.5px] font-extrabold transition-all ${tab === "delivered" ? "bg-white text-gray-900 shadow-3xs" : "text-gray-500"}`}
        >
          נמסר ({allOrders.filter(o => o.status === "delivered").length})
        </button>
      </div>

      {/* Search & Manual trigger button */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <input 
            type="text" 
            placeholder="חפש לקוח או תעודה..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-slate-50 border border-gray-250/60 rounded-xl pr-8 pl-3 py-1.5 text-xs text-right outline-none placeholder-gray-400 focus:bg-white"
          />
          <Search className="w-4 h-4 text-slate-400 absolute right-2.5 top-2.5" />
        </div>
        <button 
          onClick={() => setManualFormOpen(!manualFormOpen)}
          className="bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-[10px] px-3.5 rounded-xl flex items-center gap-1 cursor-pointer transition-colors"
        >
          <Plus className="w-3.5 h-3.5 text-white" />
          הוסף
        </button>
      </div>

      {/* Expandable Manual Creation Form */}
      {manualFormOpen && (
        <form onSubmit={handleCreateOrder} className="bg-slate-50/70 p-3.5 border border-indigo-150/40 rounded-2xl space-y-3">
          <h4 className="text-[10.5px] font-black text-gray-800">פתיחת כרטיס הובלה ידני מזורז:</h4>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[8px] block font-black text-gray-400 mb-0.5">לקוח</label>
              <input 
                type="text" 
                placeholder="שם לקוח ח.סבן"
                value={newCust} 
                onChange={(e) => setNewCust(e.target.value)}
                className="w-full bg-white border border-gray-250 text-[10.5px] p-1.5 rounded-lg leading-tight outline-none"
                required
              />
            </div>
            <div>
              <label className="text-[8px] block font-black text-gray-400 mb-0.5">מס' תעודה</label>
              <input 
                type="text" 
                placeholder="SABAN-XXXXX" 
                value={numOrder}
                onChange={(e) => setNumOrder(e.target.value)}
                className="w-full bg-white border border-gray-250 text-[10.5px] p-1.5 rounded-lg leading-tight outline-none font-mono"
              />
            </div>
          </div>
          <div>
            <label className="text-[8px] block font-black text-gray-400 mb-0.5">כתובת יעד משלוח</label>
            <input 
              type="text" 
              placeholder="רחוב, עיר, חצר אתר בנייה"
              value={newDest}
              onChange={(e) => setNewDest(e.target.value)}
              className="w-full bg-white border border-gray-250 text-[10.5px] p-1.5 rounded-lg leading-tight outline-none"
              required
            />
          </div>
          <div>
            <label className="text-[8px] block font-black text-gray-400 mb-0.5">פריטים / תכולה</label>
            <input 
              type="text" 
              placeholder="משטחים, מלט, כלים כבדים..." 
              value={newItems}
              onChange={(e) => setNewItems(e.target.value)}
              className="w-full bg-white border border-gray-250 text-[10.5px] p-1.5 rounded-lg leading-tight outline-none"
            />
          </div>
          <button 
            type="submit"
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-[10.5px] py-1.5 rounded-lg transition-all cursor-pointer block text-center"
          >
            אישור ויצירת כרטיס
          </button>
        </form>
      )}

      {/* Active Orders List */}
      <div className="space-y-3.5 max-h-[220px] overflow-y-auto pr-1">
        {filtered.length === 0 ? (
          <p className="text-[10.5px] text-gray-400 text-center py-4">אין הזמנות בסטטוס הנוכחי.</p>
        ) : (
          filtered.map((ord) => {
            const hasDriver = !!ord.driverId;
            const myDriver = allDrivers.find(d => d.id === ord.driverId);

            return (
              <div key={ord.id} className="bg-slate-50 border border-gray-150 p-3.5 rounded-2xl flex flex-col gap-2.5 transition-all relative">
                <div className="flex justify-between items-start">
                  <div>
                    <span className="text-[10px] bg-slate-200 text-gray-800 font-extrabold px-1.5 py-0.5 rounded-md font-mono">
                      #{ord.orderNumber}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-[11.5px] font-black text-gray-900 block leading-tight">{ord.customerName}</span>
                  </div>
                </div>

                <div className="space-y-1 text-[10.5px] text-gray-650">
                  <div className="flex items-center gap-1 shrink-0 text-slate-500">
                    <MapPin className="w-3.5 h-3.5 text-[#7E8B9B] shrink-0" />
                    <span className="truncate">{ord.destination}</span>
                  </div>
                  {ord.items && (
                    <div className="flex items-center gap-1 shrink-0 text-slate-500">
                      <Wrench className="w-3.5 h-3.5 text-[#7E8B9B] shrink-0" />
                      <span className="truncate">תכולה: {ord.items}</span>
                    </div>
                  )}
                  <div className="flex justify-between items-center text-[10px] text-gray-400 mt-1 pb-1">
                    <span>תאריך יעד: {ord.date} {ord.time || ""}</span>
                    <span className="text-indigo-650 font-bold">{ord.warehouse || "מחסן ראשי"}</span>
                  </div>
                </div>

                {/* Inline controllers for driver and status routing */}
                <div className="space-y-2 pt-2.5 border-t border-gray-200/50">
                  <div className="flex justify-between items-center gap-2">
                    <div className="flex items-center gap-1">
                      <span className="text-[9px] font-black text-gray-400">נהג:</span>
                      <select 
                        value={ord.driverId || ""}
                        onChange={(e) => handleAssignDriver(ord.id!, e.target.value)}
                        className="bg-white border border-gray-200 text-[#111827] text-[10.5px] px-1.5 py-0.8 rounded-lg outline-none font-bold"
                      >
                        <option value="">-- בחר נהג לשיבוץ --</option>
                        {allDrivers.map(d => (
                          <option key={d.id} value={d.id}>{d.name} {d.status === "busy" ? "(עסוק)" : ""}</option>
                        ))}
                      </select>
                    </div>

                    <div className="flex items-center gap-1">
                      <span className="text-[9px] font-black text-gray-400">שינוי סטטוס:</span>
                      <select 
                        value={ord.status}
                        onChange={(e) => handleStatusUpdate(ord.id!, e.target.value as any)}
                        className="bg-white border border-gray-200 text-[#111827] text-[10.5px] px-1.5 py-0.8 rounded-lg outline-none font-bold"
                      >
                        <option value="pending">ממתין</option>
                        <option value="in_transit">בדרך</option>
                        <option value="delivered">נמסר</option>
                        <option value="canceled">מבוטל</option>
                      </select>
                    </div>
                  </div>

                  {/* AI Predictor Expander Drawer Component inside Chat bubble */}
                  <div className="pt-1.5">
                    <button 
                      onClick={() => setExpandedOrderId(expandedOrderId === ord.id ? null : ord.id)}
                      className="w-full flex justify-between items-center text-[10px] font-extrabold text-indigo-650 hover:text-indigo-850"
                    >
                      <span className="text-[#B5BAC9]">
                        {expandedOrderId === ord.id ? "הסתר חיזוי" : "הצג חיזוי זמני הגעה AI"}
                      </span>
                      <span className="flex items-center gap-0.5 font-sans">
                        <Sparkles className="w-3 h-3 text-indigo-500" />
                        פרטי ETA נועה (Predictor)
                      </span>
                    </button>

                    {expandedOrderId === ord.id && (
                      <motion.div 
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        className="bg-slate-100 border border-gray-200/50 p-2.5 rounded-xl space-y-2 mt-1.5 text-[10px] text-right font-sans leading-relaxed"
                      >
                        <div className="flex justify-between items-center border-b border-gray-200 pb-1">
                          <span className="text-indigo-900 font-extrabold">סטטיסטיקת שינוע:</span>
                          <button 
                            onClick={() => calculateEta(ord)}
                            className="bg-white hover:bg-slate-50 border border-gray-200 text-[9px] px-2 py-0.5 rounded font-black text-[#111827] flex items-center gap-0.5 cursor-pointer"
                          >
                            <RefreshCw className="w-2.5 h-2.5" />
                            חשב זמנים
                          </button>
                        </div>
                        {loadingEtaId === ord.id ? (
                          <div className="flex items-center gap-1 bg-white p-1.5 rounded text-gray-500 font-bold justify-center">
                            <RefreshCw className="w-3 h-3 animate-spin" />
                            נועה מחשבת מרחק ופקקים בזמן אמת...
                          </div>
                        ) : etaResult ? (
                          <p className="whitespace-pre-wrap font-medium">{etaResult}</p>
                        ) : (
                          <p className="text-gray-400">הפק חיזוי AI שילוקח בחשבון את מיקום הנהג, עומסי התנועה מול כתובת היעד.</p>
                        )}
                      </motion.div>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

/* ==========================================================================
   PART V: WAREHOUSE STOCK ADJUSTMENTS
   ========================================================================== */
function InventoryInlineWidget({
  inventoryList
}: {
  inventoryList: InventoryItem[];
}) {
  const [search, setSearch] = useState("");

  const editStock = async (itemId: string, diff: number) => {
    try {
      const item = inventoryList.find(i => i.id === itemId);
      if (!item) return;
      const computedStock = Math.max(0, item.currentStock + diff);
      await updateDoc(doc(db, "inventory", itemId), { currentStock: computedStock });
    } catch (e) {
      console.error(e);
    }
  };

  const filtered = inventoryList.filter(item => 
    (item.name || "").toLowerCase().includes((search || "").toLowerCase()) || 
    (item.sku || "").toLowerCase().includes((search || "").toLowerCase())
  );

  return (
    <div className="space-y-4 pt-1" id="inline-inventory-panel">
      <div className="flex justify-between items-center pb-2 border-b border-gray-100">
        <span className="text-[10px] bg-rose-50 text-rose-800 font-black px-2 py-0.5 rounded">Stock Adjuster</span>
        <h3 className="text-xs font-black text-gray-900 flex items-center gap-1.5">
          <Wrench className="w-4 h-4 text-rose-500" />
          ניהול מלאי וציוד החצר
        </h3>
      </div>

      {/* Search Input */}
      <div className="relative">
        <input 
          type="text" 
          placeholder="חפש מוצר או מק''ט במלאי..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full bg-slate-50 border border-gray-250/60 rounded-xl pr-8 pl-3 py-1.5 text-xs text-right outline-none placeholder-gray-400 focus:bg-white"
        />
        <Search className="w-4 h-4 text-slate-400 absolute right-2.5 top-2.5" />
      </div>

      {/* Inventory Item list */}
      <div className="space-y-2.5 max-h-[220px] overflow-y-auto pr-1">
        {filtered.length === 0 ? (
          <p className="text-[10.5px] text-gray-400 text-center py-4">לא נמצאו חומרים מותאמים.</p>
        ) : (
          filtered.map((item) => {
            const isLow = item.currentStock < item.minStock;

            return (
              <div 
                key={item.id} 
                className={`p-3.5 rounded-2xl border bg-slate-50/70 text-[10.5px] transition-all flex flex-col gap-2 relative ${
                  isLow ? "border-rose-200 bg-rose-50/15 ring-2 ring-rose-100/30" : "border-gray-150"
                }`}
              >
                <div className="flex justify-between items-start">
                  {isLow ? (
                    <span className="text-[8px] bg-rose-100 text-rose-800 border-rose-200 border px-1.5 py-0.2 rounded font-black animate-pulse">
                      🚨 חסר במלאי!
                    </span>
                  ) : (
                    <span className="text-[8.5px] text-slate-400 font-black font-mono uppercase">
                      מק"ט: {item.sku}
                    </span>
                  )}
                  <span className="text-[11px] font-black text-gray-800">{item.name}</span>
                </div>

                <div className="flex justify-between items-center text-[10px] text-[#4B5563]">
                  <span>תאור: {item.description || "חומרי אספקה לאתר"}</span>
                  <span>מחיר יחידה: <strong>₪{item.price || 0}</strong></span>
                </div>

                {/* Direct stock incremental controllers */}
                <div className="flex justify-between items-center pt-2.5 border-t border-gray-200/50 mt-1">
                  <div className="flex items-center gap-1 font-mono text-[10px]">
                    <span className="text-[#7E8B9B]">מינימום נדרש:</span>
                    <span className="font-extrabold text-gray-800">{item.minStock}</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => editStock(item.id!, -1)}
                      className="w-6 h-6 rounded-lg bg-white border border-gray-200 hover:bg-slate-50 flex items-center justify-center p-0 cursor-pointer shadow-4xs active:scale-90"
                    >
                      <Minus className="w-3 h-3 text-gray-600" />
                    </button>
                    
                    <div className="px-2 font-black font-sans text-xs bg-white border border-gray-200 rounded-lg min-w-[28px] text-center py-0.5">
                      {item.currentStock}
                    </div>

                    <button 
                      onClick={() => editStock(item.id!, 1)}
                      className="w-6 h-6 rounded-lg bg-white border border-gray-200 hover:bg-slate-50 flex items-center justify-center p-0 cursor-pointer shadow-4xs active:scale-90"
                    >
                      <Plus className="w-3 h-3 text-gray-600" />
                    </button>
                    <span className="text-[9.5px] text-gray-400 font-black mr-0.5">{item.unit || "שקים"}</span>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
