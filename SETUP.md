# AttendBridge — সেটআপ গাইড (বাংলা)

**Developer:** M. Estiaque — https://mestiaque.com

ইংরেজিতে পূর্ণ নির্দেশনা: [README.md](README.md)। ড্যাশবোর্ডের **ব্যবহার নির্দেশিকা** পেজেও সব কিছু বাংলায় আছে।

---

## ১. যা লাগবে

| জিনিস | বিস্তারিত |
|---|---|
| Node.js | **20 বা তার নতুন** সংস্করণ |
| কম্পিউটার | Windows 10/11/Server বা Linux; সবসময় চালু থাকে এমন PC |
| নেটওয়ার্ক | ডিভাইস আর কম্পিউটার একই নেটওয়ার্কে; কম্পিউটারের **স্থায়ী IP** |
| পোর্ট | `3000` ওয়েব ড্যাশবোর্ড, `7788` ADMS (ডিভাইস এখানে ডেটা পাঠায়), `4370` TCP/IP ডিভাইস |

### Node.js ইনস্টল

**Linux (Ubuntu/Debian):**

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs
node -v   # v20 বা তার বেশি দেখাতে হবে
```

**Windows:** https://nodejs.org থেকে LTS সংস্করণ নামিয়ে ইনস্টল করুন। তারপর Command Prompt-এ:

```cmd
node -v
npm -v
```

---

## ২. প্রজেক্ট ইনস্টল ও চালু

```bash
cd /path/to/attendbridge
npm install     # .env, data/ ও logs/ নিজে থেকে তৈরি হয়
npm start       # তারপর ব্রাউজারে http://localhost:3000
```

প্রথমবার খুললে **সেটআপ উইজার্ড** চলবে:

1. সিস্টেম যাচাই
2. অ্যাডমিন অ্যাকাউন্ট
3. ERP সংযোগ (ঐচ্ছিক)
4. অ্যাপের নাম ও ADMS পোর্ট

উপরের বারের **EN | বাং** দিয়ে ভাষা বদলানো যায়।

একই নেটওয়ার্কের অন্য কম্পিউটার থেকে খুলতে: `http://<এই-কম্পিউটারের-IP>:3000`

---

## ৩. Background-এ চালানো ও কম্পিউটার চালু হলে নিজে থেকে চালু

### সবচেয়ে সহজ: Service হিসেবে ইনস্টল (প্রস্তাবিত)

| | ইনস্টল | সরানো |
|---|---|---|
| Windows | `install-service.bat` ডাবল-ক্লিক (Administrator অনুমতি চাইবে) | `uninstall-service.bat` |
| Linux | `./install-service.sh` (sudo চাইবে) | `./uninstall-service.sh` |

Linux-এ অবস্থা ও লগ দেখতে:

```bash
systemctl status attendbridge
journalctl -u attendbridge -f
sudo systemctl restart attendbridge
```

### এক ক্লিকে চালু / বন্ধ

| | চালু | বন্ধ |
|---|---|---|
| Linux | `./start.sh` | `./stop.sh` |
| Windows | `start.bat` (কনসোল ছাড়া: `AttendBridge.vbs`) | `stop.bat` |

### PM2 দিয়ে (ঐচ্ছিক)

```bash
npm install -g pm2
pm2 start ecosystem.config.js   # process-এর নাম: attendbridge
pm2 save
pm2 startup                     # যে কমান্ড দেখাবে সেটা চালান — বুট হলে নিজে থেকে চালু হবে

pm2 status
pm2 logs attendbridge
pm2 restart attendbridge
pm2 stop attendbridge
```

> PM2 ইনস্টল থাকলে `start.sh` / `start.bat` নিজে থেকেই PM2 ব্যবহার করে।

---

## ৪. পোর্ট ও ফায়ারওয়াল

### পোর্ট চালু আছে কিনা দেখুন

```bash
# Linux
sudo ss -tlnp | grep -E '3000|7788'
```

```cmd
:: Windows
netstat -ano | findstr ":3000 :7788"
```

### ফায়ারওয়ালে পোর্ট খুলুন

**Linux (UFW):**

```bash
sudo ufw allow 3000/tcp
sudo ufw allow 7788/tcp
```

**Linux (firewalld):**

```bash
sudo firewall-cmd --permanent --add-port=3000/tcp --add-port=7788/tcp
sudo firewall-cmd --reload
```

**Windows (PowerShell — Administrator):**

```powershell
netsh advfirewall firewall add rule name="AttendBridge Web"  dir=in action=allow protocol=TCP localport=3000
netsh advfirewall firewall add rule name="AttendBridge ADMS" dir=in action=allow protocol=TCP localport=7788
```

> পোর্ট বদলালে (`.env`-এ `PORT` / `ADMS_PORT`, অথবা সেটিংস থেকে) উপরের নম্বরগুলোও বদলে নিন।

---

## ৫. ডিভাইস যুক্ত করা

### ADMS ডিভাইস (নতুন মডেল, নিজে থেকে ডেটা পাঠায়)

ডিভাইসে **Menu → COMM → Cloud Server Setting** (পুরোনো মডেলে **Comm → ADMS**):

| ঘর | মান |
|---|---|
| Server Address | এই কম্পিউটারের LAN IP (যেমন `192.168.1.10`) |
| Server Port | ADMS পোর্ট (ডিফল্ট `7788`) |
| Enable Domain Name / HTTPS / Proxy | `OFF` |

সংরক্ষণ করে ডিভাইস রিস্টার্ট দিন। কখনো `localhost` বা `127.0.0.1` দেবেন না।

