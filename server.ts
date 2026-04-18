import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Audit Log System (Hackathon Feature: Historic Traffic Events)
  const auditLogs: any[] = [];

  app.post("/api/logs", (req, res) => {
    const { event, density, timestamp } = req.body;
    const logEntry = { id: Date.now(), event, density, timestamp: timestamp || new Date().toISOString() };
    auditLogs.unshift(logEntry);
    if (auditLogs.length > 50) auditLogs.pop(); // Keep last 50 events
    res.json({ success: true, entry: logEntry });
  });

  app.get("/api/logs", (req, res) => {
    res.json(auditLogs);
  });

  // Health check
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // Production serving
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
