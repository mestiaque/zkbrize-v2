# AttendBridge — ZKTeco ↔ ERP Bridge

AttendBridge connects ZKTeco attendance devices to any ERP, HRM or payroll system. It sends
employees to the devices, collects every punch in real time, and pushes the punches to your ERP
over a simple JSON API. It runs on Windows or Linux, in the background, with a web dashboard
in **English and Bengali**.

## Contents

1. [Features](#features)
2. [Requirements](#requirements)
3. [Installation](#installation)
4. [First-time setup](#first-time-setup)
5. [Running the bridge](#running-the-bridge)
6. [Connecting devices](#connecting-devices)
7. [Using the dashboard](#using-the-dashboard)
8. [ERP API](#erp-api)
9. [Configuration (.env)](#configuration-env)
10. [Data, backup and updates](#data-backup-and-updates)
11. [Demo mode (portfolio / cPanel)](#demo-mode-portfolio--cpanel)
12. [Troubleshooting](#troubleshooting)
13. [Project structure](#project-structure)
14. [বাংলায় দ্রুত শুরু](#বাংলায়-দ্রুত-শুরু)

---

## Features

- **ADMS push server**: newer ZKTeco devices (ADMS / Cloud Server / iClock) send punches by themselves, in real time.
- **TCP/IP pull**: older devices are read over the network on port 4370, with Comm Key support.
  It handles 8/16/40-byte attendance and 28/72-byte user records, so it works with older firmware too.
  Devices are remembered across restarts, and a device whose IP changed is recognised by its serial number.
- **Employees**: load from the ERP or from a device, add / edit / delete, and sync to every connected device.
  Export CSV (ZKTeco desktop software) or `user.dat` (USB import).
- **Attendance**: live table with filters and date ranges. Punches are pushed to the ERP on a schedule or on demand.
  A punch is never stored twice.
- **Dashboard**: present, late and absent today, a 7-day trend, late arrivals, arrivals by hour,
  verification methods and punches per device.
- **Users, roles and permissions**: built-in and custom roles, page- and button-level permissions,
  all enforced by the server too.
- **White-label**: app name, logo, colours and company name.
- **Two languages**: English and Bengali, switchable from the top bar.
- **Runs as a service** on Windows or Linux (systemd), or with PM2.

---

## Requirements

| What | Details |
|---|---|
| Operating system | Windows 10/11 or Server, or Linux (Ubuntu, Debian, etc.). macOS also works for testing. |
| Node.js | **20 or newer** (LTS recommended) — <https://nodejs.org> |
| Network | The computer and the devices on the same network (or routed to each other). Give the computer a **fixed IP**. |
| Ports | `3000` web dashboard (incoming), `7788` ADMS push (incoming), `4370` TCP/IP devices (outgoing) |

Check Node.js:

```bash
node -v    # must print v20 or higher
npm -v
```

**Installing Node.js on Ubuntu / Debian:**

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs
```

**Windows:** download the LTS installer from <https://nodejs.org> and keep the default options.

---

## Installation

### 1. Get the files

Unzip the package (or clone the repository) into a permanent folder, for example
`C:\AttendBridge` or `/opt/attendbridge`.

```bash
git clone https://github.com/mestiaque/zkbrize-v2.git attendbridge
cd attendbridge
```

### 2. Install dependencies

```bash
npm install
```

This also runs the first-time setup script: it creates `.env` from `.env.example`, generates a
`SESSION_SECRET`, and creates the `data/` and `logs/` folders. Running it again never overwrites
an existing `.env` or data.

### 3. Start it

```bash
npm start
```

Open <http://localhost:3000> (or `http://<this-computer-ip>:3000` from another computer).

### 4. Open the firewall

Allow the web port and the ADMS port (use your own values if you changed them).

**Linux (UFW)**

```bash
sudo ufw allow 3000/tcp
sudo ufw allow 7788/tcp
```

**Linux (firewalld)**

```bash
sudo firewall-cmd --permanent --add-port=3000/tcp --add-port=7788/tcp
sudo firewall-cmd --reload
```

**Windows (PowerShell as Administrator)**

```powershell
netsh advfirewall firewall add rule name="AttendBridge Web"  dir=in action=allow protocol=TCP localport=3000
netsh advfirewall firewall add rule name="AttendBridge ADMS" dir=in action=allow protocol=TCP localport=7788
```

TCP/IP devices are reached outwards on port 4370, which normally needs no rule.

---

## First-time setup

The first time you open the dashboard, a **setup wizard** runs:

1. **System check**: Node.js version, and write access to `data/` and `logs/`.
2. **Administrator account**: username and password (at least 8 characters). This is the owner account.
3. **ERP connection** (optional): API base URL and token, with a **Test Connection** button. You can skip this and set it later.
4. **Branding and devices**: app name, company name, and the **ADMS port** devices will push to.
5. **Done**: shows the server address and port to enter on ADMS devices.

After setup you are signed in. Switch the language any time with **EN | বাং** in the top bar.

---

## Running the bridge

### For a quick test

```bash
npm start          # runs in this terminal; Ctrl+C stops it
```

### One-click start / stop (runs in the background, opens the browser)

| | Start | Stop |
|---|---|---|
| Linux | `./start.sh` | `./stop.sh` |
| Windows | double-click `start.bat` (or `AttendBridge.vbs` for no console window) | `stop.bat` |

If PM2 is installed (`npm install -g pm2`), these scripts use it, so the server restarts automatically if it crashes.

### As a service: starts with the computer (recommended for production)

| | Install | Remove |
|---|---|---|
| Windows | double-click `install-service.bat` (asks for Administrator rights) | `uninstall-service.bat` |
| Linux (systemd) | `./install-service.sh` (asks for sudo) | `./uninstall-service.sh` |

The same can be done with `npm run service:install`, `npm run service:uninstall` and
`npm run service:status` (as Administrator / with sudo).

On Linux, check the service with:

```bash
systemctl status attendbridge
journalctl -u attendbridge -f
```

### With PM2

```bash
npm install -g pm2
pm2 start ecosystem.config.js     # process name: attendbridge
pm2 save
pm2 startup                       # then run the command it prints, to start on boot
pm2 logs attendbridge
```

### Restarting

Use **Settings → Restart Server** in the dashboard, or restart the service / PM2 process.
Changing the ADMS port from Settings applies immediately without a restart.

---

## Connecting devices

### ADMS devices (push, real time)

On the device, open **Menu → COMM → Cloud Server Setting** (older models: **Comm → ADMS**):

| Field | Value |
|---|---|
| Server Mode | `ADMS` (if offered) |
| Enable Domain Name | `OFF` |
| Server Address | this computer's LAN IP, e.g. `192.168.1.10` |
| Server Port | the ADMS port (default `7788`; see **Settings → ADMS Server Info**) |
| HTTPS / Proxy | `OFF` |

Save and restart the device. It appears on the **Devices** page within a minute, and **Logs** shows
`ADMS handshake`. Never enter `localhost` or `127.0.0.1` on a device.

### TCP/IP devices (pull, older models)

1. Give the device a fixed IP (**Menu → COMM → Ethernet**, DHCP off) or reserve its IP in the router.
2. In the dashboard open **Devices → Network Ping Test** and check that the device answers.
3. **Add TCP/IP Device**: IP, port `4370`, a name, and the **Comm Key** if the device has one
   (**Menu → COMM → PC Connection**). Click **Connect Device**.

Punches are read on every scheduled attendance push, with **Sync Now**, with **Attendance → Fetch TCP**,
or with the device's **Fetch** button. Each read opens a short session: connect, pause the device,
read, resume, disconnect.

- Devices are saved in `data/tcp-devices.json` and reconnected after a restart.
- An offline device shows **error** and is tried again on the next sync.
- If a device's IP changes, add it again with the new IP: it is matched by serial number and keeps
  its records, so nothing is sent to the ERP twice. Or use **Edit** in the device list.
- Without a date range, a fetch takes the retention period (default 90 days). To fetch older
  punches, set **From / To** on the Attendance page first.

---

## Using the dashboard

| Page | What it does |
|---|---|
| **Dashboard** | Today's present / late / absent, punches waiting for the ERP, 7-day trend, late list, charts, devices, recent activity, sync history |
| **Devices** | Add TCP/IP devices, ADMS server address, ping test, device list (Fetch, Sync Emp, Edit, Disconnect) |
| **Employees** | Load from ERP / machine, add / edit / delete, Set to Device, search, CSV and DAT export |
| **Attendance** | All punches with filters, date range, Fetch TCP, Fetch ADMS, Push to ERP |
| **Logs** | Server log; Clear Logs |
| **Settings** | ERP API, sync schedules, ADMS port, restart, attendance rules (start time, grace), branding |
| **User Guide** | Full built-in help in English and Bengali |
| **Users & Roles** | (owner) Users, built-in and custom roles |
| **Interface Permissions** | (owner) Turn pages and buttons off for everyone |

**Schedules** use cron format: `*/15 * * * *` means every 15 minutes, and `0 9,18 * * *` means at 09:00 and 18:00.

- **Employee Sync** imports employees from the ERP and sends new ones to the devices.
- **Attendance Push** reads TCP/IP devices, then sends new punches to the ERP.

Each schedule has an on/off switch.

---

## ERP API

Your ERP needs three JSON endpoints under the **API Base URL** (for example `https://erp.example.com/api`).
If a token is set, every request sends `Authorization: Bearer <token>`.
If your ERP uses other paths, enter the full URLs in **Settings → Fetch Employee URL / Sync Attendance URL**.

| Method | Path | Purpose |
|---|---|---|
| GET | `/zk/ping` | Connection test: any 2xx response |
| GET | `/zk/employees` | Employees for the devices |
| POST | `/zk/attendance` | Receives punches |

**GET /zk/employees**: response

```json
{
  "data": [
    { "uid": 1, "employee_id": "1001", "name": "Ayesha Rahman", "privilege": 0, "password": "" }
  ]
}
```

**POST /zk/attendance**: request body

```json
{
  "records": [
    {
      "employeeId": "1001",
      "time": "2026-10-10 08:42:04",
      "status": "0",
      "deviceId": "CQZ7224460123",
      "source": "adms",
      "verifyMethod": "fingerprint"
    }
  ]
}
```

| Field | Meaning |
|---|---|
| `uid` | Device user slot, unique per employee |
| `employee_id` / `employeeId` | The ID the employee uses on the device |
| `privilege` | `0` user, `14` device admin |
| `status` | `0` Check-In, `1` Check-Out, `2` Break-Out, `3` Break-In, `4` OT-In, `5` OT-Out |
| `time` | Device local time, `YYYY-MM-DD HH:MM:SS` |
| `source` | `adms` or `tcp` |

Reply with any **2xx** status (optionally `{ "saved": 12 }`). Otherwise the records stay *New* and are
sent again on the next push, so treat `employeeId + time + deviceId` as unique and ignore duplicates.

**Laravel example**

```php
// routes/api.php
Route::middleware('auth:sanctum')->prefix('zk')->group(function () {
    Route::get('/ping',        fn () => ['message' => 'ok']);
    Route::get('/employees',   [ZKController::class, 'employees']);
    Route::post('/attendance', [ZKController::class, 'storeAttendance']);
});
```

---

## Configuration (.env)

`.env` is created by `npm install`. Most values can also be changed from **Settings**, which writes them back to `.env`.

| Key | Default | Meaning |
|---|---|---|
| `PORT` | `3000` | Web dashboard and API port |
| `HOST` | `0.0.0.0` | Listen address (`127.0.0.1` = this computer only) |
| `ADMS_PORT` | `7788` | Port ADMS devices push to |
| `LARAVEL_API_URL` | | ERP API base URL |
| `LARAVEL_API_TOKEN` | | ERP Bearer token (optional) |
| `FETCH_EMPLOYEE_URL` | | Full URL for the employee list, if not `/zk/employees` |
| `SYNC_ATTENDANCE_URL` | | Full URL for pushing attendance, if not `/zk/attendance` |
| `SYNC_SCHEDULE` | `*/30 * * * *` | Employee sync schedule (cron) |
| `ATTENDANCE_FETCH_SCHEDULE` | `*/15 * * * *` | Attendance push schedule (cron) |
| `EMPLOYEE_SYNC_ENABLED` / `ATTENDANCE_SYNC_ENABLED` | `true` | Turn a schedule off with `false` |
| `WORK_START_TIME` | `09:00` | Start of the working day, for the Late count |
| `LATE_GRACE_MINUTES` | `15` | Minutes allowed after the start time |
| `ATTENDANCE_RETENTION_DAYS` | `90` | Days of punches kept (records not yet sent to the ERP are always kept) |
| `LOG_LEVEL` | `info` | `error`, `warn`, `info` or `debug` |
| `SESSION_SECRET` | generated | Signs sign-in sessions; keep it secret |
| `MASTER_USERNAME` / `MASTER_PASSWORD` | empty | Emergency superadmin login (see below) |
| `DEMO_MODE` | `false` | `true` turns on [demo mode](#demo-mode-portfolio--cpanel). Never in real use |
| `DEMO_USERNAME` / `DEMO_PASSWORD` | `demo` / `demo1234` | The read-only demo account |

Restart the bridge after editing `.env` by hand.

**Forgot the admin password?** Set `MASTER_USERNAME` and `MASTER_PASSWORD` in `.env`, restart, sign in
with them, and reset the password in **Administration → Users & Roles**. Then clear both values again.

---

## Data, backup and updates

Everything is stored next to the app:

| Path | Contents |
|---|---|
| `.env` | Ports, ERP URL and token, schedules, secrets |
| `data/attendance.json` | Punches |
| `data/employees.json` | Employees |
| `data/tcp-devices.json` | TCP/IP devices and their Comm Keys |
| `data/users.json`, `roles.json`, `permissions.json` | Sign-in accounts and permissions |
| `data/config.json`, `branding.json`, `branding/` | Schedules, rules, branding and logo |
| `data/sessions.json` | Signed-in sessions |
| `logs/` | Server logs |

**Backup:** copy `.env` and the `data/` folder. To restore, put them back and start the bridge.

**Update to a new version:**

1. Stop the bridge (`./stop.sh`, `stop.bat`, or stop the service).
2. Back up `.env` and `data/`.
3. Replace the program files, keeping `.env` and `data/`. With git: `git pull`.
4. Run `npm install`.
5. Start the bridge again.

---

## Demo mode (portfolio / cPanel)

Demo mode shows the bridge to visitors without real devices — for a portfolio or a sales demo,
including on shared hosting with cPanel. Turn it on with `DEMO_MODE=true`. It then:

- adds a demo company: 12 employees, 3 devices and a week of punches. Today's punches appear as
  their time passes, so the dashboard always shows "today";
- creates a **read-only account** (`demo` / `demo1234` by default) once the setup wizard has made
  your own admin account, and shows it on the sign-in page with a **Use demo account** button.
  The demo account can open every page, but the server refuses every change it tries to make;
- does not start the ADMS listener (no devices, and shared hosting allows only the web port).

> **Not for real use.** For real devices, run the bridge on an office PC or a VPS, as described above.
> Shared hosting cannot open the ADMS port or reach devices in your office network.

### Trying it on your own computer

Use a **separate copy**: demo employees and punches are saved in `data/`, and they stay there after
you turn demo mode off. A different `PORT` lets the demo run next to a real installation.

```bash
mkdir ~/attendbridge-demo
tar --exclude=node_modules --exclude=data --exclude=.env --exclude=logs -cf - . | tar -xf - -C ~/attendbridge-demo
cd ~/attendbridge-demo
npm install
sed -i 's/^DEMO_MODE=.*/DEMO_MODE=true/; s/^PORT=.*/PORT=3001/' .env    # or edit .env by hand
npm start
```

Open <http://localhost:3001>, create your admin account in the setup wizard (skip the ERP step), and
sign out. The sign-in page then shows the demo account.

### Installing on cPanel

Your hosting needs **Setup Node.js App** in cPanel, with Node.js **20 or newer**.

1. Make the ZIP of the app without `node_modules`. Upload it with **File Manager** into a new folder
   (for example `attendbridge`) and extract it.
2. In **cPanel → Setup Node.js App → Create Application**:
   - **Node.js version:** 20 or newer.
   - **Application mode:** Production.
   - **Application root:** `attendbridge`.
   - **Application URL:** for example `demo.yoursite.com`.
   - **Application startup file:** `src/server.js`.
3. Under **Environment variables**, add:
   - `DEMO_MODE` = `true`
   - `TZ` = your time zone (for example `Asia/Dhaka`), so "today" matches your visitors
   - optionally `DEMO_USERNAME` and `DEMO_PASSWORD`
4. Click **Run NPM Install**, then **Start App** (or **Restart**).
5. Open the URL. The setup wizard appears: create **your own admin account** and skip the ERP step.
   Any ADMS port is fine; it is not used in demo mode.
6. Sign out. The sign-in page now shows the demo account for visitors.

Notes:

- cPanel stops idle apps, so the first visit after a quiet period can take a few seconds.
- Restart the app with cPanel's **Restart** button.
- If you change `DEMO_USERNAME` later, delete the old demo user in **Users & Roles**.

If your hosting has no **Setup Node.js App**, use a Node.js host such as Render, Railway or Fly.io
with the same environment variables.

---

## Troubleshooting

| Problem | What to check |
|---|---|
| `Cannot find module ...` on start | Run `npm install` in the app folder. |
| Dashboard does not open from another PC | Firewall rule for the web port; `HOST=0.0.0.0` in `.env`. |
| ADMS device does not appear | Server address and port on the device, firewall, same network. Restart the device and look for `ADMS handshake` in **Logs**. |
| TCP: "Connection refused" | Wrong port, or TCP is off on the device (default port `4370`). |
| TCP: "timed out" / "unreachable" | Wrong IP, device off, or a different network. Use the Ping Test. |
| TCP: "rejected the comm key" | Enter the device's Comm Key, or `0` if it has none. |
| Device IP changed | Add it again with the new IP (matched by serial number), or use **Edit**. |
| Test Connection fails | `401/403`: wrong token. `404`: wrong base URL (include `/api` if your routes use it). |
| Records stay "New" | Turn on Attendance Push, click **Push to ERP**, and read the message and **Logs**. |
| Older punches missing | Set **From / To** on Attendance, then Fetch TCP or Fetch ADMS. |
| Port already in use | Another program, or the bridge already running. Change `PORT` / `ADMS_PORT`, or stop the other one. |

Check whether a port is listening:

```bash
sudo ss -tlnp | grep -E '3000|7788'               # Linux
netstat -ano | findstr ":3000 :7788"               # Windows
```

Check whether a TCP/IP device answers:

```bash
nc -zv 192.168.1.201 4370                                     # Linux
Test-NetConnection -ComputerName 192.168.1.201 -Port 4370     # Windows PowerShell
```

---

## Project structure

```
attendbridge/
├── src/
│   ├── server.js            Entry point: web server, sessions, startup
│   ├── routes.js            REST API for the dashboard
│   ├── authRoutes.js        Sign-in, users and roles API
│   ├── auth.js              Users, roles, permissions
│   ├── install.js           Setup wizard API
│   ├── store.js             State and data files
│   ├── scheduler.js         Employee sync and attendance push schedules
│   ├── analytics.js         Dashboard numbers and charts
│   ├── branding.js          White-label settings
│   ├── demo.js              Demo mode (DEMO_MODE=true)
│   ├── adms/server.js       ADMS push server (iclock protocol)
│   ├── tcpip/zkclient.js    ZKTeco TCP protocol client (port 4370)
│   ├── tcpip/connector.js   TCP/IP devices: sessions, fetch, user writes
│   └── laravel/api.js       ERP API client
├── public/
│   ├── index.html           Dashboard
│   ├── login.html           Sign-in page
│   ├── install.html         Setup wizard
│   ├── css/style.css
│   └── js/                  app.js, admin.js, charts.js, branding.js, i18n.js (English / Bengali)
├── scripts/                 setup.js (after npm install), service.js (Windows service / systemd), package.js
├── documentation/           Offline HTML documentation
├── .github/ci/              CI smoke test and ZKTeco device emulator
├── start.* / stop.*         One-click launchers
├── install-service.* / uninstall-service.*
├── ecosystem.config.js      PM2 config
└── .env.example             Settings template
```

**Development checks** (the same as CI):

```bash
python3 .github/ci/zk_emulator.py 14371 &         # emulated TCP/IP device
python3 .github/ci/zk_emulator.py 14372 1234 &    # with Comm Key 1234
ZK_EMU_PORT=14371 ZK_EMU_KEY_PORT=14372 node .github/ci/smoke.js full
```

Run the smoke test on a fresh copy: it runs the setup wizard.

---

## বাংলায় দ্রুত শুরু

**১. প্রয়োজন:** Node.js 20 বা নতুন (<https://nodejs.org>)। কম্পিউটারকে স্থায়ী IP দিন।

**২. ইনস্টল ও চালু:**

```bash
npm install      # .env, data/ ও logs/ নিজে থেকে তৈরি হয়
npm start        # তারপর ব্রাউজারে http://localhost:3000 খুলুন
```

**৩. সেটআপ উইজার্ড:** প্রথমবার খুললে উইজার্ড চলবে: সিস্টেম যাচাই, অ্যাডমিন অ্যাকাউন্ট, ERP সংযোগ (ঐচ্ছিক), অ্যাপের নাম ও ADMS পোর্ট।
উপরের বারের **EN | বাং** দিয়ে ভাষা বদলানো যায়।

**৪. ফায়ারওয়াল:** ওয়েব পোর্ট `3000` আর ADMS পোর্ট `7788` খুলে দিন (উপরের [Installation](#4-open-the-firewall) অংশে কমান্ড আছে)।

**৫. কম্পিউটার চালু হলে নিজে থেকে চালু:**

- Windows-এ `install-service.bat` চালান (Administrator)।
- Linux-এ `./install-service.sh` চালান।

**৬. ডিভাইস যুক্ত করা:**

- **ADMS ডিভাইস:** ডিভাইসে **Menu → COMM → Cloud Server Setting**-এ সার্ভার ঠিকানা হিসেবে এই কম্পিউটারের IP আর পোর্ট `7788` দিন।
- **পুরোনো (TCP/IP) ডিভাইস:** ড্যাশবোর্ডের **ডিভাইস** পেজে IP, পোর্ট `4370` আর Comm Key (থাকলে) দিয়ে যোগ করুন।
  IP বদলে গেলে নতুন IP দিয়ে আবার যোগ করলেই চলবে। সিরিয়াল নম্বর দেখে ডিভাইস চিনে নেবে, কোনো রেকর্ড দুবার যাবে না।

**৭. প্রতিদিনের কাজ:**

1. **কর্মী → ERP থেকে লোড → ডিভাইসে পাঠান**।
2. পাঞ্চ **হাজিরা** পেজে দেখা যাবে।
3. সেটিংসে **হাজিরা পাঠানো** চালু রাখলে নতুন পাঞ্চ নিজে থেকেই ERP-তে যাবে।

**৮. ব্যাকআপ:** `.env` ফাইল আর `data/` ফোল্ডার কপি করে রাখুন। আপডেটের সময় এ দুটো রেখে দিন।

বিস্তারিত সব কিছু ড্যাশবোর্ডের **ব্যবহার নির্দেশিকা** পেজে বাংলা ও ইংরেজিতে আছে।

---

## Developer

Developed by **M. Estiaque Ahmed Khan** — [mestiaque.com](https://mestiaque.com)
