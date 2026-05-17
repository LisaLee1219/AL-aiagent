// Mock data for the 5-department efficiency platform

// ============ Sales Department ============
export interface CustomerEmail {
  id: string;
  from: string;
  fromName: string;
  subject: string;
  body: string;
  receivedAt: string;
  status: 'unread' | 'processing' | 'processed';
}

export interface ExtractedInfo {
  customerName: string;
  companyName: string;
  products: string[];
  quantity: string;
  urgency: 'high' | 'medium' | 'low';
  keyRequirements: string[];
}

export interface ERPProduct {
  id: string;
  sku: string;
  name: string;
  category: string;
  costPrice: number;
  listPrice: number;
  stock: number;
  leadTime: string;
  minOrderQty: number;
  source?: string;
}

export interface HistoricalOrder {
  id: string;
  orderId: string;
  customer: string;
  product: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  date: string;
  status: 'completed' | 'shipped' | 'pending';
}

export const mockEmails: CustomerEmail[] = [
  {
    id: 'email-1',
    from: 'clienta@construction.sg',
    fromName: 'Client A',
    subject: 'URGENT - Price Request: Flat Wheels, Bolts, Nuts & Washers',
    body: `Dear Sir/Madam,

Good day. Could you please provide us with your best price for the items below:

• 100 PCS – FLAT WHEEL (4")
• 35 PCS – MACHINE SCREW ALLEN TYPE M14 X 30MM
• 80 PCS – BOLT M16 X 100MM GRADE 8.8
• 80 PCS – NUT M16 GRADE 8.8
• 80 PCS – FLAT WASHER M16 GRADE 8.8
• 80 PCS – SPRING WASHER M16 GRADE 8.8
• 300 PCS – BOLT M22 X 80MM GRADE 8.8
• 300 PCS – NUT M22 GRADE 8.8
• 300 PCS – FLAT WASHER M22 GRADE 8.8
• 300 PCS – SPRING WASHER M22 GRADE 8.8

Kindly include in your quotation:
- Lead time availability
- Delivery charges (if any)

This is an urgent request, and your prompt response would be greatly appreciated.

Thank you and best regards,
Client A`,
    receivedAt: '2026-05-15 09:32:00',
    status: 'unread',
  },
  {
    id: 'email-2',
    from: 'clienta@construction.sg',
    fromName: 'Client A',
    subject: 'Price Request: Butterfly Valve & Pressure Switch',
    body: `Good day,

Please provide your best price for the following items at your earliest convenience:

• BUTTERFLY VALVE 2", CAST IRON, WAFER TYPE = 1 PC
• PRESSURE SWITCH (RANGE 0–5 BARS) = 1 PC

Note:
- For Item #1, please refer to the attached image for reference.
- For Item #2, please quote for any suitable brand that meets the stated requirement, and include an image of the proposed item.

Kindly include the following in your quotation:
a) Mode of delivery
b) Lead time
c) Delivery / freight charges
d) Tax information (VAT inclusive or exclusive)
e) Product image

Thank you and best regards,
Client A`,
    receivedAt: '2026-05-15 10:15:00',
    status: 'unread',
  },
];

