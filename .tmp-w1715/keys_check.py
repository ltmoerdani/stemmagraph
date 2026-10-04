import re
s = open('src/lib/genealogy/kinship-aliases.ts').read()
m = re.search(r'  Karo: \{.*?\n  \},', s, re.S)
keys = re.findall(r"^    (?:'([^']+)'|(\w+)): \{", m.group(0), re.M)
ks = [a or b for a,b in keys]
for i,k in enumerate(ks):
    print(i, k)
