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
    return res.status(upstream.status).setHeader("content-type", "application/json").send(text);
  } catch (err) {
    return res.status(500).json({ error: err?.message || String(err) });
  }
};