export const mockERPProducts: ERPProduct[] = [
  { id: 'p1', sku: 'FW-4-01', name: 'Flat Wheel 4"', category: 'Castors & Wheels', costPrice: 8.5, listPrice: 15.0, stock: 500, leadTime: '3 days', minOrderQty: 50 },
  { id: 'p2', sku: 'MS-M14X30-01', name: 'Machine Screw Allen Type M14 x 30mm', category: 'Fasteners', costPrice: 1.2, listPrice: 2.8, stock: 2000, leadTime: '5 days', minOrderQty: 100 },
  { id: 'p3', sku: 'BT-M16X100-01', name: 'Bolt M16 x 100mm Grade 8.8', category: 'Fasteners', costPrice: 2.5, listPrice: 4.5, stock: 3000, leadTime: '3 days', minOrderQty: 50 },
  { id: 'p4', sku: 'NT-M16-01', name: 'Nut M16 Grade 8.8', category: 'Fasteners', costPrice: 0.8, listPrice: 1.8, stock: 5000, leadTime: '3 days', minOrderQty: 100 },
  { id: 'p5', sku: 'FW-M16-01', name: 'Flat Washer M16 Grade 8.8', category: 'Fasteners', costPrice: 0.3, listPrice: 0.8, stock: 8000, leadTime: '3 days', minOrderQty: 100 },
  { id: 'p6', sku: 'SW-M16-01', name: 'Spring Washer M16 Grade 8.8', category: 'Fasteners', costPrice: 0.4, listPrice: 0.9, stock: 6000, leadTime: '3 days', minOrderQty: 100 },
  { id: 'p7', sku: 'BT-M22X80-01', name: 'Bolt M22 x 80mm Grade 8.8', category: 'Fasteners', costPrice: 5.5, listPrice: 9.8, stock: 1500, leadTime: '7 days', minOrderQty: 50 },
  { id: 'p8', sku: 'NT-M22-01', name: 'Nut M22 Grade 8.8', category: 'Fasteners', costPrice: 1.8, listPrice: 3.5, stock: 3000, leadTime: '5 days', minOrderQty: 100 },
  { id: 'p9', sku: 'FW-M22-01', name: 'Flat Washer M22 Grade 8.8', category: 'Fasteners', costPrice: 0.6, listPrice: 1.5, stock: 4000, leadTime: '3 days', minOrderQty: 100 },
  { id: 'p10', sku: 'SW-M22-01', name: 'Spring Washer M22 Grade 8.8', category: 'Fasteners', costPrice: 0.7, listPrice: 1.6, stock: 3500, leadTime: '3 days', minOrderQty: 100 },
  { id: 'p11', sku: 'BV-2CI-W-01', name: 'Butterfly Valve 2" Cast Iron Wafer Type', category: 'Valves', costPrice: 85, listPrice: 150, stock: 25, leadTime: '7 days', minOrderQty: 1 },
  { id: 'p12', sku: 'PS-0-5BAR-01', name: 'Pressure Switch (Range 0-5 Bars)', category: 'Instrumentation', costPrice: 120, listPrice: 220, stock: 15, leadTime: '10 days', minOrderQty: 1 },
  { id: 'p13', sku: 'BV-3CI-W-01', name: 'Butterfly Valve 3" Cast Iron Wafer Type', category: 'Valves', costPrice: 110, listPrice: 195, stock: 18, leadTime: '7 days', minOrderQty: 1 },
  { id: 'p14', sku: 'PS-0-10BAR-01', name: 'Pressure Switch (Range 0-10 Bars)', category: 'Instrumentation', costPrice: 145, listPrice: 260, stock: 10, leadTime: '14 days', minOrderQty: 1 },
];

export const mockHistoricalOrders: HistoricalOrder[] = [
  { id: 'ho1', orderId: 'SO/AA-9001234', customer: 'Client A', product: 'Bolt M16 x 100mm Grade 8.8', quantity: 200, unitPrice: 4.2, totalPrice: 840, date: '2026-03-15', status: 'completed' },
  { id: 'ho2', orderId: 'SO/AA-9001456', customer: 'Client A', product: 'Flat Wheel 4"', quantity: 50, unitPrice: 14.0, totalPrice: 700, date: '2026-02-22', status: 'completed' },
  { id: 'ho3', orderId: 'SO/AA-9001678', customer: 'Client A', product: 'Nut M16 Grade 8.8', quantity: 200, unitPrice: 1.5, totalPrice: 300, date: '2026-01-10', status: 'completed' },
  { id: 'ho4', orderId: 'SO/AA-9001890', customer: 'BuildWell Construction', product: 'Butterfly Valve 2" Cast Iron Wafer', quantity: 3, unitPrice: 145, totalPrice: 435, date: '2026-04-05', status: 'shipped' },
  { id: 'ho5', orderId: 'SO/AA-9002012', customer: 'Client A', product: 'Spring Washer M16 Grade 8.8', quantity: 200, unitPrice: 0.85, totalPrice: 170, date: '2025-12-18', status: 'completed' },
  { id: 'ho6', orderId: 'SO/AA-9002234', customer: 'MegaTech Engineering', product: 'Pressure Switch (0-5 Bars)', quantity: 2, unitPrice: 210, totalPrice: 420, date: '2026-04-12', status: 'shipped' },
  { id: 'ho7', orderId: 'SO/AA-9002456', customer: 'Client A', product: 'Bolt M22 x 80mm Grade 8.8', quantity: 150, unitPrice: 9.2, totalPrice: 1380, date: '2026-03-03', status: 'completed' },
  { id: 'ho8', orderId: 'SO/AA-9002678', customer: 'BuildWell Construction', product: 'Butterfly Valve 3" Cast Iron Wafer', quantity: 5, unitPrice: 185, totalPrice: 925, date: '2026-05-01', status: 'pending' },
];

