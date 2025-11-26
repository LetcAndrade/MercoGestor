import admin from 'firebase-admin';
import path from 'path';
import fs from 'fs';

type SA = admin.ServiceAccount;

function readJson(p: string): SA {
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function loadServiceAccount(): SA {
  // 1) .env base64 (mais seguro para produção)
  const b64 = process.env.FIREBASE_SERVICE_ACCOUNT_B64;
  if (b64 && b64.trim()) {
    const json = Buffer.from(b64, 'base64').toString('utf8');
    return JSON.parse(json);
  }

  // 2) Arquivo ao lado: src/config/serviceAccountKey.json
  const here = path.resolve(__dirname, 'serviceAccountKey.json');
  if (fs.existsSync(here)) return readJson(here);

  // 3) Caminho explícito via env (arquivo .json)
  const fromEnvPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
  if (fromEnvPath && fs.existsSync(fromEnvPath)) return readJson(fromEnvPath);

  // 4) Application Default Credentials (GOOGLE_APPLICATION_CREDENTIALS)
  // Se essa var estiver setada, dá para usar applicationDefault()
  const gac = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (gac && fs.existsSync(gac)) {
    // Não retornamos nada: vamos inicializar com applicationDefault abaixo.
    return {} as SA;
  }

  throw new Error(
    `Service account não encontrada.
- Tentei: ${here}
- Var FIREBASE_SERVICE_ACCOUNT_PATH: ${fromEnvPath || '(vazia)'}
- Var GOOGLE_APPLICATION_CREDENTIALS: ${gac || '(vazia)'}
__dirname = ${__dirname}`
  );
}

const maybeCreds = loadServiceAccount();

if (!admin.apps.length) {
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS && fs.existsSync(process.env.GOOGLE_APPLICATION_CREDENTIALS)) {
    admin.initializeApp({
      credential: admin.credential.applicationDefault(),
    });
  } else if (Object.keys(maybeCreds).length > 0) {
    admin.initializeApp({
      credential: admin.credential.cert(maybeCreds),
    });
  } else {
    throw new Error('Credenciais do Firebase não configuradas.');
  }
}

export const auth = admin.auth();
export const db = admin.firestore();
