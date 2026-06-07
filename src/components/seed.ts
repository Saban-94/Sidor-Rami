import { collection, getDocs, doc, setDoc } from "firebase/firestore";
import { db } from "../firebase";
import { Order, Driver, InventoryItem, Customer, Reminder, TeamChatMessage } from "../types";

const INITIAL_DRIVERS: Driver[] = [
  {
    name: "אלירן סבן",
    phone: "052-8884949",
    vehicleType: "truck",
    plateNumber: "12-345-67",
    status: "active",
    totalDeliveries: 142,
    onTimeRate: 98,
    rating: 4.9
  },
  {
    name: "מוסטפא אל-חמיד",
    phone: "054-7771234",
    vehicleType: "crane",
    plateNumber: "98-765-43",
    status: "busy",
    totalDeliveries: 89,
    onTimeRate: 94,
    rating: 4.7
  },
  {
    name: "שמעון אוחיון",
    phone: "050-5556789",
    vehicleType: "truck",
    plateNumber: "55-666-77",
    status: "active",
    totalDeliveries: 230,
    onTimeRate: 99,
    rating: 5.0
  },
  {
    name: "ולדימיר יעקובלעב",
    phone: "053-4449876",
    vehicleType: "crane",
    plateNumber: "33-222-11",
    status: "offline",
    totalDeliveries: 64,
    onTimeRate: 91,
    rating: 4.5
  }
];

const INITIAL_CUSTOMERS: Customer[] = [
  {
    name: "סולל בונה מרכז",
    customerNumber: "C10492",
    contactPerson: "גדעון כהן",
    phoneNumber: "03-6009999",
    driveFolderId: "drive-folder-solel-boneh-101"
  },
  {
    name: "אשטרום הנדסה ותשתיות",
    customerNumber: "C23955",
    contactPerson: "רונית לוי",
    phoneNumber: "09-9508888",
    driveFolderId: "drive-folder-ashtrom-main"
  },
  {
    name: "שפיר מגורים",
    customerNumber: "C80221",
    contactPerson: "אריאל סבן",
    phoneNumber: "02-5004444",
    driveFolderId: "drive-folder-shapir-jerusalem"
  }
];

const INITIAL_INVENTORY: InventoryItem[] = [
  {
    sku: "SKU-CR-CHAIN-10",
    name: "שרשרת הרמה מנוף 10 מטר",
    description: "רצועת פלדה עבה במיוחד מוסמכת לתקן עומס 15 טון",
    unit: "יחידה",
    currentStock: 12,
    minStock: 5,
    price: 1850,
    category: "ציוד הרמה"
  },
  {
    sku: "SKU-CON-PAL-50",
    name: "משטחי קשירה קונסטרוקטיבים",
    description: "משטחי עגינה מאושרים לפריקה בגובה רב",
    unit: "משטח",
    currentStock: 4,
    minStock: 10, // Generates ALERT since current < min!
    price: 450,
    category: "משטחים"
  },
  {
    sku: "SKU-CEM-CAST-A",
    name: "בטון מהיר יציקה סוג א'",
    description: "שקי מלט 50 ק\"ג עמידות מהירה לעבודות דרך ותשתית",
    unit: "שק",
    currentStock: 150,
    minStock: 40,
    price: 32,
    category: "חומרי גלם"
  },
  {
    sku: "SKU-ANCHOR-SET",
    name: "סט עגינות וברגי ג'מבו מחוזקים",
    description: "ברגי עיגון עומס כבד ליציקות קונסטרוקציה",
    unit: "מארז",
    currentStock: 8,
    minStock: 15, // Generates ALERT
    price: 120,
    category: "מחברים"
  }
];

