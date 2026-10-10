# ZKTeco ↔ ERP Bridge

A Node.js application that bridges ZKTeco attendance devices with a ERP API.

## Features

- **ADMS Server** — newer ZKTeco devices push data in real-time
- **TCP/IP Connector** — connect older devices via pull mode
- **ERP Sync** — bidirectional: employees from ERP → devices, attendance from devices → ERP
- **Live Dashboard** — real-time UI with Socket.IO
- **Scheduler** — automated sync via cron

---

## Quick Start

Requires **Node.js 20+**. Same commands on Linux and Windows:

```bash
git clone <repo-url>
cd zkbrize-v1
npm install     # also creates .env, logs/ and data/ on first run
npm start       # open http://localhost:3000
```

On first launch the browser opens a **setup wizard**: it checks the system, creates the administrator
account, and (optionally) connects your ERP and sets the app name and ADMS port. Everything can be
changed later from **Settings**.

**One-click (runs in background, opens browser):**
- Linux: `./start.sh` / `./stop.sh`
- Windows: double-click `start.bat` / `stop.bat` (or `ZK-Bridge.vbs` to start without a console window)

If PM2 is installed (`npm i -g pm2`), the start scripts use it, so the server restarts automatically if it crashes.

**Run in the background and start with the computer (recommended for production):**
- Windows: double-click `install-service.bat` (asks for Administrator rights). Remove with `uninstall-service.bat`.
- Linux (systemd): `./install-service.sh` (asks for sudo). Remove with `./uninstall-service.sh`.

### Branding (white-label)
Sign in as superadmin → **Settings → Branding** to change the app name, tagline, logo, primary color,
and the company name/website shown in the footer.

### Forgot the admin password?
Set `MASTER_USERNAME` and `MASTER_PASSWORD` in `.env`, restart, sign in with them and reset the
password from **Manage Users**. Then clear both values again.

---

## .env Configuration

```env
PORT=3000               # Web UI & API port
HOST=0.0.0.0            # Listen address (127.0.0.1 = this computer only)
ADMS_PORT=7788          # ZKTeco ADMS push port

LARAVEL_API_URL=https://yourapp.com/api
LARAVEL_API_TOKEN=your-sanctum-token

SYNC_SCHEDULE=*/30 * * * *           # Employee sync frequency
ATTENDANCE_FETCH_SCHEDULE=*/15 * * * * # Attendance push frequency

SESSION_SECRET=...      # Generated automatically on first run
MASTER_USERNAME=        # Optional emergency login (see above)
MASTER_PASSWORD=
```

---

## ERP API Endpoints Required

Add these to your ERP app:

```php
// routes/api.php
Route::middleware('auth:sanctum')->prefix('zk')->group(function () {
    Route::get('/ping',        [ZKController::class, 'ping']);
    Route::get('/employees',   [ZKController::class, 'employees']);
    Route::post('/attendance', [ZKController::class, 'storeAttendance']);
});
```

### ZKController.php

```php
<?php
namespace App\Http\Controllers;

use App\Models\Employee;
use App\Models\Attendance;
use Illuminate\Http\Request;

class ZKController extends Controller
{
    public function ping()
    {
        return response()->json(['message' => 'pong', 'status' => 'ok']);
    }

    public function employees()
    {
        $employees = Employee::select('id', 'employee_id', 'name')
            ->get()
            ->map(fn($e, $i) => [
                'id'          => $e->id,
                'uid'         => $i + 1,         // ZKTeco UID (1-65535)
                'employee_id' => $e->employee_id,
                'name'        => $e->name,
                'privilege'   => 0,               // 0=user, 14=admin
                'password'    => '',
            ]);

        return response()->json(['data' => $employees]);
    }

    public function storeAttendance(Request $request)
    {
        $records = $request->input('records', []);
        $saved = 0;

        foreach ($records as $record) {
            Attendance::updateOrCreate(
                [
                    'employee_id' => $record['employee_id'] ?? null,
                    'punch_time'  => $record['time'] ?? null,
                    'device_id'   => $record['device_id'] ?? null,
                ],
                [
                    'status'  => $record['status'] ?? '0',
                    'source'  => $record['source'] ?? 'zk',
                    'raw'     => json_encode($record),
                ]
            );
            $saved++;
        }

        return response()->json(['saved' => $saved, 'message' => 'OK']);
    }
}
```

---

## Device Setup

### ADMS (Newer Devices)
On the ZKTeco device:
1. Go to **Comm → ADMS**
2. Set server address: `http://<this-machine-ip>:7788`
3. Enable push, save

The device will start pushing attendance automatically.

### TCP/IP (Older Devices)
1. Open the bridge web UI → **Devices**
2. Click **Add TCP/IP Device**
3. Enter device IP (default port: 4370)
4. Click Connect

---

## Project Structure

```
zk-bridge/
├── src/
│   ├── server.js          # Main entry point
│   ├── install.js         # First-run setup wizard API
│   ├── auth.js            # Users, roles, permissions
│   ├── branding.js        # White-label settings
│   ├── routes.js          # Express API routes
│   ├── store.js           # In-memory state
│   ├── logger.js          # Winston logger
│   ├── scheduler.js       # Cron jobs
│   ├── adms/
│   │   └── server.js      # ADMS HTTP push server
│   ├── tcpip/
│   │   └── connector.js   # TCP/IP device connector
│   └── laravel/
│       └── api.js         # ERP API client
├── public/
│   ├── index.html
│   ├── install.html       # Setup wizard
│   ├── css/style.css
│   └── js/app.js
├── scripts/
│   ├── setup.js           # Runs after npm install
│   └── service.js         # Windows service / systemd install
├── config/
│   └── default.env
├── data/                  # Auto-created: users, settings, branding
├── logs/                  # Auto-created
└── README.md
```

---

## Developer

Developed by **M. Estiaque** — [mestiaque.com](https://mestiaque.com)
