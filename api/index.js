const SOURCE = process.env.ORDERS_URL || "https://test.ooobs.ru/api/orders";

function normalizePhone(raw) {
  if (raw === null || raw === undefined) return null;
  let d = String(raw).replace(/\D/g, "");
  if (d.length === 11 && d[0] === "8") d = "7" + d.slice(1);
  else if (d.length === 10) d = "7" + d;
  if (d.length !== 11 || d[0] !== "7") return null;
  return "+" + d;
}

function toTime(s) {
  const t = Date.parse(s);
  return Number.isNaN(t) ? 0 : t;
}

function better(a, b) {
  if (a.amount !== b.amount) return a.amount > b.amount;
  return a._t > b._t;
}

function sync(orders) {
  let invalid = 0;
  let validCount = 0;
  const map = new Map();

  for (const o of orders) {
    const phone = normalizePhone(o.phone);
    if (!phone) { invalid++; continue; }
    validCount++;
    const rec = {
      name: o.name ?? "",
      phone,
      email: o.email ?? "",
      amount: Number(o.amount) || 0,
      _t: toTime(o.created_at),
    };
    const cur = map.get(phone);
    if (!cur || better(rec, cur)) map.set(phone, rec);
  }

  const clients = [...map.values()]
    .sort((a, b) => a.phone.localeCompare(b.phone))
    .map(({ _t, ...c }) => c);

  return {
    clients,
    stats: {
      received: orders.length,
      unique: clients.length,
      duplicates_merged: validCount - clients.length,
      invalid_dropped: invalid,
    },
  };
}

module.exports = async (req, res) => {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Access-Control-Allow-Origin", "*");
  try {
    const r = await fetch(SOURCE);
    if (!r.ok) throw new Error("upstream " + r.status);
    const orders = await r.json();
    if (!Array.isArray(orders)) throw new Error("upstream is not an array");
    res.status(200).send(JSON.stringify(sync(orders)));
  } catch (e) {
    res.status(502).send(JSON.stringify({ error: String(e.message || e) }));
  }
};