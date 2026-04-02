import { useEffect, useState } from 'react'

export function useBrandedNotification() {
  const [errorMessage, setErrorMessage] = useState('')

  const showError = (message, type = 'error') => {
    if (type === 'success') {
      setErrorMessage(`✅ Brothers Fashion Hub: ${message}`)
      return
    }

    setErrorMessage(`⚠️ Brothers Fashion Hub: ${message}`)
  }

  useEffect(() => {
    if (!errorMessage) {
      return undefined
    }

    const timer = setTimeout(() => setErrorMessage(''), 2500)
    return () => clearTimeout(timer)
  }, [errorMessage])

  return {
    errorMessage,
    showError,
    clearError: () => setErrorMessage(''),
  }
}
