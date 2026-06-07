import express from "express";
import path from "path";
import dotenv from "dotenv";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";

dotenv.config();

const app = express();
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

const PORT = 3000;

// Lazy initialize Gemini clients
let aiClient: GoogleGenAI | null = null;

function getGeminiClient(): GoogleGenAI {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.warn("WARNING: GEMINI_API_KEY is not defined in environment secrets.");
    }
    aiClient = new GoogleGenAI({
      apiKey: apiKey || "MOCK_KEY",
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
  }
  return aiClient;
}

// Robust retry utility for handling temporary upstream 503 errors and high-demand spikes
async function callWithRetry<T>(fn: () => Promise<T>, maxRetries = 3, initialDelayMs = 1500): Promise<T> {
  let attempt = 0;
  while (attempt < maxRetries) {
    try {
      return await fn();
    } catch (error: any) {
      attempt++;
      const errorMessage = error?.message || "";
      const is503OrUnavailable = 
        error?.status === 503 || 
        error?.statusCode === 503 || 
        errorMessage.includes("503") || 
        errorMessage.includes("UNAVAILABLE") || 
        errorMessage.includes("high demand") || 
        errorMessage.includes("temporary");

      if (is503OrUnavailable && attempt < maxRetries) {
        const delay = initialDelayMs * Math.pow(2, attempt - 1);
        console.warn(`[SabanOS AI Client] Gemini API returned 503/UNAVAILABLE (high demand). Retrying attempt ${attempt}/${maxRetries} in ${delay}ms...`);
        await new Promise((resolve) => setTimeout(resolve, delay));
      } else {
        throw error;
      }
    }
  }
  throw new Error("Gemini API call failed after max retries due to high demand.");
}

// Check api health
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", time: new Date().toISOString() });
});

/**
 * 1. AI Chat Endpoint with 'Noa'
 */
