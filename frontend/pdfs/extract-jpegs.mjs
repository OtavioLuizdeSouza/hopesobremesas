import fs from 'node:fs';
import path from 'node:path';

const [input, output] = process.argv.slice(2);
fs.mkdirSync(output, { recursive: true });
const data = fs.readFileSync(input);
let position = 0;
let index = 1;

while (position < data.length - 1) {
  const start = data.indexOf(Buffer.from([0xff, 0xd8, 0xff]), position);
  if (start === -1) break;
  const end = data.indexOf(Buffer.from([0xff, 0xd9]), start + 3);
  if (end === -1) break;
  const filename = `foto-${String(index).padStart(2, '0')}.jpg`;
  fs.writeFileSync(path.join(output, filename), data.subarray(start, end + 2));
  position = end + 2;
  index += 1;
}

console.log(`${index - 1} JPEGs extraídos de ${path.basename(input)}`);
