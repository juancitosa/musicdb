import { Link } from "react-router-dom";

import Button from "../ui/Button";

export default function AuthCard({
  title,
  subtitle,
  submitLabel,
  onSubmit,
  fields,
  footerText,
  footerLink,
  footerLabel,
}) {
  return (
    <div className="mx-auto w-full max-w-md rounded-3xl border border-border bg-card p-8 shadow-2xl shadow-black/10">
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-bold">{title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{subtitle}</p>
      </div>

      <form onSubmit={onSubmit} className="space-y-4">
        {fields}
        <Button type="submit" className="w-full" size="lg">
          {submitLabel}
        </Button>
      </form>

      {footerText && footerLink && footerLabel ? (
        <p className="mt-6 text-center text-sm text-muted-foreground">
          {footerText}{" "}
          <Link to={footerLink} className="font-semibold text-primary hover:underline">
            {footerLabel}
          </Link>
        </p>
      ) : null}
    </div>
  );
}
