export function useTheme() {
  const isDark = ref(false)
  let observer: MutationObserver | null = null

  onMounted(() => {
    isDark.value = document.documentElement.classList.contains('dark')

    observer = new MutationObserver(() => {
      isDark.value = document.documentElement.classList.contains('dark')
    })
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    })
  })

  onUnmounted(() => {
    observer?.disconnect()
  })

  return { isDark }
}
