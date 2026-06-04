const express = require('express');
const { Client } = require('basic-ftp');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const app = express();
const port = process.env.PORT || 3000;

// Use disk storage instead of memory to prevent server crashes on large files
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => {
        const uniqueName = crypto.randomUUID() + path.extname(file.originalname);
        cb(null, uniqueName);
    }
});
const upload = multer({ 
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 * 1024 } // 5GB limit
});

app.use(express.json({ limit: '10mb' }));

// XSS escape helper
function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

// Path sanitization to prevent directory traversal
function sanitizePath(inputPath) {
    if (!inputPath || typeof inputPath !== 'string') return '/';
    // Normalize and prevent traversal
    let clean = path.posix.normalize(inputPath);
    // Remove any attempts to go above root
    while (clean.startsWith('..')) clean = clean.slice(2);
    while (clean.startsWith('/..')) clean = clean.slice(3);
    if (!clean.startsWith('/')) clean = '/' + clean;
    return clean || '/';
}

// UI Frontend Engine
app.get('/', (req, res) => {
    res.send(`<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>LAN FTP Client</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <style>
        .drag-over { background-color: #e0f2fe; border-color: #38bdf8; }
        .selected-row { background-color: #f0f9ff !important; border-left: 4px solid #38bdf8; }
        .sort-asc::after { content: " ▲"; }
        .sort-desc::after { content: " ▼"; }
    </style>
</head>
<body class="bg-slate-50 text-slate-800 font-sans h-screen flex flex-col overflow-hidden">

    <div id="connModal" class="fixed inset-0 bg-slate-900/40 backdrop-blur-sm hidden flex items-center justify-center z-50 p-4">
        <div class="bg-white p-6 rounded-2xl shadow-xl w-full max-w-sm border border-slate-100">
            <h3 class="text-xl font-bold mb-4 text-slate-900">Connect to FTP Server</h3>
            <div class="space-y-3">
                <div>
                    <label class="text-xs font-semibold uppercase text-slate-500">Server IP Address</label>
                    <input type="text" id="ftpIp" placeholder="192.168.1.50" class="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-sky-500">
                </div>
                <div>
                    <label class="text-xs font-semibold uppercase text-slate-500">Port</label>
                    <input type="number" id="ftpPort" value="21" class="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-sky-500">
                </div>
                <div>
                    <label class="text-xs font-semibold uppercase text-slate-500">Username</label>
                    <input type="text" id="ftpUser" value="anonymous" class="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-sky-500">
                </div>
                <div>
                    <label class="text-xs font-semibold uppercase text-slate-500">Password</label>
                    <input type="password" id="ftpPass" placeholder="Leave empty for anonymous" class="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-sky-500">
                </div>
                <div class="flex items-center gap-2">
                    <input type="checkbox" id="ftpSecure" class="rounded border-slate-300 text-sky-500 focus:ring-sky-400">
                    <label for="ftpSecure" class="text-sm text-slate-600">Use FTPS (TLS)</label>
                </div>
                <button onclick="saveAndConnect()" class="w-full bg-sky-500 text-white font-medium py-2 rounded-lg hover:bg-sky-600 transition-colors mt-2">Connect</button>
            </div>
        </div>
    </div>

    <div id="collisionModal" class="fixed inset-0 bg-slate-900/40 backdrop-blur-sm hidden flex items-center justify-center z-50 p-4">
        <div class="bg-white p-6 rounded-2xl shadow-xl w-full max-w-md border border-slate-100">
            <div class="flex items-center gap-3 text-amber-500 mb-3">
                <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
                <h3 class="text-lg font-bold text-slate-900">File Already Exists</h3>
            </div>
            <p id="collisionMessage" class="text-sm text-slate-600 mb-5 break-all"></p>
            <div class="flex flex-col sm:flex-row justify-end gap-2 text-sm font-medium">
                <button id="btnSkip" class="px-4 py-2 border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors">Don't Copy</button>
                <button id="btnKeepBoth" class="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors">Keep Both</button>
                <button id="btnReplace" class="px-4 py-2 bg-sky-500 text-white rounded-lg hover:bg-sky-600 transition-colors">Replace</button>
            </div>
        </div>
    </div>

    <div id="renameModal" class="fixed inset-0 bg-slate-900/40 backdrop-blur-sm hidden flex items-center justify-center z-50 p-4">
        <div class="bg-white p-6 rounded-2xl shadow-xl w-full max-w-sm border border-slate-100">
            <h3 class="text-lg font-bold text-slate-900 mb-3">Rename Item</h3>
            <input type="text" id="renameInput" class="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-sky-500 mb-4">
            <div class="flex justify-end gap-2">
                <button onclick="closeRenameModal()" class="px-4 py-2 border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50">Cancel</button>
                <button onclick="confirmRename()" class="px-4 py-2 bg-sky-500 text-white rounded-lg hover:bg-sky-600">Rename</button>
            </div>
        </div>
    </div>

    <header class="bg-white border-b border-slate-200 py-4 px-6 shrink-0">
        <div class="max-w-7xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-4">
            <div class="flex items-center gap-3">
                <div class="p-2 bg-sky-500 text-white rounded-xl shadow-md shadow-sky-100">
                    <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"></path></svg>
                </div>
                <div>
                    <h1 class="text-lg font-bold text-slate-900">LAN Storage Explorer</h1>
                    <p id="connectionStatus" class="text-xs text-slate-400">Checking connection...</p>
                </div>
            </div>
            <div class="flex items-center gap-2">
                <button onclick="triggerNewFolder()" class="bg-white border border-slate-200 hover:border-slate-300 text-slate-700 px-4 py-2 rounded-lg text-sm font-medium transition-all shadow-sm">New Folder</button>
                <button onclick="showConnectionPrompt()" class="p-2 text-slate-400 hover:text-slate-600 rounded-lg" title="Connection Settings">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
                </button>
            </div>
        </div>
    </header>

    <div class="bg-white border-b border-slate-150 py-2 px-6 shrink-0">
        <div class="max-w-7xl mx-auto flex items-center gap-3 text-sm text-slate-500">
            <button id="backBtn" onclick="navigateUp()" class="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors disabled:opacity-30" title="Go Up (Backspace)">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path></svg>
            </button>
            
            <div class="flex-1 relative bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 flex items-center min-w-0 min-h-[38px] cursor-text" onclick="enablePathEdit()">
                <div id="breadcrumbs" class="flex items-center gap-1.5 overflow-x-auto w-full select-none"></div>
                <input type="text" id="pathInput" class="hidden absolute inset-0 bg-slate-50 px-3 py-1.5 rounded-lg outline-none text-slate-700 font-mono text-sm w-full border border-sky-500" onkeydown="handlePathKeydown(event)" onblur="disablePathEdit()">
            </div>
        </div>
    </div>

    <div class="max-w-7xl w-full mx-auto flex-1 flex flex-col md:flex-row p-6 gap-6 min-h-0 overflow-hidden relative">
        
        <aside class="w-full md:w-52 flex flex-row md:flex-col gap-2 shrink-0 overflow-x-auto md:overflow-x-visible pb-2 md:pb-0 select-none">
            <button onclick="document.getElementById('sidebarFileInput').click()" class="flex items-center gap-3 w-full bg-sky-500 hover:bg-sky-600 text-white text-sm font-medium px-4 py-3 rounded-xl transition-all shadow-md shadow-sky-100 shrink-0">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"></path></svg>
                <span>Upload File</span>
            </button>
            <input type="file" id="sidebarFileInput" class="hidden" multiple onchange="handleFileSelect(this.files)">

            <div class="h-px bg-slate-200 my-1 hidden md:block"></div>

            <button onclick="actionDownloadSelected()" id="toolDownload" disabled class="flex items-center gap-3 w-full border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:hover:bg-white text-slate-700 text-sm font-medium px-4 py-2.5 rounded-xl transition-all shadow-sm shrink-0">
                <svg class="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>
                <span>Download File</span>
            </button>

            <button onclick="actionClipboard('cut')" id="toolCut" disabled class="flex items-center gap-3 w-full border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:hover:bg-white text-slate-700 text-sm font-medium px-4 py-2.5 rounded-xl transition-all shadow-sm shrink-0">
                <svg class="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.121 14.121L19 19m-7-7l7-7m-7 7l-2.879 2.879M12 12L9.121 9.121m0 5.758a3 3 0 10-4.243 4.243 3 3 0 004.243-4.243zm0-5.758a3 3 0 10-4.243-4.243 3 3 0 004.243 4.243z"></path></svg>
                <span>Cut Selected</span>
            </button>

            <button onclick="actionClipboard('copy')" id="toolCopy" disabled class="flex items-center gap-3 w-full border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:hover:bg-white text-slate-700 text-sm font-medium px-4 py-2.5 rounded-xl transition-all shadow-sm shrink-0">
                <svg class="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2"></path></svg>
                <span>Copy Selected</span>
            </button>

            <button onclick="actionPaste()" id="toolPaste" disabled class="flex items-center gap-3 w-full border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:hover:bg-white text-slate-700 text-sm font-medium px-4 py-2.5 rounded-xl transition-all shadow-sm shrink-0">
                <svg class="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"></path></svg>
                <span>Paste Here</span>
            </button>

            <button onclick="actionRenameSelected()" id="toolRename" disabled class="flex items-center gap-3 w-full border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:hover:bg-white text-slate-700 text-sm font-medium px-4 py-2.5 rounded-xl transition-all shadow-sm shrink-0">
                <svg class="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path></svg>
                <span>Rename</span>
            </button>

            <button onclick="actionDeleteSelected()" id="toolDelete" disabled class="flex items-center gap-3 w-full border border-red-200 bg-white hover:bg-red-50 disabled:opacity-40 disabled:hover:bg-white text-red-600 text-sm font-medium px-4 py-2.5 rounded-xl transition-all shadow-sm shrink-0">
                <svg class="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-4v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                <span>Delete</span>
            </button>
        </aside>

        <main id="dropZone" class="flex-1 bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden transition-all border-2 border-transparent flex flex-col min-h-0">
            
            <div class="bg-slate-50/50 border-b border-slate-200 py-2 px-4 flex flex-wrap items-center gap-2 text-xs select-none shrink-0">
                <button onclick="selectAllItems()" class="px-2 py-1 bg-white border border-slate-200 rounded hover:bg-slate-50 text-slate-600 font-medium shadow-sm">Select All</button>
                <button onclick="deselectAllItems()" class="px-2 py-1 bg-white border border-slate-200 rounded hover:bg-slate-50 text-slate-600 font-medium shadow-sm">Deselect All</button>
                <button onclick="invertSelection()" class="px-2 py-1 bg-white border border-slate-200 rounded hover:bg-slate-50 text-slate-600 font-medium shadow-sm">Invert Selection</button>
                <span id="selectionInfo" class="ml-auto text-slate-400 font-medium"></span>
            </div>

            <div class="flex-1 overflow-y-auto min-h-0" id="fileListBox">
                <table class="w-full text-left border-collapse">
                    <thead class="sticky top-0 bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider select-none z-10">
                        <tr>
                            <th class="py-3 px-4 w-10"></th>
                            <th class="py-3 px-2 cursor-pointer hover:text-slate-700" onclick="sortFiles('name')">Name</th>
                            <th class="py-3 px-6 text-right w-32 cursor-pointer hover:text-slate-700" onclick="sortFiles('size')">Size</th>
                            <th class="py-3 px-6 text-right w-40 cursor-pointer hover:text-slate-700" onclick="sortFiles('date')">Modified</th>
                        </tr>
                    </thead>
                    <tbody id="fileList" class="divide-y divide-slate-100 text-sm"></tbody>
                </table>
                <div id="emptyState" class="hidden flex flex-col items-center justify-center p-12 text-slate-400 h-64">
                    <svg class="w-12 h-12 stroke-1.5 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M2.25 13.5h3.86a2.25 2.25 0 012.008 1.24l.885 1.77a2.25 2.25 0 002.007 1.24h1.98a2.25 2.25 0 002.007-1.24l.885-1.77a2.25 2.25 0 012.007-1.24h3.86m-18 0h18m-18 0V9A2.25 2.25 0 015.25 6.75h13.5A2.25 2.25 0 0121 9v4.5m-18 0V19.5A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 19.5V13.5m-18 0V9"></path></svg>
                    <span>Drag files here to upload or folder is empty</span>
                </div>
            </div>
        </main>

        <div id="progressHUD" class="absolute bottom-4 left-4 w-72 bg-slate-900 text-white rounded-xl shadow-2xl p-4 border border-slate-800 transition-all transform translate-y-20 opacity-0 pointer-events-none z-50">
            <div class="flex justify-between items-start mb-1.5">
                <div class="min-w-0 flex-1">
                    <p id="hudActionType" class="text-xs uppercase tracking-wider font-semibold text-sky-400">Transferring</p>
                    <p id="hudFilename" class="text-xs font-medium truncate text-slate-200 mt-0.5">file.dat</p>
                </div>
                <span id="hudPercent" class="text-sm font-bold text-sky-400 ml-2">0%</span>
            </div>
            
            <div class="w-full bg-slate-800 rounded-full h-2 mb-2">
                <div id="hudBar" class="bg-sky-400 h-2 rounded-full transition-all duration-150" style="width: 0%"></div>
            </div>

            <div class="flex justify-between items-center text-[11px] text-slate-400">
                <span id="hudSpeed">0.00 MB/s</span>
                <span id="hudETA">ETA: --:--</span>
            </div>
        </div>

    </div>

    <script>
        let currentPath = '/';
        let directoryItems = []; 
        let selectedNames = new Set(); 
        let clipboard = { action: null, items: [], sourceDir: null };
        let sortColumn = 'name';
        let sortDirection = 'asc';
        let renameTarget = null;
        
        let transferStartTime = null;
        let lastLoadedBytes = 0;
        let lastUpdateTime = null;

        const modal = document.getElementById('connModal');
        const dropZone = document.getElementById('dropZone');

        ['dragenter', 'dragover'].forEach(eventName => {
            dropZone.addEventListener(eventName, (e) => { e.preventDefault(); dropZone.classList.add('drag-over'); }, false);
        });
        ['dragleave', 'drop'].forEach(eventName => {
            dropZone.addEventListener(eventName, (e) => { e.preventDefault(); dropZone.classList.remove('drag-over'); }, false);
        });
        dropZone.addEventListener('drop', (e) => {
            handleFileSelect(e.dataTransfer.files);
        });

        window.addEventListener('keydown', (e) => {
            const activeTag = document.activeElement.tagName.toLowerCase();
            if (activeTag === 'input' || activeTag === 'textarea' || document.activeElement.isContentEditable) return;

            if (e.key === 'Backspace' && !e.altKey) {
                e.preventDefault();
                navigateUp();
            }
            if ((e.key === 'Backspace' && e.altKey) || e.key === 'Delete') {
                e.preventDefault();
                actionDeleteSelected();
            }
            if (e.ctrlKey || e.metaKey) {
                switch(e.key.toLowerCase()) {
                    case 'a':
                        e.preventDefault();
                        selectAllItems();
                        break;
                    case 'x':
                        e.preventDefault();
                        actionClipboard('cut');
                        break;
                    case 'c':
                        e.preventDefault();
                        actionClipboard('copy');
                        break;
                    case 'v':
                        e.preventDefault();
                        actionPaste();
                        break;
                }
            }
        });

        window.onload = async function() {
            let savedIp = localStorage.getItem('ftp_ip');
            let savedPort = localStorage.getItem('ftp_port') || '21';
            let savedUser = localStorage.getItem('ftp_user') || 'anonymous';
            
            if (savedIp) {
                document.getElementById('ftpIp').value = savedIp;
                document.getElementById('ftpPort').value = savedPort;
                document.getElementById('ftpUser').value = savedUser;
                
                let success = await testConnection(savedIp, savedPort, savedUser, localStorage.getItem('ftp_pass') || '', localStorage.getItem('ftp_secure') === 'true');
                if (success) {
                    loadDirectory();
                    return;
                }
            }
            showConnectionPrompt();
        };

        async function testConnection(ip, port, user, pass, secure) {
            document.getElementById('connectionStatus').innerText = "Connecting...";
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000);

            try {
                const response = await fetch('/api/connect', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ ip, port: parseInt(port), user, pass, secure }),
                    signal: controller.signal
                });
                clearTimeout(timeoutId);
                let res = await response.json();
                if(res.success) {
                    document.getElementById('connectionStatus').innerText = "Connected to " + ip + ":" + port;
                    return true;
                }
                document.getElementById('connectionStatus').innerText = "Connection failed";
                return false;
            } catch (err) {
                document.getElementById('connectionStatus').innerText = "Connection timeout";
                return false;
            }
        }

        window.showConnectionPrompt = function() { 
            modal.classList.remove('hidden'); 
        };

        async function saveAndConnect() {
            let ip = document.getElementById('ftpIp').value.trim();
            let port = document.getElementById('ftpPort').value;
            let user = document.getElementById('ftpUser').value.trim() || 'anonymous';
            let pass = document.getElementById('ftpPass').value;
            let secure = document.getElementById('ftpSecure').checked;
            
            if(!ip) return alert("IP is required");
            
            modal.classList.add('hidden');
            let success = await testConnection(ip, port, user, pass, secure);
            if(success) {
                localStorage.setItem('ftp_ip', ip);
                localStorage.setItem('ftp_port', port);
                localStorage.setItem('ftp_user', user);
                if(pass) localStorage.setItem('ftp_pass', pass);
                else localStorage.removeItem('ftp_pass');
                localStorage.setItem('ftp_secure', secure);
                currentPath = '/'; 
                loadDirectory();
            } else {
                alert("Connection failed or timed out.");
                showConnectionPrompt();
            }
        }

        function enablePathEdit() {
            const breadcrumbs = document.getElementById('breadcrumbs');
            const pathInput = document.getElementById('pathInput');
            if(pathInput.classList.contains('hidden')) {
                pathInput.value = currentPath;
                breadcrumbs.classList.add('opacity-0');
                pathInput.classList.remove('hidden');
                pathInput.focus();
                pathInput.select();
            }
        }

        function disablePathEdit() {
            const breadcrumbs = document.getElementById('breadcrumbs');
            const pathInput = document.getElementById('pathInput');
            setTimeout(() => {
                pathInput.classList.add('hidden');
                breadcrumbs.classList.remove('opacity-0');
            }, 180);
        }

        document.getElementById('breadcrumbs').onclick = (e) => {
            e.stopPropagation();
            enablePathEdit();
        };

        function handlePathKeydown(e) {
            if (e.key === 'Enter') {
                let target = e.target.value.trim();
                if(!target.startsWith('/')) target = '/' + target;
                currentPath = target;
                loadDirectory();
                e.target.blur();
            } else if (e.key === 'Escape') {
                e.target.blur();
            }
        }

        async function loadDirectory() {
            try {
                selectedNames.clear();
                updateSidebarState();
                let response = await fetch("/api/list?path=" + encodeURIComponent(currentPath));
                let data = await response.json();
                if (data.success) {
                    directoryItems = data.files || [];
                    sortFiles(null); // Apply current sort
                    renderFiles();
                    renderBreadcrumbs();
                } else {
                    alert("Error reading path: " + (data.error || 'Unknown error'));
                }
            } catch (err) {
                console.error(err);
                alert("Failed to load directory");
            }
        }

        function sortFiles(column) {
            if (column) {
                if (sortColumn === column) {
                    sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
                } else {
                    sortColumn = column;
                    sortDirection = 'asc';
                }
            }
            
            directoryItems.sort((a, b) => {
                // Directories always first
                if (a.type !== b.type) return a.type === 'd' ? -1 : 1;
                
                let cmp = 0;
                if (sortColumn === 'name') {
                    cmp = a.name.localeCompare(b.name);
                } else if (sortColumn === 'size') {
                    cmp = (a.size || 0) - (b.size || 0);
                } else if (sortColumn === 'date') {
                    cmp = (a.rawModifiedAt || 0) - (b.rawModifiedAt || 0);
                }
                
                return sortDirection === 'asc' ? cmp : -cmp;
            });
            
            renderFiles();
        }

        function renderFiles() {
            const tbody = document.getElementById('fileList');
            const emptyState = document.getElementById('emptyState');
            tbody.innerHTML = '';
            
            if(directoryItems.length === 0) {
                emptyState.classList.remove('hidden');
                document.getElementById('selectionInfo').innerText = '';
                return;
            }
            emptyState.classList.add('hidden');
            document.getElementById('selectionInfo').innerText = directoryItems.length + ' items';

            directoryItems.forEach(file => {
                const tr = document.createElement('tr');
                const isSelected = selectedNames.has(file.name);
                tr.className = "hover:bg-slate-50/50 transition-all cursor-pointer select-none border-l-4 " + (isSelected ? 'selected-row' : 'border-transparent');
                
                const sizeStr = file.type === 'd' ? '--' : formatBytes(file.size);
                const dateStr = file.modifiedAt ? new Date(file.modifiedAt).toLocaleString() : '--';
                const icon = file.type === 'd' 
                    ? '<svg class="w-5 h-5 text-sky-400 fill-sky-50" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"></path></svg>'
                    : '<svg class="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"></path></svg>';

                const safeName = escapeHtml(file.name);
                
                tr.innerHTML = 
                    '<td class="py-3 px-4 text-center" onclick="event.stopPropagation();">' +
                    '  <input type="checkbox" class="rounded border-slate-300 text-sky-500 focus:ring-sky-400 w-4 h-4 cursor-pointer" ' + (isSelected ? 'checked' : '') + '>' +
                    '</td>' +
                    '<td class="py-3 px-2 font-medium text-slate-700 flex items-center gap-3">' +
                    '  ' + icon +
                    '  <span class="item-name-text hover:text-sky-600 transition-colors truncate max-w-[200px] sm:max-w-xs" title="' + safeName + '">' + safeName + '</span>' +
                    '</td>' +
                    '<td class="py-3 px-6 text-slate-400 text-right whitespace-nowrap">' + sizeStr + '</td>' +
                    '<td class="py-3 px-6 text-slate-400 text-right whitespace-nowrap text-xs">' + dateStr + '</td>';

                const checkbox = tr.querySelector('input[type="checkbox"]');
                checkbox.onchange = (e) => {
                    if (checkbox.checked) selectedNames.add(file.name);
                    else selectedNames.delete(file.name);
                    updateRowSelection(tr, file.name);
                    updateSidebarState();
                };

                tr.onclick = (e) => {
                    if (e.ctrlKey || e.metaKey) {
                        if (selectedNames.has(file.name)) selectedNames.delete(file.name);
                        else selectedNames.add(file.name);
                    } else {
                        selectedNames.clear();
                        selectedNames.add(file.name);
                    }
                    renderFiles(); // Re-render to update all rows
                    updateSidebarState();
                };

                tr.ondblclick = (e) => {
                    if(file.type === 'd') {
                        currentPath = currentPath.endsWith('/') ? currentPath + file.name : currentPath + '/' + file.name;
                        loadDirectory();
                    }
                };

                tbody.appendChild(tr);
            });
        }

        function updateRowSelection(row, name) {
            if (selectedNames.has(name)) {
                row.classList.add('selected-row');
                row.classList.remove('border-transparent');
            } else {
                row.classList.remove('selected-row');
                row.classList.add('border-transparent');
            }
        }

        function selectAllItems() {
            directoryItems.forEach(f => selectedNames.add(f.name));
            renderFiles();
            updateSidebarState();
        }

        function deselectAllItems() {
            selectedNames.clear();
            renderFiles();
            updateSidebarState();
        }

        function invertSelection() {
            directoryItems.forEach(f => {
                if (selectedNames.has(f.name)) selectedNames.delete(f.name);
                else selectedNames.add(f.name);
            });
            renderFiles();
            updateSidebarState();
        }

        function updateSidebarState() {
            const hasSelection = selectedNames.size > 0;
            const singleSelected = selectedNames.size === 1;
            const singleFileSelected = selectedNames.size === 1 && directoryItems.find(f => selectedNames.has(f.name) && f.type !== 'd');

            document.getElementById('toolDownload').disabled = !singleFileSelected;
            document.getElementById('toolCut').disabled = !hasSelection;
            document.getElementById('toolCopy').disabled = !hasSelection;
            document.getElementById('toolDelete').disabled = !hasSelection;
            document.getElementById('toolRename').disabled = !singleSelected;
            document.getElementById('toolPaste').disabled = clipboard.items.length === 0;
            
            document.getElementById('selectionInfo').innerText = selectedNames.size > 0 
                ? selectedNames.size + ' of ' + directoryItems.length + ' selected' 
                : directoryItems.length + ' items';
        }

        function startHUD(actionType, filename) {
            document.getElementById('hudActionType').innerText = actionType;
            document.getElementById('hudFilename').innerText = filename;
            document.getElementById('hudPercent').innerText = "0%";
            document.getElementById('hudBar').style.width = "0%";
            document.getElementById('hudSpeed').innerText = "0.00 MB/s";
            document.getElementById('hudETA').innerText = "ETA: --:--";
            
            const hud = document.getElementById('progressHUD');
            hud.classList.remove('opacity-0', 'translate-y-20', 'pointer-events-none');
            
            transferStartTime = Date.now();
            lastUpdateTime = Date.now();
            lastLoadedBytes = 0;
        }

        function updateHUD(loadedBytes, totalBytes) {
            if (!totalBytes || totalBytes === 0) return;
            const pct = Math.min(100, Math.floor((loadedBytes / totalBytes) * 100));
            document.getElementById('hudPercent').innerText = pct + "%";
            document.getElementById('hudBar').style.width = pct + "%";
            
            const now = Date.now();
            const timeDiff = (now - lastUpdateTime) / 1000;
            
            if (timeDiff >= 0.4 || loadedBytes === totalBytes) {
                const bytesTransferred = loadedBytes - lastLoadedBytes;
                const currentSpeedBytesPerSec = bytesTransferred / timeDiff;
                
                const speedMBs = currentSpeedBytesPerSec / (1024 * 1024);
                document.getElementById('hudSpeed').innerText = speedMBs.toFixed(2) + " MB/s";
                
                if (currentSpeedBytesPerSec > 0) {
                    const remainingBytes = totalBytes - loadedBytes;
                    const etaSeconds = Math.ceil(remainingBytes / currentSpeedBytesPerSec);
                    const mins = Math.floor(etaSeconds / 60);
                    const secs = etaSeconds % 60;
                    document.getElementById('hudETA').innerText = "ETA: " + mins.toString().padStart(2, '0') + ":" + secs.toString().padStart(2, '0');
                }
                
                lastLoadedBytes = loadedBytes;
                lastUpdateTime = now;
            }
        }

        function closeHUD() {
            setTimeout(() => {
                const hud = document.getElementById('progressHUD');
                hud.classList.add('opacity-0', 'translate-y-20', 'pointer-events-none');
            }, 1200);
        }

        function checkCollisionPrompt(filename) {
            return new Promise((resolve) => {
                const match = directoryItems.find(f => f.name === filename);
                if (!match) {
                    resolve({ resolution: 'proceed', customName: filename });
                    return;
                }

                document.getElementById('collisionMessage').innerText = 'The current directory already contains a file named "' + filename + '". What would you like to do?';
                const cModal = document.getElementById('collisionModal');
                cModal.classList.remove('hidden');

                document.getElementById('btnReplace').onclick = () => {
                    cModal.classList.add('hidden');
                    resolve({ resolution: 'replace', customName: filename });
                };

                document.getElementById('btnSkip').onclick = () => {
                    cModal.classList.add('hidden');
                    resolve({ resolution: 'skip' });
                };

                document.getElementById('btnKeepBoth').onclick = () => {
                    cModal.classList.add('hidden');
                    let ext = '';
                    let base = filename;
                    const lastDot = filename.lastIndexOf('.');
                    if (lastDot > 0) {
                        ext = filename.substring(lastDot);
                        base = filename.substring(0, lastDot);
                    }
                    
                    let counter = 1;
                    let candidateName = base + "_" + counter + ext;
                    while (directoryItems.some(f => f.name === candidateName)) {
                        counter++;
                        candidateName = base + "_" + counter + ext;
                    }
                    resolve({ resolution: 'keepboth', customName: candidateName });
                };
            });
        }

        function actionClipboard(type) {
            if(selectedNames.size === 0) return;
            const targetItems = directoryItems.filter(f => selectedNames.has(f.name));
            clipboard = { action: type, items: targetItems, sourceDir: currentPath };
            document.getElementById('connectionStatus').innerText = "Staged " + clipboard.items.length + " item(s) for " + type;
            updateSidebarState();
        }

        async function actionPaste() {
            if(clipboard.items.length === 0) return;
            
            for (const item of clipboard.items) {
                const promptResult = await checkCollisionPrompt(item.name);
                if (promptResult.resolution === 'skip') continue;

                const sPath = clipboard.sourceDir.endsWith('/') ? clipboard.sourceDir + item.name : clipboard.sourceDir + '/' + item.name;
                const tPath = currentPath.endsWith('/') ? currentPath + promptResult.customName : currentPath + '/' + promptResult.customName;
                
                startHUD(clipboard.action === 'cut' ? "Moving" : "Copying", promptResult.customName);

                try {
                    let res = await fetch('/api/clipboard/paste', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ action: clipboard.action, sourcePath: sPath, targetPath: tPath })
                    });
                    
                    let data = await res.json();
                    if (!data.success) {
                        alert("Transfer failed: " + (data.error || 'Unknown error'));
                    }
                    updateHUD(item.size || 1, item.size || 1);
                } catch(err) {
                    console.error(err);
                    alert("Network error during transfer");
                } finally {
                    closeHUD();
                }
            }

            if(clipboard.action === 'cut') clipboard = { action: null, items: [], sourceDir: null };
            loadDirectory();
        }

        async function actionDeleteSelected() {
            if(selectedNames.size === 0) return;
            if(!confirm("Permanently delete " + selectedNames.size + " item(s)? This cannot be undone.")) return;

            const targets = Array.from(selectedNames);
            for(const name of targets) {
                const fullPath = currentPath.endsWith('/') ? currentPath + name : currentPath + '/' + name;
                try {
                    await fetch('/api/delete', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ path: fullPath })
                    });
                } catch (err) {
                    console.error("Delete failed for", name, err);
                }
            }
            loadDirectory();
        }

        async function actionDownloadSelected() {
            if(selectedNames.size !== 1) return;
            const name = Array.from(selectedNames)[0];
            const targetItem = directoryItems.find(f => f.name === name);
            if(!targetItem) return;

            let fullPath = currentPath.endsWith('/') ? currentPath + name : currentPath + '/' + name;
            
            startHUD("Downloading", name);

            try {
                const response = await fetch("/api/download?path=" + encodeURIComponent(fullPath));
                if (!response.ok) throw new Error("Download failed");
                
                const contentLength = response.headers.get('content-length');
                const total = contentLength ? parseInt(contentLength) : targetItem.size;
                
                const reader = response.body.getReader();
                const chunks = [];
                let received = 0;
                
                while(true) {
                    const {done, value} = await reader.read();
                    if (done) break;
                    chunks.push(value);
                    received += value.length;
                    updateHUD(received, total);
                }
                
                const blob = new Blob(chunks);
                const link = document.createElement('a');
                link.href = window.URL.createObjectURL(blob);
                link.download = name;
                link.click();
                window.URL.revokeObjectURL(link.href);
                
            } catch (err) {
                alert("Download failed: " + err.message);
            } finally {
                closeHUD();
            }
        }

        function actionRenameSelected() {
            if (selectedNames.size !== 1) return;
            renameTarget = Array.from(selectedNames)[0];
            document.getElementById('renameInput').value = renameTarget;
            document.getElementById('renameModal').classList.remove('hidden');
            setTimeout(() => document.getElementById('renameInput').focus(), 100);
        }

        function closeRenameModal() {
            document.getElementById('renameModal').classList.add('hidden');
            renameTarget = null;
        }

        async function confirmRename() {
            if (!renameTarget) return;
            const newName = document.getElementById('renameInput').value.trim();
            if (!newName || newName === renameTarget) {
                closeRenameModal();
                return;
            }
            
            const oldPath = currentPath.endsWith('/') ? currentPath + renameTarget : currentPath + '/' + renameTarget;
            const newPath = currentPath.endsWith('/') ? currentPath + newName : currentPath + '/' + newName;
            
            try {
                let res = await fetch('/api/rename', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ oldPath, newPath })
                });
                let data = await res.json();
                if (data.success) {
                    loadDirectory();
                } else {
                    alert("Rename failed: " + (data.error || 'Unknown error'));
                }
            } catch (err) {
                alert("Rename failed: " + err.message);
            }
            closeRenameModal();
        }

        function navigateTo(targetPath) {
            currentPath = targetPath;
            loadDirectory();
        }

        function navigateUp() {
            if (currentPath === '/') return;
            let parts = currentPath.split('/').filter(p => p);
            parts.pop();
            currentPath = '/' + parts.join('/');
            loadDirectory();
        }

        function renderBreadcrumbs() {
            const container = document.getElementById('breadcrumbs');
            const backBtn = document.getElementById('backBtn');
            backBtn.disabled = (currentPath === '/');
            container.innerHTML = '<span class="cursor-pointer text-sky-500 font-medium shrink-0" onclick="navigateTo(\\'/\\'); event.stopPropagation();">Root</span>';
            
            const parts = currentPath.split('/').filter(p => p);
            let builtPath = '';
            parts.forEach((part, index) => {
                builtPath += '/' + part;
                const isLast = index === parts.length - 1;
                const safePart = escapeHtml(part);
                container.innerHTML += ' <span class="text-slate-300 shrink-0">/</span> ';
                if(isLast) {
                    container.innerHTML += '<span class="text-slate-700 font-medium truncate">' + safePart + '</span>';
                } else {
                    const currentTargetMap = builtPath;
                    container.innerHTML += '<span class="cursor-pointer text-sky-500 font-medium shrink-0" onclick="navigateTo(\\'' + currentTargetMap.replace(/\\\\/g, '\\\\\\\\').replace(/\\'/g, '\\\\\\'') + '\\'); event.stopPropagation();">' + safePart + '</span>';
                }
            });
        }

        async function triggerNewFolder() {
            let folderName = prompt("Enter new folder name:");
            if(!folderName) return;
            // Basic sanitization
            folderName = folderName.replace(/[\\\\/:*?"<>|]/g, '');
            if(!folderName) return alert("Invalid folder name");
            
            let target = currentPath.endsWith('/') ? currentPath + folderName : currentPath + '/' + folderName;
            
            try {
                let response = await fetch('/api/mkdir', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ path: target })
                });
                let data = await response.json();
                if(data.success) {
                    loadDirectory();
                } else {
                    alert("Failed to create folder: " + (data.error || 'Unknown error'));
                }
            } catch (err) {
                alert("Failed to create folder");
            }
        }

        async function handleFileSelect(files) {
            if(files.length === 0) return;
            
            for(let i=0; i<files.length; i++) {
                const file = files[i];
                const promptResult = await checkCollisionPrompt(file.name);
                if(promptResult.resolution === 'skip') continue;

                let target = currentPath.endsWith('/') ? currentPath + promptResult.customName : currentPath + '/' + promptResult.customName;
                
                startHUD("Uploading", promptResult.customName);

                const formData = new FormData();
                formData.append('file', file);
                formData.append('remotePath', target);

                try {
                    const response = await fetch('/api/upload', {
                        method: 'POST',
                        body: formData
                    });
                    
                    if (!response.ok) {
                        const err = await response.json();
                        alert("Upload failed: " + (err.error || 'Unknown error'));
                    }
                    updateHUD(file.size, file.size);
                } catch(err) {
                    console.error(err);
                    alert("Upload failed: Network error");
                } finally {
                    closeHUD();
                }
            }
            loadDirectory();
        }

        function formatBytes(bytes, decimals = 2) {
            if (!+bytes) return '0 Bytes';
            const k = 1024;
            const dm = decimals < 0 ? 0 : decimals;
            const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
            const i = Math.floor(Math.log(bytes) / Math.log(k));
            return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i];
        }

        function escapeHtml(str) {
            if (!str) return '';
            return String(str)
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#039;');
        }
    </script>
</body>
</html>`);
});

