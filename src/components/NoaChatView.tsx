import React, { useState, useEffect, useRef } from "react";
import { collection, doc, setDoc, onSnapshot } from "firebase/firestore";
import { db, handleFirestoreError, OperationType } from "../firebase";
import { Order, MorningReport, InventoryItem } from "../types";
import { 
  Sparkles, SendHorizontal, Upload, Check, Clipboard, Database, FileText, RefreshCw, XCircle, Clock
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface Message {
  role: "user" | "model";
  content: string;
}

export function NoaChatView() {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "model",
      content: "שלום! אני נועה, העוזרת הווירטואלית של ח. סבן הובלות וכלים. אני יכולה לחזות זמני הגעה של נהגים, לקלוט לוגים של מערכת קומקס (Comax) כדי לעדכן הזמנות ומלאי, לעזור לך לרשום תזכורות או להפיק את דו\"ח הבוקר הלוגיסטי. במה נתחיל היום?"
    }
  ]);
  const [inputMessage, setInputMessage] = useState("");
  const [loadingChat, setLoadingChat] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Comax Excel parsing states
  const [comaxInput, setComaxInput] = useState("");
  const [loadingComax, setLoadingComax] = useState(false);
  const [parsedOrders, setParsedOrders] = useState<Order[]>([]);
  const [parsedInventory, setParsedInventory] = useState<InventoryItem[]>([]);
  const [showComaxResult, setShowComaxResult] = useState(false);

  // Active orders reference for morning summary
  const [allOrders, setAllOrders] = useState<Order[]>([]);
  
  // Morning report compilation states
  const [reportDate, setReportDate] = useState(new Date().toISOString().split("T")[0]);
  const [reportText, setReportText] = useState("");
  const [compilingReport, setCompilingReport] = useState(false);
  const [reportHistory, setReportHistory] = useState<MorningReport[]>([]);

  // Auto scroll to bottom of chat
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Read orders & morning reports
  useEffect(() => {
    const unsubOrders = onSnapshot(collection(db, "orders"), (snap) => {
      const list: Order[] = [];
      snap.forEach(d => list.push({ ...d.data(), id: d.id } as Order));
      setAllOrders(list);
    });

    const unsubReports = onSnapshot(collection(db, "morning_reports"), (snap) => {
      const list: MorningReport[] = [];
      snap.forEach(d => list.push({ ...d.data(), id: d.id } as MorningReport));
      setReportHistory(list);
    });

    return () => {
      unsubOrders();
      unsubReports();
    };
  }, []);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputMessage.trim()) return;

    const userMsg = inputMessage;
    setInputMessage("");
    setMessages(prev => [...prev, { role: "user", content: userMsg }]);
    setLoadingChat(true);

    try {
      const response = await fetch("/api/gemini/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: userMsg,
          history: messages
        })
      });
      const data = await response.json();
      if (data.text) {
        setMessages(prev => [...prev, { role: "model", content: data.text }]);
      } else {
        setMessages(prev => [...prev, { role: "model", content: "מצטערת, משהו השתבש בעיבוד הבקשה לשרת." }]);
      }
    } catch (error) {
      console.error("Chat API error:", error);
      setMessages(prev => [...prev, { role: "model", content: "חיבור הרשת עם שרתי סבן-AI נכשל." }]);
    } finally {
      setLoadingChat(false);
    }
  };

  const handleComaxScan = async () => {
    if (!comaxInput.trim()) return;
    setLoadingComax(true);
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
        setShowComaxResult(true);
      } else {
        alert("לא נמצאו נתונים תואמים בעיבוד הבינה המלאכותית.");
      }
    } catch (e) {
      console.error("Failed to parse comax logs:", e);
      alert("עיבוד הלוגים נכשל בשרת.");
    } finally {
      setLoadingComax(false);
    }
  };

  const mergeComaxData = async () => {
    try {
      // 1. Merge Orders
      for (const order of parsedOrders) {
        if (!order || !order.orderNumber) continue;
        const docId = order.orderNumber.toLowerCase().trim();
        if (!docId) continue;
        await setDoc(doc(db, "orders", docId), {
          ...order,
          eta: order.eta || "עודכן מקומקס (ממתין למינוף)"
        });
      }
      // 2. Merge Inventory Items
      for (const item of parsedInventory) {
        if (!item || !item.sku) continue;
        const docId = item.sku.toLowerCase().trim();
        if (!docId) continue;
        await setDoc(doc(db, "inventory", docId), item);
      }

      alert("הנתונים מוזגו בהצלחה לבסיס הנתונים SabanOS!");
      setParsedOrders([]);
      setParsedInventory([]);
      setComaxInput("");
      setShowComaxResult(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, "orders_inventory_merge");
    }
  };

  const generateMorningReportAI = async () => {
    setCompilingReport(true);
    try {
      const activePending = allOrders.filter(o => o.status === "pending" || o.status === "in_transit");
      const deliveredCount = allOrders.filter(o => o.status === "delivered").length;
      
      const promptText = `הפק דוח בוקר לוגיסטי מסכם עבור מנהלי סבן הובלות וכלים על סמך המצב הבא:
- תאריך סקירה: ${reportDate}
- מספר הזמנות מתוכנות להיום / כרגע: ${activePending.length}
- מספר הזמנות שכבר נמסרו בהצלחה: ${deliveredCount}
- פירוט הזמנות נוכחיות:
${JSON.stringify(activePending, null, 2)}

אנא נסח דוח בעברית רהוטה ורשמית של חצי עדיפות, המלצות לנהגים בשטח (כביש בגין, מחלפים פקוקים), דגשים לגבי מנופים וכלים כבדים שצריכים עגינה מחוזקת. דוח קצר, ממוקד וענייני שניתן לשלוח בווטסאפ לכל מנהלי העבודה.`;

      const response = await fetch("/api/gemini/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: promptText })
      });
      const data = await response.json();
      if (data.text) {
        setReportText(data.text);
      }
    } catch (error) {
      console.error("Failed morning report AI compilation:", error);
    } finally {
      setCompilingReport(false);
    }
  };

  const handleSaveMorningReport = async () => {
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
      alert("דוח הבוקר נשמר בבטחה במאגר SabanOS!");
      setReportText("");
    } catch (e) {
      handleFirestoreError(e, OperationType.CREATE, "morning_reports");
    }
  };

  return (
    <div className="flex flex-col flex-grow bg-[#FDFDFF] pb-24 text-right" dir="rtl" id="noa-view-container">
      {/* 1. Welcoming Floating App Bar */}
      <div className="bg-white/95 backdrop-blur-md px-5 pt-4 pb-3 border-b border-gray-100 shadow-2xs sticky top-0 z-30" id="noa-bar-header">
        <div>
          <span className="text-[9px] uppercase tracking-widest text-indigo-600 font-extrabold font-sans">Saban AI Core</span>
          <h2 className="text-xl font-black text-gray-900 tracking-tight mt-0.5">עוזרת לוגיסטית חכמה</h2>
        </div>
      </div>

      <div className="px-5 mt-4 space-y-4 flex-1 overflow-y-auto">
        
        {/* Quick Bento Anchors */}
        <div className="grid grid-cols-2 gap-3" id="noa-quick-features">
          <a href="#comax-logs" className="p-3.5 bg-gray-50 border border-gray-150/40 hover:bg-white hover:shadow-xs rounded-2xl text-center transition-all">
            <Upload className="w-4 h-4 mx-auto mb-1 text-gray-900" />
            <span className="text-[10px] font-black block text-gray-800">סריקת לוג Comax</span>
          </a>
          <a href="#daily-briefing" className="p-3.5 bg-gray-50 border border-gray-150/40 hover:bg-white hover:shadow-xs rounded-2xl text-center transition-all">
            <FileText className="w-4 h-4 mx-auto mb-1 text-gray-900" />
            <span className="text-[10px] font-black block text-gray-800">דוח בוקר (AI)</span>
          </a>
        </div>

        {/* AI Greetings and Agent State Indicator */}
        <div className="p-4 rounded-2xl bg-amber-50/80 border border-amber-100/60 flex items-center gap-3" id="ai-noa-interactive-status">
          <div className="w-9 h-9 rounded-xl bg-gray-900 flex items-center justify-center shrink-0 shadow-md">
            <Sparkles className="w-4.5 h-4.5 text-amber-400 animate-pulse" />
          </div>
          <div>
            <span className="text-[8.5px] font-black text-amber-800 uppercase tracking-widest block font-sans">נועה - מודל זמין</span>
            <p className="text-[11px] text-gray-800 font-bold leading-tight mt-0.5">סנכרון פעיל מול Comax ERP ומחסן הכלים</p>
          </div>
        </div>

        {/* 2. Full-feature Conversational Screen */}
        <div className="bg-white border border-gray-150 rounded-[2rem] p-4.5 shadow-2xs flex flex-col h-[380px] overflow-hidden" id="chat-subcontainer">
          <div className="text-[10.5px] font-black text-gray-900 border-b border-gray-100 pb-2.5 mb-3 flex items-center justify-between">
            <span className="flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5 text-amber-500 animate-pulse" />
              צ'אט שוטף מול נועה AI
            </span>
            <span className="text-[8px] bg-emerald-50 text-emerald-800 border-emerald-100 border px-1.5 py-0.2 rounded font-black font-mono">ESTABLISHED</span>
          </div>

          {/* Interactive Chat Stream list */}
          <div className="flex-grow overflow-y-auto space-y-3 pr-1 pl-1 mb-3 scrollbar-none">
            {messages.map((m, idx) => (
              <div key={idx} className={`flex ${m.role === "user" ? "justify-start" : "justify-end"}`}>
                <div className={`p-3.5 rounded-2xl text-[11px] leading-relaxed max-w-[88%] shadow-2xs ${
                  m.role === "user" 
                    ? "bg-gray-900 text-white rounded-br-none" 
                    : "bg-gray-50 text-gray-800 rounded-bl-none border border-gray-150/70"
                }`}>
                  <p className="whitespace-pre-line font-medium">{m.content}</p>
                </div>
              </div>
            ))}
            {loadingChat && (
              <div className="flex justify-end">
                <div className="bg-gray-50 border border-gray-150/70 p-2.5 rounded-2xl rounded-bl-none flex items-center gap-1.5">
                  <div className="animate-bounce w-1.5 h-1.5 bg-gray-800 rounded-full"></div>
                  <div className="animate-bounce delay-100 w-1.5 h-1.5 bg-gray-800 rounded-full"></div>
                  <div className="animate-bounce delay-200 w-1.5 h-1.5 bg-gray-805 rounded-full"></div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input control and submit bar */}
          <form onSubmit={handleSendMessage} className="flex gap-2">
            <input 
              type="text"
              placeholder="שאלי אותי משהו, כגון: 'מתי סמי מגיע ליעד?'..."
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              className="flex-grow bg-gray-50 border border-gray-150 rounded-xl px-3 py-2 text-xs text-gray-900 placeholder-gray-400 outline-none focus:bg-white focus:border-gray-900 text-right font-medium h-10"
              id="chat-input-noa"
            />
            <button 
              type="submit"
              disabled={loadingChat || !inputMessage.trim()}
              className="bg-gray-900 hover:bg-black text-white p-2.5 rounded-xl transition-all flex items-center justify-center shrink-0 disabled:opacity-50 cursor-pointer w-10 h-10"
              id="submit-chat-noa"
            >
              <SendHorizontal className="w-4 h-4 transform rotate-180 text-white" />
            </button>
          </form>
        </div>

        {/* 3. COMAX RAW LOG INTERPRETER */}
        <div id="comax-logs" className="bg-white border border-gray-150 rounded-[2rem] p-5 shadow-2xs space-y-3.5">
          <div className="flex justify-between items-center text-xs">
            <h4 className="font-extrabold text-[#111827] flex items-center gap-1.5">
              <Upload className="w-4.5 h-4.5 text-gray-950" />
              קלט ממסופים / Comax שטח
            </h4>
            <span className="text-[8px] bg-indigo-50 text-indigo-700 font-black border-indigo-150 border px-1.5 py-0.2 rounded font-mono">ERP GATEWAY</span>
          </div>
          <p className="text-[11px] text-gray-500 font-medium leading-relaxed">
            הדבקת שורות טקסט של מעקבי תעודות משלוח, מכלים או החצר, לבקשת קריאה ועדכון מהיר ללוגיסטיקה:
          </p>

          <textarea 
            rows={4}
            placeholder="הזנה חופשית כאן של שמות, מספרים, מקוטים..."
            value={comaxInput}
            onChange={(e) => setComaxInput(e.target.value)}
            className="w-full bg-gray-50 border border-gray-150 rounded-xl p-3 text-xs text-gray-850 placeholder-gray-400 outline-none focus:bg-white focus:border-gray-900 text-right font-mono"
            id="comax-input-textarea"
          />

          <button 
            onClick={handleComaxScan}
            disabled={loadingComax || !comaxInput.trim()}
            className="w-full bg-gray-900 hover:bg-black text-white font-black py-2.5 rounded-xl text-center text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
          >
            {loadingComax ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                מעבדת תכני קומקס במערכת...
              </>
            ) : (
              <>
                <Database className="w-3.5 h-3.5 text-amber-400" />
                סרוק וחלץ בעזרת AI נועה
              </>
            )}
          </button>

          {/* Parsed overlay displaying beautiful results */}
          {showComaxResult && (
            <motion.div 
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-gray-50 border border-gray-200 rounded-xl p-3.5 space-y-3 mt-2"
              id="comax-results-display"
            >
              <h4 className="text-[11px] font-black text-gray-900 border-b border-gray-200 pb-1.5 flex justify-between items-center">
                <span>תרגום שחולץ מקומקס:</span>
                <span className="text-emerald-700 font-bold flex items-center gap-0.5">
                  <Check className="w-3.5 h-3.5" />
                  מוכן לעדכון ענן
                </span>
              </h4>

              {parsedOrders.length > 0 && (
                <div className="space-y-1.5">
                  <span className="text-[9.5px] font-black text-indigo-700 uppercase tracking-wider block">משלוחי קצה דחופים ({parsedOrders.length}):</span>
                  {parsedOrders.map((o, i) => (
                    <div key={i} className="bg-white p-2.5 border border-gray-150/80 rounded-lg text-[10.5px] font-mono leading-relaxed">
                      <div className="flex justify-between font-extrabold text-[#111827]">
                        <span>#{o.orderNumber}</span>
                        <span>{o.customerName}</span>
                      </div>
                      <div className="text-gray-550 mt-0.5">יעד: {o.destination}</div>
                    </div>
                  ))}
                </div>
              )}

              {parsedInventory.length > 0 && (
                <div className="space-y-1.5">
                  <span className="text-[9.5px] font-black text-indigo-700 uppercase tracking-wider block">עדכון מלאי מזהה ({parsedInventory.length}):</span>
                  {parsedInventory.map((item, i) => (
                    <div key={i} className="bg-white p-2.5 border border-gray-150/80 rounded-lg text-[10.5px] font-mono leading-relaxed">
                      <div className="flex justify-between font-extrabold text-[#111827]">
                        <span>{item.sku}</span>
                        <span>{item.name}</span>
                      </div>
                      <div className="text-gray-550 mt-0.5">מלאי חדש: {item.currentStock} {item.unit}</div>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex gap-2.5 pt-2 border-t border-gray-205">
                <button 
                  onClick={() => setShowComaxResult(false)}
                  className="flex-1 bg-white hover:bg-gray-100 text-gray-600 border border-gray-200 py-1.5 rounded-lg text-[10px] cursor-pointer"
                >
                  בטל
                </button>
                <button 
                  onClick={mergeComaxData}
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-black py-1.5 rounded-lg text-[10px] flex items-center justify-center gap-1 cursor-pointer"
                >
                  <Check className="w-3.5 h-3.5 text-white" />
                  עדכן מערכת SabanOS
                </button>
              </div>
            </motion.div>
          )}
        </div>

        {/* 4. DAILY MORNING REPORT MODULE */}
        <div id="daily-briefing" className="bg-white border border-gray-150 rounded-[2rem] p-5 shadow-2xs space-y-3.5">
          <div className="flex justify-between items-center text-xs">
            <h4 className="font-extrabold text-[#111827] flex items-center gap-1.5">
              <FileText className="w-4.5 h-4.5 text-indigo-500" />
              דוח לוגיסטי מסכם (סדרן)
            </h4>
            <span className="text-[8px] bg-amber-50 text-amber-800 border-amber-100 border px-1.5 py-0.2 rounded font-black font-sans">REPORTS ARCHIVE</span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[9px] font-black text-gray-400 block mb-1 uppercase">תאריך סקירה</label>
              <input 
                type="date"
                value={reportDate}
                onChange={(e) => setReportDate(e.target.value)}
                className="w-full bg-gray-50 border border-gray-150 rounded-xl px-2.5 py-1.5 text-xs text-gray-800"
              />
            </div>
            <div className="flex items-end">
              <button 
                onClick={generateMorningReportAI}
                disabled={compilingReport}
                className="w-full bg-gray-900 border border-transparent hover:bg-black text-white font-extrabold py-1.5 rounded-xl text-center text-xs flex items-center justify-center gap-1 cursor-pointer h-9 shadow-2xs"
              >
                {compilingReport ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    מחולל...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                    חולל דוח AI
                  </>
                )}
              </button>
            </div>
          </div>

          {reportText && (
            <motion.div 
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              className="space-y-3"
            >
              <span className="text-[9.5px] font-black text-gray-400 block uppercase">טיוטת הדוח המופקת:</span>
              <textarea 
                rows={5}
                value={reportText}
                onChange={(e) => setReportText(e.target.value)}
                className="w-full bg-amber-50/30 border border-amber-200/50 rounded-xl p-3 text-xs leading-relaxed text-gray-800 outline-none font-mono text-right"
              />
              <div className="flex gap-2.5">
                <button 
                  onClick={() => setReportText("")}
                  className="flex-1 bg-white hover:bg-gray-100 text-gray-600 border border-gray-200 py-1.5 rounded-lg text-xs cursor-pointer"
                >
                  מחק טיוטה
                </button>
                <button 
                  onClick={handleSaveMorningReport}
                  className="flex-1 bg-gray-900 text-white font-black py-1.5 rounded-lg text-xs flex items-center justify-center gap-1 cursor-pointer hover:bg-black"
                >
                  <Check className="w-3.5 h-3.5 text-amber-400" />
                  שמור יומן סדרן
                </button>
              </div>
            </motion.div>
          )}

          {/* History */}
          {reportHistory.length > 0 && (
            <div className="space-y-2 pt-3 border-t border-gray-100">
              <span className="text-[9.5px] font-black text-[#B5BAC9] block uppercase tracking-wider">דוחות אחרונים שנלוגו ({reportHistory.length}):</span>
              <div className="space-y-2 max-h-[150px] overflow-y-auto pr-1">
                {reportHistory.map((rep) => (
                  <div key={rep.id} className="bg-gray-50 border border-gray-200 rounded-2xl p-3 text-[10.5px] space-y-1.5 relative overflow-hidden">
                    <div className="font-extrabold text-gray-[#111827] pb-1 border-b border-gray-250/30 flex justify-between">
                      <span>תאריך סקירה: {rep.date}</span>
                      <span className="text-[8px] bg-emerald-50 text-emerald-800 border border-emerald-100/70 px-1 py-0.2 rounded">נשמר בענן</span>
                    </div>
                    <p className="text-gray-700 leading-normal whitespace-pre-line font-mono">
                      {rep.reportText}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
