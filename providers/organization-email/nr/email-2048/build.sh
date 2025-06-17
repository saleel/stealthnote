# Extract version from Nargo.toml
rm -rf target

bbup -v 0.82.2 

echo "Compiling circuit..."
if ! nargo compile; then
    echo "Compilation failed. Exiting..."
    exit 1
fi

echo "Gate count:"
bb gates -b target/stealthnote_organization_email_2048.json | jq  '.functions[0].circuit_size'

cp target/stealthnote_organization_email_2048.json ./artifacts/circuit.json

echo "Generating vkey..."
bb write_vk -b ./target/stealthnote_organization_email_2048.json -o ./target
node -e "const fs = require('fs'); fs.writeFileSync('./artifacts/vkey.json', JSON.stringify(Array.from(Uint8Array.from(fs.readFileSync('./target/vk')))));"

echo "Done"
