import Button from "../ui/Button";

function SpotifyLogo({ className = "h-4 w-4" }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="currentColor">
      <path d="M12 0a12 12 0 1 0 0 24 12 12 0 0 0 0-24Zm5.51 17.32a.75.75 0 0 1-1.03.24c-2.81-1.71-6.34-2.08-10.5-1.11a.75.75 0 0 1-.34-1.46c4.56-1.05 8.48-.63 11.62 1.28.35.22.46.68.25 1.05Zm1.47-3.27a.94.94 0 0 1-1.29.31c-3.21-1.92-8.1-2.48-11.9-1.35a.94.94 0 1 1-.54-1.79c4.2-1.27 9.53-.65 13.4 1.67.44.26.58.84.33 1.16Zm.13-3.4c-3.85-2.29-10.19-2.5-13.86-1.39a1.13 1.13 0 1 1-.65-2.16c4.2-1.27 11.17-1.03 15.66 1.63a1.13 1.13 0 1 1-1.15 1.92Z" />
    </svg>
  );
}

export default function SpotifyConnectButton({
  children = "Conectar Spotify",
  className,
  size = "default",
  ...props
}) {
  return (
    <Button
      variant="spotify"
      size={size}
      className={`group shrink-0 whitespace-nowrap ${className ?? ""}`}
      {...props}
    >
      <SpotifyLogo className={`${size === "lg" ? "h-5 w-5" : "h-4 w-4"} transition group-hover:rotate-12`} />
      {children}
    </Button>
  );
}
