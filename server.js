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

app.use(express.json({ limit: "25mb" }));
app.use(express.static(join(__dirname, "dist")));

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

    // If it's already a data URL, return as-is. Otherwise fetch and convert
    // to base64 so the client doesn't have to deal with cross-origin / expiring URLs.
    if (imageUrl.startsWith("data:")) {
      return res.json({ image: imageUrl });
    }

    const imgRes = await fetch(imageUrl);
    if (!imgRes.ok) {
      return res
        .status(502)
        .json({ error: `Failed to fetch generated image: ${imgRes.status}` });
    }
    const buf = Buffer.from(await imgRes.arrayBuffer());
    const contentType = imgRes.headers.get("content-type") || "image/png";
    const dataUrl = `data:${contentType};base64,${buf.toString("base64")}`;
    res.json({ image: dataUrl });
  } catch (error) {
    console.error("Transform error:", error);
    res.status(500).json({ error: error.message });
  }
});

app.get("*", (req, res) => {
  res.sendFile(join(__dirname, "dist", "index.html"));
});

app.listen(port, () => {
  console.log(`Server is running at http://localhost:${port}`);
});
