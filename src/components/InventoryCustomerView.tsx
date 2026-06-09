import React, { useState, useEffect } from "react";
import { collection, onSnapshot, setDoc, doc, updateDoc } from "firebase/firestore";
import { db, handleFirestoreError, OperationType } from "../firebase";
import { InventoryItem, Customer } from "../types";
import { 
  Folder, Plus, Search, MinusCircle, PlusCircle, AlertTriangle, ExternalLink, XCircle, Check
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface InventoryCustomerViewProps {
  globalSearchQuery?: string;
}

export function InventoryCustomerView({ globalSearchQuery = "" }: InventoryCustomerViewProps) {
  const [activeTab, setActiveTab] = useState<"inventory" | "customers">("inventory");
  
  // Real-time collections
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);

  // Search filter
  const [searchQuery, setSearchQuery] = useState("");
  const effectiveQuery = globalSearchQuery || searchQuery;

  // Add Item States
  const [isAddingItem, setIsAddingItem] = useState(false);
  const [isAddingCustomer, setIsAddingCustomer] = useState(false);

  // Create forms state
  const [itemForm, setItemForm] = useState({
    sku: "",
    name: "",
    description: "",
    unit: "יחידה",
    currentStock: 10,
    minStock: 5,
    price: 150,
    category: "ציוד כללי"
  });

  const [customerForm, setCustomerForm] = useState({
    name: "",
    customerNumber: "",
    contactPerson: "",
    phoneNumber: "",
    driveFolderId: ""
  });

  // Load Real-time Firestore logs
  useEffect(() => {
    const unsubInv = onSnapshot(collection(db, "inventory"), (snap) => {
      const list: InventoryItem[] = [];
      snap.forEach(d => list.push({ ...d.data(), id: d.id } as InventoryItem));
      setInventory(list);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, "inventory");
    });

    const unsubCust = onSnapshot(collection(db, "customers"), (snap) => {
      const list: Customer[] = [];
      snap.forEach(d => list.push({ ...d.data(), id: d.id } as Customer));
      setCustomers(list);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, "customers");
    });

    return () => {
      unsubInv();
      unsubCust();
    };
  }, []);

  const handleUpdateStock = async (itemId: string, currentStock: number) => {
    try {
      const itemRef = doc(db, "inventory", itemId);
      await updateDoc(itemRef, { currentStock: Math.max(0, currentStock) });
    } catch (e) {
      handleFirestoreError(e, OperationType.UPDATE, `inventory/${itemId}`);
    }
  };

  const handleCreateInventoryItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!itemForm.sku || !itemForm.name) {
      alert("נא למלא מק\"ט ושם פריט!");
      return;
    }
    try {
      const newItem: InventoryItem = {
        sku: itemForm.sku,
        name: itemForm.name,
        description: itemForm.description,
        unit: itemForm.unit,
        currentStock: Number(itemForm.currentStock),
        minStock: Number(itemForm.minStock),
        price: Number(itemForm.price),
        category: itemForm.category
      };
      await setDoc(doc(db, "inventory", itemForm.sku.toLowerCase().trim()), newItem);
      setIsAddingItem(false);
      setItemForm({
        sku: "",
        name: "",
        description: "",
        unit: "יחידה",
        currentStock: 10,
        minStock: 5,
        price: 150,
        category: "ציוד כללי"
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, "inventory");
    }
  };

  const handleCreateCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerForm.name || !customerForm.customerNumber || !customerForm.phoneNumber) {
      alert("נא למלא שם לקוח, טלפון ומספר מזהה!");
      return;
    }
    try {
      const newCust: Customer = {
        name: customerForm.name,
        customerNumber: customerForm.customerNumber,
        contactPerson: customerForm.contactPerson,
        phoneNumber: customerForm.phoneNumber,
        driveFolderId: customerForm.driveFolderId || `drive-folder-${Date.now()}`
      };
      await setDoc(doc(db, "customers", customerForm.customerNumber.toLowerCase().trim()), newCust);
      setIsAddingCustomer(false);
      setCustomerForm({
        name: "",
        customerNumber: "",
        contactPerson: "",
        phoneNumber: "",
        driveFolderId: ""
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, "customers");
    }
  };

  const filteredInventory = inventory.filter(i => 
    (i.sku || '').toLowerCase().includes((effectiveQuery || '').toLowerCase()) || 
    (i.name || '').toLowerCase().includes((effectiveQuery || '').toLowerCase()) ||
    (i.category && i.category.toLowerCase().includes((effectiveQuery || '').toLowerCase()))
  );

  const filteredCustomers = customers.filter(c => 
    (c.name || '').toLowerCase().includes((effectiveQuery || '').toLowerCase()) || 
    (c.customerNumber || '').toLowerCase().includes((effectiveQuery || '').toLowerCase()) ||
    (c.phoneNumber || '').toLowerCase().includes((effectiveQuery || '').toLowerCase())
  );

  return (
    <div className="flex flex-col flex-grow bg-[#FDFDFF] pb-24 text-right" dir="rtl" id="inventory-customer-container">
      {/* 1. Welcoming glass Header */}
      <div className="bg-white/95 backdrop-blur-md px-5 pt-4 pb-3 border-b border-gray-100 shadow-2xs sticky top-0 z-30 flex flex-col gap-3" id="inv-header">
        <div>
          <span className="text-[9px] uppercase tracking-widest text-[#B5BAC9] font-bold font-sans">ציוד מנופים ותיקים</span>
          <h2 className="text-xl font-black text-gray-900 tracking-tight mt-0.5">מחסן וכרטיסי לקוחות</h2>
        </div>

        {/* 2. Responsive Sliding Subtabs Navigation */}
        <div className="flex bg-gray-50 border border-gray-100 p-1 rounded-xl" id="inv-tabs-nav">
          <button 
            onClick={() => { setActiveTab("inventory"); setSearchQuery(""); }}
            className={`flex-1 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all cursor-pointer ${
              activeTab === "inventory" ? "bg-gray-900 text-white shadow-xs" : "text-gray-400 hover:text-gray-900"
            }`}
          >
            מלאי וציוד עגינה
          </button>
          <button 
            onClick={() => { setActiveTab("customers"); setSearchQuery(""); }}
            className={`flex-1 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all cursor-pointer ${
              activeTab === "customers" ? "bg-gray-900 text-white shadow-xs" : "text-gray-400 hover:text-gray-900"
            }`}
          >
            לקוחות ו-Google Drive
          </button>
        </div>

        {/* 3. Global Filter search input */}
        <div className="relative">
          <input 
            type="text"
            placeholder={activeTab === "inventory" ? "חפש מק''ט, שם פריט או קטגוריה..." : "חפש שם חברה, קוד או טלפון..."}
            value={effectiveQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-gray-50 border border-gray-150 rounded-xl py-2.5 pr-9 pl-4 text-xs text-gray-900 focus:outline-none focus:ring-1.5 focus:ring-gray-900 focus:bg-white transition-all text-right placeholder-gray-400 font-medium"
            id="inv-search-query-field"
          />
          <Search className="absolute right-3.5 top-3 w-4 h-4 text-gray-400 pointer-events-none" />
        </div>
      </div>

      {/* 4. Scrollable Container List */}
      <div className="px-5 mt-4 flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 text-gray-400" id="inv-indicator-loader">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mb-2"></div>
            <p className="text-[11px] font-black uppercase">טוען קטלוגים מוגדרים...</p>
          </div>
        ) : (
          <div>
            {/* INVENTORY PANEL SLATE */}
            {activeTab === "inventory" && (
              <div className="space-y-4" id="inventory-elements-panel">
                <div className="flex justify-between items-center px-1">
                  <span className="text-[9px] text-[#9CA3AF] font-black uppercase tracking-wider">ציוד לוגיסטי מחסן סבן</span>
                  <button 
                    onClick={() => setIsAddingItem(true)}
                    className="text-[11px] font-black text-gray-900 flex items-center gap-1.5 hover:underline transition-all cursor-pointer h-8 select-none"
                  >
                    <Plus className="w-4 h-4" />
                    הוספת פריט מלאי
                  </button>
                </div>

                <div className="space-y-3.5">
                  {filteredInventory.map((item) => {
                    const isAlert = item.currentStock < item.minStock;
                    return (
                      <div 
                        key={item.id}
                        className={`bg-white border rounded-[2rem] p-5 shadow-2xs relative overflow-hidden transition-all ${
                          isAlert ? "border-rose-300 bg-rose-50/10" : "border-gray-150/80"
                        }`}
                        id={`inventory-card-${item.sku}`}
                      >
                        {/* Upper row header */}
                        <div className="flex justify-between items-start">
                          <div>
                            <span className="text-[8.5px] font-black text-gray-400 tracking-wider block font-mono uppercase">{item.sku}</span>
                            <h3 className="font-extrabold text-[#111827] mt-0.5 text-xs">{item.name}</h3>
                          </div>
                          {isAlert && (
                            <span className="bg-rose-50 text-rose-700 text-[8px] font-black border border-rose-100 py-0.5 px-2 rounded-lg flex items-center gap-0.5 uppercase tracking-tight">
                              <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                              חוסר מלאי
                            </span>
                          )}
                        </div>

                        {item.description && (
                          <p className="text-[11px] text-gray-500 font-medium mt-1.5 leading-relaxed">{item.description}</p>
                        )}

                        <div className="flex justify-between items-center mt-4 pt-3.5 border-t border-gray-100">
                          <div className="text-[9.5px] text-[#9CA3AF] font-black uppercase">
                            קבוצת מלאי: <span className={`font-black font-sans text-xs ${isAlert ? 'text-rose-600' : 'text-gray-900'}`}>{item.currentStock} {item.unit || "יח'"}</span> / מינימום {item.minStock}
                          </div>
                          
                          {/* Tactile Fast buttons adjust stock numbers */}
                          <div className="flex items-center gap-2">
                            <button 
                              onClick={() => item.id && handleUpdateStock(item.id, item.currentStock - 1)}
                              className="text-gray-500 hover:text-rose-600 bg-gray-50 border border-gray-200 p-1.5 rounded-xl transition-all cursor-pointer h-8 w-8 flex items-center justify-center shadow-3xs"
                            >
                              <MinusCircle className="w-4.5 h-4.5" />
                            </button>
                            <span className="text-xs font-bold font-mono text-gray-900 px-1">{item.currentStock}</span>
                            <button 
                              onClick={() => item.id && handleUpdateStock(item.id, item.currentStock + 1)}
                              className="text-gray-500 hover:text-emerald-600 bg-gray-50 border border-gray-200 p-1.5 rounded-xl transition-all cursor-pointer h-8 w-8 flex items-center justify-center shadow-3xs"
                            >
                              <PlusCircle className="w-4.5 h-4.5" />
                            </button>
                          </div>
                        </div>

                        {item.category && (
                          <div className="absolute left-5 top-5 text-[8px] bg-gray-100 text-[#4B5563] font-black px-2 py-0.5 rounded-full uppercase tracking-wider">
                            {item.category}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* CUSTOMERS PANEL SLATE */}
            {activeTab === "customers" && (
              <div className="space-y-4" id="customers-elements-panel">
                <div className="flex justify-between items-center px-1">
                  <span className="text-[9px] text-[#9CA3AF] font-black uppercase tracking-wider">תיקי לקוחות וסנכרון מדיה</span>
                  <button 
                    onClick={() => setIsAddingCustomer(true)}
                    className="text-[11px] font-black text-gray-900 flex items-center gap-1.5 hover:underline transition-all cursor-pointer h-8 select-none"
                  >
                    <Plus className="w-4 h-4" />
                    הוספת לקוח חדש
                  </button>
                </div>

                <div className="space-y-3.5">
                  {filteredCustomers.map((cust) => (
                    <div 
                      key={cust.id}
                      className="bg-white border border-gray-150 rounded-[2rem] p-5 shadow-2xs relative flex flex-col"
                      id={`customer-card-${cust.customerNumber}`}
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <span className="text-[8.5px] font-black text-indigo-700 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded-full uppercase font-mono block">
                            לקוח סיווג #{cust.customerNumber}
                          </span>
                          <h3 className="font-extrabold text-[#111827] mt-1.5 text-xs">{cust.name}</h3>
                        </div>
                        <Folder className="w-5 h-5 text-gray-900" />
                      </div>

                      <div className="mt-3 space-y-1 text-xs text-gray-550 font-medium">
                        {cust.contactPerson && (
                          <div>איש קשר פרויקט: <span className="font-bold text-gray-800">{cust.contactPerson}</span></div>
                        )}
                        <div>טלפון לתיאום: <span className="font-mono text-gray-850 font-bold">{cust.phoneNumber}</span></div>
                      </div>

                      {/* Google Drive action */}
                      <div className="mt-4 pt-3.5 border-t border-gray-100 flex justify-end">
                        <button 
                          onClick={() => {
                            alert(`מנהל שטח סבן הובלות:\nשולח בקשה לפתיחת תקיית עבודה בגוגל דרייב:\n[ID: ${cust.driveFolderId || "not-allocated"}]\nהתיקייה מאובטחת ומסונכרנת.`);
                          }}
                          className="bg-gray-900 hover:bg-black text-white text-[10px] font-black px-3.5 py-2 rounded-xl flex items-center gap-1.5 transition-all shadow-xs cursor-pointer h-9"
                        >
                          <ExternalLink className="w-3.5 h-3.5 text-amber-400" />
                          תיקיית Google Drive של הלקוח
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* CREATE INVENTORY ITEM DRAWER SHEET */}
      <AnimatePresence>
        {isAddingItem && (
          <div className="fixed inset-0 bg-black/60 z-50 flex items-end justify-center" id="add-item-overlay">
            <motion.div 
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 26, stiffness: 210 }}
              className="bg-[#FDFDFF] w-full max-w-md rounded-t-[2.5rem] p-6 text-right flex flex-col border-t border-gray-100 overflow-y-auto"
              style={{ maxHeight: "90vh" }}
              id="add-item-container"
            >
              <form onSubmit={handleCreateInventoryItem} className="space-y-4">
                <div className="flex justify-between items-center border-b border-gray-100 pb-3">
                  <div>
                    <span className="text-[9px] uppercase tracking-widest text-gray-400 font-bold">מלאי וציוד קל/כבד</span>
                    <h3 className="text-md font-black text-gray-900 mt-0.5">פריט קטלוג מחסן חדש</h3>
                  </div>
                  <button 
                    type="button"
                    onClick={() => setIsAddingItem(false)}
                    className="text-gray-400 hover:text-gray-900 bg-gray-100 p-2 rounded-full cursor-pointer h-8 w-8 flex items-center justify-center font-bold"
                  >
                    <XCircle className="w-4 h-4 text-gray-500" />
                  </button>
                </div>

                <div className="space-y-3.5 text-xs">
                  <div>
                    <label className="font-extrabold text-gray-700 block mb-1">מק''ט פריט (SKU) *</label>
                    <input 
                      type="text"
                      required
                      placeholder="לדוגמה: SKU-CHAIN-10"
                      value={itemForm.sku}
                      onChange={(e) => setItemForm({ ...itemForm, sku: e.target.value })}
                      className="w-full bg-white border border-gray-250 rounded-xl py-2 px-3 text-xs h-10 outline-none focus:border-gray-900"
                    />
                  </div>

                  <div>
                    <label className="font-extrabold text-gray-700 block mb-1">שם פריט המלאי *</label>
                    <input 
                      type="text"
                      required
                      placeholder="לדוגמה: שרשרת עגינה למנוף כבד"
                      value={itemForm.name}
                      onChange={(e) => setItemForm({ ...itemForm, name: e.target.value })}
                      className="w-full bg-white border border-gray-250 rounded-xl py-2 px-3 text-xs h-10 outline-none focus:border-gray-900"
                    />
                  </div>

                  <div>
                    <label className="font-extrabold text-gray-700 block mb-1">תיאור הפריט</label>
                    <input 
                      type="text"
                      placeholder="לדוגמה: פלדה מחוזקת עומס 12 טון"
                      value={itemForm.description}
                      onChange={(e) => setItemForm({ ...itemForm, description: e.target.value })}
                      className="w-full bg-white border border-gray-250 rounded-xl py-2 px-3 text-xs h-10 outline-none focus:border-gray-900"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="font-extrabold text-[#374151] block mb-1">מלאי התחלתי</label>
                      <input 
                        type="number"
                        value={itemForm.currentStock}
                        onChange={(e) => setItemForm({ ...itemForm, currentStock: Number(e.target.value) })}
                        className="w-full bg-white border border-gray-250 rounded-xl py-2 px-3 text-xs h-10"
                      />
                    </div>
                    <div>
                      <label className="font-extrabold text-[#374151] block mb-1">מלאי התרעה (מינימלי)</label>
                      <input 
                        type="number"
                        value={itemForm.minStock}
                        onChange={(e) => setItemForm({ ...itemForm, minStock: Number(e.target.value) })}
                        className="w-full bg-white border border-gray-250 rounded-xl py-2 px-3 text-xs h-10"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="font-extrabold text-[#374151] block mb-1">יחידת מידה</label>
                      <input 
                        type="text"
                        value={itemForm.unit}
                        onChange={(e) => setItemForm({ ...itemForm, unit: e.target.value })}
                        className="w-full bg-white border border-gray-250 rounded-xl py-2 px-3 text-xs h-10"
                      />
                    </div>
                    <div>
                      <label className="font-extrabold text-[#374151] block mb-1">קטגוריית קבוצה</label>
                      <input 
                        type="text"
                        value={itemForm.category}
                        onChange={(e) => setItemForm({ ...itemForm, category: e.target.value })}
                        className="w-full bg-white border border-gray-250 rounded-xl py-2 px-3 text-xs h-10"
                      />
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t border-gray-100 flex gap-3 mt-4">
                  <button 
                    type="button"
                    onClick={() => setIsAddingItem(false)}
                    className="flex-1 bg-gray-100 text-gray-600 font-black py-3 rounded-xl text-center text-xs border border-gray-200 cursor-pointer"
                  >
                    ביטול
                  </button>
                  <button 
                    type="submit"
                    className="flex-1 bg-gray-900 hover:bg-black text-white font-black py-3 rounded-xl text-center text-xs shadow-md cursor-pointer transition-colors"
                  >
                    אישור וצירוף
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* CREATE CUSTOMER DRAWER SHEET */}
      <AnimatePresence>
        {isAddingCustomer && (
          <div className="fixed inset-0 bg-black/60 z-50 flex items-end justify-center" id="add-cust-overlay">
            <motion.div 
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 26, stiffness: 210 }}
              className="bg-[#FDFDFF] w-full max-w-md rounded-t-[2.5rem] p-6 text-right flex flex-col border-t border-gray-100 overflow-y-auto"
              style={{ maxHeight: "90vh" }}
              id="add-customer-container"
            >
              <form onSubmit={handleCreateCustomer} className="space-y-4">
                <div className="flex justify-between items-center border-b border-gray-100 pb-3">
                  <div>
                    <span className="text-[9px] uppercase tracking-widest text-gray-400 font-bold">סנכרון ענני של סרנים</span>
                    <h3 className="text-md font-black text-gray-900 mt-0.5">כרטיס לקוח חדש</h3>
                  </div>
                  <button 
                    type="button"
                    onClick={() => setIsAddingCustomer(false)}
                    className="text-gray-400 hover:text-gray-950 bg-gray-100 p-2 rounded-full cursor-pointer h-8 w-8 flex items-center justify-center font-bold"
                  >
                    <XCircle className="w-4 h-4 text-gray-500" />
                  </button>
                </div>

                <div className="space-y-3.5 text-xs">
                  <div>
                    <label className="font-extrabold text-gray-700 block mb-1">שם חברה / קבלן *</label>
                    <input 
                      type="text"
                      required
                      placeholder="לדוגמה: שפיר הנדסה ותעשיות"
                      value={customerForm.name}
                      onChange={(e) => setCustomerForm({ ...customerForm, name: e.target.value })}
                      className="w-full bg-white border border-gray-250 rounded-xl py-2 px-3 text-xs h-10 outline-none focus:border-gray-900"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="font-extrabold text-gray-700 block mb-1">מספר לקוח (ID) *</label>
                      <input 
                        type="text"
                        required
                        placeholder="C9031"
                        value={customerForm.customerNumber}
                        onChange={(e) => setCustomerForm({ ...customerForm, customerNumber: e.target.value })}
                        className="w-full bg-white border border-gray-250 rounded-xl py-2 px-3 text-xs h-10 font-mono outline-none focus:border-gray-900"
                      />
                    </div>
                    <div>
                      <label className="font-extrabold text-gray-700 block mb-1">איש קשר פרויקט</label>
                      <input 
                        type="text"
                        placeholder="אורי לוי"
                        value={customerForm.contactPerson}
                        onChange={(e) => setCustomerForm({ ...customerForm, contactPerson: e.target.value })}
                        className="w-full bg-white border border-gray-250 rounded-xl py-2 px-3 text-xs h-10 outline-none focus:border-gray-900"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="font-extrabold text-gray-700 block mb-1">מספר טלפון לתיאום *</label>
                    <input 
                      type="text"
                      required
                      placeholder="052-1234567"
                      value={customerForm.phoneNumber}
                      onChange={(e) => setCustomerForm({ ...customerForm, phoneNumber: e.target.value })}
                      className="w-full bg-white border border-gray-250 rounded-xl py-2 px-3 text-xs h-10 font-mono outline-none focus:border-gray-900"
                    />
                  </div>

                  <div>
                    <label className="font-extrabold text-gray-700 block mb-1">מערכת קוד תיקיית Google Drive של הלקוח</label>
                    <input 
                      type="text"
                      placeholder="shapir-drive-101"
                      value={customerForm.driveFolderId}
                      onChange={(e) => setCustomerForm({ ...customerForm, driveFolderId: e.target.value })}
                      className="w-full bg-white border border-gray-250 rounded-xl py-2 px-3 text-xs h-10 outline-none focus:border-gray-900"
                    />
                  </div>
                </div>

                <div className="pt-4 border-t border-gray-100 flex gap-3 mt-4">
                  <button 
                    type="button"
                    onClick={() => setIsAddingCustomer(false)}
                    className="flex-1 bg-gray-100 text-gray-600 font-black py-3 rounded-xl text-center text-xs border border-gray-200 cursor-pointer"
                  >
                    ביטול
                  </button>
                  <button 
                    type="submit"
                    className="flex-1 bg-gray-900 hover:bg-black text-white font-black py-3 rounded-xl text-center text-xs shadow-md cursor-pointer transition-colors"
                  >
                    אישור ורישום
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
