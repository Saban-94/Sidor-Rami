import React, { useState, useEffect } from "react";
import { collection, onSnapshot, setDoc, doc, updateDoc, deleteDoc } from "firebase/firestore";
import { db, handleFirestoreError, OperationType } from "../firebase";
import { InventoryItem, Customer } from "../types";
import { 
  Building2, Box, Archive, Folder, ExternalLink, AlertTriangle, Check, Plus, Trash, Search, DollarSign, Layers, PlusCircle, MinusCircle, ShieldCheck
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

export function InventoryCustomerView() {
  const [activeTab, setActiveTab] = useState<"inventory" | "customers">("inventory");
  
  // Real-time collections
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);

  // Search filter
  const [searchQuery, setSearchQuery] = useState("");

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
      alert("נא למלא מק\"ט ושם פריט שבועיים!");
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
    (i.sku || '').toLowerCase().includes((searchQuery || '').toLowerCase()) || 
    (i.name || '').toLowerCase().includes((searchQuery || '').toLowerCase()) ||
    (i.category && i.category.toLowerCase().includes((searchQuery || '').toLowerCase()))
  );

  const filteredCustomers = customers.filter(c => 
    (c.name || '').toLowerCase().includes((searchQuery || '').toLowerCase()) || 
    (c.customerNumber || '').toLowerCase().includes((searchQuery || '').toLowerCase()) ||
    (c.phoneNumber || '').toLowerCase().includes((searchQuery || '').toLowerCase())
  );

  return (
    <div className="flex flex-col flex-1 bg-[#FDFDFF] pb-24 text-right" dir="rtl" id="inventory-customer-container">
      {/* Visual Hub header with glass controls */}
      <div className="bg-white px-5 py-4 border-b border-gray-100 shadow-2xs" id="inv-header">
        <h2 className="text-xl font-black text-gray-900 tracking-tight font-sans">ציוד ומסמכי לקוחות</h2>
        <p className="text-[10px] uppercase tracking-widest text-[#B5BAC9] font-bold">מעקב קטגוריות, תעודות ו-Google Drive</p>
        
        {/* Toggle subtabs */}
        <div className="flex bg-gray-100 p-1 rounded-2xl mt-4" id="inv-tabs-nav">
          <button 
            onClick={() => { setActiveTab("inventory"); setSearchQuery(""); }}
            className={`flex-1 py-2 rounded-xl text-[10px] font-extrabold uppercase tracking-wide transition-all ${
              activeTab === "inventory" ? "bg-gray-900 text-white shadow font-black" : "text-gray-400 hover:text-gray-900"
            }`}
          >
            מלאי וציוד עגינה
          </button>
          <button 
            onClick={() => { setActiveTab("customers"); setSearchQuery(""); }}
            className={`flex-1 py-1.5 rounded-xl text-[10px] font-extrabold uppercase tracking-wide transition-all ${
              activeTab === "customers" ? "bg-gray-900 text-white shadow font-black" : "text-gray-400 hover:text-gray-950"
            }`}
          >
            לקוחות ו-Google Drive
          </button>
        </div>

        {/* Global Local filter search input */}
        <div className="relative mt-4">
          <input 
            type="text"
            placeholder={activeTab === "inventory" ? "חפש מק\"ט, שם פריט, קטגוריה..." : "חפש שם לקוח, טלפון, קוד לקוח..."}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-gray-50 border border-gray-200 rounded-2xl py-2.5 pr-10 pl-4 text-xs text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-950 transition-all text-right placeholder-gray-400 font-medium"
            id="inv-search-query-field"
          />
          <Search className="absolute right-3.5 top-3.5 w-4 h-4 text-gray-400 pointer-events-none" />
        </div>
      </div>

      <div className="px-4 mt-6 flex-grow overflow-y-auto">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-gray-550" id="inv-indicator-loader">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mb-2"></div>
            <p className="text-xs">טוען קטלוגים...</p>
          </div>
        ) : (
          <div>
            {/* INVENTORY TAB SCREEN */}
            {activeTab === "inventory" && (
              <div className="space-y-4" id="inventory-elements-panel">
                <div className="flex justify-between items-center px-1">
                  <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">ציוד לוגיסטי מחסן</span>
                  <button 
                    onClick={() => setIsAddingItem(true)}
                    className="text-xs font-bold text-gray-950 flex items-center gap-1 hover:underline transition-all"
                  >
                    <Plus className="w-4 h-4" />
                    צרף פריט קטלוג
                  </button>
                </div>

                <div className="flex flex-col gap-4">
                  {filteredInventory.map((item) => {
                    const isAlert = item.currentStock < item.minStock;
                    return (
                      <div 
                        key={item.id}
                        className={`bg-white/80 backdrop-blur-xl border rounded-[2rem] p-5 shadow-xs relative transition-all ${
                          isAlert ? "border-rose-300 bg-rose-50/10" : "border-gray-150"
                        }`}
                        id={`inventory-card-${item.sku}`}
                      >
                        {/* Upper row */}
                        <div className="flex justify-between items-start">
                          <div>
                            <span className="text-[8px] font-black text-gray-400 tracking-wider block font-mono uppercase">{item.sku}</span>
                            <h3 className="font-extrabold text-gray-900 mt-0.5 text-xs">{item.name}</h3>
                          </div>
                          {isAlert && (
                            <span className="bg-rose-50 text-rose-700 text-[8px] font-black border border-rose-100 py-0.5 px-2 rounded-full flex items-center gap-1 uppercase tracking-tight">
                              <AlertTriangle className="w-3 h-3 text-rose-605" />
                              חוסר במלאי!
                            </span>
                          )}
                        </div>

                        {item.description && (
                          <p className="text-[11px] text-gray-500 font-medium mt-1.5 leading-relaxed">{item.description}</p>
                        )}

                        <div className="flex justify-between items-center mt-3 pt-3 border-t border-gray-100">
                          <div className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">
                            מלאי נוכחי: <span className={`font-black ${isAlert ? 'text-rose-750' : 'text-gray-900'}`}>{item.currentStock} {item.unit || "יח'"}</span> / מינימום {item.minStock}
                          </div>
                          
                          {/* Stock adjustment fast controls */}
                          <div className="flex items-center gap-1.5">
                            <button 
                              onClick={() => item.id && handleUpdateStock(item.id, item.currentStock - 1)}
                              className="text-gray-550 hover:text-rose-700 bg-gray-50 border border-gray-150 p-1.5 rounded-xl active:scale-95 transition-all"
                            >
                              <MinusCircle className="w-4 h-4" />
                            </button>
                            <span className="text-xs font-black font-mono px-1">{item.currentStock}</span>
                            <button 
                              onClick={() => item.id && handleUpdateStock(item.id, item.currentStock + 1)}
                              className="text-gray-555 hover:text-emerald-700 bg-gray-50 border border-gray-150 p-1.5 rounded-xl active:scale-95 transition-all"
                            >
                              <PlusCircle className="w-4 h-4" />
                            </button>
                          </div>
                        </div>

                        {item.category && (
                          <div className="absolute left-5 top-5 text-[8px] bg-gray-100 text-gray-500 font-black px-2 py-0.5 rounded-full uppercase tracking-wider">
                            {item.category}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* CUSTOMERS TAB SCREEN */}
            {activeTab === "customers" && (
              <div className="space-y-4" id="customers-elements-panel">
                <div className="flex justify-between items-center px-1">
                  <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">לקוחות ו-Google Drive</span>
                  <button 
                    onClick={() => setIsAddingCustomer(true)}
                    className="text-xs font-bold text-gray-950 flex items-center gap-1 hover:underline transition-all"
                  >
                    <Plus className="w-4 h-4" />
                    צרף לקוח חדש
                  </button>
                </div>

                <div className="flex flex-col gap-4">
                  {filteredCustomers.map((cust) => (
                    <div 
                      key={cust.id}
                      className="bg-white/80 backdrop-blur-xl border border-gray-150 rounded-[2rem] p-5 shadow-xs relative flex flex-col"
                      id={`customer-card-${cust.customerNumber}`}
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <span className="text-[8px] font-black text-gray-450 tracking-wider block font-mono bg-gray-50 border border-gray-150 px-2 py-0.5 rounded-full uppercase">
                            לקוח #{cust.customerNumber}
                          </span>
                          <h3 className="font-extrabold text-gray-900 mt-1.5 text-xs">{cust.name}</h3>
                        </div>
                        <Folder className="w-5 h-5 text-gray-900" />
                      </div>

                      <div className="mt-3 space-y-1 text-xs text-gray-500 font-medium">
                        {cust.contactPerson && (
                          <div>איש קשר בשטח: <span className="font-bold text-gray-900">{cust.contactPerson}</span></div>
                        )}
                        <div>מספר טלפון: <span className="font-mono text-gray-900 font-bold">{cust.phoneNumber}</span></div>
                      </div>

                      {/* Launch Drive Simulation Button */}
                      <div className="mt-4 pt-3 border-t border-gray-100 flex justify-end">
                        <button 
                          onClick={() => {
                            alert(`מנהל שטח סבן הובלות:\nשולח בקשה לפתיחת תקיית עבודה בגוגל דרייב:\n[ID: ${cust.driveFolderId || "not-allocated"}]\nהתיקייה מאובטחת ומסונכרנת.`);
                          }}
                          className="bg-gray-900 hover:bg-black text-white text-[10px] font-bold px-3.5 py-2 rounded-xl flex items-center gap-1.5 transition-all shadow-sm"
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

      {/* CREATE INVENTORY ITEM DIALOG OVERLAY */}
      <AnimatePresence>
        {isAddingItem && (
          <div className="fixed inset-0 bg-black/60 z-50 flex items-end justify-center" id="add-item-overlay">
            <motion.div 
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 220 }}
              className="bg-[#FDFDFF] w-full max-w-md rounded-t-3xl max-h-[90vh] p-6 text-right flex flex-col justify-between border-t border-gray-200 overflow-y-auto"
              id="add-item-container"
            >
              <form onSubmit={handleCreateInventoryItem} className="space-y-4">
                <div className="flex justify-between items-center">
                  <h2 className="text-md font-bold text-gray-900">רישום פריט מלאי חדש</h2>
                  <button 
                    type="button"
                    onClick={() => setIsAddingItem(false)}
                    className="text-gray-400 hover:text-gray-600 font-bold"
                  >
                    סגור
                  </button>
                </div>

                <div className="space-y-3 text-xs">
                  <div>
                    <label className="font-semibold block mb-1">מק\"ט פריט (SKU) *</label>
                    <input 
                      type="text"
                      required
                      placeholder="לדוגמה: SKU-CHAIN-10"
                      value={itemForm.sku}
                      onChange={(e) => setItemForm({ ...itemForm, sku: e.target.value })}
                      className="w-full bg-white border border-gray-300 rounded-xl py-2 px-3 text-xs"
                    />
                  </div>

                  <div>
                    <label className="font-semibold block mb-1">שם הפריט *</label>
                    <input 
                      type="text"
                      required
                      placeholder="שרשרת הרמה מנועה"
                      value={itemForm.name}
                      onChange={(e) => setItemForm({ ...itemForm, name: e.target.value })}
                      className="w-full bg-white border border-gray-300 rounded-xl py-2 px-3 text-xs"
                    />
                  </div>

                  <div>
                    <label className="font-semibold block mb-1">תיאור הפריט</label>
                    <input 
                      type="text"
                      placeholder="עומס מותר 12 טון פלדה יצוקה"
                      value={itemForm.description}
                      onChange={(e) => setItemForm({ ...itemForm, description: e.target.value })}
                      className="w-full bg-white border border-gray-300 rounded-xl py-2 px-3 text-xs"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="font-semibold block mb-1">מלאי נוכחי</label>
                      <input 
                        type="number"
                        value={itemForm.currentStock}
                        onChange={(e) => setItemForm({ ...itemForm, currentStock: Number(e.target.value) })}
                        className="w-full bg-white border border-gray-300 rounded-xl py-2 px-3 text-xs"
                      />
                    </div>
                    <div>
                      <label className="font-semibold block mb-1">מלאי מינימום (התרעה)</label>
                      <input 
                        type="number"
                        value={itemForm.minStock}
                        onChange={(e) => setItemForm({ ...itemForm, minStock: Number(e.target.value) })}
                        className="w-full bg-white border border-gray-300 rounded-xl py-2 px-3 text-xs"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="font-semibold block mb-1">יחידת מידה</label>
                      <input 
                        type="text"
                        value={itemForm.unit}
                        onChange={(e) => setItemForm({ ...itemForm, unit: e.target.value })}
                        className="w-full bg-white border border-gray-300 rounded-xl py-2 px-3 text-xs"
                      />
                    </div>
                    <div>
                      <label className="font-semibold block mb-1">קטגוריה</label>
                      <input 
                        type="text"
                        value={itemForm.category}
                        onChange={(e) => setItemForm({ ...itemForm, category: e.target.value })}
                        className="w-full bg-white border border-gray-300 rounded-xl py-2 px-3 text-xs"
                      />
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t border-gray-150 flex gap-3">
                  <button 
                    type="button"
                    onClick={() => setIsAddingItem(false)}
                    className="flex-1 bg-gray-150 text-gray-750 font-bold py-2 rounded-xl text-center text-xs"
                  >
                    ביטול
                  </button>
                  <button 
                    type="submit"
                    className="flex-1 bg-gray-900 text-white font-bold py-2 rounded-xl text-center text-xs shadow-md"
                  >
                    צרף פריט
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* CREATE CUSTOMER DIALOG OVERLAY */}
      <AnimatePresence>
        {isAddingCustomer && (
          <div className="fixed inset-0 bg-black/60 z-50 flex items-end justify-center" id="add-cust-overlay">
            <motion.div 
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 220 }}
              className="bg-[#FDFDFF] w-full max-w-md rounded-t-3xl max-h-[90vh] p-6 text-right flex flex-col justify-between border-t border-gray-200 overflow-y-auto"
              id="add-customer-container"
            >
              <form onSubmit={handleCreateCustomer} className="space-y-4">
                <div className="flex justify-between items-center">
                  <h2 className="text-md font-bold text-gray-900">רישום כרטיס לקוח יומי</h2>
                  <button 
                    type="button"
                    onClick={() => setIsAddingCustomer(false)}
                    className="text-gray-400 font-bold"
                  >
                    סגור
                  </button>
                </div>

                <div className="space-y-3 text-xs">
                  <div>
                    <label className="font-semibold block mb-1">שם חברה / קבלן *</label>
                    <input 
                      type="text"
                      required
                      placeholder="לדוגמה: אשטרום בע'מ"
                      value={customerForm.name}
                      onChange={(e) => setCustomerForm({ ...customerForm, name: e.target.value })}
                      className="w-full bg-white border border-gray-300 rounded-xl py-2 px-3 text-xs"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="font-semibold block mb-1">מספר לקוח (ID) *</label>
                      <input 
                        type="text"
                        required
                        placeholder="C9031"
                        value={customerForm.customerNumber}
                        onChange={(e) => setCustomerForm({ ...customerForm, customerNumber: e.target.value })}
                        className="w-full bg-white border border-gray-300 rounded-xl py-2 px-3 text-xs"
                      />
                    </div>
                    <div>
                      <label className="font-semibold block mb-1">איש קשר מוביל</label>
                      <input 
                        type="text"
                        placeholder="אורי לוי"
                        value={customerForm.contactPerson}
                        onChange={(e) => setCustomerForm({ ...customerForm, contactPerson: e.target.value })}
                        className="w-full bg-white border border-gray-300 rounded-xl py-2 px-3 text-xs"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="font-semibold block mb-1">מספר טלפון לתיאום *</label>
                    <input 
                      type="text"
                      required
                      placeholder="052-1234567"
                      value={customerForm.phoneNumber}
                      onChange={(e) => setCustomerForm({ ...customerForm, phoneNumber: e.target.value })}
                      className="w-full bg-white border border-gray-300 rounded-xl py-2 px-3 text-xs"
                    />
                  </div>

                  <div>
                    <label className="font-semibold block mb-1">קוד תיקייה בגוגל דרייב (סימולציה)</label>
                    <input 
                      type="text"
                      placeholder="shapir-drive-101"
                      value={customerForm.driveFolderId}
                      onChange={(e) => setCustomerForm({ ...customerForm, driveFolderId: e.target.value })}
                      className="w-full bg-white border border-gray-300 rounded-xl py-2 px-3 text-xs"
                    />
                  </div>
                </div>

                <div className="pt-4 border-t border-gray-150 flex gap-3">
                  <button 
                    type="button"
                    onClick={() => setIsAddingCustomer(false)}
                    className="flex-1 bg-gray-150 text-gray-750 font-bold py-2 rounded-xl text-center text-xs"
                  >
                    ביטול
                  </button>
                  <button 
                    type="submit"
                    className="flex-1 bg-gray-900 text-white font-bold py-2 rounded-xl text-center text-xs shadow-md"
                  >
                    רשום לקוח
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
