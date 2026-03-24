export default function SectionHeader({ icon, title, subtitle }) {
  return (
    <div className="mb-6">
      <h2 className="flex flex-wrap items-center gap-2 text-xl font-bold sm:text-2xl">
        {icon}
        {title}
      </h2>
      {subtitle ? <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted-foreground">{subtitle}</p> : null}
    </div>
  );
}
