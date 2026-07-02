interface Props {
  size?: number;
}

export default function LogoLGraph({ size = 64 }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="Letra L"
      role="img"
    >
      {/* Traço vertical mais alto com nó intermediário */}
      <circle cx="16" cy="10" r="6" fill="#FFB800" />
      <path
        d="M16 10V50H38"
        stroke="#FFB800"
        strokeWidth="8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="16" cy="30" r="7" fill="#dea81f" />
      <circle cx="16" cy="50" r="6" fill="#FFB800" />
      <circle cx="44" cy="50" r="6" fill="#FFB800" />

      {/* Ponto final maior, adaptável ao tema */}
      <circle cx="57" cy="50" r="6" fill="var(--foreground)" opacity="0.9" />
    </svg>
  );
}
