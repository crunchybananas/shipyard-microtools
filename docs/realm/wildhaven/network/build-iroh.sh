#!/bin/sh
set -eu
cd "$(dirname "$0")/iroh"
# Apple's archive tools can produce a successful build with unresolved ring
# imports. Use LLVM's C compiler AND archiver on macOS, then inspect the Wasm.
if [ "$(uname -s)" = Darwin ] && [ -d /opt/homebrew/opt/llvm/bin ]; then
  export CC_wasm32_unknown_unknown=/opt/homebrew/opt/llvm/bin/clang
  export AR_wasm32_unknown_unknown=/opt/homebrew/opt/llvm/bin/llvm-ar
  export RANLIB_wasm32_unknown_unknown=/opt/homebrew/opt/llvm/bin/llvm-ranlib
fi
cargo build --locked --release --target wasm32-unknown-unknown
bindgen=$(command -v wasm-bindgen || true)
if [ -z "$bindgen" ] && [ -x "$HOME/.cargo/bin/wasm-bindgen" ]; then bindgen="$HOME/.cargo/bin/wasm-bindgen"; fi
if [ -z "$bindgen" ]; then echo 'Install wasm-bindgen-cli 0.2.122 to rebuild the browser artifact.' >&2; exit 1; fi
"$bindgen" target/wasm32-unknown-unknown/release/town_peer.wasm --target web --out-dir ../../vendor/iroh --out-name town_peer --no-typescript
node --input-type=module -e 'import fs from "node:fs";const m=new WebAssembly.Module(fs.readFileSync("../../vendor/iroh/town_peer_bg.wasm"));if(WebAssembly.Module.imports(m).some(i=>i.module==="env"))throw Error("Unresolved native imports in browser Wasm");'

python3 ../collect-notices.py
