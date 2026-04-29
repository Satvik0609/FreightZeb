export default function Input({
  label,
  error,
  hint,
  icon,
  trailingIcon,
  className = '',
  inputClassName = '',
  required,
  ...props
}) {
  return (
    <div className={`space-y-1 ${className}`}>
      {label && (
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
          {label}
          {required && <span className="text-red-500 ml-0.5">*</span>}
        </label>
      )}
      <div className="relative">
        {icon && (
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
            {icon}
          </div>
        )}
        <input
          className={`
            w-full rounded-lg border bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100
            border-gray-300 dark:border-gray-600
            placeholder:text-gray-400 dark:placeholder:text-gray-500
            focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
            disabled:opacity-50 disabled:bg-gray-50 dark:disabled:bg-gray-800
            transition-colors
            ${icon ? 'pl-10' : 'pl-3'} ${trailingIcon ? 'pr-10' : 'pr-3'} py-2.5 text-sm
            ${error ? 'border-red-500 focus:ring-red-500' : ''}
            ${inputClassName}
          `}
          {...props}
        />
        {trailingIcon && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
            {trailingIcon}
          </div>
        )}
      </div>
      {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
      {hint && !error && <p className="text-xs text-gray-500 dark:text-gray-400">{hint}</p>}
    </div>
  )
}

export function Textarea({ label, error, hint, className = '', required, ...props }) {
  return (
    <div className={`space-y-1 ${className}`}>
      {label && (
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
          {label}
          {required && <span className="text-red-500 ml-0.5">*</span>}
        </label>
      )}
      <textarea
        className={`
          w-full rounded-lg border bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100
          border-gray-300 dark:border-gray-600
          placeholder:text-gray-400 dark:placeholder:text-gray-500
          focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
          disabled:opacity-50 disabled:bg-gray-50
          transition-colors px-3 py-2.5 text-sm resize-none
          ${error ? 'border-red-500 focus:ring-red-500' : ''}
        `}
        {...props}
      />
      {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
      {hint && !error && <p className="text-xs text-gray-500 dark:text-gray-400">{hint}</p>}
    </div>
  )
}
