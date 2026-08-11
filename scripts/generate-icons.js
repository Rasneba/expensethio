const sharp = require('sharp');
const path = require('path');

const svg = path.join(__dirname, '../client/public/favicon.svg');
const outDir = path.join(__dirname, '../client/public/icons');

async function gen(size, name, maskable) {
  const opts = maskable
    ? { width: size, height: size }
    : { width: size, height: size, fit: 'cover' };

  const buf = await sharp(svg).resize(opts).png().toBuffer();

  if (maskable) {
    const bg = Buffer.from(
      `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}"><rect width="${size}" height="${size}" fill="#f0f7fc"/></svg>`
    );
    await sharp(bg).composite([{ input: buf, gravity: 'center' }]).png().toFile(path.join(outDir, name));
  } else {
    await sharp(buf).toFile(path.join(outDir, name));
  }
  console.log('created', name);
}

(async () => {
  await gen(192, 'icon-192.png');
  await gen(512, 'icon-512.png');
  await gen(512, 'icon-512-maskable.png', true);
  const apple = await sharp(svg).resize(180, 180, { fit: 'cover' }).png().toBuffer();
  await sharp(apple).toFile(path.join(outDir, 'apple-touch-icon.png'));
  console.log('created apple-touch-icon.png');
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
