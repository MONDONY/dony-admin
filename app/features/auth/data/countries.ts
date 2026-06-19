export interface Country {
  code: string
  flag: string
  name: string
  dial: string
}

export const COUNTRIES: Country[] = [
  { code: 'FR', flag: '🇫🇷', name: 'France',        dial: '+33'  },
  { code: 'SN', flag: '🇸🇳', name: 'Sénégal',       dial: '+221' },
  { code: 'CI', flag: '🇨🇮', name: "Côte d'Ivoire", dial: '+225' },
  { code: 'ML', flag: '🇲🇱', name: 'Mali',          dial: '+223' },
  { code: 'CM', flag: '🇨🇲', name: 'Cameroun',      dial: '+237' },
  { code: 'GN', flag: '🇬🇳', name: 'Guinée',        dial: '+224' },
]
