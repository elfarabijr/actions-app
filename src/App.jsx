import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  signInAnonymously, 
  signInWithCustomToken, 
  onAuthStateChanged 
} from 'firebase/auth';
import { 
  doc, 
  setDoc, 
  getDoc, 
  onSnapshot,
  updateDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { 
  CheckCircle, 
  ListTodo, 
  LogOut, 
  Settings, 
  Save, 
  Loader2, 
  Clipboard, 
  User, 
  Clock, 
  ChevronLeft, 
  Zap, 
  Plus, 
  Trash2, 
  Check, 
  ShieldCheck, 
  ArrowRight, 
  ChevronDown,
  RefreshCw,
  Users,
  History,
  Trophy,
  KeyRound,
  RotateCcw,
  Eye,
  EyeOff,
  TrendingUp,
  BarChart3,
  ChevronRight,
  Lightbulb,
  CloudDownload,
  BarChart,
  AlertTriangle,
  Fingerprint,
  ShieldEllipsis,
  Activity,
  CloudOff
} from 'lucide-react';
import { auth, db } from './firebase';

const appId = 'actions-app-prod';

// --- DAFTAR KARYAWAN TETAP ---
const EMPLOYEES = [
  { id: 'alwi', name: 'Alwi Rahmat Muhamad', defaultPin: '123456' },
  { id: 'chyntia', name: 'Chyntia Pramudita Aristi', defaultPin: '123456' },
  { id: 'faiz', name: 'Faiz Abdurrahman Ali', defaultPin: '123456' },
  { id: 'hendra', name: 'Hendrayana', defaultPin: '123456' },
  { id: 'hilmy', name: 'Hilmy Abidzar Tawakal', defaultPin: '123456' },
  { id: 'jumari', name: 'Jumari', defaultPin: '123456' },
  { id: 'umam', name: 'Khoirul Umam', defaultPin: '123456' },
  { id: 'farhan', name: 'Muhammad Farhan Ardi Wiguna', defaultPin: '123456' },
  { id: 'hanif', name: 'Muhammad Hanif Rasidi', defaultPin: '123456' },
  { id: 'muslimin', name: 'Muslimin', defaultPin: '123456' },
  { id: 'nadiva', name: 'Nadiva Aulia Zahra', defaultPin: '123456' },
  { id: 'riska', name: 'Riska Anisa Putri', defaultPin: '123456' },
  { id: 'sophan', name: 'Sophan Hidayat', defaultPin: '123456' },
  { id: 'tazkia', name: 'Tazkia Normatiena Muhyiddin', defaultPin: '123456' },
  { id: 'tiyas', name: 'Tiyas Laysha Khairiyah', defaultPin: '123456' }
];

const LOGO_URL = "https://i.imgur.com/NxrRMoF.png";

const GAS_SCRIPT_CODE = `/**
 * PENTING: JANGAN TEKAN TOMBOL 'RUN' DI SINI.
 */
function doGet(e) {
  var name = e.parameter.name;
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Absensi');
  if (!sheet) return createJsonResponse([]);
  var data = sheet.getDataRange().getValues();
  var headers = data.shift(); 
  var result = data
    .filter(function(row) { return name ? row[1] == name : true; })
    .map(function(row) {
      return { timestamp: row[0], name: row[1], type: row[2], tasks: row[3], note: row[4], status: row[5] };
    }).reverse();
  return createJsonResponse(result);
}
function doPost(e) {
  var lock = LockService.getScriptLock();
  lock.tryLock(10000);
  try {
    var doc = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = doc.getSheetByName('Absensi');
    if (!sheet) {
      sheet = doc.insertSheet('Absensi');
      sheet.appendRow(['Timestamp', 'Nama', 'Tipe', 'Daftar Tugas', 'Catatan Tambahan', 'Status']);
    }
    var data = e.parameter; 
    if (e.postData && e.postData.contents && !data.name) {
      try { var jsonData = JSON.parse(e.postData.contents); if (jsonData.name) data = jsonData; } catch (err) {}
    }
    var timestamp = new Date();
    var todoString = "";
    if (data.todos && typeof data.todos === 'string' && (data.todos.startsWith('[') || data.todos.startsWith('{'))) {
      try {
        var tasks = JSON.parse(data.todos);
        if (Array.isArray(tasks)) {
           todoString = tasks.map(function(t) { return (t.done ? "[x] " : "[ ] ") + (t.text || ""); }).join("\\n");
        }
      } catch (e) { todoString = data.todos; }
    } else { todoString = data.todos || ""; }
    sheet.appendRow([timestamp, data.name, data.type, todoString, data.note || "-", data.status || 'Hadir']);
    return createJsonResponse({ "result": "success" });
  } catch (e) {
    return createJsonResponse({ "result": "error", "error": e.toString() });
  } finally { lock.releaseLock(); }
}
function createJsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
`;

export default function App() {
  // --- STATE ---
  const [user, setUser] = useState(null); 
  const [selectedEmployee, setSelectedEmployee] = useState(null); 
  const [view, setView] = useState('login');
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [msg, setMsg] = useState(null);
  
  const [attendanceData, setAttendanceData] = useState(null);
  const [tempTasks, setTempTasks] = useState([]); 
  const [taskInput, setTaskInput] = useState('');
  const [checkoutNote, setCheckoutNote] = useState(''); 
  
  const [loginSelection, setLoginSelection] = useState('');
  const [pinInput, setPinInput] = useState('');
  const [isPinMode, setIsPinMode] = useState(false);
  
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [lockoutTime, setLockoutTime] = useState(0);

  const [oldPinChange, setOldPinChange] = useState('');
  const [newPinChange, setNewPinChange] = useState('');
  const [confirmPinChange, setConfirmPinChange] = useState('');
  
  const [recapData, setRecapData] = useState([]);
  const [recapLoading, setRecapLoading] = useState(false);
  const [allRecapData, setAllRecapData] = useState([]);
  const [allRecapLoading, setAllRecapLoading] = useState(false);
  const [filterRange, setFilterRange] = useState('week'); 

  const [passInput, setPassInput] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [viewBeforePass, setViewBeforePass] = useState('login');
  const [configTab, setConfigTab] = useState('settings');

  const [config, setConfig] = useState({
    scriptUrl: 'https://script.google.com/macros/s/AKfycbyskS5aVE-5Ypol1_biIoBfSzDY6hIZ98KTpd3de7LkBebJ7lSD_N65TaLjc7laxsL3CA/exec',
  });

  const codeTextAreaRef = useRef(null);

  // --- HELPER: GET TODAY STRING ---
  const getTodayStr = () => {
    const d = new Date();
    return `${d.getFullYear()}-${(d.getMonth()+1).toString().padStart(2,'0')}-${d.getDate().toString().padStart(2,'0')}`;
  };

  // --- HYBRID DATA LOGIC ---
  // Memeriksa apakah data lokal hari ini sudah ada di data recap (Sheet)
  const isLocalDataMissingFromSheet = useMemo(() => {
    if (!attendanceData) return false;
    const d = new Date(attendanceData.checkInTime);
    const localDateStr = `${d.getFullYear()}-${(d.getMonth()+1).toString().padStart(2,'0')}-${d.getDate().toString().padStart(2,'0')}`;
    
    // Jika recapData kosong atau tidak ada yang tanggalnya sama dengan hari ini
    if (!recapData || recapData.length === 0) return true;

    return !recapData.some(item => {
        const rd = new Date(item.timestamp);
        const rdStr = `${rd.getFullYear()}-${(rd.getMonth()+1).toString().padStart(2,'0')}-${rd.getDate().toString().padStart(2,'0')}`;
        return rdStr === localDateStr;
    });
  }, [attendanceData, recapData]);

  // Menggabungkan data sheet dan data lokal untuk display
  const displayedHistory = useMemo(() => {
    let base = Array.isArray(recapData) ? [...recapData] : [];
    
    // Jika data lokal ada TAPI belum muncul di sheet, kita selipkan manual di paling atas
    if (attendanceData && isLocalDataMissingFromSheet) {
        const synthetic = {
            timestamp: attendanceData.checkInTime,
            type: 'CHECK_IN', 
            status: 'PENDING', // Penanda khusus
            tasks: attendanceData.tasks ? JSON.stringify(attendanceData.tasks) : ''
        };
        base.unshift(synthetic);
    }
    return base;
  }, [recapData, isLocalDataMissingFromSheet, attendanceData]);


  // --- ANALYTICS LOGIC (PERSONAL) ---
  const stats = useMemo(() => {
    // Gunakan displayedHistory agar analitik mencakup data hari ini meskipun belum sync
    if (!displayedHistory || displayedHistory.length === 0) return null;
    const uniqueDates = new Set();
    let totalTasksGlobal = 0;
    let completedTasksGlobal = 0;
    const dailyStats = {};

    displayedHistory.forEach(item => {
      if (!item.timestamp) return;
      const date = new Date(item.timestamp);
      if (isNaN(date.getTime())) return;
      
      const dateKey = `${date.getFullYear()}-${(date.getMonth()+1).toString().padStart(2,'0')}-${date.getDate().toString().padStart(2,'0')}`;
      uniqueDates.add(dateKey);

      const taskLines = item.tasks && typeof item.tasks === 'string' ? item.tasks.split('\n') : [];
      let itemTotal = 0;
      let itemDone = 0;

      taskLines.forEach(line => {
        const cleaned = line.trim();
        if (cleaned) {
          itemTotal++;
          totalTasksGlobal++;
          if (cleaned.includes('[x]')) {
            itemDone++;
            completedTasksGlobal++;
          }
        }
      });

      if (!dailyStats[dateKey]) {
        dailyStats[dateKey] = { total: 0, done: 0 };
      }
      dailyStats[dateKey].total += itemTotal;
      dailyStats[dateKey].done += itemDone;
    });

    const overallRate = totalTasksGlobal > 0 ? Math.round((completedTasksGlobal / totalTasksGlobal) * 100) : 0;
    const sortedDates = Object.keys(dailyStats).sort();
    const trendData = sortedDates
      .slice(-7)
      .map(key => ({
        label: key.split('-')[2],
        rate: dailyStats[key].total > 0 ? Math.round((dailyStats[key].done / dailyStats[key].total) * 100) : 0,
        fullDate: key
      }));

    return { 
      totalPresence: uniqueDates.size, 
      totalTasks: totalTasksGlobal, 
      completedTasks: completedTasksGlobal, 
      completionRate: overallRate,
      trendData
    };
  }, [displayedHistory]);

  const getInsight = (score) => {
    if (score >= 90) return { 
        title: "Performa Elit", 
        text: "Target tercapai maksimal.", 
        color: "text-white", 
        subColor: "text-emerald-100",
        bg: "bg-linear-to-br from-emerald-600 to-emerald-800", 
        border: "border-emerald-500",
        shadow: "shadow-emerald-500/40",
        barColor: "bg-emerald-400", 
        hex: "#34d399",
        bgCircle: "rgba(255,255,255,0.2)"
    };
    if (score >= 70) return { 
        title: "Sangat Solid", 
        text: "Kerja tim yang produktif.", 
        color: "text-white", 
        subColor: "text-blue-100",
        bg: "bg-linear-to-br from-blue-600 to-blue-800", 
        border: "border-blue-500",
        shadow: "shadow-blue-500/40",
        barColor: "bg-blue-400", 
        hex: "#60a5fa",
        bgCircle: "rgba(255,255,255,0.2)"
    };
    if (score >= 50) return { 
        title: "Cukup Stabil", 
        text: "Pertahankan konsistensi.", 
        color: "text-white", 
        subColor: "text-orange-100",
        bg: "bg-linear-to-br from-orange-500 to-orange-700", 
        border: "border-orange-400",
        shadow: "shadow-orange-500/40",
        barColor: "bg-orange-300", 
        hex: "#fdba74",
        bgCircle: "rgba(255,255,255,0.2)"
    };
    return { 
        title: "Butuh Evaluasi", 
        text: "Tingkatkan penyelesaian tugas.", 
        color: "text-white", 
        subColor: "text-red-100",
        bg: "bg-linear-to-br from-red-600 to-red-800", 
        border: "border-red-500",
        shadow: "shadow-red-500/40",
        barColor: "bg-red-400", 
        hex: "#f87171",
        bgCircle: "rgba(255,255,255,0.2)"
    };
  };

  const teamReport = useMemo(() => {
    if (!allRecapData || allRecapData.length === 0) return { users: [], summary: null };
    const userStatsMap = {};
    let globalTotalTasks = 0;
    let globalDoneTasks = 0;
    const globalDates = new Set();
    const activeUserCountSet = new Set();
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const startOfYesterday = startOfToday - (24 * 60 * 60 * 1000);
    const startOf7DaysAgo = startOfToday - (7 * 24 * 60 * 60 * 1000);
    const startOf30DaysAgo = startOfToday - (30 * 24 * 60 * 60 * 1000);

    allRecapData.forEach(item => {
      if (!item.name || !item.timestamp) return;
      const itemTime = new Date(item.timestamp).getTime();
      const itemDateObj = new Date(item.timestamp);
      let isMatch = true;
      if (filterRange === 'today') isMatch = itemTime >= startOfToday;
      else if (filterRange === 'yesterday') isMatch = itemTime >= startOfYesterday && itemTime < startOfToday;
      else if (filterRange === 'week') isMatch = itemTime >= startOf7DaysAgo;
      else if (filterRange === 'month') isMatch = itemDateObj.getMonth() === now.getMonth() && itemDateObj.getFullYear() === now.getFullYear();
      else if (filterRange === 'last30') isMatch = itemTime >= startOf30DaysAgo;

      if (!isMatch) return;
      const name = item.name;
      const dateKey = `${itemDateObj.getFullYear()}-${(itemDateObj.getMonth()+1).toString().padStart(2,'0')}-${itemDateObj.getDate().toString().padStart(2,'0')}`;
      globalDates.add(dateKey);
      if (!userStatsMap[name]) { userStatsMap[name] = { name: name, dates: new Set(), totalTasks: 0, doneTasks: 0 }; }
      userStatsMap[name].dates.add(dateKey);
      activeUserCountSet.add(name);
      const taskLines = item.tasks && typeof item.tasks === 'string' ? item.tasks.split('\n') : [];
      taskLines.forEach(line => {
        if (line.trim()) {
          userStatsMap[name].totalTasks++;
          globalTotalTasks++;
          if (line.includes('[x]')) { 
            userStatsMap[name].doneTasks++; 
            globalDoneTasks++; 
          }
        }
      });
    });

    const usersListRaw = Object.values(userStatsMap).map(u => ({
      ...u, presenceCount: u.dates.size, 
      score: u.totalTasks > 0 ? Math.round((u.doneTasks / u.totalTasks) * 100) : 0
    })).sort((a, b) => b.score - a.score || b.presenceCount - a.presenceCount);

    const usersList = usersListRaw.map((u, i, arr) => {
        if (i > 0) {
            const prev = arr[i - 1];
            u.rank = (u.score === prev.score && u.presenceCount === prev.presenceCount) ? prev.rank : i + 1;
        } else { u.rank = 1; }
        return u;
    });

    const averageTeamScore = globalTotalTasks > 0 ? Math.round((globalDoneTasks / globalTotalTasks) * 100) : 0;
    return { users: usersList, summary: { totalGlobalTasks: globalTotalTasks, doneGlobalTasks: globalDoneTasks, averageScore: averageTeamScore, activeDays: globalDates.size, employeeCount: activeUserCountSet.size, insight: getInsight(averageTeamScore) } };
  }, [allRecapData, filterRange]);

  const VisualProgress = ({ percent, colorClass = "bg-emerald-500" }) => (
    <div className="w-full h-3 bg-white/20 rounded-full overflow-hidden mt-3 border border-white/10 shadow-inner">
      <div className={`h-full ${colorClass} transition-all duration-1000 ease-out rounded-full shadow-[0_0_10px_rgba(255,255,255,0.4)]`} style={{ width: `${percent}%` }}></div>
    </div>
  );

  const CircularProgress = ({ percent, color = "#10b981", bgStroke = "#e2e8f0" }) => {
    const radius = 36;
    const circumference = 2 * Math.PI * radius;
    const strokeDashoffset = circumference - (percent / 100) * circumference;
    return (
      <div className="relative inline-flex items-center justify-center">
        <svg className="w-20 h-20 transform -rotate-90 drop-shadow-lg">
          <circle cx="40" cy="40" r={radius} stroke={bgStroke} strokeWidth="8" fill="transparent" />
          <circle cx="40" cy="40" r={radius} stroke={color} strokeWidth="8" strokeDasharray={circumference} style={{ strokeDashoffset, transition: 'stroke-dashoffset 1s ease-out' }} strokeLinecap="round" fill="transparent" />
        </svg>
        <span className="absolute text-sm font-black text-white">{percent}%</span>
      </div>
    );
  };

  useEffect(() => {
    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) { await signInWithCustomToken(auth, __initial_auth_token); } 
        else { await signInAnonymously(auth); }
      } catch (err) { console.error("Auth failed:", err); } 
      finally { setLoading(false); }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, (u) => { setUser(u); });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user || !selectedEmployee) return;
    const docRef = doc(db, 'artifacts', appId, 'public', 'data', 'employee_status', selectedEmployee.id);
    const unsub = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        const today = getTodayStr();
        const lastActivityDate = data.updatedAt ? (() => {
            const d = new Date(data.updatedAt.toDate());
            return `${d.getFullYear()}-${(d.getMonth()+1).toString().padStart(2,'0')}-${d.getDate().toString().padStart(2,'0')}`;
        })() : null;

        if (data.status === 'ACTIVE') { 
          setAttendanceData(data); 
          setView(prev => (prev === 'change_pin' || prev === 'recap') ? prev : 'dashboard'); 
        } 
        else if (data.status === 'COMPLETED' && lastActivityDate === today) {
          setAttendanceData(data);
          setView(prev => (prev === 'change_pin' || prev === 'recap') ? prev : 'shift_locked');
        }
        else { 
          setAttendanceData(null); 
          setView(prev => (prev === 'change_pin' || prev === 'recap') ? prev : 'checkin'); 
        }
      } else { 
        setAttendanceData(null); 
        setView(prev => (prev === 'change_pin' || prev === 'recap') ? prev : 'checkin'); 
      }
    });
    return () => unsub();
  }, [user, selectedEmployee]);

  const requestConfigAccess = () => { setViewBeforePass(view); setView('pass_challenge'); setPassInput(''); setShowPass(false); };

  const handleVerifyPin = async () => {
    if (lockoutTime > 0) return;
    const emp = EMPLOYEES.find(e => e.id === loginSelection);
    if (!emp) return;
    setActionLoading(true);
    try {
        const credRef = doc(db, 'artifacts', appId, 'public', 'data', 'user_credentials', emp.id);
        const credSnap = await getDoc(credRef);
        let actualPin = emp.defaultPin; 
        if (credSnap.exists() && credSnap.data().pin) { actualPin = credSnap.data().pin; }
        
        if (pinInput === actualPin) {
            setSelectedEmployee(emp); 
            setFailedAttempts(0); 
            setIsPinMode(false); 
            setPinInput('');
            setMsg({ type: 'success', text: `Halo, ${emp.name}!` });
        } else {
            const newFailedCount = failedAttempts + 1;
            setFailedAttempts(newFailedCount);
            if (newFailedCount >= 3) { 
              setLockoutTime(30); 
              setMsg({ type: 'error', text: 'Terkunci 30 detik.' }); 
            } 
            else { 
              setMsg({ type: 'error', text: `PIN Salah! Sisa: ${3 - newFailedCount}` }); 
            }
        }
    } catch (e) { 
      setMsg({ type: 'error', text: 'Koneksi bermasalah.' }); 
    } finally { 
      setActionLoading(false); 
      setTimeout(() => setMsg(null), 3000); 
    }
  };

  const handleUpdatePin = async () => {
    if (!selectedEmployee) return;
    if (newPinChange !== confirmPinChange) {
      setMsg({ type: 'error', text: 'Konfirmasi PIN baru tidak cocok.' });
      return;
    }
    if (newPinChange.length < 6) {
      setMsg({ type: 'error', text: 'PIN minimal 6 digit.' });
      return;
    }

    setActionLoading(true);
    try {
      const credRef = doc(db, 'artifacts', appId, 'public', 'data', 'user_credentials', selectedEmployee.id);
      const credSnap = await getDoc(credRef);
      let currentStoredPin = selectedEmployee.defaultPin;
      if (credSnap.exists() && credSnap.data().pin) { currentStoredPin = credSnap.data().pin; }

      if (oldPinChange !== currentStoredPin) {
        setMsg({ type: 'error', text: 'PIN lama salah.' });
      } else {
        await setDoc(credRef, { pin: newPinChange, updatedAt: serverTimestamp() }, { merge: true });
        setMsg({ type: 'success', text: 'PIN berhasil diperbarui!' });
        if (attendanceData) {
            setView(attendanceData.status === 'COMPLETED' ? 'shift_locked' : 'dashboard');
        } else {
            setView('checkin');
        }
        setOldPinChange(''); setNewPinChange(''); setConfirmPinChange('');
      }
    } catch (e) {
      setMsg({ type: 'error', text: 'Gagal memperbarui PIN.' });
    } finally {
      setActionLoading(false);
      setTimeout(() => setMsg(null), 3000);
    }
  };

  const handleResetUserPin = async (empId, empName) => {
    setActionLoading(true);
    try {
        const credRef = doc(db, 'artifacts', appId, 'public', 'data', 'user_credentials', empId);
        await setDoc(credRef, { pin: '123456', updatedAt: serverTimestamp() }, { merge: true });
        setMsg({ type: 'success', text: `PIN ${empName} direset!` });
    } catch (e) { setMsg({ type: 'error', text: 'Gagal reset.' }); } 
    finally { setActionLoading(false); setTimeout(() => setMsg(null), 3000); }
  };

  const verifyAdminPassword = async () => {
    const cleanInput = passInput.trim();
    if (!cleanInput) return;
    setActionLoading(true);
    try {
        const configRef = doc(db, 'artifacts', appId, 'public', 'data', 'admin_config', 'credentials');
        const snap = await getDoc(configRef);
        if (snap.exists() && snap.data().pass === cleanInput) { setView('config'); setPassInput(''); } 
        else { setMsg({ type: 'error', text: 'Sandi Salah!' }); }
    } catch (err) { setMsg({ type: 'error', text: 'Database Sibuk.' }); } 
    finally { setActionLoading(false); setTimeout(() => setMsg(null), 3000); }
  };

  // FETCH RECAP - FIXED WITH CACHE BUSTER
  const fetchRecapData = async (manual = false) => {
    if (!selectedEmployee || !config.scriptUrl) return;
    setRecapLoading(true); 
    if (!manual) setView('recap');
    try {
      // CACHE BUSTER: Menambahkan timestamp agar browser tidak mengambil data lama
      const response = await fetch(`${config.scriptUrl}?name=${encodeURIComponent(selectedEmployee.name)}&t=${Date.now()}`);
      const data = await response.json();
      setRecapData(Array.isArray(data) ? data : []);
      if (manual) setMsg({ type: 'success', text: 'Data sinkron!' });
    } catch (e) { 
      setMsg({ type: 'error', text: 'Gagal ambil histori.' }); 
    } finally { 
      setRecapLoading(false); 
      setTimeout(() => setMsg(null), 3000);
    }
  };

  const fetchAllRecap = async () => {
    if (!config.scriptUrl) return;
    setAllRecapLoading(true);
    try {
      const response = await fetch(`${config.scriptUrl}?t=${Date.now()}`);
      const data = await response.json();
      setAllRecapData(Array.isArray(data) ? data : []);
      setMsg({ type: 'success', text: 'Data tim diperbarui!' });
    } catch (e) { setMsg({ type: 'error', text: 'Gagal sinkron tim.' }); } 
    finally { setAllRecapLoading(false); setTimeout(() => setMsg(null), 3000); }
  };

  const handleCheckIn = async () => {
    if (tempTasks.length === 0 || !user || !selectedEmployee) { 
      setMsg({ type: 'error', text: 'Isi minimal satu target.' }); 
      setTimeout(() => setMsg(null), 3000); 
      return; 
    }
    
    setActionLoading(true);
    const docRef = doc(db, 'artifacts', appId, 'public', 'data', 'employee_status', selectedEmployee.id);
    try {
      const data = { 
        employeeId: selectedEmployee.id, 
        employeeName: selectedEmployee.name, 
        checkInTime: new Date().toISOString(), 
        tasks: tempTasks, 
        status: 'ACTIVE', 
        updatedAt: serverTimestamp() 
      };
      await setDoc(docRef, data);
      await sendToSheet('CHECK_IN', tempTasks, selectedEmployee.name);
      setMsg({ type: 'success', text: 'Sesi Dimulai!' }); 
      setTempTasks([]); 
      setTaskInput('');
    } catch (err) { 
      setMsg({ type: 'error', text: 'Gagal simpan sesi.' }); 
    } finally { 
      setActionLoading(false); 
      setTimeout(() => setMsg(null), 3000); 
    }
  };

  const handleUpdateTask = async (idx) => {
    if (!user || !attendanceData || !selectedEmployee) return;
    const updatedTasks = [...attendanceData.tasks];
    updatedTasks[idx].done = !updatedTasks[idx].done;
    const docRef = doc(db, 'artifacts', appId, 'public', 'data', 'employee_status', selectedEmployee.id);
    try {
      await updateDoc(docRef, { tasks: updatedTasks, updatedAt: serverTimestamp() });
    } catch(e) {}
  };

  const addTaskToActiveSession = async () => {
    if (!user || !taskInput.trim() || !attendanceData || !selectedEmployee) return;
    const updatedTasks = [...attendanceData.tasks, { text: taskInput, done: false }];
    const docRef = doc(db, 'artifacts', appId, 'public', 'data', 'employee_status', selectedEmployee.id);
    try {
      await updateDoc(docRef, { tasks: updatedTasks, updatedAt: serverTimestamp() });
      setTaskInput('');
    } catch(e) {}
  };

  const addTempTask = () => { if (taskInput.trim()) { setTempTasks([...tempTasks, { text: taskInput, done: false }]); setTaskInput(''); } };
  const removeTempTask = (idx) => setTempTasks(tempTasks.filter((_, i) => i !== idx));

  const handleCheckOut = async () => {
    if (!user || !selectedEmployee || !attendanceData) return;
    setActionLoading(true);
    const docRef = doc(db, 'artifacts', appId, 'public', 'data', 'employee_status', selectedEmployee.id);
    try {
      await sendToSheet('CHECK_OUT', attendanceData.tasks, selectedEmployee.name, checkoutNote);
      await setDoc(docRef, { 
        status: 'COMPLETED', 
        updatedAt: serverTimestamp() 
      }, { merge: true });
      
      setMsg({ type: 'success', text: 'Laporan Selesai!' });
      setCheckoutNote('');
      
      setTimeout(() => { 
        setSelectedEmployee(null); 
        setAttendanceData(null); 
        setView('login'); 
      }, 2000);
    } catch (err) { 
      setMsg({ type: 'error', text: 'Gagal kirim laporan.' }); 
    } finally { 
      setActionLoading(false); 
      setTimeout(() => setMsg(null), 3000); 
    }
  };

  const sendToSheet = async (type, tasks, employeeName, note = "") => {
    if (!config.scriptUrl) return;
    const formData = new URLSearchParams();
    formData.append('name', employeeName); 
    formData.append('type', type); 
    formData.append('todos', JSON.stringify(tasks)); 
    formData.append('note', note); 
    try { 
      await fetch(config.scriptUrl, { method: 'POST', mode: 'no-cors', body: formData.toString() }); 
    } catch (e) { 
      console.error("Sheet sync failed:", e); 
    }
  };

  if (loading) return (
    <div className="max-w-md mx-auto min-h-screen flex items-center justify-center bg-white"><Loader2 className="w-10 h-10 animate-spin text-emerald-500" /></div>
  );

  return (
    <div className="max-w-md mx-auto bg-slate-50 min-h-screen shadow-2xl relative font-sans text-slate-800 flex flex-col overflow-hidden leading-none">
      
      {/* HEADER */}
      {view !== 'login' && view !== 'pass_challenge' && (
        <div className="bg-linear-to-r from-emerald-600 to-emerald-800 p-5 text-white flex justify-between items-center shadow-xl z-30 border-b border-emerald-500/30">
          <div className="flex items-center gap-4 text-left">
            <div className="bg-white/20 p-1.5 rounded-2xl backdrop-blur-md border border-white/30 shadow-inner">
              <img src={LOGO_URL} alt="Logo" className="w-10 h-10 object-contain" onError={(e) => e.target.style.display='none'} />
            </div>
            <div className="flex flex-col">
              <h1 className="font-black text-xl tracking-tighter uppercase leading-none">ACTIONS</h1>
              <span className="text-[8px] font-black bg-white/20 px-2 py-0.5 rounded-full mt-1 uppercase w-fit">{selectedEmployee?.name || 'Enterprise'}</span>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={() => { setSelectedEmployee(null); setView('login'); }} className="p-3 bg-white/10 rounded-2xl hover:bg-white/30 transition-all active:scale-95 shadow-sm"><Users className="w-4 h-4" /></button>
            <button onClick={requestConfigAccess} className="p-3 bg-white/10 rounded-2xl hover:bg-white/30 transition-all active:scale-95 shadow-sm"><Settings className="w-4 h-4" /></button>
          </div>
        </div>
      )}

      {/* NOTIFIKASI */}
      {msg && (
        <div className="fixed bottom-28 left-4 right-4 z-100 animate-in slide-in-from-bottom-6">
          <div className={`p-4 rounded-[2.5rem] shadow-2xl border-2 flex items-center gap-4 ${msg.type === 'error' ? 'bg-red-50 border-red-200 text-red-900 shadow-red-200/50' : 'bg-emerald-50 border-emerald-200 text-emerald-900 shadow-emerald-200/50'}`}>
            <div className={`p-2 rounded-2xl ${msg.type === 'error' ? 'bg-red-500 shadow-red-300 shadow-lg' : 'bg-emerald-500 shadow-emerald-300 shadow-lg'}`}>
                <Zap className="w-4 h-4 text-white" />
            </div>
            <span className="text-xs font-black tracking-tight">{msg.text}</span>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto z-10">
        
        {/* VIEW: LOGIN */}
        {view === 'login' && (
          <div className="min-h-screen flex flex-col items-center justify-between p-8 pb-12 animate-in fade-in bg-white">
             <div className="w-full flex justify-between items-center pt-4">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-emerald-600" />
                <span className="text-[10px] font-black uppercase text-emerald-700 tracking-widest leading-none">Enterprise Secure</span>
              </div>
              <button onClick={requestConfigAccess} className="p-3 bg-white shadow-sm border border-slate-100 rounded-2xl text-slate-400 hover:text-emerald-500 transition-colors">
                <Settings className="w-5 h-5" />
              </button>
            </div>

            <div className="flex flex-col items-center text-center space-y-8 py-6">
              <div className="relative group">
                <div className="absolute inset-0 bg-emerald-500 blur-3xl opacity-20 rounded-full animate-pulse"></div>
                <img src={LOGO_URL} className="w-32 h-auto drop-shadow-2xl brightness-105" alt="Logo" />
              </div>
              <div className="space-y-1">
                <h2 className="text-4xl font-black text-slate-900 tracking-tighter leading-none">ACTIONS</h2>
                <p className="text-emerald-600 text-[10px] font-black tracking-widest leading-none">Attendance and Todo-list Information System</p>
              </div>
            </div>
            
            {!isPinMode ? (
              <div className="w-full space-y-6">
                 <div className="relative group text-left">
                    <User className="absolute left-6 top-6 text-slate-300 z-10 w-5 h-5" />
                    <select value={loginSelection} onChange={(e) => setLoginSelection(e.target.value)} className="w-full p-6 pl-16 pr-12 border-2 border-slate-100 rounded-[2.2rem] focus:border-emerald-500 outline-none shadow-sm font-bold appearance-none bg-white text-slate-700 cursor-pointer transition-all hover:border-emerald-200 leading-none">
                      <option value="" disabled>Pilih Nama Anda</option>
                      {EMPLOYEES.map(emp => (<option key={emp.id} value={emp.id}>{emp.name}</option>))}
                    </select>
                    <div className="absolute right-6 top-6 pointer-events-none text-slate-300"><ChevronDown className="w-5 h-5" /></div>
                 </div>
                 <button onClick={() => loginSelection && setIsPinMode(true)} disabled={!loginSelection} className="w-full flex items-center justify-center gap-3 text-white py-6 rounded-[2.2rem] font-black text-sm shadow-xl bg-emerald-600 active:scale-95 transition-all uppercase tracking-widest hover:bg-emerald-700 shadow-emerald-200 leading-none">
                    Masuk Aplikasi <ArrowRight className="w-4 h-4" />
                 </button>
              </div>
            ) : (
              <div className="w-full max-w-xs space-y-6 animate-in slide-in-from-right-10">
                 <div className="space-y-2 text-center">
                    <h3 className="text-xl font-black text-slate-900 leading-tight">Verifikasi PIN</h3>
                    <p className="text-[10px] text-slate-400 font-bold uppercase leading-none">{lockoutTime > 0 ? `Tunggu ${lockoutTime}s` : 'Masukkan 6 digit PIN'}</p>
                 </div>
                 <div className="relative">
                    <KeyRound className="absolute left-6 top-6 text-slate-300 w-5 h-5" />
                    <input type="password" placeholder="******" maxLength={6} className="w-full p-6 pl-16 border-2 border-slate-100 rounded-[2.2rem] focus:border-emerald-500 outline-none text-center font-black tracking-[0.5em] text-slate-700 bg-white transition-all shadow-inner leading-none" value={pinInput} onChange={(e) => setPinInput(e.target.value)} onKeyPress={(e) => e.key === 'Enter' && handleVerifyPin()} disabled={lockoutTime > 0} autoFocus />
                 </div>
                 <div className="flex gap-3">
                   <button onClick={() => setIsPinMode(false)} className="flex-1 py-5 rounded-3xl bg-white border-2 border-slate-100 text-slate-400 font-black text-[10px] uppercase hover:bg-slate-50 transition-colors leading-none">Batal</button>
                   <button onClick={handleVerifyPin} disabled={lockoutTime > 0 || actionLoading} className="flex-2 py-5 rounded-3xl text-white font-black text-[10px] uppercase shadow-xl bg-emerald-600 flex justify-center items-center gap-2 hover:bg-emerald-700 active:scale-95 transition-all shadow-emerald-100 leading-none">
                       {actionLoading ? <Loader2 className="w-4 h-4 animate-spin"/> : "Verifikasi"}
                   </button>
                 </div>
              </div>
            )}
          </div>
        )}

        {/* VIEW: PASS CHALLENGE */}
        {view === 'pass_challenge' && (
          <div className="min-h-screen flex flex-col items-center justify-center p-8 animate-in zoom-in-95 bg-white">
            <div className="w-full max-w-xs space-y-8 text-center">
              <div className="space-y-4">
                <div className="w-20 h-20 bg-emerald-50 text-emerald-600 rounded-4xl flex items-center justify-center mx-auto shadow-inner border border-emerald-100">
                    <ShieldCheck className="w-8 h-8" />
                </div>
                <h3 className="text-2xl font-black text-slate-900 leading-tight text-center">Verifikasi Admin</h3>
              </div>
              <div className="space-y-4">
                <div className="relative">
                   <input type={showPass ? "text" : "password"} placeholder="Sandi Admin..." className="w-full p-6 border-2 border-slate-100 rounded-4xl focus:border-emerald-500 outline-none text-center font-bold tracking-[0.2em] bg-white shadow-sm leading-none" value={passInput} onChange={(e) => setPassInput(e.target.value)} onKeyPress={(e) => e.key === 'Enter' && verifyAdminPassword()} autoFocus />
                   <button onClick={() => setShowPass(!showPass)} className="absolute right-6 top-6 text-slate-300 hover:text-emerald-500">
                     {showPass ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                   </button>
                </div>
                <div className="flex gap-3">
                   <button onClick={() => setView(viewBeforePass)} className="flex-1 py-5 rounded-3xl bg-white border-2 border-slate-50 text-slate-400 font-black text-[10px] uppercase leading-none">Batal</button>
                   <button onClick={verifyAdminPassword} disabled={actionLoading} className="flex-2 py-5 rounded-3xl bg-slate-900 text-white font-black text-[10px] uppercase shadow-xl flex items-center justify-center gap-2 active:scale-95 transition-all leading-none">
                     {actionLoading ? <Loader2 className="w-4 h-4 animate-spin"/> : "Buka Akses"}
                   </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* VIEW: SHIFT LOCKED */}
        {view === 'shift_locked' && (
          <div className="px-6 py-12 flex flex-col items-center justify-center min-h-[calc(100vh-100px)] animate-in zoom-in-95 space-y-8 text-center">
             <div className="w-24 h-24 bg-red-100 text-red-600 rounded-[2.5rem] flex items-center justify-center shadow-xl border-4 border-white shadow-red-100 transform rotate-3">
                <AlertTriangle className="w-10 h-10" />
             </div>
             <div className="space-y-4">
                <h3 className="text-2xl font-black text-slate-900 leading-tight">Sesi Sudah Selesai</h3>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest leading-relaxed">
                  Halo {selectedEmployee?.name.split(' ')[0]}, Anda sudah mengirimkan laporan absen hari ini. <br/>Aplikasi akan dikunci hingga besok pagi.
                </p>
             </div>
             <div className="w-full max-w-xs space-y-3">
                <button onClick={() => fetchRecapData()} className="w-full bg-emerald-600 text-white py-6 rounded-[2.2rem] font-black text-xs shadow-xl active:scale-95 transition-all uppercase tracking-widest flex items-center justify-center gap-3 leading-none">
                   <History className="w-5 h-5" /> Histori Performa
                </button>
                <div className="flex gap-3">
                    <button onClick={() => setView('change_pin')} className="flex-1 bg-slate-100 text-slate-500 py-6 rounded-[2.2rem] font-black text-[10px] uppercase flex items-center justify-center gap-2 leading-none">
                        <Fingerprint className="w-4 h-4" /> Ganti PIN
                    </button>
                    <button onClick={() => { setSelectedEmployee(null); setView('login'); }} className="flex-1 bg-white border-2 border-slate-100 text-slate-400 py-6 rounded-[2.2rem] font-black text-[10px] active:scale-95 transition-all uppercase tracking-widest leading-none">
                        Keluar
                    </button>
                </div>
             </div>
          </div>
        )}

        {/* VIEW: DASHBOARD */}
        {view === 'dashboard' && attendanceData && (
          <div className="px-6 py-8 space-y-8 animate-in fade-in pb-20 text-left">
            <div className="bg-linear-to-br from-emerald-600 to-emerald-800 rounded-[2.5rem] p-8 text-white shadow-2xl relative overflow-hidden">
               <div className="absolute -right-10 -bottom-10 w-40 h-40 bg-white/10 rounded-full blur-2xl"></div>
               <div className="relative z-10 space-y-8 text-left">
                  <div className="flex justify-between items-start">
                    <div className="space-y-1">
                      <p className="text-white/60 text-[10px] font-black uppercase tracking-widest leading-none">Status: SEDANG KERJA</p>
                      <h2 className="text-4xl font-black tracking-tighter leading-none">{selectedEmployee?.name.split(' ')[0]}</h2>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                        <button onClick={() => setView('change_pin')} className="flex items-center gap-2 bg-white/10 backdrop-blur-md px-3 py-2 rounded-xl border border-white/20 hover:bg-white/30 transition-all shadow-sm">
                            <Fingerprint className="w-4 h-4" />
                            <span className="text-[8px] font-black uppercase">Keamanan</span>
                        </button>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="flex-1 bg-white/10 backdrop-blur-md p-4 rounded-3xl border border-white/20 text-center shadow-lg">
                      <p className="text-[9px] uppercase font-black opacity-60 mb-2 leading-none">Mulai</p>
                      <p className="text-xl font-black leading-none">{new Date(attendanceData.checkInTime).toLocaleTimeString('id-ID', {hour: '2-digit', minute:'2-digit'})}</p>
                    </div>
                    <div className="flex-1 bg-white/10 backdrop-blur-md p-4 rounded-3xl border border-white/20 text-center flex flex-col items-center justify-center gap-1 shadow-lg">
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse shadow-emerald-400 shadow-[0_0_8px]"></span>
                        <p className="text-[9px] font-black uppercase tracking-widest leading-none">Live Sync</p>
                    </div>
                  </div>
               </div>
            </div>

            {/* DASHBOARD INSIGHTS */}
            {(() => {
                const total = attendanceData.tasks.length;
                const done = attendanceData.tasks.filter(t => t.done).length;
                const score = total > 0 ? Math.round((done / total) * 100) : 0;
                return (
                    <div className="bg-white p-6 rounded-[2.5rem] border-2 border-slate-100 shadow-xl animate-in slide-in-from-left-6 space-y-6">
                        <div className="flex items-center gap-4">
                            <div className="p-3 rounded-2xl bg-emerald-500 text-white shadow-lg"><TrendingUp className="w-5 h-5" /></div>
                            <div className="flex-1">
                                <h4 className="text-sm font-black text-slate-800 leading-none mb-1">Target Harian</h4>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none">Penyelesaian Agenda</p>
                            </div>
                            <div className="text-right">
                                <p className="text-xl font-black text-emerald-600 leading-none">{score}%</p>
                            </div>
                        </div>
                        <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden border border-slate-50 shadow-inner">
                            <div className="h-full bg-emerald-500 transition-all duration-1000 ease-out rounded-full shadow-md" style={{ width: `${score}%` }}></div>
                        </div>
                        <div className="flex justify-between items-center">
                            <div className="text-[9px] font-black uppercase tracking-widest text-slate-400 leading-none">
                                Selesai: {done} / {total}
                            </div>
                            <button onClick={() => fetchRecapData()} className="flex items-center gap-2 text-[9px] font-black text-emerald-600 bg-emerald-50 px-3 py-2 rounded-xl border border-emerald-100 active:scale-95 transition-all shadow-sm leading-none">
                                <BarChart className="w-3 h-3" /> Detail Analitik
                            </button>
                        </div>
                    </div>
                );
            })()}

            <div className="space-y-5">
              <h3 className="font-black text-slate-900 tracking-tight flex items-center gap-2 text-xs uppercase px-2 leading-none"><ListTodo className="w-4 h-4 text-emerald-500" /> Agenda Kerja</h3>
              <div className="bg-white p-1 rounded-3xl shadow-lg border-2 border-slate-100 flex items-center pr-3 leading-none focus-within:border-emerald-200 transition-colors">
                <input type="text" className="flex-1 p-4 px-6 rounded-2xl text-xs font-bold text-slate-700 outline-none bg-transparent h-12 leading-none" placeholder="Tambah tugas..." value={taskInput} onChange={(e) => setTaskInput(e.target.value)} onKeyPress={(e) => e.key === 'Enter' && addTaskToActiveSession()} />
                <button onClick={addTaskToActiveSession} className="p-3 rounded-xl bg-emerald-500 text-white shadow-lg active:scale-90 transition-all hover:bg-emerald-600"><Plus className="w-5 h-5" /></button>
              </div>
              <div className="bg-white rounded-[2.5rem] shadow-xl border border-slate-100 overflow-hidden divide-y divide-slate-50 p-2">
                {attendanceData.tasks.map((task, idx) => (
                  <div key={idx} onClick={() => handleUpdateTask(idx)} className="p-5 flex items-start gap-4 hover:bg-slate-50 rounded-4xl cursor-pointer transition-all group">
                    <div className={`mt-0.5 w-8 h-8 rounded-xl border-2 flex items-center justify-center transition-all ${task.done ? 'bg-emerald-500 border-emerald-500 shadow-emerald-200 shadow-lg' : 'border-slate-100 bg-white group-hover:border-slate-200'}`}>
                      {task.done && <Check className="w-4 h-4 text-white"/>}
                    </div>
                    <span className={`text-sm font-bold flex-1 py-1 text-left leading-tight ${task.done ? 'text-slate-300 line-through' : 'text-slate-700'}`}>{task.text}</span>
                  </div>
                ))}
              </div>
            </div>

            <button onClick={() => setView('checkout')} className="w-full bg-red-600 text-white py-6 rounded-[2.2rem] font-black text-xs shadow-xl flex items-center justify-center gap-3 uppercase tracking-widest active:scale-95 transition-all hover:bg-red-700 shadow-red-100 leading-none">
              <LogOut className="w-5 h-5"/> Kirim Laporan & Selesai
            </button>
          </div>
        )}

        {/* VIEW: CHANGE PIN MANDIRI */}
        {view === 'change_pin' && (
            <div className="p-8 space-y-8 animate-in slide-in-from-right-10 text-left pb-24">
                <div className="flex items-center gap-4 leading-none">
                    <button onClick={() => {
                        if (attendanceData) {
                            setView(attendanceData.status === 'COMPLETED' ? 'shift_locked' : 'dashboard');
                        } else {
                            setView('checkin');
                        }
                    }} className="p-3 bg-white border-2 border-slate-100 rounded-2xl shadow-sm text-slate-600 transition-all active:scale-95 hover:bg-slate-50 leading-none"><ChevronLeft className="w-5 h-5" /></button>
                    <h2 className="text-2xl font-black text-slate-900 tracking-tight leading-tight">Keamanan PIN</h2>
                </div>

                <div className="bg-white p-8 rounded-[2.5rem] shadow-2xl border border-slate-100 space-y-6">
                    <div className="text-center space-y-2 mb-4">
                        <div className="w-16 h-16 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto border-2 border-emerald-100 shadow-inner">
                            <ShieldEllipsis className="w-8 h-8" />
                        </div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] leading-none">Perbarui Akses Anda</p>
                    </div>

                    <div className="space-y-4">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2 leading-none ml-1">PIN Saat Ini</label>
                            <input type="password" placeholder="******" maxLength={6} className="w-full p-5 border-2 border-slate-50 rounded-2xl focus:border-emerald-200 outline-none text-center font-black tracking-[0.5em] text-slate-700 bg-slate-50 transition-all leading-none" value={oldPinChange} onChange={(e) => setOldPinChange(e.target.value)} />
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2 leading-none ml-1">PIN Baru (6 Digit)</label>
                            <input type="password" placeholder="******" maxLength={6} className="w-full p-5 border-2 border-slate-50 rounded-2xl focus:border-emerald-200 outline-none text-center font-black tracking-[0.5em] text-slate-700 bg-slate-50 transition-all leading-none" value={newPinChange} onChange={(e) => setNewPinChange(e.target.value)} />
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2 leading-none ml-1">Konfirmasi PIN Baru</label>
                            <input type="password" placeholder="******" maxLength={6} className="w-full p-5 border-2 border-slate-50 rounded-2xl focus:border-emerald-200 outline-none text-center font-black tracking-[0.5em] text-slate-700 bg-slate-50 transition-all leading-none" value={confirmPinChange} onChange={(e) => setConfirmPinChange(e.target.value)} />
                        </div>
                    </div>
                    
                    <button onClick={handleUpdatePin} disabled={actionLoading} className="w-full bg-slate-900 text-white py-6 rounded-3xl font-black text-xs shadow-xl active:scale-95 flex items-center justify-center gap-3 uppercase tracking-widest hover:bg-black transition-all leading-none">
                        {actionLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                        Simpan PIN Baru
                    </button>
                </div>
            </div>
        )}

        {/* VIEW: CONFIG */}
        {view === 'config' && (
          <div className="animate-in slide-in-from-right-10 px-6 py-8 space-y-8 pb-24 text-center">
            <div className="flex items-center gap-4 leading-none"><button onClick={() => {
                 if (attendanceData) {
                    setView(attendanceData.status === 'COMPLETED' ? 'shift_locked' : 'dashboard');
                } else {
                    setView('checkin');
                }
            }} className="p-3 bg-white border border-slate-100 rounded-2xl shadow-sm text-slate-600 leading-none"><ChevronLeft className="w-5 h-5" /></button><h2 className="text-2xl font-black text-slate-900 tracking-tight text-left leading-tight">Admin Console</h2></div>
            <div className="flex bg-slate-200 p-1 rounded-2xl gap-1 overflow-x-auto leading-none"><button onClick={() => setConfigTab('settings')} className={`flex-1 py-3 rounded-xl font-black text-[9px] uppercase transition-all ${configTab === 'settings' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-500'}`}>Koneksi</button><button onClick={() => setConfigTab('reports')} className={`flex-1 py-3 rounded-xl font-black text-[9px] uppercase transition-all ${configTab === 'reports' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-500'}`}>Tim</button><button onClick={() => setConfigTab('users')} className={`flex-1 py-3 rounded-xl font-black text-[9px] uppercase transition-all ${configTab === 'users' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-500'}`}>User</button></div>
            
            <div className="space-y-6">
              {configTab === 'settings' && (
                <div className="space-y-6 animate-in fade-in leading-none">
                  <div className="bg-white p-6 rounded-[2.5rem] shadow-xl border-2 border-slate-100 space-y-4 text-left leading-none">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block ml-2">Google Script URL</label>
                    <input type="text" className="w-full p-5 border-2 border-slate-50 rounded-2xl text-[11px] font-mono bg-slate-50 outline-none focus:border-emerald-400" value={config.scriptUrl} onChange={(e) => setConfig({...config, scriptUrl: e.target.value})} />
                  </div>
                  <div className="bg-slate-900 p-6 rounded-4xl shadow-2xl text-left overflow-hidden relative">
                    <textarea readOnly ref={codeTextAreaRef} value={GAS_SCRIPT_CODE} className="w-full h-32 bg-transparent text-[10px] font-mono text-slate-400 border-none outline-none resize-none leading-relaxed" />
                  </div>
                </div>
              )}

              {configTab === 'reports' && (
                <div className="space-y-6 animate-in fade-in leading-none">
                  <div className="flex gap-2 overflow-x-auto pb-2 custom-scrollbar">
                    {['today', 'yesterday', 'week', 'month', 'all'].map((rid) => (
                      <button key={rid} onClick={() => setFilterRange(rid)} className={`px-5 py-3 rounded-2xl text-[9px] font-black uppercase transition-all border-2 whitespace-nowrap leading-none ${filterRange === rid ? 'bg-slate-900 text-white border-slate-900 shadow-lg scale-105' : 'bg-white text-slate-400 border-slate-100 hover:border-slate-300'}`}>
                        {rid === 'today' ? 'Hari Ini' : rid === 'yesterday' ? 'Kemarin' : rid === 'week' ? '7 Hari' : rid === 'month' ? 'Bulan Ini' : 'Semua'}
                      </button>
                    ))}
                  </div>

                  {teamReport.summary ? (
                    <div className={`${teamReport.summary.insight.bg} p-8 rounded-[2.5rem] shadow-2xl border border-white/20 text-left space-y-8 animate-in zoom-in-95 leading-none`}>
                        <div className="flex justify-between items-center">
                            <div className="space-y-1">
                                <p className="text-[9px] font-black uppercase opacity-60 text-white tracking-widest leading-none">Status Kolektif</p>
                                <h4 className="text-2xl font-black text-white leading-none">{teamReport.summary.employeeCount} Karyawan</h4>
                            </div>
                            <button onClick={fetchAllRecap} disabled={allRecapLoading} className="bg-white/20 p-4 rounded-2xl active:scale-90 transition-all border border-white/20 shadow-inner">
                                {allRecapLoading ? <Loader2 className="w-5 h-5 animate-spin text-white" /> : <RefreshCw className="w-5 h-5 text-white" />}
                            </button>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="bg-white/10 backdrop-blur-md p-5 rounded-3xl border border-white/20 shadow-inner">
                                <p className="text-[8px] uppercase font-black text-white/50 mb-1">Efisiensi</p>
                                <p className="text-3xl font-black text-white">{teamReport.summary.averageScore}%</p>
                            </div>
                        </div>
                    </div>
                  ) : (
                    <button onClick={fetchAllRecap} disabled={allRecapLoading} className="w-full bg-emerald-600 text-white px-8 py-8 rounded-[2.5rem] font-black text-xs uppercase shadow-lg flex items-center justify-center gap-3">
                        {allRecapLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <RefreshCw className="w-5 h-5" />} Ambil Data Tim
                    </button>
                  )}
                </div>
              )}

              {configTab === 'users' && (
                  <div className="space-y-3 animate-in fade-in text-left">
                      {EMPLOYEES.map((emp) => (
                          <div key={emp.id} className="bg-white p-5 rounded-4xl shadow-lg border border-slate-100 flex items-center justify-between group">
                              <div className="flex items-center gap-4 text-left">
                                  <div className="w-12 h-12 bg-slate-50 text-slate-400 rounded-2xl flex items-center justify-center group-hover:bg-emerald-600 group-hover:text-white transition-all shadow-inner border border-slate-100 leading-none">
                                      <User className="w-6 h-6" />
                                  </div>
                                  <div className="space-y-1">
                                      <p className="text-xs font-black text-slate-900 leading-none">{emp.name}</p>
                                  </div>
                              </div>
                              <button onClick={() => window.confirm(`Reset PIN ${emp.name}?`) && handleResetUserPin(emp.id, emp.name)} className="p-4 bg-slate-50 text-slate-400 rounded-2xl hover:bg-emerald-600 hover:text-white transition-all leading-none">
                                  <RotateCcw className="w-5 h-5" />
                              </button>
                          </div>
                      ))}
                  </div>
              )}
            </div>
          </div>
        )}

        {/* VIEW: RECAP PERSONAL - FIXED SINKRONISASI */}
        {view === 'recap' && (
          <div className="p-6 space-y-8 animate-in slide-in-from-right-10 pb-24 text-left leading-none">
             <div className="flex items-center justify-between">
                <button onClick={() => {
                    if (attendanceData) {
                        setView(attendanceData.status === 'COMPLETED' ? 'shift_locked' : 'dashboard');
                    } else {
                        setView('checkin');
                    }
                }} className="p-3 bg-white border-2 border-slate-100 rounded-2xl shadow-sm text-slate-600 leading-none"><ChevronLeft className="w-5 h-5" /></button>
                <button onClick={() => fetchRecapData(true)} disabled={recapLoading} className="flex items-center gap-2 bg-emerald-50 text-emerald-600 px-5 py-3 rounded-2xl font-black text-[10px] uppercase border border-emerald-100 active:scale-95 transition-all">
                    {recapLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                    Sinkron Ulang
                </button>
             </div>

             <h2 className="text-2xl font-black text-slate-900 tracking-tight leading-tight">Histori Performa</h2>
             
             {recapLoading && recapData.length === 0 ? (
               <div className="flex flex-col items-center justify-center py-24 gap-4 opacity-50">
                  <Loader2 className="w-12 h-12 animate-spin text-emerald-600" />
                  <p className="text-[10px] font-black uppercase italic tracking-[0.2em] leading-none">Menghubungkan Spreadsheet...</p>
               </div>
             ) : (
               <div className="space-y-6">
                  {/* Status Hari Ini di Spreadsheet vs Firestore */}
                  {isLocalDataMissingFromSheet && attendanceData && (
                        <div className="bg-orange-50 p-6 rounded-[2.2rem] border-2 border-orange-100 flex items-center gap-4">
                            <CloudOff className="w-8 h-8 text-orange-400" />
                            <div className="space-y-1">
                                <p className="text-[11px] font-black text-orange-900 leading-none">DATA LOKAL AKTIF</p>
                                <p className="text-[9px] font-bold text-orange-600 leading-tight">Data hari ini ditampilkan dari penyimpanan lokal sementara menunggu sinkronisasi Sheet selesai.</p>
                            </div>
                        </div>
                  )}

                  {stats && (
                    <div className={`${getInsight(stats.completionRate).bg} p-8 rounded-[3rem] shadow-2xl space-y-8 animate-in zoom-in-95`}>
                        <div className="flex justify-between items-start">
                            <div className="space-y-2 text-left">
                                <p className="text-[9px] font-black uppercase opacity-60 text-white leading-none">Efisiensi Rata-rata</p>
                                <h4 className="text-3xl font-black text-white leading-tight">{getInsight(stats.completionRate).title}</h4>
                            </div>
                            <CircularProgress percent={stats.completionRate} color="white" bgStroke={getInsight(stats.completionRate).bgCircle} />
                        </div>
                        <div className="grid grid-cols-2 gap-4 border-t border-white/20 pt-8">
                            <div className="space-y-1">
                                <p className="text-3xl font-black text-white leading-none">{stats.totalPresence} Hari</p>
                                <p className="text-[8px] font-bold text-white/60 uppercase tracking-widest leading-none">Kehadiran</p>
                            </div>
                            <div className="space-y-1 text-right">
                                <p className="text-3xl font-black text-white leading-none">{stats.completedTasks}</p>
                                <p className="text-[8px] font-bold text-white/60 uppercase tracking-widest leading-none">Tugas Selesai</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-3 bg-white/10 p-4 rounded-2xl border border-white/10">
                            <Lightbulb className="w-5 h-5 text-yellow-300" />
                            <p className="text-[10px] font-black text-white uppercase tracking-tight leading-relaxed">{getInsight(stats.completionRate).text}</p>
                        </div>
                    </div>
                  )}

                  <div className="space-y-4">
                    <h3 className="text-xs font-black text-slate-400 uppercase px-2 tracking-widest leading-none">Log Aktivitas Terakhir</h3>
                    <div className="space-y-3">
                      {displayedHistory.slice(0, 15).map((item, idx) => (
                        <div key={idx} className={`p-5 rounded-[2.2rem] shadow-xl border flex items-center justify-between group cursor-default leading-none ${item.status === 'PENDING' ? 'bg-orange-50 border-orange-200' : 'bg-white border-slate-100'}`}>
                           <div className="flex items-center gap-4 text-left leading-none">
                              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg ${item.type === 'CHECK_IN' ? 'bg-emerald-500 text-white' : 'bg-red-500 text-white'}`}>
                                {item.type === 'CHECK_IN' ? <ArrowRight className="w-5 h-5 rotate-45" /> : <LogOut className="w-5 h-5" />}
                              </div>
                              <div className="space-y-1">
                                  <p className="text-[11px] font-black text-slate-900 leading-none">{new Date(item.timestamp).toLocaleDateString('id-ID', {day: 'numeric', month: 'short', year: 'numeric'})}</p>
                                  <div className="flex items-center gap-2">
                                     <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest leading-none">{item.type.replace('_', ' ')} • {new Date(item.timestamp).toLocaleTimeString('id-ID', {hour:'2-digit', minute:'2-digit'})}</p>
                                     {item.status === 'PENDING' && <span className="text-[8px] font-black bg-orange-200 text-orange-800 px-1.5 py-0.5 rounded-md">SYNCING</span>}
                                  </div>
                              </div>
                           </div>
                           <ChevronRight className="w-4 h-4 text-slate-300" />
                        </div>
                      ))}
                    </div>
                  </div>
               </div>
             )}
          </div>
        )}

        {/* VIEW: CHECKIN */}
        {view === 'checkin' && (
          <div className="px-6 py-10 space-y-8 animate-in slide-in-from-bottom-10 bg-white min-h-[calc(100vh-100px)] leading-none">
            <div className="text-center space-y-3 leading-none">
              <h2 className="text-3xl font-black text-slate-900 tracking-tighter leading-tight">Mulai Bekerja</h2>
              <div className="flex items-center justify-center gap-2 leading-none">
                <p className="text-slate-400 text-[11px] font-black uppercase tracking-[0.3em] leading-none">{selectedEmployee?.name}</p>
                <button onClick={() => setView('change_pin')} className="p-1.5 bg-slate-100 text-slate-400 rounded-lg hover:text-emerald-600 transition-colors leading-none">
                    <Fingerprint className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
            <div className="bg-white p-2 rounded-[2.5rem] shadow-2xl border-2 border-slate-100 flex items-center pr-4 leading-none focus-within:border-emerald-200 transition-colors">
              <input type="text" className="flex-1 p-6 rounded-4xl text-sm font-bold text-slate-700 outline-none h-14" placeholder="Target hari ini?..." value={taskInput} onChange={(e) => setTaskInput(e.target.value)} onKeyPress={(e) => e.key === 'Enter' && addTempTask()} />
              <button onClick={addTempTask} className="p-4 rounded-2xl bg-emerald-500 text-white shadow-lg active:scale-90 transition-all leading-none"><Plus className="w-6 h-6" /></button>
            </div>
            <div className="bg-white rounded-[2.5rem] shadow-xl border border-slate-100 overflow-hidden min-h-40 flex flex-col divide-y divide-slate-50 leading-none">
                {tempTasks.length === 0 ? (
                  <div className="flex-1 flex flex-col items-center justify-center p-10 text-slate-300 opacity-60 text-[10px] font-black uppercase tracking-widest italic leading-none">Agenda Kosong</div>
                ) : (
                  tempTasks.map((task, idx) => (
                    <div key={idx} className="p-6 flex items-center justify-between group hover:bg-slate-50 transition-all text-left leading-none">
                      <span className="text-sm font-bold text-slate-700 leading-tight">{task.text}</span>
                      <button onClick={() => removeTempTask(idx)} className="p-2 text-slate-300 hover:text-red-500 transition-colors"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  ))
                )}
            </div>
            <div className="space-y-3 leading-none">
                <button onClick={handleCheckIn} disabled={actionLoading} className="w-full text-white py-6 rounded-[2.2rem] bg-emerald-600 font-black text-xs shadow-2xl flex items-center justify-center gap-3 tracking-widest uppercase active:scale-95 transition-all leading-none">
                    {actionLoading ? <Loader2 className="animate-spin w-5 h-5"/> : <Save className="w-5 h-5"/>} Konfirmasi Absen
                </button>
                <div className="grid grid-cols-2 gap-3 leading-none">
                    <button onClick={() => fetchRecapData()} className="bg-slate-100 text-slate-500 py-6 rounded-[2.2rem] font-black text-[10px] flex items-center justify-center gap-3 uppercase active:scale-95 transition-all leading-none">
                        <History className="w-5 h-5" /> Histori
                    </button>
                    <button onClick={() => setView('change_pin')} className="bg-slate-100 text-slate-500 py-6 rounded-[2.2rem] font-black text-[10px] flex items-center justify-center gap-3 uppercase active:scale-95 transition-all leading-none">
                        <Fingerprint className="w-5 h-5" /> PIN
                    </button>
                </div>
            </div>
          </div>
        )}

        {/* VIEW: CHECKOUT */}
        {view === 'checkout' && (
           <div className="px-6 py-8 space-y-8 animate-in slide-in-from-bottom-10 bg-white min-h-[calc(100vh-100px)] text-left leading-none">
             <div className="bg-white p-10 rounded-[2.5rem] shadow-2xl border border-slate-100 text-center space-y-4 leading-none">
               <div className="w-20 h-20 bg-orange-500 text-white rounded-4xl flex items-center justify-center mx-auto shadow-xl transform rotate-12 border-4 border-white leading-none"><Clipboard className="w-8 h-8" /></div>
               <h3 className="text-2xl font-black text-slate-900 leading-none">Review Tugas</h3>
               <p className="text-xs text-slate-400 font-bold uppercase tracking-widest leading-none">Selesaikan shift hari ini</p>
             </div>
             <div className="bg-white p-6 rounded-[2.5rem] shadow-xl border-2 border-slate-50 space-y-3 leading-none focus-within:border-emerald-100 transition-colors">
                <label className="text-[10px] font-black text-slate-400 uppercase px-2 block leading-none">Catatan Opsional</label>
                <textarea className="w-full p-5 bg-slate-50 border-2 border-slate-50 rounded-2xl outline-none text-sm font-bold text-slate-700 min-h-30 resize-none leading-relaxed" placeholder="Laporan tambahan..." value={checkoutNote} onChange={(e) => setCheckoutNote(e.target.value)} />
             </div>
             <div className="flex gap-4 leading-none">
               <button onClick={() => setView('dashboard')} className="flex-1 bg-white border-2 border-slate-100 text-slate-400 py-6 rounded-3xl font-black text-xs uppercase leading-none">Batal</button>
               <button onClick={handleCheckOut} disabled={actionLoading} className="flex-2 bg-red-600 text-white py-6 rounded-3xl font-black text-xs shadow-2xl active:scale-95 flex items-center justify-center gap-3 uppercase tracking-widest leading-none">
                 {actionLoading ? <Loader2 className="animate-spin w-5 h-5"/> : <LogOut className="w-5 h-5"/>} Kirim & Selesai
               </button>
             </div>
           </div>
        )}

      </div>

      <div className="p-8 pt-0 flex flex-col items-center pointer-events-none opacity-20 bg-transparent leading-none">
        <p className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-900 leading-none">ACTIONS Digital</p>
        <p className="text-[8px] font-bold text-slate-500 mt-2 leading-none">Versi 5.3 - Recap Details Restored</p>
      </div>
    </div>
  );
}