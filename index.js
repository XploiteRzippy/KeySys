import express from "express";
import fs from "fs";

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;

// -------------------------
// LOAD & SAVE KEYS
// -------------------------
function loadKeys() {
  if (!fs.existsSync("keys.json")) {
    fs.writeFileSync("keys.json", JSON.stringify({}));
  }
  return JSON.parse(fs.readFileSync("keys.json"));
}

function saveKeys(data) {
  fs.writeFileSync("keys.json", JSON.stringify(data, null, 2));
}

// -------------------------
// GENERATE RANDOM KEY
// -------------------------
function genKey() {
  return "KEY-" + Math.random().toString(36).substring(2, 10).toUpperCase();
}

// -------------------------
// PARSE DURATION
// -------------------------
function parseDuration(str) {
  if (!str) return null;
  str = str.toLowerCase().trim();
  const match = str.match(/^(\d+)(m|h|d)$/);
  if (!match) return null;
  const num = parseInt(match[1]);
  const unit = match[2];
  if (unit === "m") return num * 60000;
  if (unit === "h") return num * 3600000;
  if (unit === "d") return num * 86400000;
  return null;
}

// -------------------------
// ROOT DASHBOARD
// -------------------------
app.get("/", (req, res) => {
  const html = `
  <!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Key Admin Dashboard</title>
    <style>
      body { background:#111; color:#eee; font-family:Arial,sans-serif; padding:20px; }
      h1,h2 { color:#0af; }
      input, button { margin:5px; padding:5px 10px; }
      table { width:100%; border-collapse: collapse; margin-top:10px; }
      th, td { border:1px solid #444; padding:5px; text-align:center; }
      th { background:#222; }
      tr:nth-child(even){ background:#1a1a1a; }
      button { cursor:pointer; }
    </style>
  </head>
  <body>
    <h1>Key Admin Dashboard</h1>

    <div>
      <h2>Create Key</h2>
      <input id="duration" placeholder="Duration e.g. 10m, 2h, 1d">
      <button onclick="createKey()">Create</button>
      <span id="createResult"></span>
    </div>

    <div>
      <h2>All Keys</h2>
      <table id="keysTable">
        <thead>
          <tr><th>Key</th><th>Created</th><th>Expires</th><th>Revoked</th><th>Actions</th></tr>
        </thead>
        <tbody></tbody>
      </table>
    </div>

    <script>
      async function fetchKeys() {
        const res = await fetch('/allkeys');
        const data = await res.json();
        const tbody = document.querySelector('#keysTable tbody');
        tbody.innerHTML = '';
        for(const k in data) {
          const d = data[k];
          const tr = document.createElement('tr');
          tr.innerHTML = \`
            <td>\${k}</td>
            <td>\${new Date(d.created).toLocaleString()}</td>
            <td>\${new Date(d.expireAt).toLocaleString()}</td>
            <td>\${d.revoked}</td>
            <td>
              <button onclick="revokeKey('\${k}')">Revoke</button>
              <button onclick="deleteKey('\${k}')">Delete</button>
            </td>
          \`;
          tbody.appendChild(tr);
        }
      }

      async function createKey() {
        const dur = document.getElementById('duration').value;
        if(!dur) return alert('Enter duration!');
        const res = await fetch('/create', {
          method:'POST',
          headers:{'Content-Type':'application/json'},
          body:JSON.stringify({duration: dur})
        });
        const data = await res.json();
        document.getElementById('createResult').innerText = data.key ? "Created: "+data.key : JSON.stringify(data);
        fetchKeys();
      }

      async function revokeKey(k) {
        await fetch('/revoke', {
          method:'POST',
          headers:{'Content-Type':'application/json'},
          body:JSON.stringify({key: k})
        });
        fetchKeys();
      }

      async function deleteKey(k) {
        await fetch('/delete', {
          method:'POST',
          headers:{'Content-Type':'application/json'},
          body:JSON.stringify({key: k})
        });
        fetchKeys();
      }

      fetchKeys();
      setInterval(fetchKeys, 5000); // auto-refresh
    </script>
  </body>
  </html>
  `;
  res.send(html);
});

// -------------------------
// API ENDPOINTS
// -------------------------
app.post("/create", (req,res)=>{
  const {duration}=req.body;
  const ms=parseDuration(duration);
  if(!ms) return res.json({error:"Invalid duration! Use 10m,2h,1d"});
  const keys=loadKeys();
  const newKey=genKey();
  keys[newKey]={created:Date.now(),expireAt:Date.now()+ms,revoked:false};
  saveKeys(keys);
  res.json({success:true,key:newKey,expires:keys[newKey].expireAt});
});

app.post("/revoke",(req,res)=>{
  const {key}=req.body;
  const keys=loadKeys();
  if(!keys[key]) return res.json({error:"Key not found"});
  keys[key].revoked=true;
  saveKeys(keys);
  res.json({success:true,revoked:key});
});

app.post("/delete",(req,res)=>{
  const {key}=req.body;
  const keys=loadKeys();
  if(!keys[key]) return res.json({error:"Key not found"});
  delete keys[key];
  saveKeys(keys);
  res.json({success:true,deleted:key});
});

app.get("/allkeys",(req,res)=>{
  res.json(loadKeys());
});

app.get("/verify",(req,res)=>{
  const {key}=req.query;
  const keys=loadKeys();
  if(!keys[key]) return res.json({valid:false,reason:"KEY_NOT_FOUND"});
  const d=keys[key];
  if(d.revoked) return res.json({valid:false,reason:"REVOKED"});
  if(Date.now()>d.expireAt) return res.json({valid:false,reason:"EXPIRED"});
  res.json({valid:true,reason:"OK"});
});

// -------------------------
// START SERVER
// -------------------------
app.listen(PORT,()=>console.log(`Key system admin dashboard running on ${PORT}`));
