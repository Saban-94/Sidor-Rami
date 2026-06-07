import express from "express";
import path from "path";
import dotenv from "dotenv";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";

dotenv.config();

const app = express();
app.use(express.json());

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

// Check api health
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", time: new Date().toISOString() });
});

/**
 * 1. AI Chat Endpoint with 'Noa'
 */
app.post("/api/gemini/chat", async (req, res) => {
  try {
    const { message, history } = req.body;
    if (!message) {
       res.status(400).json({ error: "Message is required" });
       return;
    }

    const ai = getGeminiClient();
    
    // Inject Hebrew-centric Saban Operational personality instructions
    const systemInstruction = `אתה "נועה" (Noa), העוזרת הדיגיטלית החכמה של חברת הלוגיסטיקה וההובלות "ח. סבן הובלות וכלים בע"מ" (H. Saban Logistics).
תפקידך לסייע למנהלים, סדרנים ונהגים בניהול השוטף מהשטח:
- ניתוח ואופטימיזציית הזמנות, נהגים ומלאי.
- חיזוי זמני הגעה (ETA).
- עזרה בקליטת קובצי לוגים/אקסל של קומקס (Comax) ואינטגרציות נוספות.
- השב תמיד בצורה סופר-מקצועית, סמכותית, ברורה ונעימה בעברית שוטפת ונבונה.
- שים דגש על לוגיסטיקה קפדנית, סדר ויעילות עבודה מקסימלית בשטח.`;

    const chatHistory = history ? history.map((h: any) => ({
      role: h.role === "user" ? "user" : "model",
      parts: [{ text: h.content }]
    })) : [];

    const chatInstance = ai.chats.create({
      model: "gemini-3.5-flash",
      config: {
        systemInstruction,
        temperature: 0.7,
      },
      history: chatHistory
    });

    const response = await chatInstance.sendMessage({ message });
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

    const response = await ai.models.generateContent({
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
    });

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

    const response = await ai.models.generateContent({
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
    });

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
