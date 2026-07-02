import { listComplaints, createComplaint, bulkCreateComplaints } from "../../../lib/googleSheets";

export default async function handler(req, res) {
  try {
    if (req.method === "GET") {
      const data = await listComplaints();
      return res.status(200).json({ ok: true, data });
    }

    if (req.method === "POST") {
      const { action, record, records } = req.body || {};
      if (action === "bulkCreate") {
        const count = await bulkCreateComplaints(records || []);
        return res.status(200).json({ ok: true, count });
      }
      if (!record) return res.status(400).json({ ok: false, error: "record is required" });
      const saved = await createComplaint(record);
      return res.status(200).json({ ok: true, record: saved });
    }

    res.setHeader("Allow", ["GET", "POST"]);
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message || String(err) });
  }
}
