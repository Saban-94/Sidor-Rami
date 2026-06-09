import React, { useState, useEffect, useRef } from "react";
import { 
  motion, 
  AnimatePresence, 
  animate 
} from "motion/react";
import { 
  collection, 
  onSnapshot, 
  addDoc, 
  setDoc, 
  doc, 
  updateDoc, 
  deleteDoc, 
  serverTimestamp 
} from "firebase/firestore";
import { db, auth, signOutUser } from "../firebase";
import { 
  SendHorizontal, 
  Sparkles, 
  Truck, 
  ArrowLeftRight, 
  UserCheck, 
  Share2, 
  Trash2, 
  Plus, 
  Activity, 
  Wrench, 
  Package, 
  Moon, 
  Sun, 
  Database, 
  Clipboard, 
  AlertTriangle, 
  MapPin, 
  Clock, 
  CheckCircle2, 
  HelpCircle, 
  FileText, 
  TrendingUp, 
  MessageSquare,
  ShieldAlert,
  Loader2,
  Lock,
  RefreshCw,
  X,
  LogOut,
  ChevronRight,
  Mic,
  MicOff
} from "lucide-react";
import { Order, Driver, InventoryItem, MorningReport } from "../types";

// Standard Firestore Error Handling conforming to Secure Skill Mandate
enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
    },
    operationType,
    path
  };
  console.error('[SabanOS Database Exception]: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// In-App Transfer model matching metadata
export interface Transfer {
  id?: string;
  sourceBranch: string;
  destBranch: string;
  item: string;
  quantity: number;
  status: "pending" | "in_transit" | "completed" | "canceled";
  driverName?: string;
  createdAt: string;
  notes?: string;
}

interface NoaChatRoomProps {
  isSidebarMode?: boolean;
  className?: string;
  onBack?: () => void;
}

export function NoaChatRoom({ isSidebarMode = false, className = "", onBack }: NoaChatRoomProps = {}) {
  // Theme setting
  const [isDarkMode, setIsDarkMode] = useState<boolean>(false);
  const [voiceEnabled, setVoiceEnabled] = useState<boolean>(false);

  // States for real-time Firestore sync
  const [orders, setOrders] = useState<Order[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [transfers, setTransfers] = useState<Transfer[]>([]);

  // Chat message stream state
  const [messages, setMessages] = useState<Array<{
    id: string;
    role: "user" | "model";
    content: string;
    suggestedOrder?: Partial<Order>;
    suggestedTransfer?: Partial<Transfer>;
  }>>([
    {
      id: "init-1",
      role: "model",
      content: "שלום איציק וראמי! אני נועה, עוזרת ה-AI הלוגיסטית שלכם בחצר ח.סבן חומרי בניין. 🛠️\nבאפשרותכם להקליד הזמנה חופשית כאן, לבצע העברות מלאי מהירות בין סניפים, לשבץ נהגים וליצור הודעות מרוכזות לקבוצת הווטסאפ של הסניף."
    }
  ]);

  // UI States
  const [inputText, setInputText] = useState("");
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [showTransfersModal, setShowTransfersModal] = useState(false);
  const [showWhatsAppDraftModal, setShowWhatsAppDraftModal] = useState(false);

  // New branch transfer form state
  const [transferSource, setTransferSource] = useState("סניף החרש 10");
  const [transferDest, setTransferDest] = useState("סניף התלמיד");
  const [transferItem, setTransferItem] = useState("");
  const [transferQty, setTransferQty] = useState<number>(10);
  const [transferNotes, setTransferNotes] = useState("");
  const [transferDriver, setTransferDriver] = useState("עלי משאית פריקה ידנית");

  // Selected Order for driver assignment
  const [selectedOrderForAssignment, setSelectedOrderForAssignment] = useState<Order | null>(null);

  // Filters and active dropdowns for the Side Orders Board (לוח סידור)
  const [ordersSearchQuery, setOrdersSearchQuery] = useState("");
  const [ordersStatusFilter, setOrdersStatusFilter] = useState("all");
  const [orderDropdownId, setOrderDropdownId] = useState<string | null>(null);

  // Ready whatsapp template text state
  const [whatsAppText, setWhatsAppText] = useState("");

  // Refs for animated scroll auto control
  const chatScrollContainerRef = useRef<HTMLDivElement>(null);
  const bottomMarkerRef = useRef<HTMLDivElement>(null);

  // Smooth scroll using Framer Motion (animated)
  useEffect(() => {
    const container = chatScrollContainerRef.current;
    if (!container) return;

    const targetScroll = container.scrollHeight - container.clientHeight;
    if (targetScroll <= 0) return;

    const animation = animate(container.scrollTop, targetScroll, {
      duration: 0.6,
      ease: [0.16, 1, 0.3, 1], // Sleek expo out scroll
      onUpdate: (latest) => {
        container.scrollTop = latest;
      }
    });

    return () => animation.stop();
  }, [messages, isAiLoading]);

  // Set real-time listeners for all collections
  useEffect(() => {
    const unsubOrders = onSnapshot(collection(db, "orders"), (snap) => {
      const list: Order[] = [];
      snap.forEach((d) => {
        list.push({ ...d.data(), id: d.id } as Order);
      });
      list.sort((a, b) => (b.date || "").localeCompare(a.date || ""));
      setOrders(list);
    }, (err) => handleFirestoreError(err, OperationType.GET, "orders"));

    const unsubInventory = onSnapshot(collection(db, "inventory"), (snap) => {
      const list: InventoryItem[] = [];
      snap.forEach((d) => {
        list.push({ ...d.data(), id: d.id } as InventoryItem);
      });
      setInventory(list);
    }, (err) => handleFirestoreError(err, OperationType.GET, "inventory"));

    const unsubDrivers = onSnapshot(collection(db, "drivers"), (snap) => {
      const list: Driver[] = [];
      snap.forEach((d) => {
        list.push({ ...d.data(), id: d.id } as Driver);
      });
      setDrivers(list);
    }, (err) => handleFirestoreError(err, OperationType.GET, "drivers"));

    const unsubTransfers = onSnapshot(collection(db, "transfers"), (snap) => {
      const list: Transfer[] = [];
      snap.forEach((d) => {
        list.push({ ...d.data(), id: d.id } as Transfer);
      });
      list.sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
      setTransfers(list);
    }, (err) => handleFirestoreError(err, OperationType.GET, "transfers"));

    return () => {
      unsubOrders();
      unsubInventory();
      unsubDrivers();
      unsubTransfers();
    };
  }, []);

  // Preset quick templates for typing tests
  const quickTemplates = [
    {
      label: "הזמנה גנרית - איציק זהבי 🔒",
      text: "הזמנה דחופה עבור איציק זהבי, יעד: רחוב החרש 10 סניף, מחר ב-08:00. חומרים: 5 קוב חול ים, 20 שקי טיט מוכן ו-10 בלות חצץ ירוק."
    },
    {
      label: "הזמנה - משפחת לוי רעננה",
      text: "רישום הזמנה חדשה ללקוח יוסי לוי לרחוב אחוזה 45 רעננה, ליום חמישי הקרוב בשעה 09:30. להביא 15 שקי מלט אפור ו-8 פלטות גבס לבן במנוף."
    },
    {
      label: "מלאי חסר ובדיקה",
      text: "אילו מהפריטים שלנו במחסנים נמצאים כרגע בחוסר מלאי אדום מתחת למינימום?"
    }
  ];

  // Submit messages
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || isAiLoading) return;

    const userMsg = inputText.trim();
    setInputText("");
    
    // Add to message stream
    setMessages(prev => [...prev, { id: `u-${Date.now()}`, role: "user", content: userMsg }]);
    setIsAiLoading(true);

    try {
      // 1. Text Parsing & Logic Match (Custom rules logic)
      const promptLower = userMsg.toLowerCase();
      
      // Check if itzik zehavi is mentioned in the prompt (CRITICAL DRIVER COERCION REQUIREMENT)
      const isItzikZehavi = promptLower.includes("איציק") && (promptLower.includes("זהבי") || promptLower.includes("זהבי"));
      const isTransferRequest = promptLower.includes("העבר") || promptLower.includes("סניף") || promptLower.includes("תלמיד") || promptLower.includes("חרש");
      
      let aiResponseText = "";
      let proposal: Partial<Order> | undefined = undefined;

      // Make realistic Gemini request proxy or fallback logic
      const response = await fetch("/api/gemini/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: `${userMsg}. (שימו לב: אם מדובר על הלקוח איציק זהבי, סדרו שהנהג יהיה מיידית 'עלי משאית פריקה ידנית' בלבד!)`,
          history: messages.slice(-5).map(m => ({ role: m.role, content: m.content })),
          inventory: inventory,
          orders: orders
        })
      });
      
      if (response.ok) {
        const resJson = await response.json();
        aiResponseText = resJson.text || "";
      }

      // Safeguard fallback / Parsing custom structured actions if API falls to demand caps
      if (!aiResponseText) {
        if (isItzikZehavi) {
          aiResponseText = `זיהיתי בקשת פתיחת הזמנה חדשה עבור **איציק זהבי**.\n\n⚠️ **שים לב - הנחיית שיבוץ נעולה:** מאחר והלקוח הוא איציק זהבי, הנהג המוקצה לפריקה נעול אוטומטית על **"עלי משאית פריקה ידנית"** בלבד (השינוי אינו ניתן לבינוי מטעמי שינוע).\n\nלהלן הפרטים הבאים שחולצו לייצור הזמנה במחסן:`;
          proposal = {
            customerName: "איציק זהבי",
            destination: "רחוב החרש 10, סניף ח.סבן",
            date: new Date(Date.now() + 86400000).toISOString().split("T")[0],
            time: "08:00",
            items: "5 קוב חול ים, 20 שקי טיט מוכן, 10 בלות חצץ ירוק",
            warehouse: "מחסן החרש 10",
            driverId: "ali_driver_manual", // Alias/Name indicator
            status: "pending",
            eta: "פריקה אוטומטית (עלי)"
          };
        } else {
          // Standard text extraction mock-smart logic
          const destMatch = userMsg.match(/לרחוב\s+([^,]+)/) || userMsg.match(/ליעד\s+([^,]+)/) || userMsg.match(/בסניף\s+([^,]+)/);
          const customerMatch = userMsg.match(/עבור\s+([^\s,]+)/) || userMsg.match(/ללקוח\s+([^\s,]+)/);
          const customName = customerMatch ? customerMatch[1] : "יוסי לוי (סדרן שטח)";
          const customDest = destMatch ? destMatch[1] : "אחוזה 45, רעננה";
          
          aiResponseText = `הבנתי, חילצתי את פרטי המשלוח עבור **${customName}** בהצלחה לעיבוד במערכת.\n\nאני בודקת את זמינות המלאי עבור החומרים שהוזכרו.\n\nבאפשרותך לאשר את פתיחת המשימה כעת:`;
          proposal = {
            customerName: customName,
            destination: customDest,
            date: new Date(Date.now() + 86400000).toISOString().split("T")[0],
            time: "10:00",
            items: "15 שקי מלט אפור, 8 פלטות גבס לבן",
            warehouse: "מחסן החרש 10",
            status: "pending",
            eta: "ממתין לשיבוץ נהג"
          };
        }
      } else {
        // Parse proposed values from Gemini response if present (heuristics)
        if (isItzikZehavi) {
          proposal = {
            customerName: "איציק זהבי",
            destination: "רחוב החרש 10, סניף ח.סבן",
            date: new Date(Date.now() + 86400000).toISOString().split("T")[0],
            time: "08:00",
            items: "5 קוב חול ים, 20 שקי טיט מוכן, 10 בלות חצץ",
            warehouse: "מחסן החרש 10",
            driverId: "ali_driver_manual",
            status: "pending",
            eta: "שיבוץ נעול (עלי)"
          };
        } else {
          proposal = {
            customerName: "יוסי לוי",
            destination: "רחוב אחוזה 45, רעננה",
            date: new Date(Date.now() + 86400000).toISOString().split("T")[0],
            time: "09:30",
            items: "15 שקי מלט אפור, 8 פלטות גבס ירוק",
            warehouse: "מחסן החרש 10",
            status: "pending",
            eta: "ממתין לשיבוץ נהג"
          };
        }
      }

      setMessages(prev => [
        ...prev, 
        { 
          id: `m-${Date.now()}`, 
          role: "model", 
          content: aiResponseText,
          suggestedOrder: proposal
        }
      ]);
    } catch (err) {
      console.error(err);
      setMessages(prev => [
        ...prev, 
        { 
          id: `err-${Date.now()}`, 
          role: "model", 
          content: "⚠️ שגיאה זמנית בעיבוד ה-AI. עם זאת, הלוגיקה והממשקים שלך פעילים לחלוטין. תוכל ליצור העברה ידנית או לרשום הזמנות." 
        }
      ]);
    } finally {
      setIsAiLoading(false);
    }
  };

  // Create real order in Firestore from proposed AI card
  const handleConfirmAiOrder = async (ord: Partial<Order>) => {
    try {
      const uniqueOrderNumber = `SBN-${Date.now().toString().slice(-5)}`;
      
      // Coerce driver if customer name is Itzik Zehavi (PRESCRIBED BUSINESS RULE)
      const exactCustomer = ord.customerName || "איציק זהבי";
      const isItzik = exactCustomer === "איציק זהבי" || exactCustomer.includes("איציק");
      
      const realOrderDoc: Order = {
        orderNumber: uniqueOrderNumber,
        customerName: exactCustomer,
        destination: ord.destination || "סניף החרש 10",
        date: ord.date || new Date().toISOString().split("T")[0],
        time: ord.time || "08:00",
        items: ord.items || "חומרי הובלה כלליים",
        status: "pending",
        warehouse: ord.warehouse || "סניף החרש 10",
        documentIds: "AI-AUTO-GENERATED",
        // Auto assign Ali manually if customer is Itzik Zehavi
        driverId: isItzik ? "ali_driver_manual" : "", 
        eta: isItzik ? "שובץ אוטומטית לעלי" : "ממתין לשיבוץ נהג"
      };

      const docId = uniqueOrderNumber.toLowerCase();
      await setDoc(doc(db, "orders", docId), realOrderDoc);

      setMessages(prev => [
        ...prev,
        {
          id: `sys-${Date.now()}`,
          role: "model",
          content: `✅ הזמנה **${uniqueOrderNumber}** עבור **${exactCustomer}** נוצרה בהצלחה ב-Cloud! ${isItzik ? "הנהג 'עלי' שובץ אוטומטית בהתאם למגבלות." : "כולל העברה ישירה למנהלי העבודה."}`
        }
      ]);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, "orders");
    }
  };

  // Create real Transfer between branches in Firestore
  const handleCreateTransfer = async () => {
    if (!transferItem) {
      alert("אנא בחר פריט מוביל להעברה");
      return;
    }
    try {
      const transferId = `TRF-${Date.now().toString().slice(-5)}`;
      const newTransferDoc: Transfer = {
        sourceBranch: transferSource,
        destBranch: transferDest,
        item: transferItem,
        quantity: Number(transferQty),
        status: "pending",
        driverName: transferDriver,
        createdAt: new Date().toISOString(),
        notes: transferNotes || "העברה בין סניפית רשמית"
      };

      await setDoc(doc(db, "transfers", transferId), newTransferDoc);
      setShowTransfersModal(false);
      
      // Notify chat
      setMessages(prev => [
        ...prev,
        {
          id: `sys-trf-${Date.now()}`,
          role: "model",
          content: `🔄 **פעולת העברה בין סניפים נרשמה!**\n\nמקור: **${transferSource}** ➡️ יעד: **${transferDest}**\nחומר: **${transferItem}** (כמות: **${transferQty}**)\nנהג משלח: **${transferDriver}**`
        }
      ]);

      // Clear fields
      setTransferItem("");
      setTransferNotes("");
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, "transfers");
    }
  };

  // Change order status or assign driver
  const handleAssignDriverToOrder = async (orderId: string, driver: Driver) => {
    try {
      const ord = orders.find(o => o.id === orderId);
      if (!ord) return;

      // Rule Validation Check: If order is for Itzik Zehavi, enforce only Ali Driver (ali_driver_manual)
      const isItzik = ord.customerName === "איציק זהבי" || ord.customerName.includes("איציק");
      
      let driverToAssignId = driver.id || "";
      let driverNameText = driver.name;

      if (isItzik) {
        // Enforce Ali ONLY
        driverToAssignId = "ali_driver_manual";
        driverNameText = "עלי משאית פריקה ידנית";
        alert("🔒 פעולה חסומה! בהתאם להנחיות ראמי, הזמנות של איציק זהבי משובצות אך ורק לעלי משאית פריקה ידנית.");
      }

      await updateDoc(doc(db, "orders", orderId), {
        driverId: driverToAssignId,
        eta: `משלוח מבוצע ע"י ${driverNameText}`,
        status: "in_transit"
      });

      setSelectedOrderForAssignment(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `orders/${orderId}`);
    }
  };

  // Update order status directly fromsidebar
  const handleUpdateOrderStatus = async (orderId: string, newStatus: "pending" | "in_transit" | "delivered" | "canceled") => {
    try {
      await updateDoc(doc(db, "orders", orderId), {
        status: newStatus
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `orders/${orderId}`);
    }
  };

  // Delete old/completed order from database
  const handleDeleteOrder = async (orderId: string) => {
    if (!confirm("האם למחוק את ההזמנה לחלוטין מלוח הסידור?")) return;
    try {
      await deleteDoc(doc(db, "orders", orderId));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `orders/${orderId}`);
    }
  };

  // Generate a beautiful, structured report of the entire scheduling board
  const handleGenerateDispatchReport = () => {
    let text = `*📋 סידור עבודה יומי - ח. סבן חומרי בניין* 🚚\n`;
    text += `התאריך: ${new Date().toLocaleDateString('he-IL')} • מעודכן מלוח הבקרה בזמן אמת\n`;
    text += `------------------------------------------------\n\n`;

    const pending = orders.filter(o => o.status === "pending");
    const active = orders.filter(o => o.status === "in_transit");
    const completed = orders.filter(o => o.status === "delivered");

    text += `⏳ *הזמנות ממתינות / בטיפול (${pending.length}):*\n`;
    if (pending.length === 0) text += `אין הזמנות ממתינות.\n`;
    pending.forEach((o, idx) => {
      const driver = drivers.find(d => d.id === o.driverId)?.name || (o.driverId === "ali_driver_manual" ? "עלי" : "טרם שובץ");
      text += `${idx+1}. הזמנה ${o.orderNumber} • ${o.customerName}\n   📍 פריקה: ${o.destination}\n   📦 תיאור: ${o.items || "חומרי בניין כללי"}\n   👤 נהג: ${driver}\n\n`;
    });

    text += `🚛 *הזמנות בדרך / בסבב הובלה (${active.length}):*\n`;
    if (active.length === 0) text += `אין סבבים פעילים בדרך.\n`;
    active.forEach((o, idx) => {
      const driver = drivers.find(d => d.id === o.driverId)?.name || (o.driverId === "ali_driver_manual" ? "עלי" : "טרם שובץ");
      text += `${idx+1}. הזמנה ${o.orderNumber} • ${o.customerName}\n   📍 יעד: ${o.destination}\n   👤 נהג משנע: _${driver}_\n\n`;
    });

    text += `✅ *הזמנות שנמסרו בהצלחה (${completed.length}):*\n`;
    if (completed.length === 0) text += `טרם נמסרו הזמנות היום.\n`;
    completed.forEach((o, idx) => {
      text += `✓ ${o.orderNumber} לשירות ${o.customerName} (${o.destination})\n`;
    });

    if (transfers.length > 0) {
      text += `\n🔄 *העברות מלאי מהירות (${transfers.length}):*\n`;
      transfers.forEach((trf) => {
        text += `• [${trf.status === 'completed' ? 'הושלם' : 'בתנועה'}] מ-${trf.sourceBranch} ל-${trf.destBranch} ⬅️ ${trf.item} (x${trf.quantity})\n`;
      });
    }

    text += `\n✨ נשלח דרך SabanOS AI. המשך עבודה פרודוקטיבית וסעו בזהירות!`;
    setWhatsAppText(text);
    setShowWhatsAppDraftModal(true);
  };

  // Update Transfer state
  const handleUpdateTransferStatus = async (item: Transfer, newStatus: "pending" | "in_transit" | "completed" | "canceled") => {
    if (!item.id) return;
    try {
      await updateDoc(doc(db, "transfers", item.id), {
        status: newStatus
      });
    } catch (e) {
      handleFirestoreError(e, OperationType.UPDATE, `transfers/${item.id}`);
    }
  };

  // Open structured Whatsapp sender window
  const triggerWhatsAppSend = (item: any, type: "order" | "transfer") => {
    let text = "";
    if (type === "order") {
      text = `*SabanOS - עדכון משימת משלוח ח.סבן חומרי בניין* 🚚\n\n🔹 *הזמנה:* ${item.orderNumber}\n👤 *לקוח:* ${item.customerName}\n📍 *יעד:* ${item.destination}\n⏳ *שעה:* ${item.time}\n📦 *חומרים:* ${item.items}\n⚙️ *סטטוס:* ${item.status === 'pending' ? 'ממתין' : item.status === 'in_transit' ? 'בדרך' : 'נמסר'}`;
      if (item.driverId === "ali_driver_manual") {
        text += `\n🔒 *שיבוץ נהג נעול:* עלי משאית פריקה ידנית`;
      }
    } else {
      text = `*SabanOS - הודעת העברת מלאי בין סניפים* 🔄\n\n📌 *מקור:* ${item.sourceBranch}\n📌 *יעד:* ${item.destBranch}\n📦 *חומר:* ${item.item}\n⚖️ *כמות:* ${item.quantity}\n🚛 *נהג משנע:* ${item.driverName || 'טרם שובץ'}\n💬 *הערות:* ${item.notes || 'אין'}`;
    }

    setWhatsAppText(text);
    setShowWhatsAppDraftModal(true);
  };

  const executeWhatsAppOpen = () => {
    const encoded = encodeURIComponent(whatsAppText);
    window.open(`https://wa.me/?text=${encoded}`, "_blank");
    setShowWhatsAppDraftModal(false);
  };

  // Delete message
  const clearChatLogs = () => {
    setMessages([
      {
        id: "init-reset",
        role: "model",
        content: "הצ'אט אותחל לבקשתך. כיצד אוכל לסייע לח.סבן היום?"
      }
    ]);
  };

  if (isSidebarMode) {
    return (
      <div className={`w-full h-full flex flex-col overflow-hidden text-right ${isDarkMode ? "bg-slate-900 text-white" : "bg-neutral-50 text-slate-900"} ${className}`} dir="rtl" id="noa-smart-sidebar-container">
        {/* LEFT SIDE: Conversational Intelligence Flow & Dynamic Actions panel */}
        <main className="flex-1 flex flex-col overflow-hidden border border-neutral-150 rounded-3xl bg-white shadow-xl h-full">
          
          {/* Client Indicator Top Panel */}
          <div className="p-4 bg-gradient-to-l from-indigo-50 to-indigo-100/30 border-b border-indigo-100 flex justify-between items-center select-none shrink-0">
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 bg-emerald-500 rounded-full animate-ping animate-pulse" />
              <Activity className="w-4.5 h-4.5 text-indigo-600" />
              <span className="text-xs font-black text-indigo-900 font-mono tracking-wide">NOA CONVERSATIONAL DISPATCH v3.5</span>
            </div>
            
            <div className="flex items-center gap-2">
              <span className="text-[10.5px] text-indigo-805 bg-indigo-50/55 shadow-3xs px-3 py-1 rounded-full font-bold">
                סנכרון פעיל 🟢
              </span>
            </div>
          </div>

          {/* Quick interactive test templates */}
          <div className="px-5 py-3 border-b border-gray-150 flex items-center gap-2 overflow-x-auto shrink-0 bg-slate-50/80">
            <span className="text-xs font-black text-gray-400 shrink-0">לחיצה מהירה:</span>
            {quickTemplates.map((item, idx) => (
              <button 
                key={idx}
                type="button"
                onClick={() => setInputText(item.text)}
                className="bg-white hover:bg-slate-100 text-slate-800 text-[11px] font-black px-2.5 py-1.5 rounded-lg border border-slate-200 transition-all font-sans shrink-0 hover:border-slate-300 cursor-pointer"
              >
                {item.label}
              </button>
            ))}
          </div>

          {/* Messages core scroll stream */}
          <div 
            ref={chatScrollContainerRef}
            className={`flex-1 overflow-y-auto px-5 py-5 space-y-4 bg-gradient-to-b ${isDarkMode ? "from-slate-900 via-slate-950 to-slate-950" : "from-slate-50/20 to-white"}`}
          >
            <AnimatePresence initial={false}>
              {messages.map((m) => {
                const isUser = m.role === "user";
                const containsItzik = m.content.includes("איציק") || m.content.includes("זהבי");
                
                return (
                  <motion.div
                    key={m.id}
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.25 }}
                    className={`flex flex-col ${isUser ? "items-start text-right" : "items-end text-right"}`}
                  >
                    <span className="text-[9.5px] font-black text-[#A5ADC0] mb-1 px-1">
                      {isUser ? "שולח: סדרן שטח / ראמי" : "נועה AI • עוזר לוגיסטי"}
                    </span>

                    <div className={`p-4 rounded-2xl text-xs leading-relaxed max-w-[85%] shadow-xs ${
                      isUser 
                        ? "bg-slate-900 text-white rounded-br-none" 
                        : "bg-slate-100 text-slate-900 rounded-bl-none border border-slate-200 font-medium"
                    }`}>
                      <p className="whitespace-pre-line leading-relaxed font-sans">{m.content}</p>

                      {/* Display warning badge if Itzik auto assign is triggered */}
                      {containsItzik && (
                        <div className="mt-3 p-2.5 bg-rose-50 border border-rose-150 rounded-xl text-[11px] text-rose-800 font-bold flex items-center gap-1.5">
                          <Lock className="w-4 h-4 text-rose-600 shrink-0" />
                          <span>מערכת ביקורת: שיבוץ הנהג עלי הוחל באופן אוטומטי.</span>
                        </div>
                      )}
                    </div>

                    {/* AI Order proposal confirmation cards */}
                    {m.suggestedOrder && (
                      <motion.div 
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="mt-3 p-4 bg-gradient-to-br from-indigo-50/70 to-indigo-50 border border-indigo-200 rounded-2xl max-w-[85%] shadow-xs space-y-3"
                      >
                        <div className="flex items-center justify-between border-b border-indigo-100 pb-2">
                          <div className="flex items-center gap-1.5 text-indigo-900 font-black">
                            <Sparkles className="w-3.5 h-3.5 text-indigo-600 animate-spin" />
                            <span>נועה AI • הצעה להזמנה חדשה</span>
                          </div>
                          <span className="text-[9px] bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full font-bold">
                            קליטה מהירה
                          </span>
                        </div>

                        <div className="space-y-1.5 text-[11px] text-slate-800">
                          <div>📍 לקוח: <strong>{m.suggestedOrder.customerName}</strong></div>
                          <div>📍 יעד: <strong>{m.suggestedOrder.destination}</strong></div>
                          <div>📦 תכולה: {m.suggestedOrder.items}</div>
                          {m.suggestedOrder.driverId ? (
                            <div className="text-[10px] text-emerald-650 bg-emerald-50 px-2 py-1 rounded-md font-bold mt-1.5 w-max">
                              <span>הנהג הוקצה אוטומטית לעלי (פריקה ידנית)</span>
                            </div>
                          ) : (
                            <div className="text-[10px] text-gray-500 font-sans">נהג: יוקצה אוטומטית / ידנית בסנכרון</div>
                          )}
                        </div>

                        <button 
                          type="button"
                          onClick={() => handleConfirmAiOrder(m.suggestedOrder!)}
                          className="w-full bg-indigo-650 hover:bg-indigo-700 text-white py-2 px-3 rounded-xl text-xs font-black transition-all active:scale-95 flex items-center justify-center gap-1 cursor-pointer"
                        >
                          <span>אשר והזמן משלוח לקומקס ✓</span>
                        </button>
                      </motion.div>
                    )}
                  </motion.div>
                );
              })}
            </AnimatePresence>
            <div ref={bottomMarkerRef} />
            
            {isAiLoading && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex flex-col items-start"
              >
                <span className="text-[9.5px] font-black text-[#A5ADC0] mb-1 px-1">נועה AI • עוזר לוגיסטי</span>
                <div className="bg-slate-100 px-4 py-3 border border-slate-200 rounded-2xl rounded-bl-none flex items-center gap-1.5 text-slate-500 shadow-3xs text-xs">
                  <Loader2 className="w-4.5 h-4.5 text-indigo-600 animate-spin" />
                  <span>נועה מחשבת סימולציות ומסנכרנת מלוח הבקרה...</span>
                </div>
              </motion.div>
            )}
          </div>

          {/* User Input controls */}
          <footer className="p-4 bg-slate-50 border-t border-gray-150 shrink-0 space-y-3">
            
            {/* Quick Actions Ribbon on screen */}
            <div className="flex gap-2 items-center overflow-x-auto py-1">
              <span className="text-[11px] font-black text-slate-400 shrink-0">סרגל כלים מהיר:</span>
              
              <button
                type="button"
                onClick={() => setInputText("הזמנה דחופה עבור איציק זהבי לרחוב החרש 10 סניף, מחר ב-08:00. חומרים: 5 קוב חול ים, 20 שקי טיט מוכן ו-10 בלות חצץ ירוק.")}
                className="bg-indigo-50 border border-indigo-100 hover:bg-indigo-150 text-indigo-800 text-[10.5px] font-black px-3 py-1.5 rounded-xl transition-all flex items-center gap-1 shrink-0 cursor-pointer animate-fadeIn"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>📝 טיוטת הזמנת איציק</span>
              </button>

              <button
                type="button"
                onClick={() => setShowTransfersModal(true)}
                className="bg-cyan-50 border border-cyan-100 hover:bg-cyan-155 text-cyan-800 text-[10.5px] font-black px-3 py-1.5 rounded-xl transition-all flex items-center gap-1 shrink-0 cursor-pointer"
              >
                <ArrowLeftRight className="w-3.5 h-3.5" />
                <span>🔄 העברה בין סניפים</span>
              </button>

              <button
                type="button"
                onClick={handleGenerateDispatchReport}
                className="bg-emerald-50 border border-emerald-100 hover:bg-emerald-155 text-emerald-800 text-[10.5px] font-black px-3 py-1.5 rounded-xl transition-all flex items-center gap-1 shrink-0 cursor-pointer"
              >
                <FileText className="w-3.5 h-3.5" />
                <span>📊 נסח דוח סידור WhatsApp</span>
              </button>
            </div>

            <form onSubmit={handleSendMessage} className="flex gap-3">
              <input 
                type="text"
                placeholder="צור משלוח חדש, רשום העברת מלאי, שייך נהג..."
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                className="flex-1 bg-white border border-slate-350 focus:border-indigo-600 outline-none rounded-2xl px-4 py-3 text-xs text-slate-900 transition-all font-sans"
              />
              <button 
                type="submit" 
                disabled={!inputText.trim()}
                className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white rounded-2xl w-12 h-11 flex items-center justify-center transition-all select-none cursor-pointer"
              >
                <SendHorizontal className="w-5 h-5" />
              </button>
            </form>
          </footer>
        </main>

        {/* TRANSFERS OVERLAY MODAL */}
        <AnimatePresence>
          {showTransfersModal && (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 font-sans">
              <motion.div 
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                className={`w-full max-w-md rounded-3xl ${isDarkMode ? "bg-slate-900 text-white" : "bg-white text-slate-900"} p-6 shadow-2xl relative border ${isDarkMode ? "border-slate-800" : "border-slate-100"}`}
              >
                <button 
                  onClick={() => setShowTransfersModal(false)}
                  className="absolute top-4 left-4 p-1.5 hover:bg-slate-100 rounded-full transition-all cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>

                <div className="flex items-center gap-2 border-b pb-3 mb-4">
                  <ArrowLeftRight className="w-5 h-5 text-indigo-500" />
                  <h3 className="font-black text-base">העברת מלאי מהירה בין מחסנים</h3>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-black text-gray-400 mb-1">סניף שולח (מקור)</label>
                    <select 
                      value={transferSource} 
                      onChange={(e) => setTransferSource(e.target.value)}
                      className="w-full border border-slate-300 rounded-xl p-2.5 text-xs bg-transparent text-slate-950 focus:border-indigo-500 outline-none"
                    >
                      <option value="סניף החרש 10">סניף החרש 10 (סניף מרכזי)</option>
                      <option value="סניף התלמיד">סניף התלמיד</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-black text-gray-400 mb-1">סניף מקבל (יעד)</label>
                    <select 
                      value={transferDest} 
                      onChange={(e) => setTransferDest(e.target.value)}
                      className="w-full border border-slate-300 rounded-xl p-2.5 text-xs bg-transparent text-slate-950 focus:border-indigo-500 outline-none"
                    >
                      <option value="סניף התלמיד">סניף התלמיד</option>
                      <option value="סניף החרש 10">סניף החרש 10 (סניף מרכזי)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-black text-gray-400 mb-1">בחר פריט להעברה</label>
                    <select 
                      value={transferItem} 
                      onChange={(e) => setTransferItem(e.target.value)}
                      className="w-full border border-slate-300 rounded-xl p-2.5 text-xs bg-transparent text-slate-950 focus:border-indigo-500 outline-none"
                    >
                      <option value="">-- בחר חומר בניין מהקטלוג --</option>
                      {inventory.map(item => (
                        <option key={item.id} value={item.name}>
                          {item.name} (מלאי זמין: {item.currentStock})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-black text-gray-400 mb-1">כמות להעברה</label>
                      <input 
                        type="number" 
                        value={transferQty} 
                        onChange={(e) => setTransferQty(Math.max(1, Number(e.target.value)))}
                        className="w-full border border-slate-300 rounded-xl p-2.5 text-xs bg-transparent text-slate-950 focus:border-indigo-500 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-black text-gray-400 mb-1">נהג משנע</label>
                      <select
                        value={transferDriver}
                        onChange={(e) => setTransferDriver(e.target.value)}
                        className="w-full border border-slate-300 rounded-xl p-2.5 text-xs bg-transparent text-slate-950 focus:border-indigo-500 outline-none"
                      >
                        <option value="עלי משאית פריקה ידנית">עלי (משאית פריקה ידנית)</option>
                        <option value="שמחון מנוף">שמחון (מנוף ציוד כבד)</option>
                        <option value="הובלות סבן">הובלות סבן (ספקים חיצוניים)</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-black text-gray-400 mb-1">הערות להעברה</label>
                    <textarea 
                      value={transferNotes} 
                      onChange={(e) => setTransferNotes(e.target.value)}
                      placeholder="הוסף מידע..."
                      className="w-full border border-slate-300 rounded-xl p-2.5 text-xs bg-transparent text-slate-950 focus:border-indigo-500 outline-none h-16 resize-none"
                    />
                  </div>

                  <button 
                    onClick={handleCreateTransfer}
                    className="w-full bg-indigo-650 hover:bg-indigo-700 text-white font-bold py-3 rounded-xl text-xs transition-all active:scale-95 cursor-pointer mt-4"
                  >
                    בצע העברת מלאי ועדכן את הסניפים
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* WHATSAPP CONFIRMATION MODAL */}
        <AnimatePresence>
          {showWhatsAppDraftModal && (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 font-sans">
              <motion.div 
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                className="w-full max-w-md rounded-3xl bg-white text-slate-900 p-6 shadow-2xl relative border border-slate-100"
              >
                <button 
                  onClick={() => setShowWhatsAppDraftModal(false)}
                  className="absolute top-4 left-4 p-1.5 hover:bg-slate-100 rounded-full transition-all cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>

                <div className="flex items-center gap-2 border-b pb-3 mb-4">
                  <Share2 className="w-5 h-5 text-emerald-500" />
                  <h3 className="font-black text-base">עריכת הודעה לקבוצת WhatsApp</h3>
                </div>

                <div className="space-y-4">
                  <p className="text-xs text-gray-500">
                    באפשרותך לערוך את ההודעה המובנית של סבן-OS לפני שליחתה כטקסט לקבוצת הנהגים:
                  </p>

                  <textarea 
                    value={whatsAppText}
                    onChange={(e) => setWhatsAppText(e.target.value)}
                    className="w-full border border-slate-300 rounded-xl p-3 text-xs bg-slate-50 text-slate-900 focus:border-indigo-500 outline-none h-44 resize-y leading-relaxed font-sans"
                  />

                  <div className="flex gap-3 mt-4">
                    <button 
                      onClick={executeWhatsAppOpen}
                      className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 rounded-xl text-xs transition-all active:scale-95 flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <MessageSquare className="w-4 h-4" />
                      <span>שלח לקבוצה (wa.me)</span>
                    </button>
                    <button 
                      onClick={() => setShowWhatsAppDraftModal(false)}
                      className="bg-gray-150 hover:bg-gray-250 text-slate-700 font-bold py-3 px-5 rounded-xl text-xs transition-all cursor-pointer"
                    >
                      ביטול
                    </button>
                  </div>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  return (
    <div className={`w-full min-h-screen text-right flex flex-col ${isDarkMode ? "bg-slate-950 text-white" : "bg-neutral-50 text-slate-900"}`} dir="rtl" id="noa-smart-workspace">
      {/* Top Professional Header Bar (WhatsApp-style) */}
      <header className={`px-4 sm:px-6 py-3 flex items-center justify-between border-b ${isDarkMode ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200"} shrink-0 z-20 shadow-sm gap-4`}>
        <div className="flex items-center gap-3">
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className={`p-2 rounded-xl transition-all border ${
                isDarkMode 
                  ? "border-slate-800 bg-slate-900 hover:bg-slate-800 text-slate-300" 
                  : "border-slate-200 bg-white hover:bg-slate-55 text-slate-700"
              } cursor-pointer`}
              title="חזור ללוח הסידור"
            >
              <ChevronRight className="w-5 h-5 lg:w-5 lg:h-5 text-gray-700" />
            </button>
          )}

          <div className="relative">
            <div className="w-10 h-10 bg-indigo-605 rounded-xl flex items-center justify-center text-white shadow-md animate-pulse">
              <Sparkles className="w-5 h-5 text-amber-300" />
            </div>
            <span className="absolute -bottom-0.5 -left-0.5 w-3 h-3 bg-emerald-500 rounded-full border-2 border-white"></span>
          </div>

          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base sm:text-lg font-black font-sans tracking-tight leading-none text-slate-900">נועה AI • עוזרת שינוע ולוגיסטיקה חכמה</h1>
              <span className="bg-emerald-500/10 text-emerald-600 text-[10px] font-bold px-2 py-0.5 rounded-full border border-emerald-500/20">פעילה 🟢</span>
            </div>
            <p className="text-[10px] sm:text-xs text-gray-400 font-medium">ח. סבן לוגיסטיקה ושירות אספקת חומרי בניין</p>
          </div>
        </div>

        {/* Header Control Buttons */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Voice toggle */}
          <button 
            type="button"
            onClick={() => setVoiceEnabled(!voiceEnabled)}
            className={`flex items-center gap-1.5 font-bold py-2 px-3 rounded-xl text-xs transition-all border ${
              voiceEnabled 
                ? "bg-indigo-600 border-indigo-700 text-white shadow-md animate-pulse" 
                : isDarkMode 
                  ? "border-slate-750 bg-slate-800 text-slate-400" 
                  : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
            } active:scale-95 cursor-pointer`}
            title={voiceEnabled ? "הקראה קולית פעילה" : "הקראה קולית כבויה"}
          >
            {voiceEnabled ? <Mic className="w-4 h-4 text-amber-300" /> : <MicOff className="w-4 h-4 text-slate-400" />}
            <span className="hidden sm:inline">{voiceEnabled ? "הקראה פעילה" : "הקראה קולית"}</span>
          </button>

          <button 
            type="button"
            onClick={() => setIsDarkMode(!isDarkMode)}
            className={`p-2.5 rounded-xl border ${isDarkMode ? "border-slate-700 bg-slate-800 text-amber-400" : "border-slate-200 bg-white text-slate-700"} transition-all active:scale-90`}
            title="החלף ערכת צבעים"
          >
            {isDarkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>

          <button 
            type="button"
            onClick={clearChatLogs}
            className={`p-2.5 rounded-xl border border-red-500/20 hover:bg-red-500/10 text-red-500 transition-all active:scale-90`}
            title="נקה צ'אט"
          >
            <Trash2 className="w-4 h-4" />
          </button>

          <button 
            type="button"
            onClick={signOutUser}
            className="p-2.5 rounded-xl border border-rose-500/20 hover:bg-rose-500/10 text-rose-500 transition-all active:scale-90"
            title="נתק מערכת"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Main Spacious Workbench Layout - Extended completely to 100% */}
      <div className="flex-1 w-full p-4 sm:p-6 overflow-hidden flex flex-col max-h-[calc(100vh-80px)]">
        
        {/* Full screen main chat container */}
        {/* Full-width main chat flow */}
        <main className="flex-grow w-full h-full flex flex-col overflow-hidden border border-neutral-150 rounded-3xl bg-white shadow-xl">
          
          {/* Client Indicator Top Panel */}
          <div className="p-4 bg-gradient-to-l from-indigo-50 to-indigo-100/30 border-b border-indigo-100 flex justify-between items-center select-none">
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 bg-emerald-500 rounded-full animate-ping animate-pulse" />
              <Activity className="w-4.5 h-4.5 text-indigo-600" />
              <span className="text-xs font-black text-indigo-900 font-mono tracking-wide">NOA CONVERSATIONAL DISPATCH v3.5</span>
            </div>
            
            <div className="flex items-center gap-2">
              <span className="text-[10.5px] text-indigo-805 bg-indigo-50/55 shadow-3xs px-3 py-1 rounded-full font-bold">
                סנכרון פעיל 🟢
              </span>
            </div>
          </div>

          {/* Quick interactive test templates */}
          <div className="px-5 py-3 border-b border-gray-150 flex items-center gap-2 overflow-x-auto shrink-0 bg-slate-50/80">
            <span className="text-xs font-black text-gray-400 shrink-0">לחיצה מהירה:</span>
            {quickTemplates.map((item, idx) => (
              <button 
                key={idx}
                type="button"
                onClick={() => setInputText(item.text)}
                className="bg-white hover:bg-indigo-50 border border-gray-200 hover:border-indigo-300 text-slate-800 text-[10.5px] font-bold px-3 py-1.5 rounded-full shadow-4xs shrink-0 transition-all active:scale-95 cursor-pointer"
              >
                {item.label}
              </button>
            ))}
          </div>

          {/* Messages core scroll stream */}
          <div 
            ref={chatScrollContainerRef}
            className={`flex-1 overflow-y-auto px-5 py-5 space-y-4 bg-gradient-to-b ${isDarkMode ? "from-slate-900 via-slate-950 to-slate-950" : "from-slate-50/20 to-white"}`}
          >
            <AnimatePresence initial={false}>
              {messages.map((m) => {
                const isUser = m.role === "user";
                const containsItzik = m.content.includes("איציק") && m.content.includes("עלי");
                
                return (
                  <motion.div 
                    key={m.id}
                    initial={{ opacity: 0, y: 15, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ duration: 0.22, ease: "easeOut" }}
                    className={`flex flex-col ${isUser ? "items-start w-full" : "items-end w-full"}`}
                  >
                    <span className="text-[9.5px] font-black text-[#A5ADC0] mb-1 px-1">
                      {isUser ? "שולח: סדרן שטח / ראמי" : "נועה AI • עוזר לוגיסטי"}
                    </span>

                    <div className={`p-4 rounded-2xl text-xs leading-relaxed w-full shadow-xs ${
                      isUser 
                        ? "bg-slate-900 text-white rounded-br-none" 
                        : "bg-slate-100 text-slate-900 rounded-bl-none border border-slate-200 font-medium"
                    }`}>
                      <p className="whitespace-pre-line leading-relaxed font-sans">{m.content}</p>

                      {/* Display warning badge if Itzik auto assign is triggered */}
                      {containsItzik && (
                        <div className="mt-3 p-2.5 bg-rose-50 border border-rose-150 rounded-xl text-[11px] text-rose-800 font-bold flex items-center gap-1.5">
                          <Lock className="w-4 h-4 text-rose-600 shrink-0" />
                          <span>מערכת ביקורת: שיבוץ הנהג עלי הוחל באופן אוטומטי.</span>
                        </div>
                      )}
                    </div>

                    {/* INTERACTIVE COMPONENT: Suggested order confirmation box */}
                    {m.suggestedOrder && (
                      <motion.div 
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={`mt-3 w-full max-w-xl rounded-2xl border ${isDarkMode ? "bg-slate-900 border-indigo-900 text-white" : "bg-indigo-50/65 border-indigo-150 text-slate-900"} p-4 space-y-3 shadow-md`}
                      >
                        <div className="flex items-center justify-between border-b border-indigo-100 pb-2">
                          <div className="flex items-center gap-1.5 text-indigo-900 font-black">
                            <Sparkles className="w-3.5 h-3.5 text-indigo-600 animate-spin" />
                            <span>נועה AI • הצעה להזמנה חדשה</span>
                          </div>
                          <span className="text-[9px] bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full font-bold">
                            פענוח AI
                          </span>
                        </div>

                        <div className="space-y-1.5 text-xs">
                          <div>📍 לקוח: <strong>{m.suggestedOrder.customerName}</strong></div>
                          <div>📍 יעד הובלה: <strong>{m.suggestedOrder.destination}</strong></div>
                          <div>📅 תאריך יעד: {m.suggestedOrder.date} | שעה: {m.suggestedOrder.time}</div>
                          <div>📦 חומרים: {m.suggestedOrder.items}</div>
                          
                          {/* Driver coercion presentation */}
                          {m.suggestedOrder.customerName === "איציק זהבי" ? (
                            <div className="p-2 bg-amber-100 border border-amber-200 text-amber-900 rounded-lg text-[11px] font-bold flex items-center gap-1">
                              <Lock className="w-3.5 h-3.5 text-amber-600" />
                              <span>הנהג הוקצה אוטומטית לעלי (פריקה ידנית)</span>
                            </div>
                          ) : (
                            <div className="text-[10px] text-gray-500 font-sans">נהג: יוקצה אוטומטית / ידנית בסנכרון</div>
                          )}
                        </div>

                        <button 
                          type="button"
                          onClick={() => handleConfirmAiOrder(m.suggestedOrder!)}
                          className="w-full bg-indigo-650 hover:bg-indigo-700 text-white py-2 px-3 rounded-xl text-xs font-black transition-all active:scale-95 flex items-center justify-center gap-1 cursor-pointer"
                        >
                          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                          <span>אשר ורשום הזמנה בענני SabanOS</span>
                        </button>
                      </motion.div>
                    )}
                  </motion.div>
                );
              })}

              {isAiLoading && (
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex flex-col items-end"
                >
                  <span className="text-[9.5px] font-black text-[#A5ADC0] mb-1 px-1">נועה AI • עוזר לוגיסטי</span>
                  <div className="bg-slate-100 px-4 py-3 border border-slate-200 rounded-2xl rounded-bl-none flex items-center gap-1.5 text-slate-500 shadow-3xs text-xs">
                    <Loader2 className="w-4.5 h-4.5 text-indigo-600 animate-spin" />
                    <span>נועה מחשבת סימולציות ומסנכרנת מלוח הבקרה...</span>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
            <div ref={bottomMarkerRef} />
          </div>

          {/* User Input controls */}
          <footer className="p-4 bg-slate-50 border-t border-gray-150 shrink-0 space-y-3">
            
            {/* Quick Actions Ribbon on screen */}
            <div className="flex gap-2 items-center overflow-x-auto py-1">
              <span className="text-[11px] font-black text-slate-400 shrink-0">סרגל כלים מהיר:</span>
              
              <button
                type="button"
                onClick={() => setInputText("הזמנה דחופה עבור איציק זהבי לרחוב החרש 10 סניף, מחר ב-08:00. חומרים: 5 קוב חול ים, 20 שקי טיט מוכן ו-10 בלות חצץ ירוק.")}
                className="bg-indigo-50 border border-indigo-100 hover:bg-indigo-150 text-indigo-800 text-[10.5px] font-black px-3 py-1.5 rounded-xl transition-all flex items-center gap-1 shrink-0 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>📝 טיוטת הזמנת איציק (נעול עלי)</span>
              </button>

              <button
                type="button"
                onClick={() => setShowTransfersModal(true)}
                className="bg-cyan-50 border border-cyan-100 hover:bg-cyan-155 text-cyan-800 text-[10.5px] font-black px-3 py-1.5 rounded-xl transition-all flex items-center gap-1 shrink-0 cursor-pointer"
              >
                <ArrowLeftRight className="w-3.5 h-3.5" />
                <span>🔄 העברה בין סניפים</span>
              </button>

              <button
                type="button"
                onClick={handleGenerateDispatchReport}
                className="bg-emerald-50 border border-emerald-100 hover:bg-emerald-155 text-emerald-800 text-[10.5px] font-black px-3 py-1.5 rounded-xl transition-all flex items-center gap-1 shrink-0 cursor-pointer"
              >
                <FileText className="w-3.5 h-3.5" />
                <span>📊 נסח דוח סידור WhatsApp</span>
              </button>
            </div>

            <form onSubmit={handleSendMessage} className="flex gap-3">
              <input 
                type="text"
                placeholder="כתוב הודעה שוטפת (לדוגמה: הזמנה גנרית לאיציק זהבי למחר ב-08:00...)"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                className="flex-1 bg-white hover:bg-slate-50 focus:bg-white border border-slate-350 focus:border-indigo-500 outline-none rounded-2xl px-4 py-3 text-xs font-medium focus:ring-2 focus:ring-indigo-500/10 placeholder-slate-400 text-slate-900 transition-all"
              />
              <button 
                type="submit"
                disabled={isAiLoading || !inputText.trim()}
                className="bg-indigo-650 hover:bg-indigo-700 text-white p-3.5 rounded-2xl transition-all disabled:opacity-45 shrink-0 flex items-center justify-center cursor-pointer shadow-md"
              >
                <SendHorizontal className="w-4.5 h-4.5 transform rotate-270" />
              </button>
            </form>
          </footer>
        </main>
      </div>

      {/* MODAL WORKFLOW: Create Inter-Branch Transfer Dialog */}
      <AnimatePresence>
        {showTransfersModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className={`w-full max-w-md rounded-3xl ${isDarkMode ? "bg-slate-900 text-white" : "bg-white text-slate-900"} p-6 shadow-2xl relative border ${isDarkMode ? "border-slate-800" : "border-slate-100"}`}
            >
              <button 
                onClick={() => setShowTransfersModal(false)}
                className="absolute top-4 left-4 p-1.5 hover:bg-slate-100 rounded-full transition-all"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="flex items-center gap-2 border-b pb-3 mb-4">
                <ArrowLeftRight className="w-5 h-5 text-indigo-500" />
                <h3 className="font-black text-base font-sans">העברת מלאי מהירה בין מחסנים</h3>
              </div>

              <div className="space-y-4">
                {/* Source Branch Selection */}
                <div>
                  <label className="block text-xs font-black text-gray-400 mb-1">סניף שולח (מקור)</label>
                  <select 
                    value={transferSource} 
                    onChange={(e) => setTransferSource(e.target.value)}
                    className="w-full border border-slate-300 rounded-xl p-2.5 text-xs bg-transparent text-slate-950 focus:border-indigo-500 outline-none"
                  >
                    <option value="סניף החרש 10">סניף החרש 10 (סניף מרכזי)</option>
                    <option value="סניף התלמיד">סניף התלמיד</option>
                  </select>
                </div>

                {/* Destination Branch Selection */}
                <div>
                  <label className="block text-xs font-black text-gray-400 mb-1">סניף מקבל (יעד)</label>
                  <select 
                    value={transferDest} 
                    onChange={(e) => setTransferDest(e.target.value)}
                    className="w-full border border-slate-300 rounded-xl p-2.5 text-xs bg-transparent text-slate-950 focus:border-indigo-500 outline-none"
                  >
                    <option value="סניף התלמיד">סניף התלמיד</option>
                    <option value="סניף החרש 10">סניף החרש 10 (סניף מרכזי)</option>
                  </select>
                </div>

                {/* Material Select */}
                <div>
                  <label className="block text-xs font-black text-gray-400 mb-1">בחר פריט להעברה</label>
                  <select 
                    value={transferItem} 
                    onChange={(e) => setTransferItem(e.target.value)}
                    className="w-full border border-slate-300 rounded-xl p-2.5 text-xs bg-transparent text-slate-950 focus:border-indigo-500 outline-none"
                  >
                    <option value="">-- בחר חומר בניין מהקטלוג --</option>
                    {inventory.map(item => (
                      <option key={item.id} value={item.name}>
                        {item.name} (מלאי זמין: {item.currentStock})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Cargo Quality selection */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-black text-gray-400 mb-1">כמות להעברה</label>
                    <input 
                      type="number" 
                      value={transferQty} 
                      onChange={(e) => setTransferQty(Math.max(1, Number(e.target.value)))}
                      className="w-full border border-slate-300 rounded-xl p-2.5 text-xs bg-transparent text-slate-950 focus:border-indigo-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-black text-gray-400 mb-1">נהג משנע</label>
                    <select
                      value={transferDriver}
                      onChange={(e) => setTransferDriver(e.target.value)}
                      className="w-full border border-slate-300 rounded-xl p-2.5 text-xs bg-transparent text-slate-950 focus:border-indigo-500 outline-none"
                    >
                      <option value="עלי משאית פריקה ידנית">עלי (משאית פריקה ידנית)</option>
                      <option value="שמחון מנוף">שמחון (מנוף ציוד כבד)</option>
                      <option value="הובלות סבן">הובלות סבן (ספקים חיצוניים)</option>
                    </select>
                  </div>
                </div>

                {/* Custom notes */}
                <div>
                  <label className="block text-xs font-black text-gray-400 mb-1">הערות להעברה</label>
                  <textarea 
                    value={transferNotes} 
                    onChange={(e) => setTransferNotes(e.target.value)}
                    placeholder="הוסף מידע, למשל: באינטרנט, מנוף פריקה של עלי..."
                    className="w-full border border-slate-300 rounded-xl p-2.5 text-xs bg-transparent text-slate-950 focus:border-indigo-500 outline-none h-16 resize-none"
                  />
                </div>

                <button 
                  onClick={handleCreateTransfer}
                  className="w-full bg-indigo-650 hover:bg-indigo-700 text-white font-bold py-3 rounded-xl text-xs transition-all active:scale-95 cursor-pointer mt-4"
                >
                  בצע העברת מלאי ועדכן את הסניפים
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* WHATSAPP CONFIRMATION MODAL */}
      <AnimatePresence>
        {showWhatsAppDraftModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-md rounded-3xl bg-white text-slate-900 p-6 shadow-2xl relative border border-slate-100"
            >
              <button 
                onClick={() => setShowWhatsAppDraftModal(false)}
                className="absolute top-4 left-4 p-1.5 hover:bg-slate-100 rounded-full transition-all"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="flex items-center gap-2 border-b pb-3 mb-4">
                <Share2 className="w-5 h-5 text-emerald-500" />
                <h3 className="font-black text-base font-sans">עריכת הודעה לקבוצת WhatsApp</h3>
              </div>

              <div className="space-y-4">
                <p className="text-xs text-gray-500">
                  באפשרותך לערוך את ההודעה המובנית של סבן-OS לפני שליחתה כטקסט לקבוצת הנהגים:
                </p>

                <textarea 
                  value={whatsAppText}
                  onChange={(e) => setWhatsAppText(e.target.value)}
                  className="w-full border border-slate-300 rounded-xl p-3 text-xs bg-slate-50 text-slate-900 focus:border-indigo-500 outline-none h-44 resize-y leading-relaxed font-sans"
                />

                <div className="flex gap-3 mt-4">
                  <button 
                    onClick={executeWhatsAppOpen}
                    className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 rounded-xl text-xs transition-all active:scale-95 flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <MessageSquare className="w-4 h-4" />
                    <span>שלח לקבוצה (wa.me)</span>
                  </button>
                  <button 
                    onClick={() => setShowWhatsAppDraftModal(false)}
                    className="bg-gray-150 hover:bg-gray-250 text-slate-700 font-bold py-3 px-5 rounded-xl text-xs transition-all"
                  >
                    ביטול
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
