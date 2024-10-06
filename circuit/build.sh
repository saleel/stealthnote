echo "Compiling circuit..."
nargo compile

echo "Gate count:"
bb gates -b target/stealthnote.json | jq  '.functions[0].circuit_size'

echo "Copying circuit.json to app/assets..."
cp target/stealthnote.json ../app/assets/circuit.json

echo "Generating vkey..."
bb write_vk_ultra_honk -b ./target/stealthnote.json -o ./target/vk

echo "Generating vkey.json to app/assets..."
node -e "const fs = require('fs'); fs.writeFileSync('../app/assets/circuit-vkey.json', JSON.stringify(Array.from(Uint8Array.from(fs.readFileSync('./target/vk')))));"

echo "Done"
