const express = require('express');
const { Client } = require('basic-ftp');
const multer = require('multer');
const path = require('path');

const app = express();
const port = 3000;

const upload = multer({ storage: multer.memoryStorage() });

app.use(express.json());

// UI Frontend Engine
app.get('/', (req, res) => {
    res.send(`
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>LAN FTP Client</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <style>
        .drag-over { background-color: #e0f2fe; border-color: #38bdf8; }
        .selected-row { background-color: #f0f9ff !important; border-left: 4px solid #38bdf8; }
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
            <p id="collisionMessage" class="text-sm text-slate-600 mb-5 break-all">A destination asset match was discovered.</p>
            <div class="flex flex-col sm:flex-row justify-end gap-2 text-sm font-medium">
                <button id="btnSkip" class="px-4 py-2 border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors">Don't Copy</button>
                <button id="btnKeepBoth" class="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors">Keep Both</button>
                <button id="btnReplace" class="px-4 py-2 bg-sky-500 text-white rounded-lg hover:bg-sky-600 transition-colors">Replace</button>
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
                <button onclick="showConnectionPrompt()" class="p-2 text-slate-400 hover:text-slate-600 rounded-lg"><svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path></svg></button>
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
            </div>

            <div class="flex-1 overflow-y-auto min-h-0" id="fileListBox">
                <table class="w-full text-left border-collapse">
                    <thead class="sticky top-0 bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider select-none z-10">
                        <tr>
                            <th class="py-3 px-4 w-10"></th>
                            <th class="py-3 px-2">Name</th>
                            <th class="py-3 px-6 text-right w-32">Size</th>
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
            
            if (savedIp) {
                document.getElementById('ftpIp').value = savedIp;
                document.getElementById('ftpPort').value = savedPort;
                
                let success = await testConnection(savedIp, savedPort);
                if (success) {
                    loadDirectory();
                    return;
                }
            }
            showConnectionPrompt();
        };

        async function testConnection(ip, port) {
            document.getElementById('connectionStatus').innerText = "Connecting...";
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 3000);

            try {
                const response = await fetch('/api/connect', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ ip, port }),
                    signal: controller.signal
                });
                clearTimeout(timeoutId);
                let res = await response.json();
                if(res.success) {
                    document.getElementById('connectionStatus').innerText = "Connected to " + ip + ":" + port;
                    return true;
                }
                return false;
            } catch (err) {
                return false;
            }
        }

        // Exposing globally to clear manual modal lockouts
        window.showConnectionPrompt = function() { 
            modal.classList.remove('hidden'); 
        };

        async function saveAndConnect() {
            let ip = document.getElementById('ftpIp').value;
            let port = document.getElementById('ftpPort').value;
            if(!ip) return alert("IP is required");
            
            modal.classList.add('hidden');
            let success = await testConnection(ip, port);
            if(success) {
                localStorage.setItem('ftp_ip', ip);
                localStorage.setItem('ftp_port', port);
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
                    renderFiles();
                    renderBreadcrumbs();
                } else {
                    alert("Error reading path: " + data.error);
                }
            } catch (err) {
                console.error(err);
            }
        }

                function renderFiles() {
            const tbody = document.getElementById('fileList');
            const emptyState = document.getElementById('emptyState');
            tbody.innerHTML = '';
            
            if(directoryItems.length === 0) {
                emptyState.classList.remove('hidden');
                return;
            }
            emptyState.classList.add('hidden');

            directoryItems.forEach(file => {
                const tr = document.createElement('tr');
                const isSelected = selectedNames.has(file.name);
                tr.className = "hover:bg-slate-50/50 transition-all cursor-pointer select-none border-l-4 " + (isSelected ? 'selected-row' : 'border-transparent');
                
                const sizeStr = file.type === 'd' ? '--' : formatBytes(file.size);
                const icon = file.type === 'd' 
                    ? '<svg class="w-5 h-5 text-sky-400 fill-sky-50" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"></path></svg>'
                    : '<svg class="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"></path></svg>';

                // Cleaned up string construction to prevent SyntaxErrors
                let rowHtml = "";
                rowHtml += '<td class="py-3 px-4 text-center" onclick="event.stopPropagation();">';
                rowHtml += '  <input type="checkbox" class="rounded border-slate-300 text-sky-500 focus:ring-sky-400 w-4 h-4 cursor-pointer" ' + (isSelected ? 'checked' : '') + '>';
                rowHtml += '</td>';
                rowHtml += '<td class="py-3 px-2 font-medium text-slate-700 flex items-center gap-3">';
                rowHtml += '  ' + icon;
                rowHtml += '  <span class="item-name-text hover:text-sky-600 transition-colors">' + file.name + '</span>';
                rowHtml += '</td>';
                rowHtml += '<td class="py-3 px-6 text-slate-400 text-right">' + sizeStr + '</td>';
                
                tr.innerHTML = rowHtml;

                const checkbox = tr.querySelector('input[type="checkbox"]');
                checkbox.onchange = (e) => {
                    if (checkbox.checked) selectedNames.add(file.name);
                    else selectedNames.delete(file.name);
                    renderFiles();
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
                    renderFiles();
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
            const singleFileSelected = selectedNames.size === 1 && directoryItems.find(f => selectedNames.has(f.name) && f.type !== 'd');

            document.getElementById('toolDownload').disabled = !singleFileSelected;
            document.getElementById('toolCut').disabled = !hasSelection;
            document.getElementById('toolCopy').disabled = !hasSelection;
            document.getElementById('toolDelete').disabled = !hasSelection;
            document.getElementById('toolPaste').disabled = clipboard.items.length === 0;
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
            }, 1000);
        }

        function checkCollisionPrompt(filename) {
            return new Promise((resolve) => {
                const match = directoryItems.find(f => f.name === filename);
                if (!match) {
                    resolve({ resolution: 'proceed', customName: filename });
                    return;
                }

                document.getElementById('collisionMessage').innerText = "The current directory already contains a file named \\"" + filename + "\\". What would you like to do?";
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
                    let ext = filename.substring(filename.lastIndexOf('.'));
                    let base = filename.substring(0, filename.lastIndexOf('.'));
                    if(filename.indexOf('.') === -1) { base = filename; ext = ''; }
                    
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
            document.getElementById('connectionStatus').innerText = "Staged " + clipboard.items.length + " assets for transfer pipeline.";
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
                    let simulatedProgress = 0;
                    const interval = setInterval(() => {
                        simulatedProgress += (item.size * 0.15);
                        if(simulatedProgress >= item.size) simulatedProgress = item.size * 0.98;
                        updateHUD(simulatedProgress, item.size);
                    }, 250);

                    let res = await fetch('/api/clipboard/paste', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ action: clipboard.action, sourcePath: sPath, targetPath: tPath })
                    });
                    
                    clearInterval(interval);
                    updateHUD(item.size, item.size);
                    await res.json();
                } catch(err) {
                    console.error(err);
                } finally {
                    closeHUD();
                }
            }

            if(clipboard.action === 'cut') clipboard = { action: null, items: [], sourceDir: null };
            loadDirectory();
        }

        async function actionDeleteSelected() {
            if(selectedNames.size === 0) return;
            if(!confirm("Permanently delete " + selectedNames.size + " items?")) return;

            const targets = Array.from(selectedNames);
            for(const name of targets) {
                const fullPath = currentPath.endsWith('/') ? currentPath + name : currentPath + '/' + name;
                await fetch('/api/delete', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ path: fullPath })
                });
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

            const xhr = new XMLHttpRequest();
            xhr.open('GET', "/api/download?path=" + encodeURIComponent(fullPath), true);
            xhr.responseType = 'blob';

            xhr.onprogress = (e) => {
                if (e.lengthComputable) updateHUD(e.loaded, e.total);
                else updateHUD(e.loaded, targetItem.size);
            };

            xhr.onload = () => {
                if (xhr.status === 200) {
                    updateHUD(targetItem.size, targetItem.size);
                    const blob = xhr.response;
                    const link = document.createElement('a');
                    link.href = window.URL.createObjectURL(blob);
                    link.download = name;
                    link.click();
                } else {
                    alert("Download channel exception");
                }
                closeHUD();
            };
            xhr.send();
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
            container.innerHTML = '<span class="cursor-pointer text-sky-500 font-medium shrink-0" onclick="navigateTo(\'/\'); event.stopPropagation();">Root</span>';
            
            const parts = currentPath.split('/').filter(p => p);
            let builtPath = '';
            parts.forEach((part, index) => {
                builtPath += '/' + part;
                const isLast = index === parts.length - 1;
                container.innerHTML += " <span class=\\"text-slate-300 shrink-0\\">/</span> ";
                if(isLast) {
                    container.innerHTML += "<span class=\\"text-slate-700 font-medium truncate\\">" + part + "</span>";
                } else {
                    const currentTargetMap = builtPath;
                    container.innerHTML += "<span class=\\"cursor-pointer text-sky-500 font-medium shrink-0\\" onclick=\\"navigateTo('" + currentTargetMap.replace(/'/g, "\\\\'") + "'); event.stopPropagation();\\">" + part + "</span>";
                }
            });
        }

        async function triggerNewFolder() {
            let folderName = prompt("Enter new folder name:");
            if(!folderName) return;
            let target = currentPath.endsWith('/') ? currentPath + folderName : currentPath + '/' + folderName;
            
            let response = await fetch('/api/mkdir', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ path: target })
            });
            let data = await response.json();
            if(data.success) loadDirectory();
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

                const xhr = new XMLHttpRequest();
                xhr.open('POST', '/api/upload', true);

                xhr.upload.onprogress = (e) => {
                    if (e.lengthComputable) updateHUD(e.loaded, e.total);
                };

                await new Promise((resolve) => {
                    xhr.onload = () => {
                        updateHUD(file.size, file.size);
                        resolve();
                    };
                    xhr.send(formData);
                });
                closeHUD();
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
    </script>
</body>
</html>
    `);
});

