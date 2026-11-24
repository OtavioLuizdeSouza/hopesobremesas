import { env } from '../config/env.js';

const DISTANCIA_MAXIMA_METROS = 12_000;
const TEMPO_MAXIMO_SEGUNDOS = 50 * 60;
const DISTANCIA_BASE_KM = 3;
const TAXA_BASE = 10;
const TAXA_POR_KM_ADICIONAL = 2.5;

function resposta(status, mensagem, {
  distanciaKm = null,
  tempoMin = null,
  valorFrete = null,
} = {}) {
  return { status, distanciaKm, tempoMin, valorFrete, mensagem };
}

export class FreteServiceError extends Error {
  constructor(statusCode, body) {
    super(body.mensagem);
    this.statusCode = statusCode;
    this.body = body;
  }
}

function erroDeIntegracao(statusCode, mensagem) {
  return new FreteServiceError(statusCode, resposta('erro', mensagem));
}

export async function calcularFrete(
  destino,
  { fetchFn = fetch, configuracao = env } = {},
) {
  const { GOOGLE_MAPS_API_KEY, STORE_LATITUDE, STORE_LONGITUDE } = configuracao;
  if (!GOOGLE_MAPS_API_KEY || STORE_LATITUDE === undefined || STORE_LONGITUDE === undefined) {
    throw erroDeIntegracao(
      503,
      'O cálculo de frete está temporariamente indisponível. Tente novamente mais tarde.',
    );
  }

  const parametros = new URLSearchParams({
    origins: `${STORE_LATITUDE},${STORE_LONGITUDE}`,
    destinations: `${destino.latitude},${destino.longitude}`,
    mode: 'driving',
    units: 'metric',
    departure_time: 'now',
    key: GOOGLE_MAPS_API_KEY,
  });

  let respostaApi;
  try {
    const response = await fetchFn(
      `https://maps.googleapis.com/maps/api/distancematrix/json?${parametros}`,
      { signal: AbortSignal.timeout(10_000) },
    );
    if (!response.ok) {
      throw erroDeIntegracao(
        502,
        'Não foi possível consultar a rota agora. Tente novamente mais tarde.',
      );
    }
    respostaApi = await response.json();
  } catch (error) {
    if (error instanceof FreteServiceError) throw error;
    throw erroDeIntegracao(
      502,
      'Não foi possível consultar a rota agora. Tente novamente mais tarde.',
    );
  }

  const elemento = respostaApi?.rows?.[0]?.elements?.[0];
  if (respostaApi?.status !== 'OK' || elemento?.status !== 'OK') {
    if (elemento?.status === 'ZERO_RESULTS') {
      return resposta('erro', 'Não foi possível encontrar uma rota de entrega para esse endereço.');
    }
    throw erroDeIntegracao(
      502,
      'Não foi possível calcular a rota para esse endereço. Tente novamente mais tarde.',
    );
  }

  const metros = elemento.distance?.value;
  const segundos = (elemento.duration_in_traffic || elemento.duration)?.value;
  if (!Number.isFinite(metros) || metros < 0 || !Number.isFinite(segundos) || segundos < 0) {
    throw erroDeIntegracao(
      502,
      'A resposta da rota veio inválida. Tente novamente mais tarde.',
    );
  }

  const km = metros / 1000;
  const camposDeRota = {
    distanciaKm: km.toFixed(2),
    tempoMin: Math.ceil(segundos / 60),
  };

  if (metros > DISTANCIA_MAXIMA_METROS) {
    return resposta(
      'erro',
      'Este endereço está fora da área segura de entrega para bolos e doces frágeis (limite de 12 km).',
      camposDeRota,
    );
  }

  const frete = km <= DISTANCIA_BASE_KM
    ? TAXA_BASE
    : TAXA_BASE + (km - DISTANCIA_BASE_KM) * TAXA_POR_KM_ADICIONAL;
  const camposComFrete = { ...camposDeRota, valorFrete: frete.toFixed(2) };

  if (segundos > TEMPO_MAXIMO_SEGUNDOS) {
    return resposta(
      'alerta',
      'O trânsito está intenso, com previsão acima de 50 minutos. O tempo de percurso pode comprometer a integridade dos produtos.',
      camposComFrete,
    );
  }

  return resposta('sucesso', 'Entrega disponível para este endereço.', camposComFrete);
}

export async function calcularFretePorEndereco(
  endereco,
  { fetchFn = fetch, configuracao = env } = {},
) {
  const { GOOGLE_MAPS_API_KEY } = configuracao;
  if (!GOOGLE_MAPS_API_KEY) {
    throw erroDeIntegracao(
      503,
      'O cálculo de frete está temporariamente indisponível. Tente novamente mais tarde.',
    );
  }

  const parametros = new URLSearchParams({
    address: endereco,
    key: GOOGLE_MAPS_API_KEY,
  });

  let respostaApi;
  try {
    const response = await fetchFn(
      `https://maps.googleapis.com/maps/api/geocode/json?${parametros}`,
      { signal: AbortSignal.timeout(10_000) },
    );
    if (!response.ok) {
      throw erroDeIntegracao(
        502,
        'Não foi possível localizar esse endereço agora. Tente novamente mais tarde.',
      );
    }
    respostaApi = await response.json();
  } catch (error) {
    if (error instanceof FreteServiceError) throw error;
    throw erroDeIntegracao(
      502,
      'Não foi possível localizar esse endereço agora. Tente novamente mais tarde.',
    );
  }

  if (respostaApi?.status === 'ZERO_RESULTS') {
    return resposta(
      'erro',
      'Não foi possível encontrar esse endereço. Confira os dados e tente novamente.',
    );
  }
  if (respostaApi?.status !== 'OK') {
    throw erroDeIntegracao(
      502,
      'Não foi possível localizar esse endereço agora. Tente novamente mais tarde.',
    );
  }

  const localizacao = respostaApi.results?.[0]?.geometry?.location;
  if (
    !Number.isFinite(localizacao?.lat) ||
    !Number.isFinite(localizacao?.lng)
  ) {
    throw erroDeIntegracao(
      502,
      'A localização retornada para esse endereço é inválida.',
    );
  }

  return calcularFrete(
    { latitude: localizacao.lat, longitude: localizacao.lng },
    { fetchFn, configuracao },
  );
}
