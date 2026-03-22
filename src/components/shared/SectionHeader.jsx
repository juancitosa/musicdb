export default function SectionHeader({ icon, title, subtitle }) {
  return (
    <div className="mb-6">
      <h2 className="flex items-center gap-2 text-2xl font-bold">
        {icon}
        {title}
      </h2>
      {subtitle ? <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p> : null}
    </div>
  );
}
