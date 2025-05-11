# Extract version from Nargo.toml
rm -rf target

echo "Compiling circuit..."
if ! nargo compile; then
    echo "Compilation failed. Exiting..."
    exit 1
fi

echo "Gate count:"
bb gates -b target/stealthnote_email_1024.json | jq  '.functions[0].circuit_size'

# Create version-specific directory
mkdir -p "../../app/assets/email_1024"

echo "Copying circuit.json to app/assets/email_1024..."
cp target/stealthnote_email_1024.json "../../app/assets/email_1024/circuit.json"

echo "Generating vkey..."
bb write_vk -b ./target/stealthnote_email_1024.json -o ./target

echo "Generating vkey.json to app/assets/email_1024..."
node -e "const fs = require('fs'); fs.writeFileSync('../../app/assets/email_1024/vkey.json', JSON.stringify(Array.from(Uint8Array.from(fs.readFileSync('./target/vk')))));"

echo "Done"
