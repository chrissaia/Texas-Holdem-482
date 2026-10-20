import type { InputHTMLAttributes } from 'react'

type Props = InputHTMLAttributes<HTMLInputElement> & {
  label: string
  errors?: string[]
}

export function FormField({ label, errors, id, ...props }: Props) {
  return (
    <div className="form-field">
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        aria-invalid={!!errors}
        aria-describedby={errors ? `${id}-error` : undefined}
        {...props}
      />
      {errors && (
        <p className="field-error" id={`${id}-error`}>
          {errors.join(' ')}
        </p>
      )}
    </div>
  )
}
