import {initializeApp} from 'firebase/app';
import type {User} from 'firebase/auth';
import {doc, getDocFromServer, getFirestore} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import {initOptionalAppCheck} from './firebaseAppCheck';

export const firebaseApp = initializeApp(firebaseConfig);
initOptionalAppCheck(firebaseApp);

export const db = getFirestore(firebaseApp, firebaseConfig.firestoreDatabaseId);

let getCurrentUserRef: (() => User | null) | null = null;
export function registerAuthGetter(getter: () => User | null): void {
  getCurrentUserRef = getter;
}

export const BOOTSTRAP_ADMIN_EMAIL = 'brandallanka@gmail.com';
export const FIREBASE_PROJECT_ID = firebaseConfig.projectId;
export const FIREBASE_DATABASE_ID = firebaseConfig.firestoreDatabaseId;

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null,
): never {
  const currentUser = getCurrentUserRef ? getCurrentUserRef() : null;
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: currentUser?.uid ?? null,
      email: currentUser?.email ?? null,
      emailVerified: currentUser?.emailVerified ?? null,
      isAnonymous: currentUser?.isAnonymous ?? null,
      tenantId: currentUser?.tenantId ?? null,
      providerInfo:
        currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export async function testFirestoreConnection(): Promise<{ok: boolean; message: string}> {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    return {ok: true, message: 'Connected to Firestore'};
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    if (msg.includes('the client is offline')) {
      return {
        ok: false,
        message: 'Firestore client is offline. Please verify your Firebase configuration.',
      };
    }
    // Permission or missing healthcheck doc still confirms server reachability
    return {ok: true, message: 'Firestore server reachable'};
  }
}