let ftpConfig = { host: '', port: 21 };

app.post('/api/connect', async (req, res) => {
    const { ip, port } = req.body;
    const client = new Client();
    try {
        // Enforce 3-second connection fallback threshold explicitly
        await client.access({ 
            host: ip, 
            port: parseInt(port), 
            user: "anonymous", 
            password: "",
            timeout: 3000 
        });
        ftpConfig = { host: ip, port: parseInt(port) };
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    } finally {
        client.close();
    }
});

app.get('/api/list', async (req, res) => {
    const remotePath = req.query.path || '/';
    const client = new Client();
    try {
        await client.access({ ...ftpConfig, user: "anonymous", timeout: 3000 });
        const rawList = await client.list(remotePath);
        const cleanFiles = rawList.map(f => ({
            name: f.name,
            size: f.size,
            type: f.isDirectory ? 'd' : 'f'
        })).filter(f => f.name !== '.' && f.name !== '..');
        res.json({ success: true, files: cleanFiles });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    } finally {
        client.close();
    }
});

app.get('/api/download', async (req, res) => {
    const remotePath = req.query.path;
    const client = new Client();
    try {
        await client.access({ ...ftpConfig, user: "anonymous" });
        res.setHeader('Content-Disposition', `attachment; filename="${path.basename(remotePath)}"`);
        await client.downloadTo({ write: (chunk, enc, cb) => { res.write(chunk, enc, cb); } }, remotePath);
        res.end();
    } catch (err) {
        if (!res.headersSent) res.status(500).send(err.message);
    } finally {
        client.close();
    }
});

