# Extract version from Nargo.toml
VERSION=$(grep '^version = ' Nargo.toml | cut -d '"' -f 2)
echo "Circuit version: $VERSION"

echo "Compiling circuit..."
if ! nargo compile; then
    echo "Compilation failed. Exiting..."
    exit 1
fi

echo "Gate count:"
bb gates -b target/stealthnote.json | jq  '.functions[0].circuit_size'

# Create version-specific directory
mkdir -p "../app/assets/$VERSION"

echo "Copying circuit.json to app/assets/$VERSION..."
cp target/stealthnote.json "../app/assets/$VERSION/circuit.json"

echo "Generating vkey..."
bb write_vk_ultra_honk -b ./target/stealthnote.json -o ./target/vk

echo "Generating vkey.json to app/assets/$VERSION..."
node -e "const fs = require('fs'); fs.writeFileSync('../app/assets/$VERSION/circuit-vkey.json', JSON.stringify(Array.from(Uint8Array.from(fs.readFileSync('./target/vk')))));"

echo "Done"
