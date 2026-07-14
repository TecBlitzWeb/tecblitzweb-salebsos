import re, sys
path = sys.argv[1] if len(sys.argv) > 1 else "index.html"
src = open(path, encoding="utf-8").read(); counts = {}
def lit(old, new):
    global src; n = src.count(old)
    if n: src = src.replace(old, new); counts[old+" -> "+new] = n
def hx(h, new):
    global src
    src, n = re.compile("#"+h+r"(?![0-9a-fA-F])", re.I).subn(new, src)
    if n: counts["#"+h+" -> "+new] = n
for v in ["#A855F7,#7C3AED","#a855f7,#7c3aed"]:
    lit("linear-gradient(135deg,"+v+")","linear-gradient(135deg,#00E5FF,#00B8D4)")
for v in ["#7C3AED 45%","#7c3aed 45%"]: lit(v,"#00B8D4 45%")
for old,new in [("rgba(168, 85, 247","rgba(0, 229, 255"),("rgba(168,85,247","rgba(0,229,255"),
                ("rgba(124, 58, 237","rgba(0, 184, 212"),("rgba(124,58,237","rgba(0,184,212"),
                ("rgba(124, 92, 255","rgba(0, 229, 255"),("rgba(124,92,255","rgba(0,229,255"),
                ("rgba(123, 47, 255","rgba(0, 229, 255"),("rgba(123,47,255","rgba(0,229,255")]:
    lit(old,new)
for h in ["a855f7","7c5cff","7b2fff","9b82ff"]: hx(h,"#00E5FF")
hx("9078ff","#33EBFF"); hx("6b21e8","#00B8D4")
hx("c084fc","#5CF2FF"); hx("a78bfa","#5CF2FF")
hx("c4b5fd","#8FF6FF"); hx("d8b4fe","#8FF6FF"); hx("e9d5ff","#C8FBFF")
hx("7c3aed","#0E7490"); hx("5b21b6","#0E7490"); hx("4c1d95","#164E63")
t=0
for k in sorted(counts,key=lambda x:-counts[x]): print(f"{counts[k]:>4}  {k}"); t+=counts[k]
print(f"---- {t} total, {len(counts)} rules ----")
if len(sys.argv)>2 and sys.argv[2]=="--write":
    open(path,"w",encoding="utf-8").write(src); print("WROTE "+path)
else: print("(dry run — pass --write to apply)")