app.post('/api/upload', upload.single('file'), async (req, res) => {
    const { remotePath } = req.body;
    const client = new Client();
    try {
        await client.access({ ...ftpConfig, user: "anonymous" });
        const Readable = require('stream').Readable;
        const stream = new Readable();
        stream.push(req.file.buffer);
        stream.push(null);

        await client.uploadFrom(stream, remotePath);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    } finally {
        client.close();
    }
});

app.post('/api/mkdir', async (req, res) => {
    const { path } = req.body;
    const client = new Client();
    try {
        await client.access({ ...ftpConfig, user: "anonymous" });
        await client.send(`MKD ${path}`);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    } finally {
        client.close();
    }
});

app.post('/api/delete', async (req, res) => {
    const { path } = req.body;
    const client = new Client();
    try {
        await client.access({ ...ftpConfig, user: "anonymous" });
        const targetDirname = path.substring(0, path.lastIndexOf('/')) || '/';
        const targetFilename = path.substring(path.lastIndexOf('/') + 1);
        const list = await client.list(targetDirname);
        const item = list.find(f => f.name === targetFilename);

        if (item && item.isDirectory) {
            await client.removeDir(path);
        } else {
            await client.remove(path);
        }
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    } finally {
        client.close();
    }
});

app.post('/api/clipboard/paste', async (req, res) => {
    const { action, sourcePath, targetPath } = req.body;
    const clientReader = new Client();
    const clientWriter = new Client();
    
    try {
        await clientReader.access({ ...ftpConfig, user: "anonymous" });
        await clientWriter.access({ ...ftpConfig, user: "anonymous" });
        
        const PassThrough = require('stream').PassThrough;
        const bridgeStream = new PassThrough();

        const downloadPromise = clientReader.downloadTo(bridgeStream, sourcePath);
        const uploadPromise = clientWriter.uploadFrom(bridgeStream, targetPath);

        await Promise.all([downloadPromise, uploadPromise]);

        if (action === 'cut') {
            const list = await clientReader.list(sourcePath.substring(0, sourcePath.lastIndexOf('/')) || '/');
            const item = list.find(f => f.name === sourcePath.substring(sourcePath.lastIndexOf('/') + 1));
            if (item && item.isDirectory) {
                await clientReader.removeDir(sourcePath);
            } else {
                await clientReader.remove(sourcePath);
            }
        }
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    } finally {
        clientReader.close();
        clientWriter.close();
    }
});

app.listen(port, '0.0.0.0', () => {
    console.log(`Server listening on port ${port}`);
});
