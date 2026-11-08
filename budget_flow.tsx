import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell, Sector
} from 'recharts';
import {
  UploadCloud, Download, Moon, Sun, Filter, ChevronLeft, ChevronRight,
  Settings as SettingsIcon, PieChart as PieChartIcon, List, DollarSign,
  TrendingUp, TrendingDown, Activity, AlertCircle, Database, Trash2, Home,
  ShoppingCart, Utensils, Car, Zap, Film, Heart, Briefcase, PiggyBank, Package, Plus
} from 'lucide-react';

// --- Constants & Config ---
const APP_VERSION = '1.0.0';

const CATEGORY_STRUCTURE = {
  'Housing': ['Rent/Mortgage', 'Maintenance & Repairs', 'Property Tax', 'Home Insurance', 'Other'],
  'Food & Dining': ['Groceries - Food', 'Groceries - Non-Food', 'Restaurants & Takeout', 'Coffee Shops', 'Other'],
  'Shopping': ['Electronics & Tech', 'Clothing & Apparel', 'Home & Garden', 'Hobbies/General', 'Other'],
  'Transportation': ['Transit', 'Auto Fuel/Charging', 'Vehicle Maintenance', 'Parking & Tolls', 'Other'],
  'Utilities & Bills': ['Electricity', 'Water', 'Internet/Phone', 'Subscriptions', 'Other'],
  'Entertainment & Leisure': ['Movies/Events', 'Games', 'Travel', 'Other'],
  'Health & Wellness': ['Pharmacy', 'Medical/Dental', 'Fitness', 'Other'],
  'Income': ['Salary/Wages', 'Freelance/Business', 'Gifts', 'Other'],
  'Investments & Savings': ['Stock Market', 'Retirement', 'Emergency Fund', 'Other'],
  'Miscellaneous': ['Fees', 'Uncategorized', 'Other']
};

const BROAD_CATEGORIES = Object.keys(CATEGORY_STRUCTURE);

const DEFAULT_BUDGETS = {
  'Food & Dining': 800,
  'Shopping': 400,
  'Transportation': 300,
  'Entertainment & Leisure': 200,
  'Housing': 2000,
  'Utilities & Bills': 400
};

const CATEGORY_COLORS = {
  'Housing': '#3b82f6', // blue
  'Food & Dining': '#10b981', // emerald
  'Shopping': '#f59e0b', // amber
  'Transportation': '#6366f1', // indigo
  'Utilities & Bills': '#ec4899', // pink
  'Entertainment & Leisure': '#8b5cf6', // purple
  'Health & Wellness': '#14b8a6', // teal
  'Income': '#22c55e', // green
  'Investments & Savings': '#0ea5e9', // sky
  'Miscellaneous': '#64748b' // slate
};

const CATEGORY_ICONS = {
  'Housing': Home,
  'Food & Dining': Utensils,
  'Shopping': ShoppingCart,
  'Transportation': Car,
  'Utilities & Bills': Zap,
  'Entertainment & Leisure': Film,
  'Health & Wellness': Heart,
  'Income': Briefcase,
  'Investments & Savings': PiggyBank,
  'Miscellaneous': Package
};

// --- Helper Functions ---

// Generate a deterministic hash for duplicate detection
const generateHash = (date, merchant, amount) => {
  const str = `${date}-${merchant.toLowerCase().replace(/[^a-z0-9]/g, '')}-${Math.abs(amount)}`;
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16);
};