// ============ Procurement Department ============
export interface Supplier {
  id: string;
  name: string;
  category: string;
  rating: number;
  leadTime: string;
  minOrder: number;
  priceIndex: number; // 1-100, lower is cheaper
  qualityScore: number; // 1-100
  deliveryScore: number; // 1-100
}

export interface InventoryAlert {
  id: string;
  product: string;
  sku: string;
  currentStock: number;
  minStock: number;
  status: 'critical' | 'warning' | 'normal';
  suggestedOrder: number;
  estimatedCost: number;
}

export const mockSuppliers: Supplier[] = [
  { id: 's1', name: 'Dell Technologies Direct', category: 'Servers / Storage', rating: 4.8, leadTime: '3-5 days', minOrder: 1, priceIndex: 75, qualityScore: 92, deliveryScore: 95 },
  { id: 's2', name: 'Huawei Enterprise Distribution', category: 'Network Equipment', rating: 4.6, leadTime: '7-10 days', minOrder: 1, priceIndex: 68, qualityScore: 90, deliveryScore: 88 },
  { id: 's3', name: 'H3C Authorized Distributor', category: 'Network Equipment', rating: 4.5, leadTime: '5-7 days', minOrder: 1, priceIndex: 62, qualityScore: 88, deliveryScore: 90 },
  { id: 's4', name: 'FANUC Robotics', category: 'Industrial Robots', rating: 4.9, leadTime: '30-45 days', minOrder: 1, priceIndex: 82, qualityScore: 98, deliveryScore: 85 },
  { id: 's5', name: 'ABB Automation', category: 'Industrial Robots', rating: 4.7, leadTime: '25-35 days', minOrder: 1, priceIndex: 78, qualityScore: 95, deliveryScore: 88 },
  { id: 's6', name: 'Mindray Medical Direct', category: 'Medical Equipment', rating: 4.8, leadTime: '5-10 days', minOrder: 1, priceIndex: 70, qualityScore: 94, deliveryScore: 92 },
  { id: 's7', name: 'Siemens Industry', category: 'Controllers / PLC', rating: 4.7, leadTime: '3-7 days', minOrder: 5, priceIndex: 72, qualityScore: 96, deliveryScore: 90 },
];

export const mockInventoryAlerts: InventoryAlert[] = [
  { id: 'ia1', product: 'Dell PowerScale NAS', sku: 'NAS-500T-01', currentStock: 3, minStock: 5, status: 'warning', suggestedOrder: 5, estimatedCost: 2250000 },
  { id: 'ia2', product: 'NetApp FAS8300 Storage Array', sku: 'NAS-500T-02', currentStock: 2, minStock: 5, status: 'critical', suggestedOrder: 8, estimatedCost: 4160000 },
  { id: 'ia3', product: 'GE Voluson E10 Ultrasound', sku: 'MED-US-01', currentStock: 3, minStock: 5, status: 'warning', suggestedOrder: 3, estimatedCost: 1950000 },
  { id: 'ia4', product: 'ABB IRB 6700 Robot', sku: 'ROB-6AX-50-02', currentStock: 4, minStock: 6, status: 'warning', suggestedOrder: 4, estimatedCost: 1680000 },
  { id: 'ia5', product: 'Huawei CE6856 Switch', sku: 'SW-10G-48-02', currentStock: 8, minStock: 10, status: 'normal', suggestedOrder: 5, estimatedCost: 160000 },
];

