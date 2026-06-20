import { ReactNode } from 'react'

interface PageHeaderProps {
  title: string
  subtitle?: string
  icon?: ReactNode
  actions?: ReactNode
  /** Extra decorative badge/pill shown in hero */
  badge?: string
}

/**
 * Maximalist page header with navy gradient band, dot grid,
 * gold orb decoration, and consistent responsive layout.
 */
export default function PageHeader({ title, subtitle, icon, actions, badge }: PageHeaderProps) {
  return (
    <div
      className="rounded-2xl px-4 py-4 sm:px-7 sm:py-6 mb-4 sm:mb-6 relative overflow-hidden"
      style={{
        background: 'linear-gradient(135deg, #0c0b6e 0%, #100F88 45%, #1a19c0 85%, #2020b8 100%)',
        boxShadow: '0 8px 32px rgba(16,15,136,0.28), 0 2px 8px rgba(16,15,136,0.18)',
      }}
    >
      {/* Dot grid overlay */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.055) 1px, transparent 1px)',
          backgroundSize: '20px 20px',
        }}
      />
      {/* Gold orb — top right */}
      <div
        className="absolute -top-16 -right-16 w-52 h-52 rounded-full pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(255,194,99,0.18) 0%, transparent 70%)' }}
      />
      {/* Small orb — bottom left */}
      <div
        className="absolute -bottom-10 -left-10 w-32 h-32 rounded-full pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(255,194,99,0.10) 0%, transparent 70%)' }}
      />

      <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        {/* Left — title block */}
        <div className="flex items-start sm:items-center gap-4">
          {icon && (
            <div
              className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{
                background: 'linear-gradient(135deg, #FFC263, #f0a832)',
                boxShadow: '0 4px 14px rgba(255,194,99,0.45)',
              }}
            >
              <span style={{ color: '#100F88' }}>{icon}</span>
            </div>
          )}
          <div>
            {badge && (
              <div
                className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-widest mb-1.5"
                style={{ background: 'rgba(255,194,99,0.18)', border: '1px solid rgba(255,194,99,0.32)', color: '#FFC263' }}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                {badge}
              </div>
            )}
            <h1
              className="text-xl sm:text-2xl font-black text-white leading-tight"
              style={{ letterSpacing: '-0.03em' }}
            >
              {title}
            </h1>
            {subtitle && (
              <p className="text-sm mt-0.5 font-medium" style={{ color: 'rgba(255,255,255,0.60)' }}>
                {subtitle}
              </p>
            )}
          </div>
        </div>

        {/* Right — action buttons */}
        {actions && (
          <div className="flex items-center gap-2 flex-wrap self-start sm:self-auto flex-shrink-0">
            {actions}
          </div>
        )}
      </div>
    </div>
  )
}
