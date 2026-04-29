export const required = (value) => {
  if (!value && value !== 0) return 'This field is required'
  if (typeof value === 'string' && !value.trim()) return 'This field is required'
  return null
}

export const email = (value) => {
  if (!value) return 'Email is required'
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return 'Invalid email address'
  return null
}

export const minLength = (min) => (value) => {
  if (!value || value.length < min) return `Must be at least ${min} characters`
  return null
}

export const maxLength = (max) => (value) => {
  if (value && value.length > max) return `Must be at most ${max} characters`
  return null
}

export const positiveNumber = (value) => {
  if (!value && value !== 0) return 'This field is required'
  if (isNaN(value) || Number(value) <= 0) return 'Must be a positive number'
  return null
}

export const phoneNumber = (value) => {
  if (!value) return null
  if (!/^[+]?[\d\s\-()]{7,15}$/.test(value)) return 'Invalid phone number'
  return null
}

export function validate(rules, values) {
  const errors = {}
  for (const [field, ruleFns] of Object.entries(rules)) {
    for (const ruleFn of ruleFns) {
      const error = ruleFn(values[field])
      if (error) {
        errors[field] = error
        break
      }
    }
  }
  return errors
}
