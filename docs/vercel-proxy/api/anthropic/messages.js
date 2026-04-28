function anthropicToGeminiContents(messages) {
  const out = [];
  for (const msg of messages || []) {
    const role = msg?.role === "assistant" ? "model" : "user";
    const content = msg?.content;
    const parts = [];

    if (typeof content === "string") {
      parts.push({ text: content });
    } else if (Array.isArray(content)) {
      for (const item of content) {
        if (!item) continue;
        if (item.type === "text") {
          parts.push({ text: String(item.text || "") });
          continue;
        }
        if ((item.type === "image" || item.type === "document") && item.source?.type === "base64") {
          parts.push({
            inlineData: {
              mimeType: item.source.media_type || "application/octet-stream",
              data: item.source.data || ""
            }
          });
        }
      }
    }

    if (parts.length) out.push({ role, parts });
  }
  return out;
}

function geminiToAnthropicShape(geminiJson) {
  const parts = geminiJson?.candidates?.[0]?.content?.parts || [];
  const text = parts
    .map((p) => (typeof p?.text === "string" ? p.text : ""))
    .filter(Boolean)
    .join("\n")
    .trim();
  return {
    content: [{ text: text || "" }]
  };
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const body = req.body?.body;
    if (!body || typeof body !== "object") {
      return res.status(400).json({ error: "Missing body payload" });
    }

    const anthropicKey = process.env.ANTHROPIC_API_KEY;
    const geminiKey = process.env.GEMINI_API_KEY;

    if (anthropicKey) {
      const upstream = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-api-key": anthropicKey,
          "anthropic-version": "2023-06-01"
        },
        body: JSON.stringify(body)
      });

      const text = await upstream.text();
      return res.status(upstream.status).setHeader("content-type", "application/json").send(text);
    }

    if (geminiKey) {
      const geminiModel = process.env.GEMINI_MODEL || "gemini-2.0-flash";
      const geminiBody = {
        contents: anthropicToGeminiContents(body.messages || [])
      };
      const upstream = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(geminiModel)}:generateContent?key=${encodeURIComponent(geminiKey)}`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(geminiBody)
        }
      );

      const text = await upstream.text();
      let parsed = null;
      try { parsed = JSON.parse(text); } catch (_) {}

      if (!upstream.ok) {
        return res.status(upstream.status).json({
          error: "Gemini upstream error",
          detail: parsed || text
        });
      }

      return res.status(200).json(geminiToAnthropicShape(parsed || {}));
    }

    return res.status(500).json({
      error: "Server missing provider key",
      detail: "Configure ANTHROPIC_API_KEY or GEMINI_API_KEY"
    });
  } catch (err) {
    return res.status(500).json({ error: err?.message || String(err) });
  }
};
