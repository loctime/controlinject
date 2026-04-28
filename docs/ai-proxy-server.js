const express = require("express");

const app = express();
app.use(express.json({ limit: "25mb" }));

app.post("/anthropic/messages", async (req, res) => {
  try {
    const body = req.body?.body;
    if (!body || typeof body !== "object") {
      return res.status(400).json({ error: "Missing body payload" });
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: "Server missing ANTHROPIC_API_KEY" });
    }

    const upstream = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify(body)
    });

    const text = await upstream.text();
    res.status(upstream.status).type("application/json").send(text);
  } catch (err) {
    res.status(500).json({ error: err?.message || String(err) });
  }
});

const port = process.env.PORT || 8080;
app.listen(port, () => {
  console.log(`AI proxy listening on ${port}`);
});
