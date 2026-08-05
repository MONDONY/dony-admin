import type { FirebaseApp } from 'firebase/app'
import type { Auth } from 'firebase/auth'

declare module '#app' {
  interface NuxtApp {
    $firebaseApp: FirebaseApp | null
    $firebaseAuth: Auth | null
  }
}

declare module 'vue' {
  interface ComponentCustomProperties {
    $firebaseApp: FirebaseApp | null
    $firebaseAuth: Auth | null
  }
}

export {}