let ftpConfig = { host: '', port: 21, user: 'anonymous', password: '', secure: false };

app.post('/api/connect', async (req, res) => {
    const { ip, port, user, pass, secure } = req.body;
    if (!ip) return res.status(400).json({ success: false, error: 'IP address required' });
    
    const client = new Client();
    try {
        await client.access({ 
            host: ip, 
            port: parseInt(port) || 21, 
            user: user || 'anonymous', 
            password: pass || '',
            secure: secure || false,
            timeout: 5000 
        });
        ftpConfig = { 
            host: ip, 
            port: parseInt(port) || 21, 
            user: user || 'anonymous', 
            password: pass || '',
            secure: secure || false
        };
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    } finally {
        client.close();
    }
});

app.get('/api/list', async (req, res) => {
    const remotePath = sanitizePath(req.query.path);
    const client = new Client();
    try {
        await client.access({ ...ftpConfig, timeout: 10000 });
        const rawList = await client.list(remotePath);
        const cleanFiles = rawList.map(f => ({
            name: f.name,
            size: f.size,
            type: f.isDirectory ? 'd' : 'f',
            modifiedAt: f.modifiedAt ? f.modifiedAt.toISOString() : null,
            rawModifiedAt: f.modifiedAt ? f.modifiedAt.getTime() : 0
        })).filter(f => f.name !== '.' && f.name !== '..');
        res.json({ success: true, files: cleanFiles });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    } finally {
        client.close();
    }
});