// ============ Logistics Department ============
export interface Shipment {
  id: string;
  trackingNo: string;
  customer: string;
  destination: string;
  status: 'preparing' | 'in_transit' | 'customs' | 'delivered' | 'delayed';
  currentLocation: string;
  estimatedDelivery: string;
  items: string;
  weight: string;
  carrier: string;
}

export interface WarehouseItem {
  id: string;
  zone: string;
  product: string;
  sku: string;
  quantity: number;
  capacity: number;
  lastUpdated: string;
}

export const mockShipments: Shipment[] = [
  { id: 'sh1', trackingNo: 'SF20250115001', customer: 'TechVision Solutions Pte Ltd', destination: 'Singapore CBD', status: 'in_transit', currentLocation: 'Changi Hub', estimatedDelivery: '2025-01-17', items: 'Dell R750 Servers x10', weight: '320kg', carrier: 'DHL Express' },
  { id: 'sh2', trackingNo: 'SF20250114003', customer: 'Global Pharma Group', destination: 'Singapore Science Park', status: 'delivered', currentLocation: 'Signed off at Science Park', estimatedDelivery: '2025-01-15', items: 'Blood Analyzers x5, Centrifuges x10', weight: '180kg', carrier: 'DHL Express' },
  { id: 'sh3', trackingNo: 'JD20250113002', customer: 'AutoStar Manufacturing Pte Ltd', destination: 'Tuas Industrial Zone', status: 'customs', currentLocation: 'Tuas Checkpoint - Customs Clearance', estimatedDelivery: '2025-01-20', items: 'FANUC Robots x4', weight: '2400kg', carrier: 'Maersk Logistics' },
  { id: 'sh4', trackingNo: 'SF20250112004', customer: 'TechVision Solutions Pte Ltd', destination: 'One North', status: 'delayed', currentLocation: 'Weather delay at hub', estimatedDelivery: '2025-01-18', items: 'H3C Switches x5', weight: '45kg', carrier: 'DHL Express' },
  { id: 'sh5', trackingNo: 'EMS20250115005', customer: 'Global Pharma Group', destination: 'Buona Vista', status: 'preparing', currentLocation: 'Warehouse - Picking', estimatedDelivery: '2025-01-22', items: 'Ultrasound Systems x2', weight: '120kg', carrier: 'SingPost' },
  { id: 'sh6', trackingNo: 'SF20250111006', customer: 'TechVision Solutions Pte Ltd', destination: 'Singapore CBD', status: 'in_transit', currentLocation: 'Jurong Transfer Center', estimatedDelivery: '2025-01-16', items: 'Dell PowerScale NAS x1', weight: '85kg', carrier: 'DHL Express' },
];

export const mockWarehouse: WarehouseItem[] = [
  { id: 'w1', zone: 'Zone A - Servers', product: 'Dell R750 Server', sku: 'SVR-R750-01', quantity: 35, capacity: 50, lastUpdated: '2025-01-15' },
  { id: 'w2', zone: 'Zone A - Servers', product: 'Dell R650 Server', sku: 'SVR-R650-01', quantity: 20, capacity: 50, lastUpdated: '2025-01-15' },
  { id: 'w3', zone: 'Zone B - Network', product: 'H3C S6850 Switch', sku: 'SW-10G-48-01', quantity: 15, capacity: 30, lastUpdated: '2025-01-14' },
  { id: 'w4', zone: 'Zone B - Network', product: 'Huawei CE6856 Switch', sku: 'SW-10G-48-02', quantity: 8, capacity: 30, lastUpdated: '2025-01-14' },
  { id: 'w5', zone: 'Zone C - Storage', product: 'Dell PowerScale NAS', sku: 'NAS-500T-01', quantity: 3, capacity: 10, lastUpdated: '2025-01-13' },
  { id: 'w6', zone: 'Zone C - Storage', product: 'NetApp FAS8300', sku: 'NAS-500T-02', quantity: 2, capacity: 10, lastUpdated: '2025-01-13' },
  { id: 'w7', zone: 'Zone D - Robotics', product: 'FANUC R-2000iC', sku: 'ROB-6AX-50-01', quantity: 5, capacity: 8, lastUpdated: '2025-01-12' },
  { id: 'w8', zone: 'Zone D - Robotics', product: 'ABB IRB 6700', sku: 'ROB-6AX-50-02', quantity: 4, capacity: 8, lastUpdated: '2025-01-12' },
  { id: 'w9', zone: 'Zone E - Medical', product: 'Mindray BC-5800', sku: 'MED-HEM-01', quantity: 12, capacity: 20, lastUpdated: '2025-01-15' },
  { id: 'w10', zone: 'Zone E - Medical', product: 'GE Voluson E10', sku: 'MED-US-01', quantity: 3, capacity: 10, lastUpdated: '2025-01-14' },
];