// Basic normalization rules
const normalizeMerchant = (raw) => {
  let name = raw.toUpperCase();
  if (name.includes('AMZN') || name.includes('AMAZON')) return 'Amazon';
  if (name.includes('UBER') && !name.includes('EATS')) return 'Uber';
  if (name.includes('UBER EATS')) return 'Uber Eats';
  if (name.includes('STARBUCKS')) return 'Starbucks';
  if (name.includes('WAL-MART') || name.includes('WALMART')) return 'Walmart';
  if (name.includes('MCDONALD')) return 'McDonalds';
  if (name.includes('SHELL')) return 'Shell';
  if (name.includes('TIM HORTONS')) return 'Tim Hortons';
  if (name.includes('SHOPPERS DRUG')) return 'Shoppers Drug Mart';
  if (name.includes('NETFLIX')) return 'Netflix';
  
  // Clean up typical bank statement garbage
  name = name.replace(/ (INC|LTD|LLC|CORP|CO)\b.*/i, '');
  name = name.replace(/[0-9]{4,}/g, ''); // Remove long numbers
  name = name.replace(/ #.*/, ''); // Remove store numbers
  return name.trim() || raw;
};

// Simple auto-categorization based on normalized name
const suggestCategory = (merchant, rules) => {
  // Check user defined rules first
  const rule = rules.find(r => merchant.toLowerCase().includes(r.keyword.toLowerCase()));
  if (rule) return { category: rule.category, subcategory: rule.subcategory };

  // Fallback defaults
  const m = merchant.toLowerCase();
  if (m.includes('amazon') || m.includes('walmart')) return { category: 'Shopping', subcategory: 'General' };
  if (m.includes('uber') || m.includes('transit') || m.includes('shell')) return { category: 'Transportation', subcategory: 'Other' };
  if (m.includes('starbucks') || m.includes('mcdonald') || m.includes('tim hortons') || m.includes('eats')) return { category: 'Food & Dining', subcategory: 'Restaurants & Takeout' };
  if (m.includes('loblaw') || m.includes('metro') || m.includes('costco') || m.includes('sobeys')) return { category: 'Food & Dining', subcategory: 'Groceries - Food' };
  if (m.includes('shoppers')) return { category: 'Health & Wellness', subcategory: 'Pharmacy' };
  if (m.includes('netflix') || m.includes('spotify') || m.includes('cineplex')) return { category: 'Entertainment & Leisure', subcategory: 'Subscriptions' };
  if (m.includes('hydro') || m.includes('enbridge') || m.includes('rogers') || m.includes('bell')) return { category: 'Utilities & Bills', subcategory: 'Other' };
  if (m.includes('payroll') || m.includes('salary') || m.includes('deposit')) return { category: 'Income', subcategory: 'Salary/Wages' };
  
  return { category: 'Miscellaneous', subcategory: 'Uncategorized' };
};

// Generate Mock Data
const generateMockData = () => {
  const transactions = [];
  const today = new Date();
  
  const addTx = (daysAgo, rawDesc, amount) => {
    const d = new Date(today);
    d.setDate(today.getDate() - daysAgo);
    const dateStr = d.toISOString().split('T')[0];
    const merchant = normalizeMerchant(rawDesc);
    const cat = suggestCategory(merchant, []);
    
    transactions.push({
      id: generateHash(dateStr, merchant, amount),
      date: dateStr,
      rawMerchant: rawDesc,
      merchant: merchant,
      amount: amount,
      type: amount > 0 ? 'income' : 'expense',
      category: cat.category,
      subcategory: cat.subcategory,
      isManuallyCategorized: false
    });
  };

  // Generate 90 days of data
  for (let i = 0; i < 3; i++) {
    const offset = i * 30;
    addTx(28 + offset, "ACME CORP PAYROLL", 3200.00); // Income
    addTx(27 + offset, "PROPERTY MGMT RENT", -1800.00);
    addTx(26 + offset, "ROGERS CABLE & INT", -95.50);
    addTx(24 + offset, "TORONTO HYDRO", -65.20);
    
    // Weekly stuff
    for(let j=0; j<4; j++) {
      addTx(1 + offset + (j*7), "LOBLAWS #4322 TORONTO", -(120 + Math.random()*50));
      addTx(3 + offset + (j*7), "UBER EATS *PENDING", -(25 + Math.random()*20));
      addTx(5 + offset + (j*7), "STARBUCKS STORE 12", -(5 + Math.random()*4));
      addTx(6 + offset + (j*7), "PRESTO TRANSIT", -25.00);
    }
    
    // Random shopping/entertainment
    if (i === 0) addTx(15, "AMZN MKTPLACE 8234", -145.99);
    if (i === 1) addTx(45, "CINEPLEX ENTERTAINMENT", -35.00);
    if (i === 2) addTx(70, "SHOPPERS DRUG MART", -42.15);
  }
  return transactions;
};

// --- Custom Hooks ---

function useLocalStorage(key, initialValue) {
  const [storedValue, setStoredValue] = useState(() => {
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      console.error(error);
      return initialValue;
    }
  });

  const setValue = (value) => {
    try {
      const valueToStore = value instanceof Function ? value(storedValue) : value;
      setStoredValue(valueToStore);
      window.localStorage.setItem(key, JSON.stringify(valueToStore));
    } catch (error) {
      console.error(error);
    }
  };
  return [storedValue, setValue];
}

// --- Main Application Component ---

