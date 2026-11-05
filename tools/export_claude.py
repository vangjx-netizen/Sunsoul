"""Build the migration file (catalogue only) from a dump of the Claude artifact database.

Usage: python3 -I tools/export_claude.py <dump-dir> <out.json>
<dump-dir> holds one folder per collection with one <id>.json per document
(as written by ArtifactData list ... out_dir). Orders, cases and applications are left out on purpose:
the new site starts clean. Stock is carried over as "left now" (stored stock minus what open
orders on the old site still hold), with stockAt reset so the new site counts from zero.
"""
import glob, json, os, re, sys, time

HOLD = {"await_shop", "await_pay", "await_verify", "await_pickup", "shipping", "delivered"}


def load(root, coll):
    out = {}
    for f in glob.glob(os.path.join(root, coll, "*.json")):
        out[os.path.basename(f)[:-5]] = json.load(open(f, encoding="utf8"))
    return out


def e164(phone):
    d = re.sub(r"\D", "", str(phone or ""))
    if d.startswith("856"):
        d = d[3:]
    if d.startswith("0"):
        d = d[1:]
    return "+856" + d if d else ""


def main(root, out_path):
    now = int(time.time() * 1000)
    products, shop_products = load(root, "products"), load(root, "shopProducts")
    orders = list(load(root, "orders").values())

    def held(pid, label, base):
        return sum(int(o.get("qty") or 1) for o in orders
                   if o.get("pid") == pid and o.get("vlabel") == label and o.get("status") in HOLD
                   and (o.get("shopAt") or o.get("createdAt") or 0) >= base)

    def carry_stock(pid, p):
        base = p.get("stockAt") or p.get("createdAt") or 0
        vs = []
        for v in p.get("variants") or []:
            v = dict(v)
            v["stock"] = max(0, int(v.get("stock") or 0) - held(pid, v.get("label"), base))
            vs.append(v)
        return {**p, "variants": vs, "stockAt": now}

    cat = {k: carry_stock(k, p) for k, p in products.items()}
    sp = {k: carry_stock(k, p) for k, p in shop_products.items()}
    shops = {k: {**s, "phoneE164": e164(s.get("phone"))} for k, s in load(root, "shops").items()}
    settings = {k: v for k, v in load(root, "settings").items() if k in ("delivery", "rules", "pay")}

    refs = set()
    for p in list(cat.values()) + list(sp.values()):
        refs.update(p.get("imgs") or [])
        refs.update(v.get("img") for v in p.get("variants") or [] if isinstance(v, dict) and v.get("img"))
    imgm = {k: v for k, v in load(root, "imgm").items() if k in refs}
    missing = sorted(r for r in refs if re.fullmatch(r"[0-9a-f]{32}", r) and r not in imgm)

    data = {
        "kind": "sunsoul-export", "version": 1, "exportedAt": now,
        "note": "Catalogue only: products, shops, settings and product photos. Contains shop bank accounts (shopPrivate) — keep private.",
        "collections": {
            "shops": shops, "shopPrivate": load(root, "shopPrivate"), "products": cat, "shopProducts": sp,
            "shopOff": load(root, "shopOff"), "settings": settings, "imgm": imgm,
        },
    }
    json.dump(data, open(out_path, "w", encoding="utf8"), ensure_ascii=False)
    print({c: len(d) for c, d in data["collections"].items()}, "photos without a copy:", missing,
          "size:", os.path.getsize(out_path) // 1024, "KB")
    for k, p in {**cat, **sp}.items():
        old = (products.get(k) or shop_products.get(k))["variants"]
        print(k, p.get("name"), [(v.get("label"), o.get("stock"), "→", v["stock"]) for v, o in zip(p["variants"], old)])


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
