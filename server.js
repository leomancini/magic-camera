import express from "express";
import "dotenv/config";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const port = 3135;

const POE_API_KEY = process.env.POE_API_KEY;
const POE_MODEL = "nano-banana-2";
// Shared secret required on all API calls, passed by the client as ?key=.
// Lives only in .env (never committed).
const APP_KEY = process.env.APP_KEY;

app.use(express.json({ limit: "25mb" }));
app.use(express.static(join(__dirname, "dist")));

// Gate the API behind the key. Fails closed if APP_KEY isn't configured.
app.use("/api", (req, res, next) => {
  if (!APP_KEY) {
    return res.status(500).json({ error: "Server key not configured" });
  }
  if (req.query.key !== APP_KEY) {
    return res.status(401).json({ error: "Invalid or missing key" });
  }
  next();
});

// Extract image URLs from Poe-style markdown content like:
// "![desc](https://...png)" or attachment objects.
function extractImageFromPoe(data) {
  const message = data?.choices?.[0]?.message;
  if (!message) return null;

  // 1. Attachments array
  if (Array.isArray(message.attachments)) {
    const img = message.attachments.find(
      (a) =>
        a.content_type?.startsWith("image/") ||
        a.url?.match(/\.(png|jpe?g|webp|gif)/i)
    );
    if (img?.url) return img.url;
  }

  // 2. Content string with markdown image
  if (typeof message.content === "string") {
    const md = message.content.match(/!\[[^\]]*\]\(([^)]+)\)/);
    if (md) return md[1];

    const url = message.content.match(/https?:\/\/\S+\.(?:png|jpe?g|webp|gif)/i);
    if (url) return url[0];
  }

  // 3. Content array (OpenAI multimodal style)
  if (Array.isArray(message.content)) {
    for (const part of message.content) {
      if (part.type === "image_url" && part.image_url?.url) {
        return part.image_url.url;
      }
      if (part.type === "output_image" && part.image_url) {
        return part.image_url;
      }
    }
  }

  return null;
}

app.post("/api/transform", async (req, res) => {
  try {
    const { image, prompt } = req.body;
    if (!image || !prompt) {
      return res.status(400).json({ error: "Missing image or prompt" });
    }

    const poeRes = await fetch("https://api.poe.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${POE_API_KEY}`
      },
      body: JSON.stringify({
        model: POE_MODEL,
        stream: false,
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: prompt },
              { type: "image_url", image_url: { url: image } }
            ]
          }
        ]
      })
    });

    if (!poeRes.ok) {
      const errText = await poeRes.text();
      console.error("Poe API error:", poeRes.status, errText);
      return res
        .status(502)
        .json({ error: `Poe API ${poeRes.status}: ${errText.slice(0, 500)}` });
    }

    const data = await poeRes.json();
    const imageUrl = extractImageFromPoe(data);
    if (!imageUrl) {
      console.error("No image found in Poe response:", JSON.stringify(data).slice(0, 1000));
      return res.status(502).json({ error: "No image in Poe response" });
    }

    // Return whatever URL Poe gave us (CDN URL or data URL). Letting the
    // browser fetch from Poe's CDN directly skips a server-side download
    // and a base64 round-trip — meaningful win on perceived latency.
    res.json({ image: imageUrl });
  } catch (error) {
    console.error("Transform error:", error);
    res.status(500).json({ error: error.message });
  }
});

// Proxy generated images back through this origin so the client can fetch
// their bytes (for Web Share API file payload / download fallback) without
// running into the upstream CDN's CORS rules.
app.get("/api/image-proxy", async (req, res) => {
  try {
    const target = req.query.url;
    if (typeof target !== "string" || !target) {
      return res.status(400).json({ error: "Missing url" });
    }
    // Allow only Poe's image CDN to keep this from becoming an open proxy.
    let parsed;
    try {
      parsed = new URL(target);
    } catch {
      return res.status(400).json({ error: "Invalid url" });
    }
    if (!parsed.host.endsWith(".poecdn.net")) {
      return res.status(403).json({ error: "Host not allowed" });
    }

    const upstream = await fetch(target);
    if (!upstream.ok) {
      return res.status(502).json({ error: `Upstream ${upstream.status}` });
    }
    const buf = Buffer.from(await upstream.arrayBuffer());
    res.setHeader(
      "Content-Type",
      upstream.headers.get("content-type") || "image/jpeg"
    );
    res.setHeader("Cache-Control", "public, max-age=3600");
    res.send(buf);
  } catch (err) {
    console.error("image-proxy error:", err);
    res.status(500).json({ error: err.message });
  }
});

app.get("*", (req, res) => {
  res.sendFile(join(__dirname, "dist", "index.html"));
});

app.listen(port, () => {
  console.log(`Server is running at http://localhost:${port}`);
});