app.get('/api/download', async (req, res) => {
    const remotePath = sanitizePath(req.query.path);
    const client = new Client();
    try {
        await client.access(ftpConfig);
        res.setHeader('Content-Disposition', `attachment; filename="${path.basename(remotePath)}"`);
        res.setHeader('Content-Type', 'application/octet-stream');
        
        await client.downloadTo(res, remotePath);
        // Express response will be ended by the stream
    } catch (err) {
        if (!res.headersSent) {
            res.status(500).json({ success: false, error: err.message });
        } else {
            res.destroy();
        }
    } finally {
        client.close();
    }
});

app.post('/api/upload', upload.single('file'), async (req, res) => {
    const { remotePath } = req.body;
    const client = new Client();
    try {
        await client.access(ftpConfig);
        const localPath = req.file.path;
        
        await client.uploadFrom(localPath, sanitizePath(remotePath));
        
        // Clean up temp file
        fs.unlink(localPath, (err) => {
            if (err) console.error('Failed to clean up temp file:', err);
        });
        
        res.json({ success: true });
    } catch (err) {
        // Clean up on error too
        if (req.file && req.file.path) {
            fs.unlink(req.file.path, () => {});
        }
        res.status(500).json({ success: false, error: err.message });
    } finally {
        client.close();
    }
});

