# Extract version from Nargo.toml
rm -rf target

echo "Compiling circuit..."
if ! nargo compile; then
    echo "Compilation failed. Exiting..."
    exit 1
fi

echo "Gate count:"
bb gates -b target/stealthnote_jwt.json | jq  '.functions[0].circuit_size'

# Create version-specific directory
mkdir -p "../../app/assets/jwt"

echo "Copying circuit.json to app/assets/jwt..."
cp target/stealthnote_jwt.json "../../app/assets/jwt/circuit.json"

echo "Generating vkey..."
bb write_vk -b ./target/stealthnote_jwt.json -o ./target

echo "Generating vkey.json to app/assets/jwt..."
node -e "const fs = require('fs'); fs.writeFileSync('../../app/assets/jwt/circuit-vkey.json', JSON.stringify(Array.from(Uint8Array.from(fs.readFileSync('./target/vk')))));"

echo "Done"
