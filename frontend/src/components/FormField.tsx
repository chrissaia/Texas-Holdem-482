import type { InputHTMLAttributes } from 'react'

type Props = InputHTMLAttributes<HTMLInputElement> & {
  label: string
  errors?: string[]
  hint?: string
}

export function FormField({ label, errors, hint, id, ...props }: Props) {
  const describedBy =
    [errors && `${id}-error`, hint && `${id}-hint`].filter(Boolean).join(' ') ||
    undefined
  return (
    <div className="form-field">
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        aria-invalid={!!errors}
        aria-describedby={describedBy}
        {...props}
      />
      {hint && (
        <p className="form-hint" id={`${id}-hint`}>
          {hint}
        </p>
      )}
      {errors && (
        <p className="field-error" id={`${id}-error`}>
          {errors.join(' ')}
        </p>
      )}
    </div>
  )
}
