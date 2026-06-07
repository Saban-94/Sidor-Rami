import React, { useState, useEffect, useRef } from "react";
import { collection, addDoc, getDocs, doc, setDoc, onSnapshot } from "firebase/firestore";
import { db, handleFirestoreError, OperationType } from "../firebase";
import { Order, MorningReport, Reminder, InventoryItem } from "../types";
import { 
  Sparkles, Send, Sparkle, Upload, Check, Clipboard, Database, AlertCircle, Calendar, FileText, RefreshCw, SendHorizontal, Trash, HelpCircle 
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
  const [isCopied, setIsCopied] = useState(false);

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
        // Give standard pending eta status
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
    <div className="flex flex-col flex-1 bg-[#FDFDFF] pb-24 text-right" dir="rtl" id="noa-view-container">
      {/* Visual top bar of Saban AI Hub with premium white layout and dark branding accent */}
      <div className="bg-white px-5 py-4 border-b border-gray-100 shadow-2xs flex justify-between items-center" id="noa-bar-header">
        <div>
          <h2 className="text-xl font-black text-gray-900 tracking-tight font-sans">AI סייעת לוגיסטית</h2>
          <p className="text-[10px] uppercase tracking-widest text-[#B5BAC9] font-bold">נועה - עוזרת חכמה & קומקס</p>
        </div>
      </div>

      <div className="px-5 mt-4 space-y-5 flex-1 overflow-y-auto">
        {/* Quick action buttons designed as custom bento layout anchors */}
        <div className="grid grid-cols-2 gap-3" id="noa-quick-features">
          <a href="#comax-logs" className="p-4 bg-gray-50 hover:bg-gray-100/70 border border-gray-100 rounded-3xl text-center font-bold text-xs text-gray-855 transition-all block">
            <Upload className="w-4.5 h-4.5 mx-auto mb-1 text-gray-950" />
            סריקת לוג Comax
          </a>
          <a href="#daily-briefing" className="p-4 bg-gray-50 hover:bg-gray-100/70 border border-gray-100 rounded-3xl text-center font-bold text-xs text-gray-855 transition-all block">
            <FileText className="w-4.5 h-4.5 mx-auto mb-1 text-gray-950" />
            דוח בוקר לוגיסטי (AI)
          </a>
        </div>

        {/* AI Assistant Banner inline with system status */}
        <div className="p-4 rounded-3xl bg-amber-50 border border-amber-100 flex items-center gap-3.5 text-right" id="ai-noa-interactive-status">
          <div className="w-10 h-10 rounded-2xl bg-gray-900 flex items-center justify-center shadow-lg shrink-0">
             <Sparkles className="w-5 h-5 text-amber-400 animate-pulse" />
          </div>
          <div className="flex-1">
            <p className="text-[9px] font-black text-amber-800 uppercase tracking-widest">סייעת חכמה - נועה</p>
            <p className="text-xs text-gray-800 font-bold leading-tight">"זיהיתי עדכוני מלאי מעולים קומקס. לערוך דוח?"</p>
          </div>
        </div>

        {/* 1. Conversational Chat screen wrapper */}
        <div className="bg-white border border-gray-100 rounded-[2rem] p-5 shadow-sm flex flex-col h-[400px]" id="chat-subcontainer">
          <div className="text-xs font-extrabold text-gray-900 border-b border-gray-100 pb-2 mb-3.5 flex items-center gap-1.5 justify-between">
            <span className="flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              צ'אט שוטף מול נועה
            </span>
            <span className="text-[9px] bg-emerald-50 text-emerald-800 border-emerald-100 border px-2 py-0.5 rounded-full font-black">סנכרון פעיל</span>
          </div>

          {/* Interactive Chat Stream list */}
          <div className="flex-1 overflow-y-auto space-y-3.5 pr-1 pl-1 scrollbar-styled mb-3.5">
            {messages.map((m, idx) => (
              <div key={idx} className={`flex ${m.role === "user" ? "justify-start" : "justify-end"}`}>
                <div className={`p-4 rounded-[1.6rem] text-xs leading-relaxed max-w-[85%] shadow-xs ${
                  m.role === "user" 
                    ? "bg-gray-900 text-white rounded-br-none" 
                    : "bg-gray-50 text-gray-850 rounded-bl-none border border-gray-150"
                }`}>
                  <div className="font-black mb-1 text-[9px] opacity-75">
                    {m.role === "user" ? "אתה" : "נועה"}
                  </div>
                  <p className="whitespace-pre-line font-medium">{m.content}</p>
                </div>
              </div>
            ))}
            {loadingChat && (
              <div className="flex justify-end pr-1">
                <div className="bg-gray-50 border border-gray-150 p-2.5 rounded-2xl rounded-bl-none flex items-center gap-2">
                  <div className="animate-bounce w-1.5 h-1.5 bg-gray-950 rounded-full"></div>
                  <div className="animate-bounce delay-100 w-1.5 h-1.5 bg-gray-950 rounded-full"></div>
                  <div className="animate-bounce delay-200 w-1.5 h-1.5 bg-gray-950 rounded-full"></div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Chat input box */}
          <form onSubmit={handleSendMessage} className="flex gap-2">
            <input 
              type="text"
              placeholder="שאלי אותי משהו, למשל: 'איזה נהגים פנויים עכשיו?'..."
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs text-gray-800 placeholder-gray-400 outline-none focus:border-gray-950 text-right font-medium"
              id="chat-input-noa"
            />
            <button 
              type="submit"
              disabled={loadingChat || !inputMessage.trim()}
              className="bg-gray-900 text-white p-2.5 rounded-xl hover:bg-black transition-all flex items-center justify-center flex-shrink-0 disabled:opacity-50"
              id="submit-chat-noa"
            >
              <SendHorizontal className="w-4 h-4 transform rotate-180 text-white" />
            </button>
          </form>
        </div>

        {/* 2. COMAX LOG SCANNER INTERACTIVE PANEL */}
        <div id="comax-logs" className="bg-white border border-gray-150 rounded-[2rem] p-5 shadow-sm space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-xs font-black text-gray-900 flex items-center gap-2">
              <Upload className="w-4.5 h-4.5 text-gray-950" />
              קליטת אקסל / לוג Comax מהשטח
            </h2>
            <span className="text-[9px] bg-gray-100 text-gray-800 font-extrabold border-gray-200 border px-2.5 py-0.5 rounded-full uppercase tracking-tight">סורק בינה מלאכותית</span>
          </div>
          <p className="text-xs text-[#9CA3AF] font-medium leading-relaxed">
            הדבק נתונים גולמיים ממערכת Comax לניהול הזמנות או מלאי, ונועה תפרק אותם ותציע למזג אותם באופן אוטומטי לבסיס הנתונים של SabanOS.
          </p>

          <textarea 
            rows={5}
            placeholder="לדוגמה:
הזמנה ORD-9912. לקוח: אשטרום הנדסה. יעד: הרצליה פיתוח. פריט: מנוף כננת עגינה. תאריך: 2026-06-06.
מק''ט מלאי מזהה: SKU-CR-CHAIN-10. תכולה מעודכנת: 25 יח'. מינימום: 10."
            value={comaxInput}
            onChange={(e) => setComaxInput(e.target.value)}
            className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 text-xs text-gray-850 placeholder-gray-400 outline-none focus:border-gray-950 text-right font-mono"
            id="comax-input-textarea"
          />

          <div className="flex gap-2">
            <button 
              onClick={handleComaxScan}
              disabled={loadingComax || !comaxInput.trim()}
              className="flex-1 bg-gray-900 hover:bg-black text-white font-bold py-2.5 rounded-xl text-center text-xs flex items-center justify-center gap-1.5 transition-colors"
            >
              {loadingComax ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  נועה מעבדת את הקומקס...
                </>
              ) : (
                <>
                  <Database className="w-3.5 h-3.5 text-amber-450" />
                  סרוק וחלץ נתונים
                </>
              )}
            </button>
          </div>

          {/* Results overlay display drawer */}
          {showComaxResult && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-gray-50 border border-gray-200 rounded-2xl p-4 space-y-4"
              id="comax-results-display"
            >
              <h3 className="text-xs font-bold text-gray-800 border-b border-gray-250 pb-2 flex justify-between items-center">
                <span>תרגום בינה מלאכותית מאובחן:</span>
                <span className="text-emerald-750 font-bold flex items-center gap-1">
                  <Check className="w-3.5 h-3.5" />
                  מוכן למיזוג שטח
                </span>
              </h3>

              {parsedOrders.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-xs font-bold text-gray-700">🚚 הזמנות שזוהו ({parsedOrders.length}):</h4>
                  <div className="space-y-1.5 max-h-[150px] overflow-y-auto">
                    {parsedOrders.map((o, i) => (
                      <div key={i} className="bg-white p-2 border border-gray-150 rounded-xl text-[11px] font-mono leading-relaxed space-y-0.5">
                        <div className="flex justify-between font-bold text-amber-700">
                          <span>{o.orderNumber}</span>
                          <span>{o.customerName}</span>
                        </div>
                        <div className="text-gray-550">יעד: {o.destination}</div>
                        {o.items && <div className="text-gray-550 truncate">פריט: {o.items}</div>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {parsedInventory.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-xs font-bold text-gray-700">📦 פריטי מלאי שזוהו ({parsedInventory.length}):</h4>
                  <div className="space-y-1.5 max-h-[150px] overflow-y-auto">
                    {parsedInventory.map((item, i) => (
                      <div key={i} className="bg-white p-2 border border-gray-150 rounded-xl text-[11px] font-mono leading-relaxed space-y-0.5">
                        <div className="flex justify-between font-bold text-sky-700">
                          <span>{item.sku}</span>
                          <span>{item.name}</span>
                        </div>
                        <div className="text-gray-550">מלאי חדש: {item.currentStock} {item.unit || "יח'"}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex gap-2 pt-2 border-t border-gray-200">
                <button 
                  onClick={() => setShowComaxResult(false)}
                  className="flex-1 bg-gray-200 text-gray-700 py-1.5 rounded-lg text-center text-xs"
                >
                  נקה תוצאות
                </button>
                <button 
                  onClick={mergeComaxData}
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-1.5 rounded-lg text-center text-xs flex items-center justify-center gap-1"
                >
                  <Database className="w-3.5 h-3.5" />
                  מזג למערכת SabanOS
                </button>
              </div>
            </motion.div>
          )}
        </div>

        {/* 3. MORNING LOGISTICS OFFICE REPORT WRAPPER */}
        <div id="daily-briefing" className="bg-white border border-gray-200 rounded-3xl p-5 shadow-sm space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-sm font-bold text-gray-900 flex items-center gap-2">
              <FileText className="w-4.5 h-4.5 text-sky-500" />
              דוח בוקר ויומן סדרן יומי
            </h2>
            <span className="text-[10px] bg-sky-50 text-sky-800 font-semibold border-sky-100 border px-2 py-0.5 rounded-full">ארכיון סיכומים</span>
          </div>

          <div className="grid grid-cols-2 gap-3.5">
            <div>
              <label className="text-xs font-semibold text-gray-600 block mb-1">תאריך סקירה</label>
              <input 
                type="date"
                value={reportDate}
                onChange={(e) => setReportDate(e.target.value)}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-2.5 py-1.5 text-xs text-gray-800"
              />
            </div>
            <div className="flex items-end">
              <button 
                onClick={generateMorningReportAI}
                disabled={compilingReport}
                className="w-full bg-gray-900 text-white font-bold py-2 rounded-xl text-center text-xs flex items-center justify-center gap-1 hover:bg-black transition-all"
              >
                {compilingReport ? (
                  <>
                    <RefreshCw className="w-3 animate-spin" />
                    יוצר סיכום...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                    חולל דוח אוטומטי
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
              <span className="text-xs font-semibold text-gray-600 block mb-1">טיוטת דוח הבוקר המוצעת:</span>
              <textarea 
                rows={6}
                value={reportText}
                onChange={(e) => setReportText(e.target.value)}
                className="w-full bg-amber-50/40 border border-amber-200/95 rounded-xl p-3 text-xs leading-relaxed text-gray-800 outline-none text-right font-mono"
              />
              <div className="flex gap-2">
                <button 
                  onClick={() => setReportText("")}
                  className="flex-1 bg-gray-200 text-gray-700 py-1.5 rounded-lg text-center text-xs"
                >
                  נקה דוח
                </button>
                <button 
                  onClick={handleSaveMorningReport}
                  className="flex-1 bg-sky-600 hover:bg-sky-700 text-white font-bold py-1.5 rounded-lg text-center text-xs flex items-center justify-center gap-1"
                >
                  <Check className="w-3.5 h-3.5" />
                  שמור דוח בארכיון
                </button>
              </div>
            </motion.div>
          )}

          {/* Historical archive reports preview list */}
          {reportHistory.length > 0 && (
            <div className="space-y-2 pt-2 border-t border-gray-150">
              <span className="text-xs font-bold text-gray-650 block">דו\"חות בוקר שמורים מוקדמים:</span>
              <div className="space-y-2 max-h-[140px] overflow-y-auto">
                {reportHistory.map((rep) => (
                  <div key={rep.id} className="bg-gray-50 border border-gray-200 rounded-xl p-3 text-xs space-y-2 text-right">
                    <div className="font-bold text-gray-800 pb-1 border-b border-gray-200/50 flex justify-between">
                      <span>דוח לתאריך: {rep.date}</span>
                      <span className="text-[10px] text-gray-400">נשמר בבטחה</span>
                    </div>
                    <p className="text-gray-700 leading-relaxed max-w-[100%] overflow-hidden overflow-ellipsis break-words">
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