app.post("/api/gemini/chat", async (req, res) => {
  try {
    const { message, history, inventory, orders } = req.body;
    if (!message) {
       res.status(400).json({ error: "Message is required" });
       return;
    }

    const ai = getGeminiClient();
    const todayStr = new Date().toISOString().split("T")[0];
    
    // Inject Hebrew-centric Saban Operational personality instructions, matching inventory & history
    const systemInstruction = `אתה "נועה AI" (Noa), המוח הקוגניטיבי ומערכת הלמידה והבינה הלוגיסטית המתקדמת ביותר של SabanOS (H. Saban Logistics).
תפקידך לתמוך בנותני שירות, מנהלי עבודה וסדרנים, לפענח טקסטים חופשיים, לבדוק מלאי והיסטוריית לקוחות, ולחזור תמיד עם פלט HTML מעוצב, ידידותי ונקי של מחלקה ראשונה.

הנה ההוראות הקשיחות שלך:

1. שפה ועיצוב:
- החזר אך ורק קוד HTML בעברית רהוטה ומקצועית. עטוף את הכל בתוך מכל שיוצג בצורה אולטימטיבית במובייל.
- השתמש בגלסמורפיזם ועיצוב מודרני מרהיב באמצעות לקסיקון מחלקות של Tailwind CSS (כגון bg-white/95 border border-gray-150/70 rounded-[1.5rem] p-5 shadow-md text-right space-y-4 text-gray-800 leading-relaxed font-sans block).
- אל תשתמש בבלוק קוד של מרקדאון (בלי \`\`\`html או \`\`\`). החזר קוד HTML נקי לגמרי המתחיל ועוטף בדיב ראשי דקורטיבי.
- כל פריט או חומר גלם שזוהה בטקסט החופשי - חובה להציבו בתוך כרטיס ויזואלי נייד ומעוצב ברמה גבוהה ביותר (כגון bg-gray-50 border border-gray-150 p-3 rounded-2xl flex flex-col gap-1).

2. ניתוח טקסט חופשי (Raw Text Analysis):
- נתח את טקסט המשתמש כדי לחלץ באופן אינטליגנטי: שם לקוח (Customer Name), כתובת יעד (Destination), תאריך יעד למשלוח (Date - ברירת מחדל: ${todayStr}), שעה (Time), ורשימת פריטים עם כמות, שם החומר, ומק"ט (SKU) אפשרי.

3. הצלבה דו-כיוונית מול מלאי והיסטוריית רכישה (סנכרון מלאי והיסטוריה):
להלן רשימת המלאי הנוכחי במחסן:
${JSON.stringify(inventory || [], null, 2)}

להלן רשימת הזמנות העבר וההיסטוריה המערכתית:
${JSON.stringify(orders || [], null, 2)}

עבור כל פריט או חומר שהמשתמש ביקש:
A. בדיקת מלאי: בדוק אם הוא קיים ברשימת המלאי (לפי שם או מק"ט). אם קיים, הצג את המלאי הזמין (currentStock) בשאיפה.
B. בדיקת היסטוריית רכישות של הלקוח הספציפי (לפי התאמה חכמה של שם הלקוח):
   - מוצר חוזר (Repeated Product): אם המוצר הזה (SKU או שם) כבר נרכש בעבר על ידי לקוח זה באחת מהזמנות העבר, הוסף תג בולט בצבע כחול/אינדיגו: "🔄 רכישה חוזרת". ציין במדויק מתי הייתה הפעם האחרונה שהוא רכש את זה ובאיזו כמות על סמך היסטוריית הזמנות העבר.
   - מוצר חדש ללקוח (New Product): אם המוצר קיים במלאי הכללי אבל לקוח זה מעולם לא הזמין אותו קודם לכן, הוסף תג בולט ונוצץ במיוחד (אדום/כתום): "🔥 מוצר חדש ללקוח זה".

4. זיהוי פרטי הזמנה מלאים ויצירת הזמנה אוטומטית (Order Creation):
- אם זיהית את כל משתני הליבה הדרושים לפתיחת כרטיס הובלה: לקוח, יעד, ותאריך/שעה ופריט, הצג קטע סיכום אישור הזמנה (visual confirmation card) עם כפתור פעולה מיוחד בעל מאפיין 'data-order-trigger'. הכפתור חייב להכיל את אובייקט הנתונים הבא בפורמט JSON מדויק ותקין כערך שלו:
  \`data-order-trigger='{"orderNumber": "SABAN-XXXXXX", "customerName": "...", "destination": "...", "date": "YYYY-MM-DD", "time": "HH:mm", "items": "...", "warehouse": "מחסן ראשי", "status": "pending"}'\` (החלף את ה-XXXXXX בסיפרור ייחודי אקראי של 6 ספרות, ושבץ את שאר הנתונים שחולצו).
- הכפתור צריך להיות מעוצב היטב (כמו כפתור לחיצה ראשי אינטראקטיבי). למשל: class="mt-3 w-full bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white font-extrabold py-2.5 px-4 rounded-xl shadow-md transition-all text-center block cursor-pointer".

אם המשתמש סתם כותב לך שיחה כללית ולא טקסט להזמנה, ענה לו בהסבר קצר וידידותי בעברית, מעוצב בתוך תיבה יפהפייה באותו סגנון HTML גלאסמורפי.`;

    const chatHistory = history ? history.map((h: any) => ({
      role: h.role === "user" ? "user" : "model",
      parts: [{ text: h.content }]
    })) : [];

    const chatInstance = ai.chats.create({
      model: "gemini-3.5-flash",
      config: {
        systemInstruction,
        temperature: 0.5,
      },
      history: chatHistory
    });

    const response = await callWithRetry(() => chatInstance.sendMessage({ message }));
    res.json({ text: response.text });
  } catch (error: any) {
    console.error("Noa Chat Error:", error);
    res.status(500).json({ error: error.message || "Unknown error during AI lookup." });
  }
});

/**
 * 2. Comax Log Data Parser Interface
 */
