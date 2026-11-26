import {getAuth} from 'firebase/auth';
import {getStorage} from 'firebase/storage';
import {firebaseApp, registerAuthGetter} from './firebase';

export const auth = getAuth(firebaseApp);
export const storage = getStorage(firebaseApp);

registerAuthGetter(() => auth.currentUser);
