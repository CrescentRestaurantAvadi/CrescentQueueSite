importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore-compat.js');

const firebaseConfig = {
  apiKey: "AIzaSyCwv0xOOliAnlXivDEVnndaVXPf91C5fA8",
  authDomain: "crescent-queue-system.firebaseapp.com",
  projectId: "crescent-queue-system",
  storageBucket: "crescent-queue-system.appspot.com",
  messagingSenderId: "326862097681",
  appId: "1:326862097681:web:e0205177054de6f90010b0"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

// Cache Firestore data for offline use
self.addEventListener('fetch', (event) => {
  if (event.request.url.includes('firestore.googleapis.com')) {
    event.respondWith(
      caches.open('firestore-cache').then(async (cache) => {
        try {
          const response = await fetch(event.request);
          if (response.status === 200) {
            cache.put(event.request, response.clone());
          }
          return response;
        } catch (err) {
          const cachedResponse = await cache.match(event.request);
          return cachedResponse || new Response('Network error', { status: 408 });
        }
      })
    );
  }
});