### TCP/IP ডিভাইস (পুরোনো মডেল)

1. ডিভাইসকে স্থায়ী IP দিন (Menu → COMM → Ethernet, DHCP বন্ধ)।
2. ড্যাশবোর্ডে **ডিভাইস → নেটওয়ার্ক পিং টেস্ট**।
3. **TCP/IP ডিভাইস যোগ করুন**: IP, পোর্ট `4370`, নাম, আর থাকলে Comm Key।

IP বদলে গেলে নতুন IP দিয়ে আবার যোগ করলেই হবে। সিরিয়াল নম্বর দেখে আগের ডিভাইস চিনে নেবে, কোনো রেকর্ড দুবার যাবে না। অথবা ডিভাইস তালিকার **এডিট** বোতাম ব্যবহার করুন।

---

## ৬. নেটওয়ার্কে ডিভাইস খোঁজা ও যাচাই

### একটি ডিভাইস ping করুন

```bash
ping 192.168.1.100
```

### ডিভাইসের 4370 পোর্ট খোলা কিনা

```bash
# Linux
nc -zv 192.168.1.100 4370
```

```powershell
# Windows PowerShell
Test-NetConnection -ComputerName 192.168.1.100 -Port 4370
```

### নেটওয়ার্কের সব ZKTeco ডিভাইস খুঁজুন

**Linux — nmap:**

```bash
sudo apt install nmap -y
sudo nmap -p 4370 192.168.1.0/24 --open     # শুধু 4370 পোর্ট খোলা এমন যন্ত্র
sudo nmap -sn 192.168.1.0/24                # নেটওয়ার্কের সব চালু যন্ত্র
```

**Linux — arp-scan (দ্রুত):**

```bash
sudo apt install arp-scan -y
sudo arp-scan --localnet
```

**Windows — PowerShell:**

```powershell
1..254 | ForEach-Object {
  $ip = "192.168.1.$_"
  if (Test-Connection -ComputerName $ip -Count 1 -Quiet -ErrorAction SilentlyContinue) { Write-Host "$ip is UP" }
}
arp -a     # সংযুক্ত যন্ত্রের তালিকা
```

> `192.168.1` অংশটা আপনার নেটওয়ার্ক অনুযায়ী বদলে নিন।

---

## ৭. .env সেটিংস

`npm install` নিজে থেকেই `.env` তৈরি করে। প্রধান মানগুলো:

```env
PORT=3000                 # ওয়েব ড্যাশবোর্ড
HOST=0.0.0.0              # 127.0.0.1 দিলে শুধু এই কম্পিউটার থেকে খোলা যাবে
ADMS_PORT=7788            # ADMS ডিভাইস এই পোর্টে পাঠায়
LARAVEL_API_URL=          # ERP API বেস URL (সেটিংস থেকেও দেওয়া যায়)
LARAVEL_API_TOKEN=
ATTENDANCE_RETENTION_DAYS=90
MASTER_USERNAME=          # জরুরি লগইন — পাসওয়ার্ড ভুলে গেলে
MASTER_PASSWORD=
```

হাতে `.env` বদলালে ব্রিজ রিস্টার্ট দিন। সব key-র তালিকা: [README.md](README.md#configuration-env)।

**অ্যাডমিন পাসওয়ার্ড ভুলে গেলে:**

1. `.env`-এ `MASTER_USERNAME` আর `MASTER_PASSWORD` দিয়ে রিস্টার্ট করুন।
2. সেগুলো দিয়ে লগইন করে **প্রশাসন → ইউজার ও রোল** থেকে পাসওয়ার্ড বদলান।
3. তারপর দুটো মান আবার মুছে দিন।

---

## ৮. ব্যাকআপ ও আপডেট

সব ডেটা থাকে `data/` ফোল্ডারে (হাজিরা, কর্মী, TCP ডিভাইস, ইউজার, সেটিংস), আর সংযোগের সেটিং থাকে `.env`-এ।
**ব্যাকআপ = এই দুটো কপি করে রাখা।**

`data/` আর `.env` git-এ ignore করা, তাই `git pull` এগুলো কখনো বদলায় না।

```bash
# ১. ব্যাকআপ (ঐচ্ছিক কিন্তু ভালো)
cp -r data data-backup-$(date +%F) && cp .env .env.backup

# ২. নতুন কোড
git pull origin master
npm install

# ৩. রিস্টার্ট (যেভাবে চালাচ্ছেন সেভাবে)
sudo systemctl restart attendbridge    # service হলে
pm2 restart attendbridge               # PM2 হলে
./start.sh                             # script হলে
```

Windows-এ zip থেকে আপডেট করলে:

1. `stop.bat` দিয়ে বন্ধ করুন (বা service বন্ধ করুন)।
2. নতুন ফাইলগুলো পুরোনো ফোল্ডারে কপি করুন, `.env` আর `data/` রেখে।
3. `npm install` চালান।
4. আবার চালু করুন।

---

## ৯. দ্রুত সারসংক্ষেপ

```bash
npm install                 # ১. ইনস্টল
npm start                   # ২. চালু → http://localhost:3000 → সেটআপ উইজার্ড
./install-service.sh        # ৩. বুট হলে নিজে থেকে চালু (Windows: install-service.bat)
sudo ufw allow 3000/tcp     # ৪. ফায়ারওয়াল
sudo ufw allow 7788/tcp
git pull && npm install     # ৫. আপডেট, তারপর রিস্টার্ট
```

---

*Developed by M. Estiaque — https://mestiaque.com*