// ============ Finance Department ============
export interface Invoice {
  id: string;
  invoiceNo: string;
  customer: string;
  amount: number;
  tax: number;
  totalAmount: number;
  issueDate: string;
  dueDate: string;
  status: 'paid' | 'pending' | 'overdue' | 'processing';
  type: 'receivable' | 'payable';
}

export interface FinancialMetric {
  month: string;
  revenue: number;
  cost: number;
  profit: number;
  receivables: number;
  payables: number;
}

export const mockInvoices: Invoice[] = [
  { id: 'inv1', invoiceNo: 'INV-2025-0001', customer: 'TechVision Solutions Pte Ltd', amount: 850000, tax: 110500, totalAmount: 960500, issueDate: '2025-01-05', dueDate: '2025-02-05', status: 'pending', type: 'receivable' },
  { id: 'inv2', invoiceNo: 'INV-2025-0002', customer: 'Dell Technologies Direct', amount: 680000, tax: 88400, totalAmount: 768400, issueDate: '2025-01-03', dueDate: '2025-02-03', status: 'pending', type: 'payable' },
  { id: 'inv3', invoiceNo: 'INV-2024-0156', customer: 'Global Pharma Group', amount: 1700000, tax: 221000, totalAmount: 1921000, issueDate: '2024-12-15', dueDate: '2025-01-15', status: 'overdue', type: 'receivable' },
  { id: 'inv4', invoiceNo: 'INV-2025-0003', customer: 'AutoStar Manufacturing Pte Ltd', amount: 2000000, tax: 260000, totalAmount: 2260000, issueDate: '2025-01-10', dueDate: '2025-02-10', status: 'processing', type: 'receivable' },
  { id: 'inv5', invoiceNo: 'INV-2024-0148', customer: 'H3C Authorized Distributor', amount: 280000, tax: 36400, totalAmount: 316400, issueDate: '2024-12-20', dueDate: '2025-01-20', status: 'pending', type: 'payable' },
  { id: 'inv6', invoiceNo: 'INV-2024-0142', customer: 'TechVision Solutions Pte Ltd', amount: 430000, tax: 55900, totalAmount: 485900, issueDate: '2024-11-28', dueDate: '2024-12-28', status: 'paid', type: 'receivable' },
  { id: 'inv7', invoiceNo: 'INV-2024-0139', customer: 'Mindray Medical Direct', amount: 510000, tax: 66300, totalAmount: 576300, issueDate: '2024-12-01', dueDate: '2025-01-01', status: 'paid', type: 'payable' },
];

export const mockFinancialMetrics: FinancialMetric[] = [
  { month: '2024-07', revenue: 2800000, cost: 1680000, profit: 1120000, receivables: 950000, payables: 620000 },
  { month: '2024-08', revenue: 3200000, cost: 1920000, profit: 1280000, receivables: 1100000, payables: 730000 },
  { month: '2024-09', revenue: 2950000, cost: 1770000, profit: 1180000, receivables: 890000, payables: 580000 },
  { month: '2024-10', revenue: 3600000, cost: 2160000, profit: 1440000, receivables: 1250000, payables: 810000 },
  { month: '2024-11', revenue: 3100000, cost: 1860000, profit: 1240000, receivables: 1020000, payables: 670000 },
  { month: '2024-12', revenue: 4100000, cost: 2460000, profit: 1640000, receivables: 1580000, payables: 920000 },
  { month: '2025-01', revenue: 3380000, cost: 2028000, profit: 1352000, receivables: 1370000, payables: 845000 },
];

