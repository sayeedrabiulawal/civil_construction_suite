/**
 * Generates the PWA icon set with no image library.
 *
 * A tiny PNG encoder (truecolour + alpha, 8-bit) is enough here: the artwork is
 * flat shapes, and rendering at 3x then box-downsampling gives clean edges.
 *
 * Run with:  node scripts/generate-icons.mjs
 */
import { deflateSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const OUT_DIR = join(
    dirname(fileURLToPath(import.meta.url)),
    "..",
    "public",
    "icons",
);

/* ------------------------------------------------------------------ *
 * Minimal PNG encoder
 * ------------------------------------------------------------------ */

const CRC_TABLE = (() => {
    const table = new Int32Array(256);
    for (let n = 0; n < 256; n += 1) {
        let c = n;
        for (let k = 0; k < 8; k += 1)
            c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
        table[n] = c;
    }
    return table;
})();

function crc32(buf) {
    let c = 0xffffffff;
    for (let i = 0; i < buf.length; i += 1)
        c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
    const length = Buffer.alloc(4);
    length.writeUInt32BE(data.length, 0);
    const typed = Buffer.from(type, "ascii");
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(Buffer.concat([typed, data])), 0);
    return Buffer.concat([length, typed, data, crc]);
}

/** rgba: Buffer of width*height*4 bytes. */
function encodePng(width, height, rgba) {
    const stride = width * 4;
    const raw = Buffer.alloc((stride + 1) * height);
    for (let y = 0; y < height; y += 1) {
        raw[y * (stride + 1)] = 0; // filter: none
        rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
    }

    const ihdr = Buffer.alloc(13);
    ihdr.writeUInt32BE(width, 0);
    ihdr.writeUInt32BE(height, 4);
    ihdr[8] = 8; // bit depth
    ihdr[9] = 6; // colour type: RGBA
    ihdr[10] = 0; // deflate
    ihdr[11] = 0; // adaptive filtering
    ihdr[12] = 0; // no interlace

    return Buffer.concat([
        Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
        chunk("IHDR", ihdr),
        chunk("IDAT", deflateSync(raw, { level: 9 })),
        chunk("IEND", Buffer.alloc(0)),
    ]);
}

/* ------------------------------------------------------------------ *
 * Geometry helpers (all coordinates normalised to 0..1)
 * ------------------------------------------------------------------ */

const mix = (a, b, t) => a + (b - a) * t;

/** Signed-ish test for a rounded box centred on (0.5, 0.5). */
function insideRoundedBox(x, y, halfExtent, radius) {
    const qx = Math.abs(x - 0.5) - halfExtent + radius;
    const qy = Math.abs(y - 0.5) - halfExtent + radius;
    const ax = Math.max(qx, 0);
    const ay = Math.max(qy, 0);
    return Math.hypot(ax, ay) - radius <= 0;
}

/**
 * A hard hat, drawn in its own coordinate space and then placed.
 * Bounding box is x in [-1.42, 1.42], y in [-1.15, 0.32]; its centre is
 * (0, -0.415), so that offset centres the glyph on screen.
 */
const GLYPH_WIDTH = 2.84;
const GLYPH_CENTRE_Y = -0.415;

function insideHardHat(nx, ny, targetExtent) {
    const scale = targetExtent / GLYPH_WIDTH;
    const gx = (nx - 0.5) / scale;
    const gy = (ny - 0.5) / scale - GLYPH_CENTRE_Y;

    // Dome: the top half of an ellipse.
    const dome = (gx / 1.0) ** 2 + (gy / 1.15) ** 2 <= 1 && gy <= 0;
    if (dome) return true;

    // Brim: a superellipse, which reads as a rounded bar.
    return (Math.abs(gx) / 1.42) ** 4 + (Math.abs(gy - 0.16) / 0.16) ** 4 <= 1;
}

/* ------------------------------------------------------------------ *
 * Rendering
 * ------------------------------------------------------------------ */

const BRAND_TOP = [47, 95, 224]; // #2f5fe0
const BRAND_BOTTOM = [24, 64, 178]; // #1840b2
const GLYPH = [255, 255, 255];

function render(size, { maskable }) {
    const SS = 3; // supersampling factor
    const big = size * SS;
    const out = Buffer.alloc(size * size * 4);

    // Corner radius: maskable icons are full bleed so the launcher can mask them.
    const radius = maskable ? 0 : 0.22;
    // Maskable glyphs stay inside the safe zone (centre 80%) to survive cropping.
    const glyphExtent = maskable ? 0.56 : 0.74;

    for (let py = 0; py < size; py += 1) {
        for (let px = 0; px < size; px += 1) {
            let r = 0;
            let g = 0;
            let b = 0;
            let a = 0;

            for (let sy = 0; sy < SS; sy += 1) {
                for (let sx = 0; sx < SS; sx += 1) {
                    const x = (px * SS + sx + 0.5) / big;
                    const y = (py * SS + sy + 0.5) / big;

                    const inBackground =
                        maskable || insideRoundedBox(x, y, 0.5, radius);
                    if (!inBackground) continue;

                    // Vertical gradient, then the glyph on top.
                    const t = y;
                    let cr = mix(BRAND_TOP[0], BRAND_BOTTOM[0], t);
                    let cg = mix(BRAND_TOP[1], BRAND_BOTTOM[1], t);
                    let cb = mix(BRAND_TOP[2], BRAND_BOTTOM[2], t);

                    if (insideHardHat(x, y, glyphExtent)) {
                        cr = GLYPH[0];
                        cg = GLYPH[1];
                        cb = GLYPH[2];
                    }

                    r += cr;
                    g += cg;
                    b += cb;
                    a += 255;
                }
            }

            const samples = SS * SS;
            const i = (py * size + px) * 4;
            const alpha = a / samples; // 0..255
            const covered = a / 255; // number of samples that hit the shape

            // Average the colour over the COVERED samples only, then store the
            // coverage as alpha. Averaging over all samples would darken the edges.
            out[i] = covered > 0 ? Math.round(Math.min(r / covered, 255)) : 0;
            out[i + 1] =
                covered > 0 ? Math.round(Math.min(g / covered, 255)) : 0;
            out[i + 2] =
                covered > 0 ? Math.round(Math.min(b / covered, 255)) : 0;
            out[i + 3] = Math.round(alpha);
        }
    }

    return encodePng(size, size, out);
}

/* ------------------------------------------------------------------ *
 * Write the icon set
 * ------------------------------------------------------------------ */

const targets = [
    { file: "icon-192.png", size: 192, maskable: false },
    { file: "icon-512.png", size: 512, maskable: false },
    { file: "icon-maskable-192.png", size: 192, maskable: true },
    { file: "icon-maskable-512.png", size: 512, maskable: true },
    { file: "apple-touch-icon.png", size: 180, maskable: true },
];

mkdirSync(OUT_DIR, { recursive: true });

for (const t of targets) {
    const png = render(t.size, { maskable: t.maskable });
    writeFileSync(join(OUT_DIR, t.file), png);
    console.log(`  ${t.file}  ${t.size}x${t.size}  ${png.length} bytes`);
}

console.log(`\nWrote ${targets.length} icons to public/icons/`);
