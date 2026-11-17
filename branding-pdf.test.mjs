import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('los logos de respaldo de Mundo LED existen para PDFs y recibos', async () => {
  const configUrl = new URL('./company-runtime-config.js', import.meta.url);
  const configSource = await readFile(configUrl, 'utf8');
  const { COMPANY_RUNTIME_CONFIG } = await import(`data:text/javascript,${encodeURIComponent(configSource)}`);

  for (const key of ['logoEmpresaFallbackUrl', 'logoReciboPremiumUrl']) {
    const asset = COMPANY_RUNTIME_CONFIG[key];
    assert.ok(asset, `${key} no debe estar vacío`);
    const data = await readFile(new URL(asset, configUrl));
    assert.equal(data.subarray(0, 8).toString('hex'), '89504e470d0a1a0a', `${key} debe ser un PNG válido`);
  }
});