const INITIAL_ORDERS: Order[] = [
  {
    date: "2026-06-06",
    time: "08:30",
    driverId: "eliran_saban",
    customerName: "סולל בונה מרכז",
    orderNumber: "ORD-9481",
    destination: "דרך בגין 132, תל אביב",
    items: "4 משטחי בטון מהיר + שרשראות הרמה",
    warehouse: "חצר אשדוד",
    documentIds: "תעודת משלוח #T-1002",
    status: "in_transit",
    eta: "הגעה ב-16:15 סמוך לפקקים"
  },
  {
    date: "2026-06-06",
    time: "11:00",
    driverId: "mustafa_alhamid",
    customerName: "אשטרום הנדסה ותשתיות",
    orderNumber: "ORD-8452",
    destination: "שד' אבא אבן 10, הרצליה פיתוח",
    items: "סט ברגים מחוזקים + משטח עגינה",
    warehouse: "חצר שפד\"ן",
    documentIds: "חשבונית #INV-492",
    status: "pending",
    eta: "בוצע ניתוח צפי: 50 דקות יציאה"
  },
  {
    date: "2026-06-05",
    time: "15:30",
    driverId: "shimon_ohayon",
    customerName: "שפיר מגורים",
    orderNumber: "ORD-7299",
    destination: "רחוב יפו 210, ירושלים",
    items: "מארזי עגינות וחלקי חילוף למנוף קל",
    warehouse: "מרלו\"ג רמלה",
    documentIds: "תעודה #T-9988",
    status: "delivered",
    eta: "נמסר ב-15:42 בהצלחה"
  }
];

const INITIAL_REMINDERS: Reminder[] = [
  {
    title: "בדיקת רישיונות מנוף מעופף",
    description: "בדיקת הסמכה תקופתית של מוסטפא מול משרד התחבורה",
    dueDate: "2026-06-08",
    dueTime: "10:00",
    isCompleted: false,
    orderId: "ORD-8452"
  },
  {
    title: "חידוש ביטוח חובה למשאית מוביל",
    description: "לוודא אל מול הנהג אלירן שפוליסת סבן הובלות מעודכנת",
    dueDate: "2026-06-12",
    isCompleted: false
  }
];

const INITIAL_CHAT: TeamChatMessage[] = [
  {
    senderId: "sys",
    senderName: "מערכת SabanOS",
    text: "מערכת SabanOS פעילה ומוכנה לשירות רכבי המטען והמנופים של H. Saban Logistics.",
    timestamp: new Date().toISOString()
  }
];

export async function seedInitialFirestoreData() {
  try {
    // Check if configuration already seeded
    const orderTest = await getDocs(collection(db, "orders"));
    if (!orderTest.empty) {
      console.log("Firestore already loaded with data. Skipping seeding.");
      return;
    }

    console.log("Initial seeding started...");

    // 1. Seed Drivers
    for (const d of INITIAL_DRIVERS) {
      // Use standard normalized clean ID for document mapping to avoid character collisions
      const docId = d.name.includes("אלירן") ? "eliran_saban" :
                    d.name.includes("מוסטפא") ? "mustafa_alhamid" :
                    d.name.includes("שמעון") ? "shimon_ohayon" : "vladimir_yakov";
      await setDoc(doc(db, "drivers", docId), d);
    }

    // 2. Seed Customers
    for (const c of INITIAL_CUSTOMERS) {
      const docId = c.customerNumber.toLowerCase();
      await setDoc(doc(db, "customers", docId), c);
    }

    // 3. Seed Inventory
    for (const i of INITIAL_INVENTORY) {
      const docId = i.sku.toLowerCase();
      await setDoc(doc(db, "inventory", docId), i);
    }

    // 4. Seed Orders
    for (const o of INITIAL_ORDERS) {
      const docId = o.orderNumber.toLowerCase();
      await setDoc(doc(db, "orders", docId), o);
    }

    // 5. Seed Reminders
    for (let rIdx = 0; rIdx < INITIAL_REMINDERS.length; rIdx++) {
      const docId = `rem_${rIdx + 1}`;
      await setDoc(doc(db, "reminders", docId), INITIAL_REMINDERS[rIdx]);
    }

    // 6. Seed messages
    for (let mIdx = 0; mIdx < INITIAL_CHAT.length; mIdx++) {
      const docId = `msg_${mIdx + 1}`;
      await setDoc(doc(db, "office_messages", docId), INITIAL_CHAT[mIdx]);
    }

    console.log("Firebase storage successfully seeded with H. Saban records.");
  } catch (error) {
    console.error("Failed to seed database records:", error);
  }
}
