// Interface language (English / Bengali). Load in <head> on every page.
//
// Pages and scripts are written in English. In Bengali mode this file swaps the
// rendered text: text nodes and the placeholder / title / aria-label attributes
// are looked up in BN (exact text) or BN_PATTERNS (text with numbers or names).
// A MutationObserver covers everything rendered later (tables, toasts, server
// messages), and the English originals are kept so switching back is instant.
//   data-i18n="key"   element whose whole innerHTML comes from BN_HTML[key]
//   data-lang="en|bn" block shown only in that language (used by the user guide)
//   data-no-i18n      element left untouched (with everything inside it)
(function () {
  const BN = {
    // ── Navigation, top bar ──────────────────────────────────────────
    'Overview': 'সারসংক্ষেপ',
    'Dashboard': 'ড্যাশবোর্ড',
    'Devices': 'ডিভাইস',
    'Data Sync': 'ডেটা সিঙ্ক',
    'Employees': 'কর্মী',
    'Attendance': 'হাজিরা',
    'System': 'সিস্টেম',
    'Logs': 'লগ',
    'Settings': 'সেটিংস',
    'User Guide': 'ব্যবহার নির্দেশিকা',
    'Administration': 'প্রশাসন',
    'Users & Roles': 'ইউজার ও রোল',
    'Interface Permissions': 'ইন্টারফেস অনুমতি',
    'Logout': 'লগআউট',
    'Connecting...': 'সংযোগ হচ্ছে...',
    'Live': 'লাইভ',
    'Disconnected': 'সংযোগ বিচ্ছিন্ন',
    'Sync Now': 'এখনই সিঙ্ক',
    'Syncing…': 'সিঙ্ক হচ্ছে…',
    '🔄 Syncing…': '🔄 সিঙ্ক হচ্ছে…',
    'Fetching from TCP devices': 'TCP ডিভাইস থেকে আনা হচ্ছে',
    'Collecting ADMS data': 'ADMS ডেটা সংগ্রহ হচ্ছে',
    'Pushing to ERP': 'ERP-তে পাঠানো হচ্ছে',
    '— All Rights Reserved': '— সর্বস্বত্ব সংরক্ষিত',
    'Developed by': 'ডেভেলপ করেছেন',
    'Attendance ↔ ERP Bridge': 'হাজিরা ↔ ERP ব্রিজ',
    'Language': 'ভাষা',

    // ── Dashboard ────────────────────────────────────────────────────
    'Present today': 'আজ উপস্থিত',
    'Late today': 'আজ দেরিতে',
    'Absent today': 'আজ অনুপস্থিত',
    'Waiting for ERP': 'ERP-তে পাঠানো বাকি',
    'Last 7 days': 'গত ৭ দিন',
    'Employees present each day, by first punch': 'প্রতিদিন উপস্থিত কর্মী, প্রথম পাঞ্চ অনুযায়ী',
    'On time': 'সময়মতো',
    'Late': 'দেরি',
    'Late arrivals today': 'আজ দেরিতে আসা',
    'Arrivals by hour': 'ঘণ্টা অনুযায়ী আগমন',
    'First punch of each employee today': 'আজ প্রত্যেক কর্মীর প্রথম পাঞ্চ',
    'Verification method': 'যাচাইয়ের পদ্ধতি',
    'All punches, last 7 days': 'সব পাঞ্চ, গত ৭ দিন',
    'Punches by device': 'ডিভাইস অনুযায়ী পাঞ্চ',
    'Today': 'আজ',
    'Connected Devices': 'সংযুক্ত ডিভাইস',
    'Manage →': 'পরিচালনা →',
    'No devices connected yet': 'এখনো কোনো ডিভাইস সংযুক্ত হয়নি',
    'Recent Activity': 'সাম্প্রতিক কার্যকলাপ',
    'View All →': 'সব দেখুন →',
    'No activity yet': 'এখনো কোনো কার্যকলাপ নেই',
    'Sync History': 'সিঙ্ক ইতিহাস',
    'No sync history': 'কোনো সিঙ্ক ইতিহাস নেই',
    'No arrivals yet': 'এখনো কেউ আসেনি',
    'Add employees to track': 'হিসাব রাখতে কর্মী যোগ করুন',
    'Employees with no punch today': 'আজ যাদের কোনো পাঞ্চ নেই',
    'Records not yet sent': 'যে রেকর্ড এখনো পাঠানো হয়নি',
    'Everything is sent': 'সব পাঠানো হয়েছে',
    'No punches in the last 7 days': 'গত ৭ দিনে কোনো পাঞ্চ নেই',
    'No punches today': 'আজ কোনো পাঞ্চ নেই',
    'Nobody is late today': 'আজ কেউ দেরি করেনি',
    'No arrivals yet today': 'আজ এখনো কেউ আসেনি',
    'employees arrived': 'জন কর্মী এসেছেন',
    'Total': 'মোট',
    'No data yet': 'এখনো কোনো ডেটা নেই',
    'Employees present on time and late, last 7 days': 'গত ৭ দিনে সময়মতো ও দেরিতে উপস্থিত কর্মী',
    'Employees arriving by hour today': 'আজ ঘণ্টা অনুযায়ী কর্মীদের আগমন',
    'Password': 'পাসওয়ার্ড',
    'Fingerprint': 'ফিঙ্গারপ্রিন্ট',
    'Face': 'ফেস',
    'Card': 'কার্ড',
    'Unknown': 'অজানা',
    'FP+Pass': 'ফিঙ্গার+পাস',
    'Face+Pass': 'ফেস+পাস',
    'No pages available': 'কোনো পেজ নেই',
    'Your account does not have access to any page yet. Ask the administrator to update your role.':
      'আপনার অ্যাকাউন্টে এখনো কোনো পেজের অনুমতি নেই। অ্যাডমিনকে আপনার রোল আপডেট করতে বলুন।',

    // ── Devices ──────────────────────────────────────────────────────
    'Device Management': 'ডিভাইস ব্যবস্থাপনা',
    'Connect and manage ZKTeco attendance devices': 'ZKTeco হাজিরা ডিভাইস সংযোগ ও পরিচালনা করুন',
    'Add TCP/IP Device': 'TCP/IP ডিভাইস যোগ করুন',
    'Older devices': 'পুরোনো ডিভাইস',
    'For older ZKTeco devices without ADMS push support. The bridge will pull data from these devices.':
      'ADMS push সুবিধা নেই এমন পুরোনো ZKTeco ডিভাইসের জন্য। ব্রিজ নিজেই এসব ডিভাইস থেকে ডেটা টেনে আনবে।',
    'Device IP Address': 'ডিভাইসের IP ঠিকানা',
    'Port': 'পোর্ট',
    'Device Name': 'ডিভাইসের নাম',
    'Main Entrance': 'প্রধান ফটক',
    'Comm Key (if set)': 'Comm Key (থাকলে)',
    'Comm Key': 'Comm Key',
    'Leave empty if none': 'না থাকলে খালি রাখুন',
    'Connect Device': 'ডিভাইস সংযোগ করুন',
    'ADMS Push Server': 'ADMS Push সার্ভার',
    'Auto': 'স্বয়ংক্রিয়',
    "Newer ZKTeco devices automatically push data here. Configure the device's server address to point to this machine.":
      'নতুন ZKTeco ডিভাইস নিজে থেকেই এখানে ডেটা পাঠায়। ডিভাইসের সার্ভার ঠিকানায় এই কম্পিউটারের ঠিকানা দিন।',
    'Server Address': 'সার্ভার ঠিকানা',
    'Server Port': 'সার্ভার পোর্ট',
    'Status': 'অবস্থা',
    'Listening': 'চালু আছে',
    'Network Ping Test': 'নেটওয়ার্ক পিং টেস্ট',
    'Reachability Check': 'সংযোগ যাচাই',
    'Check if a ZKTeco device is reachable on the same network before connecting.':
      'সংযোগের আগে দেখে নিন ZKTeco ডিভাইসটি একই নেটওয়ার্কে পাওয়া যাচ্ছে কিনা।',
    'Ping': 'পিং',
    'Pinging...': 'পিং হচ্ছে...',
    'Sending ping...': 'পিং পাঠানো হচ্ছে...',
    'Request failed': 'অনুরোধ ব্যর্থ হয়েছে',
    'All Devices': 'সব ডিভাইস',
    'Refresh': 'রিফ্রেশ',
    'No devices configured': 'কোনো ডিভাইস যোগ করা হয়নি',
    'Type': 'ধরন',
    'Name': 'নাম',
    'Records': 'রেকর্ড',
    'Last Seen': 'শেষ দেখা',
    'Actions': 'কাজ',
    'Fetch': 'আনুন',
    'Sync Emp': 'কর্মী সিঙ্ক',
    'Edit': 'এডিট',
    'Disconnect': 'সরিয়ে দিন',
    'connected': 'সংযুক্ত',
    'error': 'ত্রুটি',
    'disconnected': 'বিচ্ছিন্ন',
    'Edit TCP/IP Device': 'TCP/IP ডিভাইস এডিট',
    "Use this when the device's IP address changed. The device keeps its records, so nothing is sent to the ERP twice.":
      'ডিভাইসের IP বদলে গেলে এটি ব্যবহার করুন। ডিভাইসের রেকর্ড আগের মতোই থাকবে, তাই কিছুই ERP-তে দুবার যাবে না।',
    'Leave empty to keep the current key (0 = none)': 'আগের key রাখতে খালি রাখুন (0 = নেই)',
    'Cancel': 'বাতিল',
    'Save': 'সংরক্ষণ',

    // ── Employees ────────────────────────────────────────────────────
    'Manage employees, sync with devices, and export for ZKTeco software':
      'কর্মী পরিচালনা, ডিভাইসে সিঙ্ক এবং ZKTeco সফটওয়্যারের জন্য এক্সপোর্ট করুন',
    'Load from ERP': 'ERP থেকে লোড',
    'Load from Machine': 'মেশিন থেকে লোড',
    'Set to Device': 'ডিভাইসে পাঠান',
    '+ Add Employee': '+ কর্মী যোগ করুন',
    'Employee List': 'কর্মী তালিকা',
    'Search name / ID / UID...': 'নাম / ID / UID দিয়ে খুঁজুন...',
    'All Status': 'সব অবস্থা',
    'Synced': 'সিঙ্ক হয়েছে',
    'Not Synced': 'সিঙ্ক হয়নি',
    'Clear': 'মুছুন',
    'Click "Load from ERP" or "Load from Machine" to load employees':
      'কর্মী লোড করতে "ERP থেকে লোড" বা "মেশিন থেকে লোড" চাপুন',
    'Export Guide': 'এক্সপোর্ট নির্দেশিকা',
    'ERP API Endpoints Required': 'প্রয়োজনীয় ERP API এন্ডপয়েন্ট',
    'Employee ID': 'কর্মী ID',
    'Role': 'রোল',
    'Device Sync': 'ডিভাইস সিঙ্ক',
    'Delete': 'মুছুন',
    '✓ Synced': '✓ সিঙ্ক হয়েছে',
    '⚠ Not Synced': '⚠ সিঙ্ক হয়নি',
    'Admin': 'অ্যাডমিন',
    'User': 'ইউজার',
    'Loading...': 'লোড হচ্ছে...',
    'Loading…': 'লোড হচ্ছে…',
    'No employees yet. Click "+ Add Employee" to create one — it will sync to all connected devices.':
      'এখনো কোনো কর্মী নেই। "+ কর্মী যোগ করুন" চেপে তৈরি করুন — এটি সব সংযুক্ত ডিভাইসে সিঙ্ক হবে।',
    'No employees match the filter.': 'ফিল্টারের সাথে কোনো কর্মী মেলেনি।',
    'Load users from which device?': 'কোন ডিভাইস থেকে ইউজার লোড করবেন?',
    'Load': 'লোড',
    'Add Employee': 'কর্মী যোগ করুন',
    'Edit Employee': 'কর্মী এডিট',
    'Full Name': 'পূর্ণ নাম',
    'Password / PIN': 'পাসওয়ার্ড / PIN',
    'Save to Machine': 'মেশিনে সংরক্ষণ',
    'e.g. 1': 'যেমন 1',
    'e.g. EMP001': 'যেমন EMP001',
    'Pushing to device...': 'ডিভাইসে পাঠানো হচ্ছে...',
    'Pushing employees to connected devices...': 'সংযুক্ত ডিভাইসে কর্মী পাঠানো হচ্ছে...',
    '✓ Queued (ADMS — syncs within 30s)': '✓ সারিতে রাখা হয়েছে (ADMS — ৩০ সেকেন্ডের মধ্যে সিঙ্ক হবে)',
    'Fetching...': 'আনা হচ্ছে...',
    'Fetch from API': 'API থেকে আনুন',
    'Loading from API...': 'API থেকে লোড হচ্ছে...',
    'No employees returned from API': 'API থেকে কোনো কর্মী আসেনি',
    'Failed to fetch employees. Check API URL in Settings.': 'কর্মী আনা যায়নি। সেটিংসে API URL দেখুন।',
    'Failed to fetch employees': 'কর্মী আনা যায়নি',
    'No employees found': 'কোনো কর্মী পাওয়া যায়নি',

    // ── Attendance ───────────────────────────────────────────────────
    'Attendance Records': 'হাজিরা রেকর্ড',
    'Real-time attendance data from all devices': 'সব ডিভাইসের রিয়েল-টাইম হাজিরা',
    'From': 'থেকে',
    'To': 'পর্যন্ত',
    'Fetch TCP': 'TCP থেকে আনুন',
    '↓ Fetch ADMS': '↓ ADMS থেকে আনুন',
    'Pull stored attendance from ADMS device': 'ADMS ডিভাইসে জমা থাকা হাজিরা আনুন',
    'Push to ERP': 'ERP-তে পাঠান',
    'Live Records': 'লাইভ রেকর্ড',
    'Employee ID...': 'কর্মী ID...',
    'All Types': 'সব ধরন',
    'Check In': 'চেক ইন',
    'Check Out': 'চেক আউট',
    'All Methods': 'সব পদ্ধতি',
    'All Sources': 'সব উৎস',
    'New (Not Pushed)': 'নতুন (পাঠানো হয়নি)',
    'Pushed': 'পাঠানো হয়েছে',
    'Date & Time': 'তারিখ ও সময়',
    'Method': 'পদ্ধতি',
    'Device': 'ডিভাইস',
    'Source': 'উৎস',
    'Pushed At': 'পাঠানোর সময়',
    'No records yet. Connect a device to start receiving attendance.':
      'এখনো কোনো রেকর্ড নেই। হাজিরা পেতে একটি ডিভাইস সংযোগ করুন।',
    'No records match the filters': 'ফিল্টারের সাথে কোনো রেকর্ড মেলেনি',
    '✓ Pushed': '✓ পাঠানো হয়েছে',
    'New': 'নতুন',
    'Queuing...': 'সারিতে রাখা হচ্ছে...',
    'Pushing…': 'পাঠানো হচ্ছে…',

    // ── Logs ─────────────────────────────────────────────────────────
    'System Logs': 'সিস্টেম লগ',
    'Server activity and debug information': 'সার্ভারের কার্যকলাপ ও ডিবাগ তথ্য',
    'Clear Logs': 'লগ মুছুন',
    'Loading logs...': 'লগ লোড হচ্ছে...',
    'No logs yet': 'এখনো কোনো লগ নেই',
    'Logs cleared': 'লগ মুছে ফেলা হয়েছে',

    // ── Settings ─────────────────────────────────────────────────────
    'Configure ERP connection and sync schedules': 'ERP সংযোগ ও সিঙ্কের সময়সূচি ঠিক করুন',
    'ERP API Configuration': 'ERP API কনফিগারেশন',
    'ERP API Base URL': 'ERP API বেস URL',
    'Include /api — e.g. https://myapp.com/api': '/api সহ দিন — যেমন https://myapp.com/api',
    'API Token (Bearer)': 'API টোকেন (Bearer)',
    '— optional': '— ঐচ্ছিক',
    'Leave empty if not required': 'প্রয়োজন না হলে খালি রাখুন',
    'ERP Sanctum / Passport token (leave blank if public route)': 'ERP-এর Sanctum / Passport টোকেন (route পাবলিক হলে খালি রাখুন)',
    'Fetch Employee URL': 'কর্মী আনার URL',
    'GET — bridge will call this to get employee list': 'GET — কর্মী তালিকা পেতে ব্রিজ এই URL-এ কল করবে',
    'Sync Attendance URL': 'হাজিরা পাঠানোর URL',
    'POST — bridge will push attendance records here': 'POST — ব্রিজ এখানে হাজিরা রেকর্ড পাঠাবে',
    'Save Config': 'কনফিগ সংরক্ষণ',
    'Test Connection': 'সংযোগ পরীক্ষা',
    'Sync Schedule': 'সিঙ্কের সময়সূচি',
    'Employee Sync': 'কর্মী সিঙ্ক',
    'Syncs employees from ERP to devices': 'ERP থেকে কর্মী ডিভাইসে সিঙ্ক করে',
    'Employee Sync (Cron)': 'কর্মী সিঙ্ক (Cron)',
    'e.g. */30 * * * * = every 30 minutes': 'যেমন */30 * * * * = প্রতি ৩০ মিনিটে',
    'Attendance Push': 'হাজিরা পাঠানো',
    'Pushes new attendance records to ERP automatically': 'নতুন হাজিরা রেকর্ড স্বয়ংক্রিয়ভাবে ERP-তে পাঠায়',
    'Attendance Push (Cron)': 'হাজিরা পাঠানো (Cron)',
    'e.g. */15 * * * * = every 15 minutes — pushes unpushed records to ERP':
      'যেমন */15 * * * * = প্রতি ১৫ মিনিটে — না-পাঠানো রেকর্ড ERP-তে পাঠায়',
    'Every 5 min': 'প্রতি ৫ মিনিট',
    'Every 15 min': 'প্রতি ১৫ মিনিট',
    'Every 30 min': 'প্রতি ৩০ মিনিট',
    'Hourly': 'প্রতি ঘণ্টা',
    'Save Schedule': 'সময়সূচি সংরক্ষণ',
    'ADMS Server Info': 'ADMS সার্ভারের তথ্য',
    'ADMS Port': 'ADMS পোর্ট',
    'Running': 'চালু',
    'Protocol': 'প্রোটোকল',
    'Device URL': 'ডিভাইস URL',
    'Change ADMS Port': 'ADMS পোর্ট বদলান',
    'e.g. 5015': 'যেমন 5015',
    'Save & Apply': 'সংরক্ষণ ও চালু করুন',
    'Applying…': 'চালু করা হচ্ছে…',
    'Takes effect immediately — no restart needed. Current:': 'সঙ্গে সঙ্গে কার্যকর — রিস্টার্ট লাগবে না। বর্তমান:',
    '↺ Restart Server': '↺ সার্ভার রিস্টার্ট',
    'Server will be back in a few seconds.': 'কয়েক সেকেন্ডের মধ্যে সার্ভার আবার চালু হবে।',
    'Attendance Rules': 'হাজিরার নিয়ম',
    'Used by the dashboard to count late arrivals': 'দেরিতে আসা গোনার জন্য ড্যাশবোর্ড এটি ব্যবহার করে',
    'Work starts at': 'কাজ শুরুর সময়',
    'Grace period (minutes)': 'ছাড়ের সময় (মিনিট)',
    'Save Rules': 'নিয়ম সংরক্ষণ',
    'An employee is late when their first punch of the day is after the start time plus the grace period.':
      'দিনের প্রথম পাঞ্চ যদি শুরুর সময় আর ছাড়ের সময়ের পরে হয়, তাহলে কর্মীকে দেরিতে ধরা হয়।',
    'Branding': 'ব্র্যান্ডিং',
    'App Name': 'অ্যাপের নাম',
    'Tagline': 'ট্যাগলাইন',
    'Company Name': 'কোম্পানির নাম',
    '— shown in the footer': '— ফুটারে দেখাবে',
    'Company Website': 'কোম্পানির ওয়েবসাইট',
    'Your Company Ltd.': 'আপনার কোম্পানি লিমিটেড',
    'Logo': 'লোগো',
    'Upload Logo': 'লোগো আপলোড',
    'Use Default': 'ডিফল্ট ব্যবহার করুন',
    'PNG, JPG, WEBP or SVG, max 1 MB. Square images look best. Also used as the browser icon.':
      'PNG, JPG, WEBP বা SVG, সর্বোচ্চ ১ MB। বর্গাকার ছবি সবচেয়ে ভালো দেখায়। ব্রাউজারের আইকন হিসেবেও ব্যবহার হয়।',
    'Primary Color': 'প্রধান রং',
    'Save Branding': 'ব্র্যান্ডিং সংরক্ষণ',
    'Running — syncs employees from ERP to devices': 'চালু — ERP থেকে কর্মী ডিভাইসে সিঙ্ক করছে',
    'Running — pushes new attendance records to ERP': 'চালু — নতুন হাজিরা রেকর্ড ERP-তে পাঠাচ্ছে',
    'Disabled — schedule will not run': 'বন্ধ — সময়সূচি চলবে না',
    'Testing connection...': 'সংযোগ পরীক্ষা হচ্ছে...',
    'Connected successfully': 'সফলভাবে সংযুক্ত হয়েছে',

    // ── Users & Roles, permissions ───────────────────────────────────
    'Who can sign in, and what each role is allowed to do': 'কে লগইন করতে পারবে এবং প্রতিটি রোল কী কী করতে পারবে',
    '+ Add Role': '+ রোল যোগ করুন',
    '+ Add User': '+ ইউজার যোগ করুন',
    'Users': 'ইউজার',
    'Username': 'ইউজারনেম',
    'Created': 'তৈরির তারিখ',
    'Roles': 'রোল',
    'Pages': 'পেজ',
    'built-in': 'বিল্ট-ইন',
    'Full access': 'পূর্ণ অনুমতি',
    'No roles': 'কোনো রোল নেই',
    'emergency login (.env)': 'জরুরি লগইন (.env)',
    'Set in .env': '.env-এ সেট করা',
    'owner': 'মালিক',
    'you': 'আপনি',
    'No users yet': 'এখনো কোনো ইউজার নেই',
    'Add User': 'ইউজার যোগ করুন',
    'New Password (leave blank to keep)': 'নতুন পাসওয়ার্ড (আগেরটা রাখতে খালি রাখুন)',
    'At least 8 characters': 'কমপক্ষে ৮ অক্ষর',
    'e.g. john': 'যেমন john',
    'Add Role': 'রোল যোগ করুন',
    'Role Name': 'রোলের নাম',
    'e.g. operator': 'যেমন operator',
    'Save Role': 'রোল সংরক্ষণ',
    'All on': 'সব চালু',
    'All off': 'সব বন্ধ',
    'Turn pages and buttons off for every role at once. A user can use a feature only if both this page and their role allow it.':
      'সব রোলের জন্য একসাথে পেজ ও বোতাম বন্ধ করুন। কোনো ফিচার তখনই ব্যবহার করা যাবে যখন এই পেজ এবং ইউজারের রোল দুটোই অনুমতি দেয়।',
    'Reset to Defaults': 'ডিফল্টে ফেরান',
    'Save Permissions': 'অনুমতি সংরক্ষণ',
    'Overview stats and activity': 'সারসংক্ষেপ ও কার্যকলাপ',
    'Device management page': 'ডিভাইস ব্যবস্থাপনার পেজ',
    'Employee management page': 'কর্মী ব্যবস্থাপনার পেজ',
    'Attendance records page': 'হাজিরা রেকর্ডের পেজ',
    'Server log page': 'সার্ভার লগের পেজ',
    'ERP connection, schedules, ADMS port': 'ERP সংযোগ, সময়সূচি, ADMS পোর্ট',
    'Built-in help page': 'বিল্ট-ইন সহায়তা পেজ',
    'Employees page': 'কর্মী পেজ',
    'Devices page': 'ডিভাইস পেজ',
    'Attendance page': 'হাজিরা পেজ',
    'Import employees from the ERP API': 'ERP API থেকে কর্মী আনুন',
    'Read users stored on a device': 'ডিভাইসে থাকা ইউজার পড়ুন',
    'Send employees to connected devices': 'সংযুক্ত ডিভাইসে কর্মী পাঠান',
    'Create a new employee': 'নতুন কর্মী তৈরি করুন',
    'Change an employee': 'কর্মীর তথ্য বদলান',
    'Delete Employee': 'কর্মী মুছুন',
    'Remove an employee from bridge and devices': 'ব্রিজ ও ডিভাইস থেকে কর্মী মুছুন',
    'Export CSV': 'CSV এক্সপোর্ট',
    'Download for ZKTeco desktop software': 'ZKTeco ডেস্কটপ সফটওয়্যারের জন্য ডাউনলোড',
    'Export DAT (USB)': 'DAT এক্সপোর্ট (USB)',
    'Download user.dat for USB import': 'USB দিয়ে ইমপোর্টের জন্য user.dat ডাউনলোড',
    'Export guide card': 'এক্সপোর্ট নির্দেশিকা কার্ড',
    'Instructions for CSV/DAT export': 'CSV/DAT এক্সপোর্টের নির্দেশনা',
    'ERP API card': 'ERP API কার্ড',
    'API example for developers': 'ডেভেলপারদের জন্য API উদাহরণ',
    'Connect and disconnect TCP/IP devices': 'TCP/IP ডিভাইস যোগ করা ও সরানো',
    'Address and port for ADMS devices': 'ADMS ডিভাইসের ঠিকানা ও পোর্ট',
    'Check if a device is reachable': 'ডিভাইস পাওয়া যায় কিনা দেখুন',
    'Date range': 'তারিখের সীমা',
    'From / To date inputs': 'শুরু / শেষ তারিখের ঘর',
    'Read punches from TCP/IP devices': 'TCP/IP ডিভাইস থেকে পাঞ্চ পড়ুন',
    'Fetch ADMS': 'ADMS থেকে আনুন',
    'Ask ADMS devices to upload their history': 'ADMS ডিভাইসকে আগের রেকর্ড পাঠাতে বলুন',
    'Send records to the ERP (also Sync Now)': 'ERP-তে রেকর্ড পাঠান (এখনই সিঙ্ক সহ)',

    // ── Messages (toasts, errors) ────────────────────────────────────
    'Connected to bridge server': 'ব্রিজ সার্ভারের সাথে সংযুক্ত',
    'Enter device IP address': 'ডিভাইসের IP ঠিকানা দিন',
    'Connecting to device...': 'ডিভাইসে সংযোগ হচ্ছে...',
    'Enter an IP address': 'একটি IP ঠিকানা দিন',
    'Device disconnected': 'ডিভাইস সরিয়ে দেওয়া হয়েছে',
    'Fetching attendance...': 'হাজিরা আনা হচ্ছে...',
    'Syncing employees...': 'কর্মী সিঙ্ক হচ্ছে...',
    'No TCP devices added': 'কোনো TCP ডিভাইস যোগ করা হয়নি',
    'No connected ADMS device found': 'কোনো সংযুক্ত ADMS ডিভাইস পাওয়া যায়নি',
    'Queued! Device will push attendance in ~10s…': 'সারিতে রাখা হয়েছে! ডিভাইস প্রায় ১০ সেকেন্ডে হাজিরা পাঠাবে…',
    'Attendance logs updated.': 'হাজিরার তালিকা আপডেট হয়েছে।',
    'All records already pushed to ERP': 'সব রেকর্ড আগেই ERP-তে পাঠানো হয়েছে',
    'Failed': 'ব্যর্থ',
    'No employees to push. Add employees or load from ERP first.': 'পাঠানোর মতো কর্মী নেই। আগে কর্মী যোগ করুন বা ERP থেকে লোড করুন।',
    'Failed to push employees': 'কর্মী পাঠানো যায়নি',
    'Failed to load from ERP': 'ERP থেকে লোড করা যায়নি',
    'Requesting employee list from device…': 'ডিভাইস থেকে কর্মী তালিকা চাওয়া হচ্ছে…',
    'Failed to load employees': 'কর্মী লোড করা যায়নি',
    'UID must be between 1 and 99999999': 'UID ১ থেকে 99999999-এর মধ্যে হতে হবে',
    'Name is required': 'নাম দিতে হবে',
    'Employee saved to bridge (no devices connected)': 'কর্মী ব্রিজে সংরক্ষিত হয়েছে (কোনো ডিভাইস সংযুক্ত নেই)',
    'Employee saved — syncing to ADMS device in background': 'কর্মী সংরক্ষিত — পেছনে ADMS ডিভাইসে সিঙ্ক হচ্ছে',
    'Employee saved to bridge only': 'কর্মী শুধু ব্রিজে সংরক্ষিত হয়েছে',
    'Failed to save employee': 'কর্মী সংরক্ষণ করা যায়নি',
    'Employee deleted': 'কর্মী মুছে ফেলা হয়েছে',
    'Failed to delete': 'মুছে ফেলা যায়নি',
    'Enter a start time': 'শুরুর সময় দিন',
    'Grace period must be 0–240 minutes': 'ছাড়ের সময় ০–২৪০ মিনিট হতে হবে',
    'Attendance rules saved': 'হাজিরার নিয়ম সংরক্ষিত হয়েছে',
    'Failed to save rules': 'নিয়ম সংরক্ষণ করা যায়নি',
    'Invalid port (must be 1024–65535)': 'ভুল পোর্ট (১০২৪–৬৫৫৩৫ হতে হবে)',
    'Failed to change port': 'পোর্ট বদলানো যায়নি',
    'Configuration saved': 'কনফিগারেশন সংরক্ষিত হয়েছে',
    'Failed to save config': 'কনফিগ সংরক্ষণ করা যায়নি',
    'ERP API connected!': 'ERP API সংযুক্ত হয়েছে!',
    'ERP connection failed': 'ERP সংযোগ ব্যর্থ হয়েছে',
    'Restarting server…': 'সার্ভার রিস্টার্ট হচ্ছে…',
    'Restart signal sent': 'রিস্টার্টের নির্দেশ পাঠানো হয়েছে',
    'Sync failed': 'সিঙ্ক ব্যর্থ হয়েছে',
    'Branding saved': 'ব্র্যান্ডিং সংরক্ষিত হয়েছে',
    'Failed to save branding': 'ব্র্যান্ডিং সংরক্ষণ করা যায়নি',
    'Logo must be smaller than 1 MB': 'লোগো ১ MB-এর ছোট হতে হবে',
    'Logo updated': 'লোগো আপডেট হয়েছে',
    'Logo upload failed': 'লোগো আপলোড ব্যর্থ হয়েছে',
    'Default logo restored': 'ডিফল্ট লোগো ফিরিয়ে আনা হয়েছে',
    'You do not have permission for this action': 'এই কাজের অনুমতি আপনার নেই',
    'User updated': 'ইউজার আপডেট হয়েছে',
    'User created': 'ইউজার তৈরি হয়েছে',
    'Could not save user': 'ইউজার সংরক্ষণ করা যায়নি',
    'User deleted': 'ইউজার মুছে ফেলা হয়েছে',
    'Could not delete user': 'ইউজার মুছে ফেলা যায়নি',
    'Role name is required': 'রোলের নাম দিতে হবে',
    'Could not save role': 'রোল সংরক্ষণ করা যায়নি',
    'Role updated': 'রোল আপডেট হয়েছে',
    'Role created': 'রোল তৈরি হয়েছে',
    'Role deleted': 'রোল মুছে ফেলা হয়েছে',
    'Could not delete role': 'রোল মুছে ফেলা যায়নি',
    'Defaults restored — click Save Permissions to apply': 'ডিফল্ট ফিরিয়ে আনা হয়েছে — কার্যকর করতে "অনুমতি সংরক্ষণ" চাপুন',
    'Permissions saved': 'অনুমতি সংরক্ষিত হয়েছে',
    'Could not save permissions': 'অনুমতি সংরক্ষণ করা যায়নি',
    'Password must be at least 8 characters': 'পাসওয়ার্ড কমপক্ষে ৮ অক্ষরের হতে হবে',
    'Restart the server? It will be back in a few seconds.': 'সার্ভার রিস্টার্ট করবেন? কয়েক সেকেন্ডের মধ্যে আবার চালু হবে।',
    'Clear all logs? This cannot be undone.': 'সব লগ মুছবেন? এটি আর ফেরানো যাবে না।',

    // Sync history types and server messages
    'tcp attendance fetch': 'TCP হাজিরা আনা',
    'attendance push': 'হাজিরা পাঠানো',
    'employee fetch': 'কর্মী আনা',
    'employee sync tcp': 'কর্মী সিঙ্ক (TCP)',
    'employee set': 'কর্মী সেট',
    'employee delete': 'কর্মী মুছা',
    'employee sync': 'কর্মী সিঙ্ক',
    'attendance fetch': 'হাজিরা আনা',
    'Device not connected': 'ডিভাইস সংযুক্ত নেই',
    'Device not found': 'ডিভাইস পাওয়া যায়নি',
    'Device unreachable on the network': 'নেটওয়ার্কে ডিভাইস পাওয়া যাচ্ছে না',
    'Connection refused (is the device on port 4370 / TCP enabled?)': 'সংযোগ প্রত্যাখ্যাত (ডিভাইস কি পোর্ট 4370-এ আছে / TCP চালু আছে?)',
    'Device rejected the comm key (password)': 'ডিভাইস Comm Key (পাসওয়ার্ড) গ্রহণ করেনি',
    'Device closed the connection': 'ডিভাইস সংযোগ বন্ধ করে দিয়েছে',
    'Not connected to the device': 'ডিভাইসের সাথে সংযোগ নেই',
    'IP address required': 'IP ঠিকানা দিতে হবে',
    'Invalid IP address': 'ভুল IP ঠিকানা',
    'Invalid IP address or host name': 'ভুল IP ঠিকানা বা হোস্ট নাম',
    'Port must be 1-65535': 'পোর্ট ১-৬৫৫৩৫ হতে হবে',
    'Comm key must be a number': 'Comm Key একটি সংখ্যা হতে হবে',
    'Host unreachable': 'হোস্ট পাওয়া যাচ্ছে না',
    'ADMS devices push automatically': 'ADMS ডিভাইস নিজে থেকেই ডেটা পাঠায়',
    'No connected devices found': 'কোনো সংযুক্ত ডিভাইস পাওয়া যায়নি',
    'No connected devices found.': 'কোনো সংযুক্ত ডিভাইস পাওয়া যায়নি।',
    'No employees in bridge store. Add employees first.': 'ব্রিজে কোনো কর্মী নেই। আগে কর্মী যোগ করুন।',
    'All employees already synced to device.': 'সব কর্মী আগেই ডিভাইসে সিঙ্ক হয়েছে।',
    'All records already pushed': 'সব রেকর্ড আগেই পাঠানো হয়েছে',
    'Only ADMS devices support this': 'এটি শুধু ADMS ডিভাইসে কাজ করে',
    'No ADMS device connected — showing bridge-synced employees': 'কোনো ADMS ডিভাইস সংযুক্ত নেই — ব্রিজে সিঙ্ক হওয়া কর্মী দেখানো হচ্ছে',
    'Invalid username or password': 'ভুল ইউজারনেম বা পাসওয়ার্ড',
    'Username already exists': 'এই ইউজারনেম আগে থেকেই আছে',
    'Username is reserved': 'এই ইউজারনেম সংরক্ষিত',
    'Username must be 3-32 characters (letters, numbers, . _ @ -)': 'ইউজারনেম ৩-৩২ অক্ষরের হতে হবে (অক্ষর, সংখ্যা, . _ @ -)',
    'You cannot delete your own account': 'নিজের অ্যাকাউন্ট মুছতে পারবেন না',
    'The owner account cannot be deleted': 'মালিকের অ্যাকাউন্ট মুছা যায় না',
    'The owner account must stay superadmin': 'মালিকের অ্যাকাউন্ট superadmin-ই থাকবে',
    'Role already exists': 'এই রোল আগে থেকেই আছে',
    'Built-in role cannot be deleted': 'বিল্ট-ইন রোল মুছা যায় না',
    'This role cannot be edited': 'এই রোল এডিট করা যায় না',
    'Role name must be 2-32 characters (letters, numbers, space, _ -)': 'রোলের নাম ২-৩২ অক্ষরের হতে হবে (অক্ষর, সংখ্যা, স্পেস, _ -)',
    'Work start time must be HH:MM (24-hour)': 'কাজ শুরুর সময় HH:MM (২৪ ঘণ্টা) হতে হবে',
    'Grace minutes must be 0-240': 'ছাড়ের সময় ০-২৪০ মিনিট হতে হবে',
    'ADMS port must be 1024-65535': 'ADMS পোর্ট ১০২৪-৬৫৫৩৫ হতে হবে',
    'ERP URLs must start with http:// or https://': 'ERP URL http:// বা https:// দিয়ে শুরু হতে হবে',
    'Enter a valid http(s) URL': 'সঠিক http(s) URL দিন',
    'Sync queued — device will update on next heartbeat': 'সিঙ্ক সারিতে রাখা হয়েছে — পরের heartbeat-এ ডিভাইস আপডেট হবে',

    // ── Sign in ──────────────────────────────────────────────────────
    'Sign in': 'সাইন ইন',
    'Sign In': 'সাইন ইন',
    'Enter your credentials to continue': 'চালিয়ে যেতে আপনার তথ্য দিন',
    'Signing in…': 'সাইন ইন হচ্ছে…',
    'Connection error. Try again.': 'সংযোগে সমস্যা। আবার চেষ্টা করুন।',

    // ── Setup wizard ─────────────────────────────────────────────────
    'Setup': 'সেটআপ',
    'Setup wizard': 'সেটআপ উইজার্ড',
    'Welcome': 'স্বাগতম',
    "Let's get the bridge ready. First, a quick check of this computer.": 'চলুন ব্রিজ প্রস্তুত করি। প্রথমে এই কম্পিউটারটা একবার দেখে নিই।',
    'Administrator account': 'অ্যাডমিনিস্ট্রেটর অ্যাকাউন্ট',
    'This account has full access. You can add more users later.': 'এই অ্যাকাউন্টের পূর্ণ অনুমতি থাকবে। পরে আরও ইউজার যোগ করতে পারবেন।',
    'Confirm password': 'পাসওয়ার্ড নিশ্চিত করুন',
    'At least 8 characters.': 'কমপক্ষে ৮ অক্ষর।',
    'ERP connection': 'ERP সংযোগ',
    'Where should employees come from and attendance go to? You can skip this and set it later in Settings.':
      'কর্মীর তালিকা কোথা থেকে আসবে আর হাজিরা কোথায় যাবে? চাইলে এখন বাদ দিয়ে পরে সেটিংস থেকে দিতে পারবেন।',
    'Branding & devices': 'ব্র্যান্ডিং ও ডিভাইস',
    'Name this installation and choose the port ZKTeco devices push to.': 'এই ইনস্টলেশনের নাম দিন এবং ZKTeco ডিভাইস কোন পোর্টে ডেটা পাঠাবে তা বেছে নিন।',
    'Devices with ADMS/Cloud push send attendance to this port. Allow it in the firewall.': 'ADMS/Cloud push থাকা ডিভাইস এই পোর্টে হাজিরা পাঠায়। ফায়ারওয়ালে পোর্টটি খুলে দিন।',
    'All set 🎉': 'সব প্রস্তুত 🎉',
    'Back': 'পেছনে',
    'Continue': 'পরবর্তী',
    'Skip': 'বাদ দিন',
    'Finish Setup': 'সেটআপ শেষ করুন',
    'Open Dashboard': 'ড্যাশবোর্ড খুলুন',
    'Saving…': 'সংরক্ষণ হচ্ছে…',
    'Testing…': 'পরীক্ষা হচ্ছে…',
    'Passwords do not match': 'পাসওয়ার্ড দুটো মেলেনি',
    'ERP URL must start with http:// or https://': 'ERP URL http:// বা https:// দিয়ে শুরু হতে হবে',
    'App name is required': 'অ্যাপের নাম দিতে হবে',
    'ADMS port must be between 1024 and 65535': 'ADMS পোর্ট ১০২৪ থেকে ৬৫৫৩৫-এর মধ্যে হতে হবে',
    'Connection error': 'সংযোগে সমস্যা',
    'Setup failed': 'সেটআপ ব্যর্থ হয়েছে',
    'Connection error. Is the server still running?': 'সংযোগে সমস্যা। সার্ভার কি এখনো চালু আছে?',
    'Could not reach the server.': 'সার্ভারে পৌঁছানো যায়নি।',
    'Fix the items above, then reload this page.': 'উপরের সমস্যাগুলো ঠিক করে পেজটি আবার লোড করুন।',
    'data/ folder is writable': 'data/ ফোল্ডারে লেখা যায়',
    'logs/ folder is writable': 'logs/ ফোল্ডারে লেখা যায়',
    'Node.js 20 or newer is required': 'Node.js 20 বা তার নতুন সংস্করণ লাগবে',
    'Give the app write access to the data folder': 'data ফোল্ডারে লেখার অনুমতি দিন',
    'Give the app write access to the logs folder': 'logs ফোল্ডারে লেখার অনুমতি দিন',
  };

  const WEEKDAY = { Sun: 'রবি', Mon: 'সোম', Tue: 'মঙ্গল', Wed: 'বুধ', Thu: 'বৃহঃ', Fri: 'শুক্র', Sat: 'শনি' };

  // Messages that carry numbers, names or another message; t() translates the inner part
  const BN_PATTERNS = [
    [/^Device connected: (.+) \((ADMS|TCP)\)$/, (m, id, type) => `ডিভাইস সংযুক্ত: ${id} (${type})`],
    [/^Device connected: (.+)$/, (m, id) => `ডিভাইস সংযুক্ত: ${id}`],
    [/^Device updated: (.+)$/, (m, id) => `ডিভাইস আপডেট হয়েছে: ${id}`],
    [/^Same device as (.+) \(serial number\) — updated its address$/, (m, id) => `${id}-এর সাথে একই ডিভাইস (সিরিয়াল নম্বর) — ঠিকানা আপডেট করা হয়েছে`],
    [/^Connection failed: (.+)$/, (m, e) => `সংযোগ ব্যর্থ: ${t(e)}`],
    [/^Saved, but could not connect: (.+)$/, (m, e) => `সংরক্ষিত হয়েছে, কিন্তু সংযোগ হয়নি: ${t(e)}`],
    [/^Sync started: (.+)$/, (m, type) => `সিঙ্ক শুরু: ${t(type)}`],
    [/^Sync done: (\d+) records$/, (m, n) => `সিঙ্ক শেষ: ${n}টি রেকর্ড`],
    [/^Sync failed: (.+)$/, (m, e) => `সিঙ্ক ব্যর্থ: ${t(e)}`],
    [/^Fetch failed: (.+)$/, (m, e) => `আনা যায়নি: ${t(e)}`],
    [/^Push failed: (.+)$/, (m, e) => `পাঠানো যায়নি: ${t(e)}`],
    [/^Failed: (.+)$/, (m, e) => `ব্যর্থ: ${t(e)}`],
    [/^✗ (.+)$/, (m, e) => `✗ ${t(e)}`],
    [/^(\d+) of (\d+) connected$/, (m, a, b) => `${b}টির মধ্যে ${a}টি সংযুক্ত`],
    [/^of ([\d,]+) employees · (\d+%)$/, (m, n, p) => `${n} জন কর্মীর মধ্যে · ${p}`],
    [/^([\d,]+) punches today$/, (m, n) => `আজ ${n}টি পাঞ্চ`],
    [/^(\d+%) of those present$/, (m, p) => `উপস্থিতদের ${p}`],
    [/^Start (\d\d:\d\d)(?: \+ (\d+) min grace)? · change in Settings$/,
      (m, s, g) => `শুরু ${s}` + (g ? ` + ${g} মিনিট ছাড়` : '') + ' · সেটিংসে বদলান'],
    [/^(Sun|Mon|Tue|Wed|Thu|Fri|Sat) (\d+)( · .+)?$/, (m, d, n, rest) => `${WEEKDAY[d]} ${n}${rest || ''}`],
    [/^Employee ([\w.-]*\d[\w.-]*)$/, (m, id) => `কর্মী ${id}`],
    [/^Employee (\S+) — Check (In|Out)$/, (m, id, io) => `কর্মী ${id} — ${io === 'In' ? 'চেক ইন' : 'চেক আউট'}`],
    [/^(\S+) — Check (In|Out) @ (.+)$/, (m, id, io, time) => `${id} — ${io === 'In' ? 'চেক ইন' : 'চেক আউট'} @ ${time}`],
    [/^(\d+) min late$/, (m, n) => `${n} মিনিট দেরি`],
    [/^(\d+)s ago$/, (m, n) => `${n} সেকেন্ড আগে`],
    [/^(\d+)m ago$/, (m, n) => `${n} মিনিট আগে`],
    [/^(\d+)h ago$/, (m, n) => `${n} ঘণ্টা আগে`],
    [/^(.+) is reachable \((.+) ms\)$/, (m, ip, ms) => `${ip} পাওয়া যাচ্ছে (${ms} ms)`],
    [/^(.+) unreachable$/, (m, ip) => `${ip} পাওয়া যাচ্ছে না`],
    [/^Reachable — (.+) replied in$/, (m, ip) => `পাওয়া যাচ্ছে — ${ip} উত্তর দিয়েছে`],
    [/^Unreachable — (.+) did not respond\. Check IP and network\.$/, (m, ip) => `পাওয়া যাচ্ছে না — ${ip} কোনো উত্তর দেয়নি। IP ও নেটওয়ার্ক দেখুন।`],
    [/^Fetched (\d+) records$/, (m, n) => `${n}টি রেকর্ড আনা হয়েছে`],
    [/^Synced (\d+) employees$/, (m, n) => `${n} জন কর্মী সিঙ্ক হয়েছে`],
    [/^(\d+) records$/, (m, n) => `${n}টি রেকর্ড`],
    [/^(.+): (\d+) records fetched$/, (m, name, n) => `${name}: ${n}টি রেকর্ড আনা হয়েছে`],
    [/^Fetching from TCP devices(?: \((.+)\))?\.\.\.$/, (m, r) => `TCP ডিভাইস থেকে আনা হচ্ছে${r ? ` (${r})` : ''}...`],
    [/^Requesting attendance from (\d+) ADMS device\(s\) \((.+)\)…$/,
      (m, n, r) => `${n}টি ADMS ডিভাইস থেকে হাজিরা চাওয়া হচ্ছে (${r === 'all history' ? 'সব ইতিহাস' : r})…`],
    [/^Pushing (\d+) unpushed records to ERP…$/, (m, n) => `${n}টি না-পাঠানো রেকর্ড ERP-তে পাঠানো হচ্ছে…`],
    [/^(\d+) records pushed \((\d+) already done\)$/, (m, n, d) => `${n}টি রেকর্ড পাঠানো হয়েছে (${d}টি আগেই পাঠানো ছিল)`],
    [/^([\d,]+) employees$/, (m, n) => `${n} জন কর্মী`],
    [/^Fetched (\d+) employees$/, (m, n) => `${n} জন কর্মী আনা হয়েছে`],
    [/^(\d+) employees loaded from ERP and saved to bridge$/, (m, n) => `ERP থেকে ${n} জন কর্মী লোড করে ব্রিজে সংরক্ষণ করা হয়েছে`],
    [/^(\d+) employees loaded from device( \(cached from last device push\))?$/,
      (m, n, c) => `ডিভাইস থেকে ${n} জন কর্মী লোড হয়েছে${c ? ' (ডিভাইসের শেষ পাঠানো তালিকা থেকে)' : ''}`],
    [/^(\d+) employees loaded from bridge store$/, (m, n) => `ব্রিজ থেকে ${n} জন কর্মী লোড হয়েছে`],
    [/^(\d+) employees pushed to (\d+) device\(s\)$/, (m, n, d) => `${n} জন কর্মী ${d}টি ডিভাইসে পাঠানো হয়েছে`],
    [/^(\d+) employees pushed to device\(s\)$/, (m, n) => `${n} জন কর্মী ডিভাইসে পাঠানো হয়েছে`],
    [/^Synced at (.*)$/, (m, d) => `সিঙ্কের সময় ${d}`],
    [/^Employee saved & synced to (\d+) device\(s\)$/, (m, n) => `কর্মী সংরক্ষিত ও ${n}টি ডিভাইসে সিঙ্ক হয়েছে`],
    [/^Device (\S+): (.+)$/, (m, id, e) => `ডিভাইস ${id}: ${t(e)}`],
    [/^Delete employee UID (\d+)\? This will also remove from connected devices\.$/,
      (m, uid) => `UID ${uid} কর্মীকে মুছবেন? সংযুক্ত ডিভাইস থেকেও মুছে যাবে।`],
    [/^(Employee|Attendance) sync (enabled|disabled)$/,
      (m, w, s) => `${w === 'Employee' ? 'কর্মী' : 'হাজিরা'} সিঙ্ক ${s === 'enabled' ? 'চালু হয়েছে' : 'বন্ধ হয়েছে'}`],
    [/^ADMS port changed to (\d+) — live, no restart needed$/, (m, p) => `ADMS পোর্ট বদলে ${p} করা হয়েছে — এখনই কার্যকর, রিস্টার্ট লাগবে না`],
    [/^Sync complete — (.+)$/, (m, parts) => 'সিঙ্ক সম্পূর্ণ — ' + parts.split(' · ').map(p => p
      .replace(/^TCP: (\d+) fetched$/, 'TCP: $1টি আনা হয়েছে')
      .replace(/^ADMS: (\d+) records$/, 'ADMS: $1টি রেকর্ড')
      .replace(/^Pushed: (\d+) new$/, 'পাঠানো: $1টি নতুন')
      .replace(/^Already done: (\d+)$/, 'আগেই পাঠানো: $1টি')).join(' · ')],
    [/^Edit User: (.+)$/, (m, u) => `ইউজার এডিট: ${u}`],
    [/^Edit Role: (.+)$/, (m, r) => `রোল এডিট: ${r}`],
    [/^Delete user "(.+)"\?$/, (m, u) => `"${u}" ইউজারকে মুছবেন?`],
    [/^Delete role "(.+)"\?$/, (m, r) => `"${r}" রোল মুছবেন?`],
    [/^(\d+) user\(s\) still have this role\. Change their role first\.$/, (m, n) => `${n} জন ইউজারের এখনো এই রোল আছে। আগে তাদের রোল বদলান।`],
    [/^Too many failed attempts\. Try again in (\d+) minute\(s\)\.$/, (m, n) => `অনেকবার ভুল হয়েছে। ${n} মিনিট পরে আবার চেষ্টা করুন।`],
    [/^Password must be at least (\d+) characters$/, (m, n) => `পাসওয়ার্ড কমপক্ষে ${n} অক্ষরের হতে হবে`],
    [/^(.+) is not a valid cron expression$/, (m, k) => `${k} সঠিক cron expression নয়`],
    [/^(.+) must be an http\(s\) URL$/, (m, k) => `${k} একটি http(s) URL হতে হবে`],
    [/^Connection to (.+) timed out$/, (m, a) => `${a}-এ সংযোগের সময় শেষ হয়ে গেছে`],
    [/^Device did not answer within (\d+)s$/, (m, n) => `ডিভাইস ${n} সেকেন্ডের মধ্যে উত্তর দেয়নি`],
    [/^Device refused the connection \(reply (\d+)\)$/, (m, n) => `ডিভাইস সংযোগ গ্রহণ করেনি (reply ${n})`],
    [/^Device did not push user list\. Showing (\d+) employee\(s\) confirmed synced to device\.$/,
      (m, n) => `ডিভাইস ইউজার তালিকা পাঠায়নি। ডিভাইসে সিঙ্ক নিশ্চিত হওয়া ${n} জন কর্মী দেখানো হচ্ছে।`],
    [/^Fetched (\d+) new records from (.+) \((\d+) on device\)$/, (m, n, id, d) => `${id} থেকে ${n}টি নতুন রেকর্ড আনা হয়েছে (ডিভাইসে আছে ${d}টি)`],
    [/^Pushed (\d+) attendance records$/, (m, n) => `${n}টি হাজিরা রেকর্ড পাঠানো হয়েছে`],
    [/^Synced (\d+)\/(\d+) employees to (.+)$/, (m, a, b, id) => `${id}-এ ${b} জনের মধ্যে ${a} জন কর্মী সিঙ্ক হয়েছে`],
    [/^Set employee UID=(\d+) on (.+)$/, (m, uid, id) => `${id}-এ UID=${uid} কর্মী সেট করা হয়েছে`],
    [/^Deleted employee UID=(\d+) from (.+)$/, (m, uid, id) => `${id} থেকে UID=${uid} কর্মী মুছে ফেলা হয়েছে`],
    [/^(Sign in|Setup) — (.+)$/, (m, p, app) => `${t(p)} — ${app}`],
    [/^Connected: (.+)$/, (m, msg) => `সংযুক্ত: ${msg}`],
    [/^Could not connect: (.+)$/, (m, e) => `সংযোগ হয়নি: ${t(e)}`],
  ];

  // Whole elements whose wording includes markup (data-i18n="key")
  const BN_HTML = {
    'adms-hint': 'আপনার ZKTeco ডিভাইসে <strong>Comm → ADMS</strong>-এ গিয়ে উপরের সার্ভার ঠিকানাটি দিন। ডিভাইস তখন রিয়েল-টাইমে হাজিরা পাঠাবে।',
    'export-guide': '<strong>CSV এক্সপোর্ট</strong> → ZKBio Security / ZKTime.Net সফটওয়্যারে ইমপোর্ট করুন<br>'
      + '<strong>DAT এক্সপোর্ট (USB)</strong> → <code>user.dat</code> ফাইলটি USB ড্রাইভে রেখে ZKTeco ডিভাইসে ইমপোর্ট করুন<br>'
      + '<em>ডিভাইসে: Menu → USB Manager → Upload → User Info</em>',
    'install-erp-hint': 'ব্রিজ এই URL-এর নিচে <code>/zk/ping</code>, <code>/zk/employees</code> ও <code>/zk/attendance</code>-এ কল করবে।',
    'install-done': 'সেটআপ সম্পূর্ণ এবং আপনি সাইন ইন অবস্থায় আছেন। ADMS ডিভাইস যুক্ত করতে ডিভাইসে <b>Menu → COMM → Cloud Server Setting</b> খুলে লিখুন:',
    'install-done-tcp': 'ADMS ছাড়া পুরোনো ডিভাইস <b>ডিভাইস</b> পেজ থেকে IP দিয়ে যোগ করা যায়।',
  };

  const ATTRS = ['placeholder', 'title', 'aria-label'];
  const SKIP = 'script,style,code,pre,textarea,[data-no-i18n],.log-line,[data-lang],[data-i18n]';
  const textState = new WeakMap(); // text node -> { en, shown }
  const attrState = new WeakMap(); // element  -> { attr: { en, shown } }
  const htmlState = new WeakMap(); // element  -> original innerHTML

  let lang = 'en';
  try { lang = localStorage.getItem('lang') === 'bn' ? 'bn' : 'en'; } catch {}

  function t(s) {
    if (lang !== 'bn' || typeof s !== 'string') return s;
    const key = s.replace(/\s+/g, ' ').trim();
    if (!key || !/[A-Za-z]/.test(key)) return s;
    let out = BN[key];
    if (out === undefined) {
      for (const [re, fn] of BN_PATTERNS) {
        const m = key.match(re);
        if (m) { out = fn(...m); break; }
      }
    }
    if (out === undefined || out === key) return s;
    // keep the spacing around the text, so inline layout does not change
    const lead = s.match(/^\s*/)[0], tail = s.match(/\s*$/)[0];
    return lead + out + tail;
  }

  function skipped(el) {
    return el && el.closest && el.closest(SKIP);
  }

  function doText(node) {
    if (skipped(node.parentElement)) return;
    let st = textState.get(node);
    if (!st || node.nodeValue !== st.shown) st = { en: node.nodeValue };
    st.shown = lang === 'bn' ? t(st.en) : st.en;
    textState.set(node, st);
    if (node.nodeValue !== st.shown) node.nodeValue = st.shown;
  }

  function doAttrs(el) {
    if (skipped(el)) return;
    let map = attrState.get(el);
    for (const a of ATTRS) {
      if (!el.hasAttribute(a)) continue;
      const cur = el.getAttribute(a);
      map = map || {};
      let st = map[a];
      if (!st || cur !== st.shown) st = { en: cur };
      st.shown = lang === 'bn' ? t(st.en) : st.en;
      map[a] = st;
      if (cur !== st.shown) el.setAttribute(a, st.shown);
    }
    if (map) attrState.set(el, map);
  }

  function doHtml(el) {
    const bn = BN_HTML[el.dataset.i18n];
    if (!bn) return;
    if (!htmlState.has(el)) htmlState.set(el, el.innerHTML);
    const want = lang === 'bn' ? bn : htmlState.get(el);
    if (el.innerHTML !== want) el.innerHTML = want;
  }

  function translateTree(root) {
    if (root.nodeType === 3) { doText(root); return; }
    if (root.nodeType !== 1 && root.nodeType !== 9) return;
    if (root.nodeType === 1) {
      if (root.matches('[data-i18n]')) doHtml(root);
      doAttrs(root);
    }
    root.querySelectorAll('[data-i18n]').forEach(doHtml);
    root.querySelectorAll('[placeholder],[title],[aria-label]').forEach(doAttrs);
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) doText(n);
  }

  // Content rendered later (tables, toasts, messages) — translated before it paints
  const observer = new MutationObserver(records => {
    for (const r of records) {
      if (r.type === 'characterData') doText(r.target);
      else if (r.type === 'attributes') doAttrs(r.target);
      else r.addedNodes.forEach(translateTree);
    }
  });

  function applyLang() {
    document.documentElement.lang = lang;
    document.documentElement.dataset.uiLang = lang;
    translateTree(document);
    document.querySelectorAll('.lang-switch button').forEach(b => b.classList.toggle('on', b.dataset.setLang === lang));
    document.dispatchEvent(new CustomEvent('langchange', { detail: lang }));
  }

  function setLang(next) {
    lang = next === 'bn' ? 'bn' : 'en';
    try { localStorage.setItem('lang', lang); } catch {}
    applyLang();
  }

  // EN | বাং switch; pages put an empty .lang-switch element where it belongs
  function mountSwitches() {
    document.querySelectorAll('.lang-switch:empty').forEach(box => {
      box.setAttribute('role', 'group');
      box.setAttribute('aria-label', 'Language');
      for (const [code, label] of [['en', 'EN'], ['bn', 'বাং']]) {
        const b = document.createElement('button');
        b.type = 'button';
        b.dataset.setLang = code; // not data-lang: that attribute hides blocks by language
        b.textContent = label;
        b.className = code === lang ? 'on' : '';
        b.addEventListener('click', () => setLang(code));
        box.append(b);
      }
      box.setAttribute('data-no-i18n', '');
    });
  }

  // Native dialogs show their text outside the page, so translate it on the way in
  const nativeConfirm = window.confirm.bind(window);
  const nativeAlert = window.alert.bind(window);
  window.confirm = msg => nativeConfirm(t(String(msg)));
  window.alert = msg => nativeAlert(t(String(msg)));

  // Hide the page until the first translation, so Bengali users never see English flash
  const style = document.createElement('style');
  style.textContent = `
    html.i18n-pending body { visibility: hidden; }
    html[data-ui-lang="en"] [data-lang="bn"], html[data-ui-lang="bn"] [data-lang="en"] { display: none !important; }
    .lang-switch { display: inline-flex; border: 1px solid var(--border, #e2e8f0); border-radius: 8px; overflow: hidden; background: var(--surface, #fff); }
    .lang-switch button { border: 0; background: transparent; padding: 6px 10px; font-size: 12px; font-weight: 600; color: var(--text-2, #64748b); cursor: pointer; margin: 0; width: auto; border-radius: 0; }
    .lang-switch button.on { background: var(--primary, #3b82f6); color: #fff; }
    .lang-switch button:hover:not(.on) { background: rgba(0,0,0,.04); }`;
  document.head.appendChild(style);
  document.documentElement.dataset.uiLang = lang;
  document.documentElement.lang = lang;
  if (lang === 'bn') document.documentElement.classList.add('i18n-pending');

  observer.observe(document.documentElement, {
    subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ATTRS,
  });

  function start() {
    mountSwitches();
    applyLang();
    document.documentElement.classList.remove('i18n-pending');
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();

  window.I18N = {
    get lang() { return lang; },
    locale: () => (lang === 'bn' ? 'bn-BD' : 'en-US'),
    set: setLang,
    t,
  };
})();
