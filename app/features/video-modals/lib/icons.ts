import { Bell, Info, Lock, Luggage, MessageCircle, Package, QrCode, Search, Star, Wallet } from 'lucide-vue-next'
import type { Component } from 'vue'
import type { ModalIcon } from '@/features/video-modals/types/index'

/** Couleurs unies de l'app pour chaque icône (aucun dégradé). */
export const MODAL_ICON_STYLES: Record<ModalIcon, { icon: Component; fg: string; bg: string }> = {
  PARCEL: { icon: Package, fg: '#D96A3A', bg: '#FBE7DC' },
  SUITCASE: { icon: Luggage, fg: '#0B5FFF', bg: '#EAF1FF' },
  LOCK: { icon: Lock, fg: '#16A34A', bg: '#DCFCE7' },
  SEARCH: { icon: Search, fg: '#0B5FFF', bg: '#EAF1FF' },
  CHAT: { icon: MessageCircle, fg: '#0B5FFF', bg: '#EAF1FF' },
  QR: { icon: QrCode, fg: '#041D54', bg: '#E6EAF3' },
  STAR: { icon: Star, fg: '#B7791F', bg: '#FFF4D6' },
  WALLET: { icon: Wallet, fg: '#16A34A', bg: '#DCFCE7' },
  BELL: { icon: Bell, fg: '#B7791F', bg: '#FFF4D6' },
  INFO: { icon: Info, fg: '#0B5FFF', bg: '#EAF1FF' },
}
