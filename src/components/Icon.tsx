import type { SVGProps } from 'react'

const PATHS: Record<string, string> = {
  file: 'M4 2.5h5.5L13 6v7.5H4z M9.5 2.5V6H13',
  folder: 'M2.5 4.5h4l1.5 2h5.5v6.5h-11z',
  search: 'M7.2 12.4a5.2 5.2 0 1 0 0-10.4 5.2 5.2 0 0 0 0 10.4z M11 11l3 3',
  sun: 'M8 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6z M8 1.5v1.6 M8 12.9v1.6 M1.5 8h1.6 M12.9 8h1.6 M3.4 3.4l1.1 1.1 M11.5 11.5l1.1 1.1 M12.6 3.4l-1.1 1.1 M4.5 11.5l-1.1 1.1',
  moon: 'M13.2 9.6A5.6 5.6 0 1 1 6.4 2.8a4.6 4.6 0 0 0 6.8 6.8z',
  text: 'M3 3.5h10 M8 3.5v9 M6 12.5h4',
  width: 'M2 4v8 M14 4v8 M5 8h6 M9.5 6l2 2-2 2 M6.5 6l-2 2 2 2',
  chevron: 'M6 4l4 4-4 4',
  close: 'M4 4l8 8 M12 4l-8 8',
  menu: 'M2.5 4.5h11 M2.5 8h11 M2.5 11.5h11',
  copy: 'M5.5 5.5h7v8h-7z M3.5 10.5v-8h7',
  refresh: 'M13 8a5 5 0 1 1-1.6-3.7 M13 2v3h-3',
  doc: 'M4 2.5h5.5L13 6v7.5H4z',
  columns: 'M2.5 3.5h11v9h-11z M8 3.5v9',
  save: 'M3.5 3.5h6l2.5 2.5v6.5h-8.5z M5.8 3.5v3.2h4v-3.2 M5.8 9.2h4.4',
  book: 'M2.5 3.5h4.2c0 0 .8.6.8 1.4v7.6c0-.8-.8-1.4-1.6-1.4H2.5z M13 3.5H8.8c0 0-.8.6-.8 1.4v7.6c0-.8.8-1.4 1.6-1.4H13z',
}

export interface IconProps extends SVGProps<SVGSVGElement> {
  name: keyof typeof PATHS | string
  size?: number
}

export function Icon({ name, size = 16, ...rest }: IconProps) {
  const d = PATHS[name] ?? PATHS.file
  return (
    <svg
      viewBox="0 0 16 16"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.4}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...rest}
    >
      <path d={d} />
    </svg>
  )
}
