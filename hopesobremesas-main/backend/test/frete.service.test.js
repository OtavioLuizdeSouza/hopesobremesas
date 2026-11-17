import assert from 'node:assert/strict';
import test from 'node:test';
import { calcularFrete, calcularFretePorEndereco } from '../src/services/frete.service.js';

const configuracao = {
  GOOGLE_MAPS_API_KEY: 'test-key',
  STORE_LATITUDE: -23.55,
  STORE_LONGITUDE: -46.63,
};

function mockFetch({ metros, segundos, segundosNoTransito = segundos, status = 'OK' }) {
  return async (url) => {
    const parsedUrl = new URL(url);
    assert.equal(parsedUrl.searchParams.get('origins'), '-23.55,-46.63');
    assert.equal(parsedUrl.searchParams.get('departure_time'), 'now');

    return {
      ok: true,
      json: async () => ({
        status: 'OK',
        rows: [{
          elements: [{
            status,
            distance: { value: metros },
            duration: { value: segundos },
            duration_in_traffic: { value: segundosNoTransito },
          }],
        }],
      }),
    };
  };
}

test('aplica a taxa base e formata os campos da resposta', async () => {
  const resultado = await calcularFrete(
    { latitude: -23.56, longitude: -46.64 },
    { fetchFn: mockFetch({ metros: 2500, segundos: 600 }), configuracao },
  );

  assert.deepEqual(resultado, {
    status: 'sucesso',
    distanciaKm: '2.50',
    tempoMin: 10,
    valorFrete: '10.00',
    mensagem: 'Entrega disponível para este endereço.',
  });
});

test('cobra quilometragem excedente e aceita o limite exato de 12 km', async () => {
  const resultado = await calcularFrete(
    { latitude: -23.56, longitude: -46.64 },
    { fetchFn: mockFetch({ metros: 12_000, segundos: 600 }), configuracao },
  );

  assert.equal(resultado.status, 'sucesso');
  assert.equal(resultado.distanciaKm, '12.00');
  assert.equal(resultado.valorFrete, '32.50');
});

test('bloqueia distâncias estritamente acima de 12 km', async () => {
  const resultado = await calcularFrete(
    { latitude: -23.56, longitude: -46.64 },
    { fetchFn: mockFetch({ metros: 12_001, segundos: 600 }), configuracao },
  );

  assert.equal(resultado.status, 'erro');
  assert.equal(resultado.distanciaKm, '12.00');
  assert.equal(resultado.valorFrete, null);
  assert.match(resultado.mensagem, /fora da área segura/);
});

test('retorna alerta quando o tempo com trânsito supera 50 minutos', async () => {
  const resultado = await calcularFrete(
    { latitude: -23.56, longitude: -46.64 },
    {
      fetchFn: mockFetch({
        metros: 5000,
        segundos: 1200,
        segundosNoTransito: 3001,
      }),
      configuracao,
    },
  );

  assert.equal(resultado.status, 'alerta');
  assert.equal(resultado.tempoMin, 51);
  assert.equal(resultado.valorFrete, '15.00');
  assert.match(resultado.mensagem, /trânsito está intenso/);
});

test('geocodifica um endereço e reutiliza o cálculo de frete existente', async () => {
  const calcularPorCoordenadas = mockFetch({ metros: 4200, segundos: 900 });
  const fetchFn = async (url, options) => {
    const parsedUrl = new URL(url);
    if (parsedUrl.pathname.endsWith('/geocode/json')) {
      assert.equal(parsedUrl.searchParams.get('address'), 'Rua das Palmeiras, 2450');
      assert.equal(parsedUrl.searchParams.get('key'), 'test-key');
      return {
        ok: true,
        json: async () => ({
          status: 'OK',
          results: [{ geometry: { location: { lat: -23.56, lng: -46.64 } } }],
        }),
      };
    }
    return calcularPorCoordenadas(url, options);
  };

  const resultado = await calcularFretePorEndereco(
    'Rua das Palmeiras, 2450',
    { fetchFn, configuracao },
  );

  assert.equal(resultado.status, 'sucesso');
  assert.equal(resultado.distanciaKm, '4.20');
  assert.equal(resultado.valorFrete, '13.00');
});

test('retorna erro quando o endereço não pode ser encontrado', async () => {
  const resultado = await calcularFretePorEndereco(
    'Rua inexistente, 999',
    {
      configuracao,
      fetchFn: async () => ({
        ok: true,
        json: async () => ({ status: 'ZERO_RESULTS', results: [] }),
      }),
    },
  );

  assert.equal(resultado.status, 'erro');
  assert.equal(resultado.distanciaKm, null);
  assert.match(resultado.mensagem, /Não foi possível encontrar esse endereço/);
});