app.post('/api/mkdir', async (req, res) => {
    const { path: dirPath } = req.body;
    const client = new Client();
    try {
        await client.access(ftpConfig);
        await client.ensureDir(sanitizePath(dirPath));
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    } finally {
        client.close();
    }
});

app.post('/api/delete', async (req, res) => {
    const { path: itemPath } = req.body;
    const client = new Client();
    try {
        await client.access(ftpConfig);
        const sanitized = sanitizePath(itemPath);
        const targetDirname = sanitized.substring(0, sanitized.lastIndexOf('/')) || '/';
        const targetFilename = sanitized.substring(sanitized.lastIndexOf('/') + 1);
        
        // Try to list parent to determine if directory
        let isDir = false;
        try {
            const list = await client.list(targetDirname);
            const item = list.find(f => f.name === targetFilename);
            isDir = item && item.isDirectory;
        } catch (e) {
            // If we can't list, try remove as file first
        }

        if (isDir) {
            await client.removeDir(sanitized);
        } else {
            await client.remove(sanitized);
        }
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    } finally {
        client.close();
    }
});

app.post('/api/rename', async (req, res) => {
    const { oldPath, newPath } = req.body;
    const client = new Client();
    try {
        await client.access(ftpConfig);
        await client.rename(sanitizePath(oldPath), sanitizePath(newPath));
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    } finally {
        client.close();
    }
});

app.post('/api/clipboard/paste', async (req, res) => {
    const { action, sourcePath, targetPath } = req.body;
    const client = new Client();
    
    try {
        await client.access(ftpConfig);
        
        // Use FTP's native rename for same-server moves (instant, no data transfer)
        if (action === 'cut') {
            await client.rename(sanitizePath(sourcePath), sanitizePath(targetPath));
            res.json({ success: true });
            return;
        }
        
        // For copy, we need to download then upload
        const tempFile = path.join(uploadDir, crypto.randomUUID() + '.tmp');
        
        // Download to temp file
        await client.downloadTo(tempFile, sanitizePath(sourcePath));
        
        // Upload from temp file
        await client.uploadFrom(tempFile, sanitizePath(targetPath));
        
        // Clean up temp
        fs.unlink(tempFile, (err) => {
            if (err) console.error('Failed to clean up temp file:', err);
        });
        
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    } finally {
        client.close();
    }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', ftpConfigured: !!ftpConfig.host });
});

app.listen(port, '0.0.0.0', () => {
    console.log(`LAN FTP Client listening on port ${port}`);
    console.log(`Open http://localhost:${port} in your browser`);
});
