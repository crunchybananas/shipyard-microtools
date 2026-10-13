"""Collect notices from the actual crates referenced by the Wasm build's depfiles."""
from pathlib import Path
import re
base=Path(__file__).resolve().parent
sources=set()
for dep in (base/'iroh/target/wasm32-unknown-unknown/release/deps').glob('*.d'):
    sources.update(re.findall(r'(/[^\s]+/registry/src/[^/]+/[^/]+)/',dep.read_text()))
chunks=['Third-party notices for the committed iroh browser module.\nGenerated from the compiled dependency sources; Cargo.lock pins versions.\n']
for location in sorted(sources):
    root=Path(location)
    manifest=(root/'Cargo.toml').read_text()
    license=re.search(r'^license\s*=\s*"([^"]+)"',manifest,re.M)
    repository=re.search(r'^repository\s*=\s*"([^"]+)"',manifest,re.M)
    chunks.append('\n'+'='*72+'\n'+root.name+'\nLicense: '+(license.group(1) if license else 'See included license text')+'\n'+(repository.group(1)+'\n' if repository else ''))
    found=[]
    for candidate in root.iterdir():
        if candidate.is_file() and candidate.name.upper().startswith(('LICENSE','COPYING','NOTICE')):found.append(candidate)
    for candidate in sorted(found):
        chunks.append('\n'+candidate.name+'\n'+candidate.read_text(errors='replace')+'\n')
    if not found:
        readme=root/'README.md'
        if readme.exists():
            text=readme.read_text(errors='replace'); start=re.search(r'^#+ (?:Copyright|License|Licensing)',text,re.M|re.I)
            if start:chunks.append(text[start.start():])
(base/'../vendor/iroh/THIRD_PARTY_NOTICES.txt').write_text('\n'.join(line.rstrip() for line in '\n'.join(chunks).splitlines()).rstrip()+'\n')
print(f'Collected notices for {len(sources)} compiled dependencies.')
