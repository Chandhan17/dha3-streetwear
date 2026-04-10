import { useEffect, useState } from 'react'
import clientConfig from '../config'

export function useBrandedNotification() {
  const [errorMessage, setErrorMessage] = useState('')

  const showError = (message, type = 'error') => {
    if (type === 'success') {
      setErrorMessage(`✅ ${clientConfig.brandName}: ${message}`)
      return
    }

    setErrorMessage(`⚠️ ${clientConfig.brandName}: ${message}`)
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
