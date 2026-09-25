import { cn } from "@/lib/utils";
import { clientColor, clientInitials } from "@/lib/clients";
import { logoUrl } from "@/lib/client-logo";

export function ClientAvatar({
  name, logoPath, className,
}: {
  name: string;
  logoPath: string | null;
  className?: string;
}) {
  const url = logoUrl(logoPath);
  if (url) {
    // eslint-disable-next-line @next/next/no-img-element -- public Storage URL, arbitrary host
    return <img src={url} alt={`Logo de ${name}`} className={cn("h-10 w-10 rounded-md object-contain bg-white border", className)} />;
  }
  return (
    <div
      aria-hidden
      className={cn("h-10 w-10 rounded-md flex items-center justify-center text-sm font-semibold text-white", className)}
      style={{ backgroundColor: clientColor(name) }}
    >
      {clientInitials(name)}
    </div>
  );
}