app.post("/api/gemini/scan_comax", async (req, res) => {
  try {
    const { logText } = req.body;
    if (!logText) {
       res.status(400).json({ error: "Log text is required" });
       return;
    }

    const ai = getGeminiClient();
    const prompt = `נתח את טקסט הלוג או טבלת האקסל הבאה מסוג Comax (מערכת ניהול מלאי והזמנות) ותרגם אותה ישירות למבנה נתונים מסודר של הזמנות או פריטי מלאי:
${logText}

אנא הפק אובייקט JSON המכיל רשימה של הזמנות ופריטים שזוהו. עליך להשלים את כל שדות השפה בצורה תקנית בעברית עבור SabanOS.
הזמנות צריכות להתאים לשדות האלו:
- orderNumber (מספר הזמנה)
- customerName (שם הלקוח)
- destination (כתובת יעד)
- items (פריטים/חומרים)
- date (תאריך YYYY-MM-DD)
- time (שעה HH:mm)
- status (pending / in_transit)
- warehouse (מחסן מקור)
- documentIds (מספרי תעודות קשורים)

פריטי מלאי צריכים להתאים לשדות:
- sku (מק"ט)
- name (שם הפריט)
- description (תיאור)
- currentStock (מלאי נוכחי - מספר)
- minStock (מלאי מינימלי - מספר)
- price (מחיר - מספר)
- category (קטגוריה)

החזר אך ורק קובץ JSON תקין ומדויק.`;

    const response = await callWithRetry(() => ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            orders: {
              type: Type.ARRAY,
              description: "הזמנות שחולצו מקובץ הקומקס",
              items: {
                type: Type.OBJECT,
                properties: {
                  orderNumber: { type: Type.STRING },
                  customerName: { type: Type.STRING },
                  destination: { type: Type.STRING },
                  items: { type: Type.STRING },
                  date: { type: Type.STRING },
                  time: { type: Type.STRING },
                  status: { type: Type.STRING },
                  warehouse: { type: Type.STRING },
                  documentIds: { type: Type.STRING }
                },
                required: ["orderNumber", "customerName", "destination", "status"]
              }
            },
            inventory: {
              type: Type.ARRAY,
              description: "עריכת עדכוני מלאי שחולצו מהקומקס",
              items: {
                type: Type.OBJECT,
                properties: {
                  sku: { type: Type.STRING },
                  name: { type: Type.STRING },
                  description: { type: Type.STRING },
                  currentStock: { type: Type.NUMBER },
                  minStock: { type: Type.NUMBER },
                  price: { type: Type.NUMBER },
                  category: { type: Type.STRING }
                },
                required: ["sku", "name", "currentStock", "minStock"]
              }
            }
          }
        }
      }
    }));

    const parsedData = JSON.parse(response.text || "{}");
    res.json(parsedData);
  } catch (error: any) {
    console.error("Comax Parsing Error:", error);
    res.status(500).json({ error: error.message || "Error processing Comax telemetry logs." });
  }
});

/**
 * 3. AI ETA Route Prediction Endpoint
 */
app.post("/api/gemini/predict_eta", async (req, res) => {
  try {
    const { orderDetails, driverStats } = req.body;
    if (!orderDetails) {
       res.status(400).json({ error: "Order details are required" });
       return;
    }

    const ai = getGeminiClient();
    const prompt = `עליך לחשב ולחזות בצורה אינטליגנטית סבירה את ה-ETA (זמן הגעה משוער) עבור המשלוח הבא של חברת ח. סבן:
פרטי הזמנה משלוח:
${JSON.stringify(orderDetails, null, 2)}

נתוני נהג ומצב הובלה:
${JSON.stringify(driverStats, null, 2)}

נא להחזיר חיזוי בשפה העברית. החזר אובייקט JSON המכיל:
- predictionReasoning: הסבר קצר ומקצועי בעברית על פקקים, עומסים, סוג הרכב (מנוף/משאית) והערכת המרחק.
- estimatedMinutes: מספר דקות משוער להגעה (מספר שלם).
- formattedEtaMessage: הודעת סיכום נוחה ללקוח (למשל, "תוך כ-45 דקות מהיציאה").`;

    const response = await callWithRetry(() => ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            predictionReasoning: { type: Type.STRING },
            estimatedMinutes: { type: Type.NUMBER },
            formattedEtaMessage: { type: Type.STRING }
          },
          required: ["predictionReasoning", "estimatedMinutes", "formattedEtaMessage"]
        }
      }
    }));

    const parsedEta = JSON.parse(response.text || "{}");
    res.json(parsedEta);
  } catch (error: any) {
    console.error("ETA Prediction Error:", error);
    res.status(500).json({ error: error.message || "Error occurred predicting destination analytics." });
  }
});

// Configure Vite middleware and catch-alls
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[SabanOS Server] Started on http://localhost:${PORT}`);
  });
}

startServer();
