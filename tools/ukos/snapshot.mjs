import { writeFile } from 'node:fs/promises';
import { constants, zstdCompressSync } from 'node:zlib';
import { V86 } from '../../client/node_modules/v86/build/libv86.mjs';

export async function createBootSnapshot(output) {
  const startedAt = performance.now();
  const emulator = new V86({
    wasm_path: `${output}/v86.wasm`,
    memory_size: 128 * 1024 * 1024,
    vga_memory_size: 256 * 1024,
    bios: { url: `${output}/seabios.bin` },
    vga_bios: { url: `${output}/vgabios.bin` },
    bzimage: { url: `${output}/kernel.bin`, async: false },
    initrd: { url: `${output}/initrd.gz`, async: false },
    cmdline:
      'console=ttyS0,115200 quiet loglevel=0 tsc=reliable mitigations=off random.trust_cpu=on init=/init',
    autostart: true,
    disable_keyboard: true,
    disable_mouse: true,
    disable_speaker: true,
    uart1: true,
    uart2: true,
    uart3: true,
  });
  try {
    await new Promise((resolve, reject) => {
      let line = '';
      const timeout = setTimeout(
        () => reject(new Error('Linux failed to reach its startup checkpoint')),
        60000
      );
      emulator.add_listener('serial1-output-byte', (byte) => {
        if (byte === 10) {
          if (line.trim() === 'CONTROL_READY') {
            clearTimeout(timeout);
            resolve();
          }
          line = '';
        } else line += String.fromCharCode(byte);
      });
    });
    await emulator.stop();
    const state = await emulator.save_state();
    const compressed = zstdCompressSync(new Uint8Array(state), {
      params: { [constants.ZSTD_c_compressionLevel]: 15 },
    });
    await writeFile(`${output}/boot-state.bin.zst`, compressed);
    process.stdout.write(
      `Boot snapshot: ${state.byteLength} bytes, compressed ${compressed.byteLength} bytes, ${((performance.now() - startedAt) / 1000).toFixed(2)} seconds\n`
    );
  } finally {
    await emulator.destroy();
  }
}
