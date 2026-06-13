import { initializeApp } from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js';
import {
  createUserWithEmailAndPassword,
  getAdditionalUserInfo,
  GoogleAuthProvider,
  browserSessionPersistence,
  browserPopupRedirectResolver,
  getRedirectResult,
  initializeAuth,
  OAuthProvider,
  RecaptchaVerifier,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPhoneNumber,
  signInWithPopup,
  signInWithRedirect,
  signOut
} from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js';

let auth;
let phoneConfirmation;
let recaptchaVerifier;

function currentUserResult(user) {
  if (!user) return null;
  return {
    uid: user.uid,
    email: user.email || '',
    phoneNumber: user.phoneNumber || '',
    displayName: user.displayName || '',
    isNewUser: false
  };
}

function normalizeResult(result) {
  return {
    uid: result.user.uid,
    email: result.user.email || '',
    phoneNumber: result.user.phoneNumber || '',
    displayName: result.user.displayName || '',
    isNewUser: Boolean(getAdditionalUserInfo(result)?.isNewUser)
  };
}

async function ensureRecaptcha() {
  if (!recaptchaVerifier) {
    recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', { size: 'invisible' });
  }
  return recaptchaVerifier;
}

try {
  let response;
  try {
    response = await fetch('/api/firebase-config');
  } catch {
    throw new Error('Cannot reach the server. Make sure the app is running at http://localhost:3000');
  }

  let config;
  try {
    config = await response.json();
  } catch {
    throw new Error('Server returned invalid Firebase config. Restart the server and try again.');
  }

  if (!response.ok || !config.apiKey || !config.projectId || !config.appId) {
    throw new Error('Firebase configuration is missing. Check your .env file and restart the server.');
  }

  auth = initializeAuth(initializeApp(config), {
    persistence: browserSessionPersistence,
    popupRedirectResolver: browserPopupRedirectResolver
  });

  let redirectResult = null;
  try {
    redirectResult = await getRedirectResult(auth);
  } catch (redirectError) {
    console.warn('[Auth] getRedirectResult failed (non-fatal):', redirectError.message);
  }

  const initialUser = await new Promise(resolve => {
    const unsubscribe = onAuthStateChanged(auth, user => {
      unsubscribe();
      resolve(currentUserResult(user));
    });
  });
  window.firebaseAuthApi = {
    ready: true,
    currentUser: initialUser,
    redirectResult: redirectResult ? normalizeResult(redirectResult) : null,
    async signInProvider(providerName) {
      const provider = providerName === 'google'
        ? new GoogleAuthProvider()
        : new OAuthProvider('apple.com');
      if (providerName === 'apple') provider.addScope('email');
      if (providerName === 'google') provider.setCustomParameters({ prompt: 'select_account' });
      try {
        return normalizeResult(await signInWithPopup(auth, provider));
      } catch (error) {
        if (/popup-blocked|operation-not-supported-in-this-environment/i.test(error?.code || error?.message)) {
          await signInWithRedirect(auth, provider);
          return null;
        }
        throw error;
      }
    },
    async signInEmail(email, password) {
      return normalizeResult(await signInWithEmailAndPassword(auth, email, password));
    },
    async registerEmail(email, password) {
      return normalizeResult(await createUserWithEmailAndPassword(auth, email, password));
    },
    async sendPhoneCode(phoneNumber) {
      try {
        phoneConfirmation = await signInWithPhoneNumber(auth, phoneNumber, await ensureRecaptcha());
      } catch (error) {
        recaptchaVerifier?.clear();
        recaptchaVerifier = null;
        throw error;
      }
    },
    async confirmPhoneCode(code) {
      if (!phoneConfirmation) throw new Error('Request a verification code first.');
      return normalizeResult(await phoneConfirmation.confirm(code));
    },
    async signOut() {
      await signOut(auth);
    }
  };
  window.dispatchEvent(new Event('firebase-auth-ready'));
} catch (error) {
  console.warn('[Auth]', error.message);
  window.firebaseAuthApi = { ready: false, error: error.message };
  window.dispatchEvent(new Event('firebase-auth-ready'));
}