// ============ Marketing Department ============
export interface Campaign {
  id: string;
  name: string;
  channel: string;
  budget: number;
  spent: number;
  leads: number;
  conversions: number;
  roi: number;
  status: 'active' | 'paused' | 'completed';
  startDate: string;
  endDate: string;
}

export interface Lead {
  id: string;
  company: string;
  contact: string;
  source: string;
  score: number;
  status: 'hot' | 'warm' | 'cold';
  industry: string;
  estimatedValue: number;
  lastActivity: string;
}

export const mockCampaigns: Campaign[] = [
  { id: 'c1', name: 'Q1 2025 Server Campaign', channel: 'Search Engine', budget: 150000, spent: 89000, leads: 156, conversions: 23, roi: 3.2, status: 'active', startDate: '2025-01-01', endDate: '2025-03-31' },
  { id: 'c2', name: 'Medical Equipment Industry Expo', channel: 'Offline Event', budget: 300000, spent: 280000, leads: 89, conversions: 12, roi: 2.8, status: 'completed', startDate: '2024-12-01', endDate: '2024-12-15' },
  { id: 'c3', name: 'Industry 4.0 Whitepaper Campaign', channel: 'Content Marketing', budget: 80000, spent: 45000, leads: 234, conversions: 18, roi: 4.5, status: 'active', startDate: '2025-01-10', endDate: '2025-02-28' },
  { id: 'c4', name: 'LinkedIn Enterprise Targeting', channel: 'Social Media', budget: 120000, spent: 67000, leads: 98, conversions: 8, roi: 1.9, status: 'active', startDate: '2025-01-05', endDate: '2025-03-05' },
  { id: 'c5', name: 'Annual Customer Appreciation Event', channel: 'Offline Event', budget: 200000, spent: 195000, leads: 45, conversions: 15, roi: 3.8, status: 'completed', startDate: '2024-11-20', endDate: '2024-11-22' },
];

export const mockLeads: Lead[] = [
  { id: 'l1', company: 'SmartCloud Solutions Pte Ltd', contact: 'Director Chen', source: 'Search Engine', score: 92, status: 'hot', industry: 'IT / Cloud', estimatedValue: 2500000, lastActivity: '2025-01-15' },
  { id: 'l2', company: 'HealthTech Medical Devices', contact: 'Manager Lim', source: 'Exhibition', score: 85, status: 'hot', industry: 'Healthcare', estimatedValue: 1800000, lastActivity: '2025-01-14' },
  { id: 'l3', company: 'AutoTech Automation', contact: 'Engineer Tan', source: 'Whitepaper Download', score: 72, status: 'warm', industry: 'Industrial Automation', estimatedValue: 3200000, lastActivity: '2025-01-13' },
  { id: 'l4', company: 'GreenEnergy Group', contact: 'Director Sun', source: 'LinkedIn', score: 65, status: 'warm', industry: 'Renewable Energy', estimatedValue: 1500000, lastActivity: '2025-01-12' },
  { id: 'l5', company: 'SkyAero Technologies', contact: 'Manager Zhou', source: 'Search Engine', score: 78, status: 'warm', industry: 'Aerospace', estimatedValue: 5000000, lastActivity: '2025-01-11' },
  { id: 'l6', company: 'SwiftLog Technologies', contact: 'Manager Wu', source: 'Referral', score: 58, status: 'cold', industry: 'Logistics', estimatedValue: 600000, lastActivity: '2025-01-08' },
  { id: 'l7', company: 'RedStar Semiconductors', contact: 'Director Zheng', source: 'Exhibition', score: 88, status: 'hot', industry: 'Semiconductors', estimatedValue: 4200000, lastActivity: '2025-01-15' },
];
