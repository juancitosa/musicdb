import clsx from "clsx";

const variants = {
  default: "bg-primary text-primary-foreground hover:bg-primary/90",
  secondary: "bg-secondary text-foreground hover:bg-secondary/80",
  ghost: "bg-transparent text-foreground hover:bg-secondary/70",
  destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
  spotify: "bg-[#1DB954] text-white hover:bg-[#1ed760] shadow-lg shadow-[#1DB954]/25",
};

const sizes = {
  default: "px-4 py-2.5 text-sm",
  lg: "px-6 py-3 text-base",
  icon: "h-10 w-10",
};

export default function Button({
  children,
  className,
  variant = "default",
  size = "default",
  ...props
}) {
  return (
    <button
      className={clsx(
        "inline-flex items-center justify-center gap-2 rounded-full font-semibold transition-all disabled:cursor-not-allowed disabled:opacity-50",
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}
