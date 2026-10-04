import type { ButtonHTMLAttributes, ReactNode } from 'react'

type Variant = 'primary' | 'secondary' | 'accent' | 'danger' | 'ghost'
type Size = 'md' | 'lg' | 'xl' | 'sm'

const variants: Record<Variant, string> = {
  primary: 'bg-black text-white border-black hover:bg-neutral-800 active:bg-neutral-700',
  secondary: 'bg-white text-black border-black hover:bg-neutral-100 active:bg-neutral-200',
  accent: 'bg-accent text-black border-accent hover:bg-accent-deep hover:text-white active:bg-accent-deep',
  danger: 'bg-white text-red-700 border-red-700 hover:bg-red-50 active:bg-red-100',
  ghost: 'bg-transparent text-black border-transparent hover:bg-neutral-100 active:bg-neutral-200',
}
const sizes: Record<Size, string> = {
  sm: 'min-h-10 px-3 text-sm',
  md: 'min-h-12 px-4 text-base',
  lg: 'min-h-14 px-5 text-lg',
  xl: 'min-h-16 px-6 text-xl',
}

export function Button({
  variant = 'primary', size = 'md', className = '', children, ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size }) {
  return (
    <button
      type="button"
      {...rest}
      className={`inline-flex items-center justify-center gap-2 rounded-xl border-2 font-semibold transition
        disabled:cursor-not-allowed disabled:opacity-40 ${variants[variant]} ${sizes[size]} ${className}`}
    >
      {children}
    </button>
  )
}

export function Field({ label, children, hint, className = '' }: { label: string; children: ReactNode; hint?: string; className?: string }) {
  return (
    <div className={className}>
      <label className="lbl">{label}</label>
      {children}
      {hint && <p className="mt-1 text-sm text-neutral-500">{hint}</p>}
    </div>
  )
}

export function PageHeader({ title, right, sub }: { title: string; right?: ReactNode; sub?: string }) {
  return (
    <div className="mb-4">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="font-brand text-3xl font-bold leading-tight">{title}</h1>
          {sub && <p className="text-sm text-neutral-600">{sub}</p>}
        </div>
        {right && <div className="shrink-0">{right}</div>}
      </div>
      <div className="dots mt-2 h-2 rounded-full" />
    </div>
  )
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-2xl border-2 border-black bg-white p-4 ${className}`}>{children}</div>
}

export function Badge({ children, tone = 'black' }: { children: ReactNode; tone?: 'black' | 'rose' | 'gray' | 'green' | 'red' | 'outline' }) {
  const tones = {
    black: 'bg-black text-white',
    rose: 'bg-accent text-black',
    gray: 'bg-neutral-200 text-neutral-800',
    green: 'bg-green-600 text-white',
    red: 'bg-red-600 text-white',
    outline: 'border border-black text-black',
  }
  return <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-bold uppercase tracking-wide ${tones[tone]}`}>{children}</span>
}

export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="dots-light rounded-2xl border-2 border-dashed border-neutral-300 p-8 text-center">
      <p className="text-lg font-semibold">{title}</p>
      {children && <div className="mt-2 text-neutral-600">{children}</div>}
    </div>
  )
}

export function Spinner({ label = 'Loading…' }: { label?: string }) {
  return <div className="py-10 text-center text-neutral-500">{label}</div>
}

/** Segmented filter control. */
export function Segmented<T extends string>({ value, onChange, options, className = '' }: {
  value: T; onChange: (v: T) => void; options: { value: T; label: string }[]; className?: string
}) {
  return (
    <div className={`inline-flex overflow-hidden rounded-xl border-2 border-black ${className}`}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={`min-h-11 px-3 text-sm font-semibold ${value === o.value ? 'bg-black text-white' : 'bg-white text-black hover:bg-neutral-100'}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function Bow({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
      <path d="M12 12c-1.5-2.5-5-5-8.5-4.5C1 8 1 13 3 14.5c2.5 2 6.5.5 9-2.5 2.5 3 6.5 4.5 9 2.5 2-1.5 2-6.5-.5-7C17 7 13.5 9.5 12 12Zm0 0c-1 1.5-1 3-1 4.5 0 1.5 2 1.5 2 0 0-1.5 0-3-1-4.5Z" />
      <circle cx="12" cy="12" r="1.6" fill="#fff" />
    </svg>
  )
}

export function Logo({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const s = size === 'lg' ? 'text-4xl' : size === 'sm' ? 'text-xl' : 'text-2xl'
  return (
    <div className="flex items-center gap-2">
      <img src="/logo.svg" alt="" className={size === 'lg' ? 'h-14 w-14' : size === 'sm' ? 'h-8 w-8' : 'h-10 w-10'} />
      <div className="leading-none">
        <div className={`font-brand font-bold ${s}`}>The Inkwell</div>
        <div className="flex items-center gap-1 text-xs font-semibold uppercase tracking-[0.2em] text-neutral-600">
          Focal Pens <Bow className="h-3.5 w-3.5 text-accent" />
        </div>
      </div>
    </div>
  )
}