export default function App() {
  // State
  const [theme, setTheme] = useLocalStorage('theme', 'dark');
  const [transactions, setTransactions] = useLocalStorage('transactions', []);
  const [rules, setRules] = useLocalStorage('categorization_rules', []);
  const [budgets, setBudgets] = useLocalStorage('budgets', DEFAULT_BUDGETS);
  
  const [currentView, setCurrentView] = useState('dashboard'); // dashboard, transactions, settings
  const [selectedCategory, setSelectedCategory] = useState(null); // For drilldown
  
  // Date Filtering State
  const [dateFilter, setDateFilter] = useState('all'); // 'all', 'ytd', 'month3', 'month1'
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');

  // UI State
  const [isDragging, setIsDragging] = useState(false);
  const [uploadStatus, setUploadStatus] = useState('');

  // Apply Theme
  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  // --- Data Processing Methods ---

  const handleDemoData = () => {
    if (window.confirm("This will clear existing data and load demo transactions. Proceed?")) {
      setTransactions(generateMockData());
      setUploadStatus("Demo data loaded successfully.");
      setTimeout(() => setUploadStatus(''), 3000);
    }
  };

  const handleFileUpload = useCallback((e) => {
    e.preventDefault();
    setIsDragging(false);
    
    const file = e.dataTransfer ? e.dataTransfer.files[0] : e.target.files[0];
    if (!file) return;

    setUploadStatus('Parsing file...');
    
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target.result;
      processCSV(text);
    };
    reader.readAsText(file);
  }, [transactions, rules]); // Need current tx to check duplicates

  const processCSV = (csvText) => {
    // Very basic heuristic CSV parser
    const lines = csvText.split('\n').filter(l => l.trim().length > 0);
    if (lines.length < 2) {
      setUploadStatus('Invalid file format.');
      return;
    }

    // Try to guess columns based on row 1 (assuming row 0 is headers)
    const sampleCols = lines[1].split(',').map(s => s.replace(/(^"|"$)/g, '').trim());
    
    let dateIdx = -1, descIdx = -1, amtIdx = -1;
    
    sampleCols.forEach((val, idx) => {
      if (dateIdx === -1 && !isNaN(Date.parse(val)) && val.length >= 8) dateIdx = idx;
      else if (amtIdx === -1 && !isNaN(parseFloat(val)) && val.match(/[0-9]/)) amtIdx = idx;
      else if (descIdx === -1 && isNaN(parseFloat(val))) descIdx = idx;
    });

    if (dateIdx === -1 || amtIdx === -1 || descIdx === -1) {
       // Fallback to strict standard: Date, Description, Amount
       dateIdx = 0; descIdx = 1; amtIdx = 2;
    }

    let newTxCount = 0;
    const newTransactions = [...transactions];
    const existingHashes = new Set(transactions.map(t => t.id));

    for (let i = 1; i < lines.length; i++) {
      // Basic CSV split ignoring commas inside quotes
      const cols = lines[i].match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g);
      if (!cols || cols.length < 3) continue;

      const cleanCol = (c) => c ? c.replace(/(^"|"$)/g, '').trim() : '';
      
      const rawDate = cleanCol(cols[dateIdx]);
      const rawDesc = cleanCol(cols[descIdx]);
      let rawAmt = cleanCol(cols[amtIdx]);
      
      // Handle potentially problematic amount formats
      if (rawAmt.includes('(')) rawAmt = '-' + rawAmt.replace(/[\(\)]/g, ''); // (100) -> -100
      let amount = parseFloat(rawAmt.replace(/[^0-9.-]+/g,""));

      // Standardize date to YYYY-MM-DD
      let parsedDate;
      try {
        const d = new Date(rawDate);
        parsedDate = d.toISOString().split('T')[0];
      } catch (e) {
        continue; // Skip invalid dates
      }

      if (isNaN(amount) || !parsedDate || !rawDesc) continue;

      // In bank exports, sometimes expenses are positive. We assume mostly expenses if they are positive, 
      // but let's stick to standard: negative = expense, positive = income.
      // If the entire file has mostly positive values for obviously expenses, we might need a flip toggle.
      // For this app, we assume standard sign conventions or explicit columns.

      const merchant = normalizeMerchant(rawDesc);
      const hash = generateHash(parsedDate, merchant, amount);

      if (!existingHashes.has(hash)) {
        const catObj = suggestCategory(merchant, rules);
        newTransactions.push({
          id: hash,
          date: parsedDate,
          rawMerchant: rawDesc,
          merchant: merchant,
          amount: amount,
          type: amount > 0 ? 'income' : 'expense',
          category: catObj.category,
          subcategory: catObj.subcategory,
          isManuallyCategorized: false
        });
        existingHashes.add(hash);
        newTxCount++;
      }
    }

    // Sort by date descending
    newTransactions.sort((a, b) => new Date(b.date) - new Date(a.date));
    setTransactions(newTransactions);
    setUploadStatus(`Added ${newTxCount} new transactions. Skipped duplicates.`);
    setTimeout(() => setUploadStatus(''), 4000);
  };

  const updateTransactionCategory = (id, newCategory, newSubCategory, createRule) => {
    let targetMerchant = '';
    const updatedTx = transactions.map(t => {
      if (t.id === id) {
        targetMerchant = t.merchant;
        return { ...t, category: newCategory, subcategory: newSubCategory, isManuallyCategorized: true };
      }
      return t;
    });

    if (createRule && targetMerchant) {
      const newRule = { keyword: targetMerchant, category: newCategory, subcategory: newSubCategory };
      const updatedRules = [...rules.filter(r => r.keyword !== targetMerchant), newRule];
      setRules(updatedRules);
      
      // Apply rule retroactively to uncategorized or similarly named ones
      updatedTx.forEach(t => {
        if (t.merchant.toLowerCase().includes(targetMerchant.toLowerCase()) && !t.isManuallyCategorized && t.id !== id) {
          t.category = newCategory;
          t.subcategory = newSubCategory;
        }
      });
    }
    setTransactions(updatedTx);
  };

  const clearAllData = () => {
    if (window.confirm("Are you sure? This will delete all transactions and rules locally.")) {
      setTransactions([]);
      setRules([]);
      setBudgets(DEFAULT_BUDGETS);
    }
  };

  const exportData = () => {
    const data = { transactions, rules, budgets };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `budget_backup_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // --- Derived State & Computations ---

  const filteredTransactions = useMemo(() => {
    const now = new Date();
    let start, end = now;

    if (dateFilter === 'month1') {
      start = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
    } else if (dateFilter === 'month3') {
      start = new Date(now.getFullYear(), now.getMonth() - 3, now.getDate());
    } else if (dateFilter === 'ytd') {
      start = new Date(now.getFullYear(), 0, 1);
    } else if (dateFilter === 'custom' && customStartDate && customEndDate) {
      start = new Date(customStartDate);
      end = new Date(customEndDate);
    } else {
      // 'all'
      return transactions;
    }

    return transactions.filter(t => {
      const d = new Date(t.date);
      return d >= start && d <= end;
    });
  }, [transactions, dateFilter, customStartDate, customEndDate]);

  const stats = useMemo(() => {
    let income = 0, expenses = 0;
    const categoryTotals = {};
    const subcategoryTotals = {}; // { 'Housing': { 'Rent': 1000 } }
    const merchantTotals = {};
    const monthlyDataMap = {};

    filteredTransactions.forEach(t => {
      const amt = Math.abs(t.amount);
      const monthKey = t.date.substring(0, 7); // YYYY-MM

      if (!monthlyDataMap[monthKey]) {
        monthlyDataMap[monthKey] = { name: monthKey, Income: 0, Expenses: 0 };
      }

      if (t.type === 'income') {
        income += amt;
        monthlyDataMap[monthKey].Income += amt;
      } else {
        expenses += amt;
        monthlyDataMap[monthKey].Expenses += amt;
        
        // Expense categorization
        categoryTotals[t.category] = (categoryTotals[t.category] || 0) + amt;
        
        if (!subcategoryTotals[t.category]) subcategoryTotals[t.category] = {};
        subcategoryTotals[t.category][t.subcategory] = (subcategoryTotals[t.category][t.subcategory] || 0) + amt;

        merchantTotals[t.merchant] = (merchantTotals[t.merchant] || 0) + amt;
      }
    });

    // Formatting for charts
    const pieData = Object.keys(categoryTotals)
      .map(key => ({ name: key, value: categoryTotals[key] }))
      .sort((a, b) => b.value - a.value);

    const topMerchants = Object.entries(merchantTotals)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([name, value]) => ({ name, value }));

    const monthlyData = Object.values(monthlyDataMap).sort((a, b) => a.name.localeCompare(b.name));

    return {
      income,
      expenses,
      netFlow: income - expenses,
      savingsRate: income > 0 ? ((income - expenses) / income) * 100 : 0,
      pieData,
      topMerchants,
      monthlyData,
      subcategoryTotals,
      categoryTotals
    };
  }, [filteredTransactions]);

  // --- Sub-Components ---

  // Custom Pie Chart Label
  const renderCustomizedLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent, index, name }) => {
    const RADIAN = Math.PI / 180;
    const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);

    return percent > 0.05 ? (
      <text x={x} y={y} fill="white" textAnchor={x > cx ? 'start' : 'end'} dominantBaseline="central" className="text-xs font-semibold drop-shadow-md">
        {`${(percent * 100).toFixed(0)}%`}
      </text>
    ) : null;
  };

  const DrilldownView = () => {
    if (!selectedCategory) return null;
    
    const catTotal = stats.categoryTotals[selectedCategory] || 0;
    const subTotals = stats.subcategoryTotals[selectedCategory] || {};
    
    const subData = Object.entries(subTotals)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);

    const relatedTx = filteredTransactions.filter(t => t.category === selectedCategory && t.type === 'expense');

    return (
      <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
        <div className="flex items-center mb-6">
          <button 
            onClick={() => setSelectedCategory(null)}
            className="mr-4 p-2 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
          >
            <ChevronLeft size={24} />
          </button>
          <div>
            <h2 className="text-2xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
              {React.createElement(CATEGORY_ICONS[selectedCategory] || Package, { className: "text-blue-500", size: 28 })}
              {selectedCategory}
            </h2>
            <p className="text-slate-500 dark:text-slate-400">Total Spend: ${catTotal.toFixed(2)}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          {/* Subcategory Chart */}
          <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 col-span-1">
            <h3 className="text-lg font-semibold mb-4 text-slate-700 dark:text-slate-200">Subcategory Breakdown</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={subData}
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {subData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={CATEGORY_COLORS[selectedCategory]} opacity={1 - (index * 0.15)} />
                    ))}
                  </Pie>
                  <Tooltip 
                    formatter={(value) => `$${value.toFixed(2)}`}
                    contentStyle={{ backgroundColor: theme === 'dark' ? '#1e293b' : '#fff', borderRadius: '8px', border: 'none' }}
                  />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Subcategory List */}
          <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 col-span-1 lg:col-span-2 overflow-y-auto max-h-80">
             <h3 className="text-lg font-semibold mb-4 text-slate-700 dark:text-slate-200">Recent Transactions</h3>
             <div className="space-y-3">
               {relatedTx.slice(0,20).map(t => (
                 <div key={t.id} className="flex justify-between items-center p-3 hover:bg-slate-50 dark:hover:bg-slate-700/50 rounded-xl transition-colors">
                   <div>
                     <p className="font-medium text-slate-800 dark:text-slate-200">{t.merchant}</p>
                     <p className="text-xs text-slate-500">{t.date} &bull; {t.subcategory}</p>
                   </div>
                   <p className="font-semibold text-slate-800 dark:text-slate-200">
                     ${Math.abs(t.amount).toFixed(2)}
                   </p>
                 </div>
               ))}
               {relatedTx.length === 0 && <p className="text-slate-500 text-center py-4">No transactions found.</p>}
             </div>
          </div>
        </div>
      </div>
    );
  };

  const DashboardView = () => (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* KPI Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 flex flex-col relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-20"><TrendingUp size={48} className="text-green-500"/></div>
          <span className="text-sm font-medium text-slate-500 dark:text-slate-400">Total Income</span>
          <span className="text-3xl font-bold text-slate-800 dark:text-white mt-2">${stats.income.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
        </div>
        
        <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 flex flex-col relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-20"><TrendingDown size={48} className="text-rose-500"/></div>
          <span className="text-sm font-medium text-slate-500 dark:text-slate-400">Total Expenses</span>
          <span className="text-3xl font-bold text-slate-800 dark:text-white mt-2">${stats.expenses.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
        </div>

        <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 flex flex-col relative overflow-hidden">
           <div className="absolute top-0 right-0 p-4 opacity-20"><Activity size={48} className={stats.netFlow >= 0 ? "text-emerald-500" : "text-rose-500"}/></div>
          <span className="text-sm font-medium text-slate-500 dark:text-slate-400">Net Cash Flow</span>
          <span className={`text-3xl font-bold mt-2 ${stats.netFlow >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
            {stats.netFlow >= 0 ? '+' : '-'}${Math.abs(stats.netFlow).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
          </span>
        </div>

        <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 flex flex-col relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-20"><PiggyBank size={48} className="text-blue-500"/></div>
          <span className="text-sm font-medium text-slate-500 dark:text-slate-400">Savings Rate</span>
          <span className="text-3xl font-bold text-slate-800 dark:text-white mt-2">{stats.savingsRate.toFixed(1)}%</span>
        </div>
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Income vs Expense Bar Chart */}
        <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 lg:col-span-2">
          <h3 className="text-lg font-semibold mb-4 text-slate-800 dark:text-slate-200">Cash Flow History</h3>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.monthlyData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={theme === 'dark' ? '#334155' : '#e2e8f0'} />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: theme === 'dark' ? '#94a3b8' : '#64748b'}} />
                <YAxis axisLine={false} tickLine={false} tick={{fill: theme === 'dark' ? '#94a3b8' : '#64748b'}} tickFormatter={(value) => `$${value}`} />
                <Tooltip 
                  cursor={{fill: theme === 'dark' ? '#334155' : '#f1f5f9'}}
                  contentStyle={{ backgroundColor: theme === 'dark' ? '#1e293b' : '#fff', borderRadius: '8px', border: 'none', color: theme === 'dark' ? '#fff' : '#000' }}
                  itemStyle={{fontWeight: 'bold'}}
                />
                <Legend iconType="circle" />
                <Bar dataKey="Income" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={40} />
                <Bar dataKey="Expenses" fill="#f43f5e" radius={[4, 4, 0, 0]} maxBarSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Category Pie Chart */}
        <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700">
          <h3 className="text-lg font-semibold mb-4 text-slate-800 dark:text-slate-200">Spending Distribution</h3>
          <div className="h-64 relative">
            {stats.pieData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={stats.pieData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={renderCustomizedLabel}
                    outerRadius={100}
                    innerRadius={40}
                    paddingAngle={2}
                    dataKey="value"
                    onClick={(data, index) => setSelectedCategory(data.name)}
                    className="cursor-pointer"
                  >
                    {stats.pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={CATEGORY_COLORS[entry.name] || '#94a3b8'} className="hover:opacity-80 transition-opacity outline-none" />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => `$${value.toFixed(2)}`} contentStyle={{ backgroundColor: theme === 'dark' ? '#1e293b' : '#fff', borderRadius: '8px', border: 'none' }}/>
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="absolute inset-0 flex items-center justify-center text-slate-400">No expense data</div>
            )}
          </div>
          <p className="text-center text-xs text-slate-500 mt-2">Click a slice to drill down</p>
        </div>
      </div>

      {/* Row 3: Budget Tracking & Top Merchants */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Budget Trackers */}
        <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-200">Monthly Budget Caps</h3>
            <button onClick={() => setCurrentView('settings')} className="text-xs text-blue-500 hover:underline">Edit Caps</button>
          </div>
          
          <div className="space-y-5">
            {Object.entries(budgets).map(([cat, limit]) => {
              // Calculate spend for current month specifically for budgets, or just use filtered data if looking at a specific month
              // For simplicity, we compare current filtered period spend against the limit.
              const spent = stats.categoryTotals[cat] || 0;
              const percent = Math.min((spent / limit) * 100, 100);
              const isOver = spent > limit;
              const isWarning = spent > limit * 0.8 && !isOver;

              let barColor = 'bg-blue-500';
              if (isOver) barColor = 'bg-rose-500';
              else if (isWarning) barColor = 'bg-amber-500';

              return (
                <div key={cat} className="group">
                  <div className="flex justify-between text-sm mb-1">
                    <span className="font-medium text-slate-700 dark:text-slate-300 flex items-center gap-2">
                       {React.createElement(CATEGORY_ICONS[cat] || Package, { size: 14 })}
                       {cat}
                    </span>
                    <span className="text-slate-500 dark:text-slate-400">
                      ${spent.toFixed(0)} / ${limit}
                    </span>
                  </div>
                  <div className="w-full bg-slate-100 dark:bg-slate-700 rounded-full h-2.5 overflow-hidden">
                    <div className={`h-2.5 rounded-full transition-all duration-500 ${barColor}`} style={{ width: `${percent}%` }}></div>
                  </div>
                  {isOver && <p className="text-xs text-rose-500 mt-1 flex items-center gap-1"><AlertCircle size={10}/> Over budget</p>}
                </div>
              )
            })}
          </div>
        </div>

        {/* Top Merchants */}
        <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700">
          <h3 className="text-lg font-semibold mb-4 text-slate-800 dark:text-slate-200">Top 10 Merchants (Spend)</h3>
          <div className="space-y-3">
            {stats.topMerchants.map((m, i) => (
              <div key={i} className="flex items-center justify-between p-2 hover:bg-slate-50 dark:hover:bg-slate-700/50 rounded-lg transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-slate-500 font-bold text-xs">
                    {i+1}
                  </div>
                  <span className="font-medium text-slate-700 dark:text-slate-200">{m.name}</span>
                </div>
                <span className="font-semibold text-slate-800 dark:text-white">${m.value.toFixed(2)}</span>
              </div>
            ))}
            {stats.topMerchants.length === 0 && <p className="text-slate-500 text-center py-4">No data available</p>}
          </div>
        </div>

      </div>
    </div>
  );

  const TransactionsView = () => {
    const [editingId, setEditingId] = useState(null);
    const [editCat, setEditCat] = useState('');
    const [editSubCat, setEditSubCat] = useState('');
    const [saveRule, setSaveRule] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    const startEdit = (t) => {
      setEditingId(t.id);
      setEditCat(t.category);
      setEditSubCat(t.subcategory);
    };

    const saveEdit = (id) => {
      updateTransactionCategory(id, editCat, editSubCat, saveRule);
      setEditingId(null);
    };

    const handleCatChange = (e) => {
      const newCat = e.target.value;
      setEditCat(newCat);
      setEditSubCat(CATEGORY_STRUCTURE[newCat][0]); // Default to first subcat
    };

    const filteredList = filteredTransactions.filter(t => 
      t.merchant.toLowerCase().includes(searchTerm.toLowerCase()) || 
      t.category.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 overflow-hidden flex flex-col h-[calc(100vh-140px)] animate-in fade-in">
        
        {/* Toolbar */}
        <div className="p-4 border-b border-slate-100 dark:border-slate-700 flex flex-col sm:flex-row justify-between items-center gap-4">
          <h2 className="text-lg font-semibold text-slate-800 dark:text-white">Transactions ({filteredList.length})</h2>
          <input 
            type="text" 
            placeholder="Search merchants or categories..." 
            className="w-full sm:w-64 px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:text-white transition-all"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>

        {/* Table container with scrolling */}
        <div className="overflow-x-auto overflow-y-auto flex-1 p-0">
          <table className="w-full text-left text-sm text-slate-600 dark:text-slate-300">
            <thead className="text-xs uppercase bg-slate-50 dark:bg-slate-900 text-slate-500 dark:text-slate-400 sticky top-0 z-10 shadow-sm">
              <tr>
                <th className="px-6 py-4 font-semibold">Date</th>
                <th className="px-6 py-4 font-semibold">Merchant</th>
                <th className="px-6 py-4 font-semibold">Category</th>
                <th className="px-6 py-4 font-semibold text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
              {filteredList.map((t) => (
                <tr key={t.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-700/30 transition-colors group">
                  <td className="px-6 py-4 whitespace-nowrap">{t.date}</td>
                  <td className="px-6 py-4">
                    <div className="font-medium text-slate-800 dark:text-slate-200">{t.merchant}</div>
                    <div className="text-xs text-slate-400" title={t.rawMerchant}>{t.rawMerchant.substring(0, 30)}{t.rawMerchant.length > 30 ? '...' : ''}</div>
                  </td>
                  <td className="px-6 py-4">
                    {editingId === t.id ? (
                      <div className="flex flex-col gap-2 min-w-[250px] bg-slate-50 dark:bg-slate-900 p-3 rounded-lg border border-blue-200 dark:border-blue-800 shadow-lg absolute z-20">
                        <select className="p-2 border rounded-md dark:bg-slate-800 dark:border-slate-600 text-xs" value={editCat} onChange={handleCatChange}>
                          {BROAD_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                        <select className="p-2 border rounded-md dark:bg-slate-800 dark:border-slate-600 text-xs" value={editSubCat} onChange={e => setEditSubCat(e.target.value)}>
                          {CATEGORY_STRUCTURE[editCat]?.map(sc => <option key={sc} value={sc}>{sc}</option>)}
                        </select>
                        <div className="flex items-center gap-2 mt-1">
                          <input type="checkbox" id={`rule-${t.id}`} checked={saveRule} onChange={e => setSaveRule(e.target.checked)} className="rounded text-blue-500" />
                          <label htmlFor={`rule-${t.id}`} className="text-xs text-slate-500">Apply to future '{t.merchant}'</label>
                        </div>
                        <div className="flex justify-end gap-2 mt-2">
                          <button onClick={() => setEditingId(null)} className="px-3 py-1 text-xs text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700 rounded">Cancel</button>
                          <button onClick={() => saveEdit(t.id)} className="px-3 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600">Save</button>
                        </div>
                      </div>
                    ) : (
                      <div 
                        className="cursor-pointer group-hover:text-blue-500 transition-colors inline-flex items-center gap-2"
                        onClick={() => startEdit(t)}
                        title="Click to edit category"
                      >
                         <div className={`w-2 h-2 rounded-full`} style={{backgroundColor: CATEGORY_COLORS[t.category] || '#ccc'}}></div>
                         <div>
                            <span className="block font-medium">{t.category}</span>
                            <span className="block text-xs opacity-70">{t.subcategory}</span>
                         </div>
                      </div>
                    )}
                  </td>
                  <td className={`px-6 py-4 text-right font-semibold whitespace-nowrap ${t.type === 'income' ? 'text-emerald-500' : 'text-slate-800 dark:text-slate-200'}`}>
                    {t.type === 'income' ? '+' : '-'}${Math.abs(t.amount).toFixed(2)}
                  </td>
                </tr>
              ))}
              {filteredList.length === 0 && (
                <tr>
                  <td colSpan="4" className="px-6 py-12 text-center text-slate-500">
                    <div className="flex flex-col items-center gap-3">
                      <Database size={40} className="opacity-20" />
                      <p>No transactions found for this period.</p>
                      <p className="text-xs opacity-60">Try adjusting your date filter or uploading a statement.</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const SettingsView = () => {
    return (
      <div className="max-w-3xl mx-auto space-y-6 animate-in fade-in">
        
        <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700">
          <h2 className="text-xl font-bold text-slate-800 dark:text-white mb-4 flex items-center gap-2"><Database className="text-blue-500"/> Data Management</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">Your data is stored locally in this browser. Export frequently to back up your history.</p>
          
          <div className="flex flex-wrap gap-4">
            <button onClick={exportData} className="flex items-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-xl transition-colors font-medium text-sm">
              <Download size={18} /> Export JSON Backup
            </button>
            
            <button onClick={handleDemoData} className="flex items-center gap-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl transition-colors font-medium text-sm">
              <Activity size={18} /> Load Demo Data
            </button>

            <button onClick={clearAllData} className="flex items-center gap-2 px-4 py-2 border border-rose-200 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-xl transition-colors font-medium text-sm ml-auto">
              <Trash2 size={18} /> Wipe All Data
            </button>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700">
          <h2 className="text-xl font-bold text-slate-800 dark:text-white mb-4 flex items-center gap-2"><TrendingDown className="text-amber-500"/> Budget Caps</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">Set monthly limits for broad categories. Enter 0 to disable tracking for a category.</p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {BROAD_CATEGORIES.map(cat => (
              <div key={cat} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800">
                <span className="text-sm font-medium text-slate-700 dark:text-slate-300 flex items-center gap-2">
                   <div className="w-3 h-3 rounded-full" style={{backgroundColor: CATEGORY_COLORS[cat]}}></div>
                   {cat}
                </span>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">$</span>
                  <input 
                    type="number"
                    className="w-24 pl-6 pr-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:text-white"
                    value={budgets[cat] || 0}
                    onChange={(e) => setBudgets({...budgets, [cat]: parseInt(e.target.value) || 0})}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700">
          <h2 className="text-xl font-bold text-slate-800 dark:text-white mb-4 flex items-center gap-2"><Activity className="text-purple-500"/> Auto-Categorization Rules</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">These rules are created automatically when you check "Apply to future" while editing a transaction.</p>
          
          <div className="max-h-60 overflow-y-auto rounded-xl border border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900">
            {rules.length === 0 ? (
              <p className="p-4 text-sm text-slate-500 text-center">No custom rules yet. Edit a transaction to create one.</p>
            ) : (
              <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                {rules.map((rule, idx) => (
                  <li key={idx} className="p-3 flex justify-between items-center text-sm">
                    <div>
                      <span className="font-semibold text-slate-700 dark:text-slate-200">If merchant contains: </span>
                      <span className="bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded text-xs font-mono">"{rule.keyword}"</span>
                    </div>
                    <div className="flex items-center gap-2">
                       <span className="text-slate-500">&rarr;</span>
                       <span className="bg-slate-200 dark:bg-slate-700 px-2 py-0.5 rounded text-xs">{rule.category} ({rule.subcategory})</span>
                       <button 
                         onClick={() => setRules(rules.filter((_, i) => i !== idx))}
                         className="ml-2 text-rose-400 hover:text-rose-600 transition-colors p-1"
                         title="Delete rule"
                       >
                         <Trash2 size={14}/>
                       </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

      </div>
    );
  };

  // --- Main Layout Render ---

  return (
    <div className="min-h-screen bg-[#f8fafc] dark:bg-[#0f172a] text-slate-900 dark:text-slate-100 font-sans transition-colors duration-300">
      
      {/* Top Navigation & App Bar */}
      <nav className="sticky top-0 z-50 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 px-4 sm:px-6 lg:px-8 py-3">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-4">
          
          {/* Logo & Brand */}
          <div className="flex items-center gap-3">
            <div className="bg-gradient-to-br from-blue-500 to-indigo-600 p-2 rounded-xl shadow-lg shadow-blue-500/20">
              <LineChartIcon className="text-white" size={24} />
            </div>
            <div>
              <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-slate-800 to-slate-500 dark:from-white dark:to-slate-400 tracking-tight">
                BudgetFlow
              </h1>
              <p className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">Privacy First</p>
            </div>
          </div>

          {/* Center Actions (Upload & Filter) */}
          <div className="flex flex-wrap items-center justify-center gap-3 w-full sm:w-auto">
             
             {/* File Upload Dropzone - Inline Mini */}
             <div 
                className={`relative flex items-center gap-2 px-4 py-2 rounded-full border border-dashed transition-all duration-300 cursor-pointer overflow-hidden
                  ${isDragging ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 scale-105' : 'border-slate-300 dark:border-slate-600 hover:border-blue-400 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleFileUpload}
             >
                <input 
                  type="file" 
                  accept=".csv" 
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" 
                  onChange={handleFileUpload}
                />
                <UploadCloud size={18} className={isDragging ? 'text-blue-500' : 'text-slate-500'} />
                <span className="text-sm font-medium text-slate-600 dark:text-slate-300 hidden md:inline">
                  {uploadStatus || 'Drop Statement (CSV)'}
                </span>
             </div>

             <div className="h-6 w-px bg-slate-200 dark:bg-slate-700 hidden sm:block"></div>

             {/* Date Filter */}
             <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 p-1 rounded-full border border-slate-200 dark:border-slate-700">
                <select 
                  className="bg-transparent text-sm font-medium text-slate-700 dark:text-slate-300 px-3 py-1.5 focus:outline-none appearance-none cursor-pointer"
                  value={dateFilter}
                  onChange={(e) => setDateFilter(e.target.value)}
                >
                  <option value="month1">Past 30 Days</option>
                  <option value="month3">Past 90 Days</option>
                  <option value="ytd">Year to Date</option>
                  <option value="all">All Time</option>
                  <option value="custom">Custom Range</option>
                </select>
                <Filter size={14} className="text-slate-400 mr-3 pointer-events-none" />
             </div>

             {dateFilter === 'custom' && (
                <div className="flex items-center gap-2 animate-in fade-in slide-in-from-left-2">
                  <input type="date" className="text-xs p-1.5 rounded bg-white dark:bg-slate-800 border dark:border-slate-700" value={customStartDate} onChange={e=>setCustomStartDate(e.target.value)}/>
                  <span className="text-slate-400">-</span>
                  <input type="date" className="text-xs p-1.5 rounded bg-white dark:bg-slate-800 border dark:border-slate-700" value={customEndDate} onChange={e=>setCustomEndDate(e.target.value)}/>
                </div>
             )}
          </div>

          {/* Right Actions */}
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-slate-500 dark:text-slate-400"
              title="Toggle Theme"
            >
              {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
            </button>
          </div>
        </div>
      </nav>

      {/* Main Layout Grid */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex flex-col md:flex-row gap-8">
        
        {/* Sidebar Navigation */}
        <aside className="w-full md:w-56 shrink-0">
          <div className="sticky top-28 flex flex-row md:flex-col gap-2 overflow-x-auto pb-4 md:pb-0 hide-scrollbar">
            {[
              { id: 'dashboard', icon: PieChartIcon, label: 'Dashboard' },
              { id: 'transactions', icon: List, label: 'Transactions', count: transactions.length },
              { id: 'settings', icon: SettingsIcon, label: 'Settings' }
            ].map(nav => (
              <button
                key={nav.id}
                onClick={() => { setCurrentView(nav.id); setSelectedCategory(null); }}
                className={`flex items-center gap-3 px-4 py-3 rounded-2xl transition-all duration-200 whitespace-nowrap md:whitespace-normal text-left font-medium
                  ${currentView === nav.id 
                    ? 'bg-blue-500 text-white shadow-md shadow-blue-500/20' 
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/50 hover:text-slate-900 dark:hover:text-white'
                  }`}
              >
                <nav.icon size={20} className={currentView === nav.id ? 'text-white' : 'opacity-70'} />
                <span>{nav.label}</span>
                {nav.count !== undefined && (
                  <span className={`ml-auto text-xs py-0.5 px-2 rounded-full ${currentView === nav.id ? 'bg-white/20 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'}`}>
                    {nav.count}
                  </span>
                )}
              </button>
            ))}
          </div>

           {/* Quick Stats Sidebar Snippet */}
           {transactions.length > 0 && currentView !== 'dashboard' && (
             <div className="mt-8 p-4 rounded-2xl bg-gradient-to-b from-blue-50 to-indigo-50 dark:from-slate-800 dark:to-slate-800/50 border border-blue-100 dark:border-slate-700 hidden md:block animate-in fade-in">
                <h4 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">Period Summary</h4>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-600 dark:text-slate-300">In</span>
                    <span className="font-semibold text-emerald-600 dark:text-emerald-400">${stats.income.toFixed(0)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-600 dark:text-slate-300">Out</span>
                    <span className="font-semibold text-rose-600 dark:text-rose-400">${stats.expenses.toFixed(0)}</span>
                  </div>
                  <div className="pt-2 mt-2 border-t border-blue-200/50 dark:border-slate-700 flex justify-between text-sm">
                    <span className="font-medium text-slate-700 dark:text-slate-200">Net</span>
                    <span className={`font-bold ${stats.netFlow >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                      ${stats.netFlow.toFixed(0)}
                    </span>
                  </div>
                </div>
             </div>
           )}
        </aside>

        {/* Main Content Area */}
        <main className="flex-1 min-w-0">
          {transactions.length === 0 && currentView === 'dashboard' ? (
             <div className="h-[60vh] flex flex-col items-center justify-center text-center animate-in fade-in zoom-in-95 duration-500">
                <div className="w-24 h-24 bg-blue-50 dark:bg-slate-800 rounded-full flex items-center justify-center mb-6 shadow-inner">
                  <LineChartIcon size={48} className="text-blue-500 opacity-80"/>
                </div>
                <h2 className="text-3xl font-bold text-slate-800 dark:text-white mb-4">Welcome to BudgetFlow</h2>
                <p className="text-slate-500 dark:text-slate-400 max-w-md mb-8 leading-relaxed">
                  Your privacy-first financial dashboard. All data is processed locally in your browser. Never sent to a server.
                </p>
                <div className="flex flex-col sm:flex-row gap-4">
                   <div 
                      className="relative px-6 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-xl font-semibold shadow-lg shadow-blue-500/30 transition-all cursor-pointer flex items-center gap-2 group overflow-hidden"
                      onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                      onDragLeave={() => setIsDragging(false)}
                      onDrop={handleFileUpload}
                   >
                     <input type="file" accept=".csv" className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" onChange={handleFileUpload} />
                     <UploadCloud size={20} className="group-hover:-translate-y-1 transition-transform" /> 
                     <span>Upload CSV Statement</span>
                   </div>
                   <button onClick={handleDemoData} className="px-6 py-3 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 rounded-xl font-semibold transition-all shadow-sm">
                     Load Demo Data
                   </button>
                </div>
                <p className="text-xs text-slate-400 mt-6 mt-4"><AlertCircle size={12} className="inline mr-1"/> Supports standard bank CSV exports.</p>
             </div>
          ) : (
            <>
              {selectedCategory ? (
                <DrilldownView />
              ) : (
                <>
                  {currentView === 'dashboard' && <DashboardView />}
                  {currentView === 'transactions' && <TransactionsView />}
                  {currentView === 'settings' && <SettingsView />}
                </>
              )}
            </>
          )}
        </main>
      </div>

      <style dangerouslySetInnerHTML={{__html: `
        .hide-scrollbar::-webkit-scrollbar { display: none; }
        .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}} />
    </div>
  );
}

// Helper icon component used in logo
function LineChartIcon(props) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 3v18h18" />
      <path d="m19 9-5 5-4-4-3 3" />
    </svg>
  )
}