import { updateComplaint } from "../../../lib/googleSheets";

export default async function handler(req, res) {
  const { id } = req.query;

  try {
    if (req.method === "PATCH" || req.method === "POST") {
      const patch = (req.body && req.body.patch) || req.body || {};
      const record = await updateComplaint(id, patch);
      return res.status(200).json({ ok: true, record });
    }

    res.setHeader("Allow", ["PATCH", "POST"]);
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message || String(err) });
  }
}
