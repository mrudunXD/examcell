const http = require('http');
const { spawn } = require('child_process');
const path = require('path');
const port = 3000;

const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>MIT WPU Exam System Control Panel</title>
    <style>
        :root {
            --bg-gradient: linear-gradient(135deg, #0f172a, #1e1b4b);
            --card-bg: rgba(30, 41, 59, 0.7);
            --accent-glow: 0 0 40px rgba(124, 58, 237, 0.3);
            --text-primary: #f8fafc;
            --text-secondary: #94a3b8;
            --purple: #8b5cf6;
        }

        body {
            margin: 0;
            padding: 0;
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            background: var(--bg-gradient);
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            color: var(--text-primary);
            overflow: hidden;
        }

        .container {
            text-align: center;
            padding: 3rem;
            border-radius: 24px;
            background: var(--card-bg);
            backdrop-filter: blur(16px);
            border: 1px solid rgba(255, 255, 255, 0.08);
            box-shadow: var(--accent-glow), 0 20px 50px rgba(0, 0, 0, 0.5);
            max-width: 480px;
            width: 90%;
            z-index: 10;
            position: relative;
        }

        .logo-glow {
            width: 80px;
            height: 80px;
            margin: 0 auto 1.5rem;
            border-radius: 20px;
            background: linear-gradient(135deg, #7c3aed, #4f46e5);
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 8px 32px rgba(124, 58, 237, 0.5);
        }

        h1 {
            font-size: 1.8rem;
            margin: 0 0 0.5rem 0;
            font-weight: 800;
            letter-spacing: -0.025em;
        }

        p {
            font-size: 0.95rem;
            color: var(--text-secondary);
            margin: 0 0 2rem 0;
            line-height: 1.5;
        }

        .btn-start {
            background: linear-gradient(135deg, #7c3aed, #4f46e5);
            color: white;
            border: none;
            padding: 1rem 2.5rem;
            font-size: 1.1rem;
            font-weight: 700;
            border-radius: 12px;
            cursor: pointer;
            box-shadow: 0 4px 15px rgba(124, 58, 237, 0.4);
            transition: all 0.2s ease;
            display: inline-flex;
            align-items: center;
            gap: 8px;
        }

        .btn-start:hover {
            transform: translateY(-2px);
            box-shadow: 0 8px 25px rgba(124, 58, 237, 0.6);
        }

        .btn-start:active {
            transform: translateY(0);
        }

        /* Loading Screen */
        .loading-screen {
            display: none;
        }

        .spinner {
            width: 48px;
            height: 48px;
            border: 4px solid rgba(255, 255, 255, 0.1);
            border-left-color: var(--purple);
            border-radius: 50%;
            animation: spin 1s linear infinite;
            margin: 0 auto 1.5rem;
        }

        .status-text {
            font-size: 1.1rem;
            font-weight: 600;
            margin-bottom: 0.5rem;
        }

        .sub-status-text {
            font-size: 0.85rem;
            color: var(--text-secondary);
            font-family: monospace;
        }

        @keyframes spin {
            to { transform: rotate(360deg); }
        }

        .decor {
            position: absolute;
            border-radius: 50%;
            filter: blur(80px);
            z-index: 1;
        }
        .decor-1 { width: 300px; height: 300px; background: rgba(124, 58, 237, 0.15); top: -10%; left: -10%; }
        .decor-2 { width: 300px; height: 300px; background: rgba(79, 70, 229, 0.15); bottom: -10%; right: -10%; }
    </style>
</head>
<body>
    <div class="decor decor-1"></div>
    <div class="decor decor-2"></div>

    <div class="container" id="panel">
        <div class="logo-glow">
            <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color: white;"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>
        </div>
        <h1>Exam Management System</h1>
        <p>Control panel to launch the localized testing environments, OR-Tools constraints scheduler, and faculty dashboard.</p>
        
        <button class="btn-start" onclick="startSystem()">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>
            Start System
        </button>
    </div>

    <div class="container loading-screen" id="loading">
        <div class="spinner"></div>
        <div class="status-text" id="status">Launching Application</div>
        <div class="sub-status-text" id="sub-status">Executing start.bat...</div>
    </div>

    <script>
        function startSystem() {
            document.getElementById('panel').style.display = 'none';
            document.getElementById('loading').style.display = 'block';

            const stages = [
                "Booting Node.js servers...",
                "Connecting to PostgreSQL database...",
                "Initializing scheduling solver engines...",
                "Launching client frontend dashboard..."
            ];
            let stageIdx = 0;

            const interval = setInterval(() => {
                if (stageIdx < stages.length) {
                    document.getElementById('status').innerText = stages[stageIdx];
                    stageIdx++;
                }
            }, 1200);

            fetch('/start', { method: 'POST' })
                .then(res => res.json())
                .then(data => {
                    if (data.success) {
                        checkFrontendReady();
                    } else {
                        document.getElementById('status').innerText = "Startup Failed";
                        document.getElementById('sub-status').innerText = data.error || "Unknown error";
                        clearInterval(interval);
                    }
                })
                .catch(err => {
                    document.getElementById('status').innerText = "Startup Error";
                    document.getElementById('sub-status').innerText = err.message;
                    clearInterval(interval);
                });
        }

        function checkFrontendReady() {
            const checkInterval = setInterval(() => {
                fetch('http://localhost:5173', { mode: 'no-cors' })
                    .then(() => {
                        document.getElementById('status').innerText = "System Operational!";
                        document.getElementById('sub-status').innerText = "Redirecting to Dashboard...";
                        clearInterval(checkInterval);
                        setTimeout(() => {
                            window.location.href = 'http://localhost:5173';
                        }, 800);
                    })
                    .catch(() => {
                        // Retry until Vite server is up
                    });
            }, 1000);
        }
    </script>
</body>
</html>
`;

const server = http.createServer((req, res) => {
  if (req.url === '/' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(htmlContent);
  } else if (req.url === '/start' && req.method === 'POST') {
    console.log('Triggering start.bat...');
    // Spawn start.bat in background
    const bat = spawn('cmd.exe', ['/c', 'start.bat'], {
      cwd: __dirname,
      detached: true,
      stdio: 'ignore'
    });
    bat.unref();

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true }));
  } else {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found');
  }
});

server.listen(port, () => {
  console.log(`Control portal running at http://localhost:${port}`);
});
