/**
 * SabanOS Core Entity Types
 */

export interface Order {
  id?: string;
  date: string; // YYYY-MM-DD
  time?: string; // HH:mm
  driverId?: string; // Driver ID references
  customerName: string;
  orderNumber: string;
  destination: string;
  items?: string;
  warehouse?: string;
  documentIds?: string;
  status: "pending" | "in_transit" | "delivered" | "canceled";
  eta?: string;
}

export interface MorningReport {
  id?: string;
  date: string;
  orderIds?: string; // List or description
  reportText: string;
  createdAt: string; // ISO string
}

export interface InventoryItem {
  id?: string;
  sku: string;
  name: string;
  description?: string;
  unit?: string;
  currentStock: number;
  minStock: number;
  price?: number;
  category?: string;
}

export interface Driver {
  id?: string;
  name: string;
  phone: string;
  vehicleType: "truck" | "crane";
  plateNumber?: string;
  status: "active" | "busy" | "offline";
  totalDeliveries?: number;
  onTimeRate?: number; // feedback Percentage (e.g. 98)
  rating?: number; // out of 5
}

export interface Customer {
  id?: string;
  name: string;
  customerNumber: string;
  contactPerson?: string;
  phoneNumber: string;
  driveFolderId?: string;
}

export interface Reminder {
  id?: string;
  title: string;
  description?: string;
  dueDate: string; // YYYY-MM-DD
  dueTime?: string;
  isCompleted: boolean;
  orderId?: string;
}

export interface TeamChatMessage {
  id?: string;
  senderId: string;
  senderName: string;
  text: string;
  timestamp: string; // ISO String
}
