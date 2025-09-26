// src/config/firebase.ts

import * as admin from 'firebase-admin';
import { type ServiceAccount } from 'firebase-admin';

// @ts-ignore
const serviceAccountKey = require('../../config/serviceAccountKey.json');

// Verifique se o serviceAccountKey tem as propriedades esperadas
const serviceAccount = serviceAccountKey as ServiceAccount;

// Inicializa o Firebase Admin SDK
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

// Exporta a instância do Firestore para ser usada em outros lugares
export const db = admin.firestore();
