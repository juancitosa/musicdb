import { Disc3, Play } from "lucide-react";
import { Link } from "react-router-dom";

function MediaArtwork({
  image,
  alt,
  rounded = "rounded-xl",
  showPlayOverlay = false,
  fallbackRounded = "rounded-md",
}) {
  return (
    <div className={`relative overflow-hidden ${rounded}`}>
      {image ? (
        <img src={image} alt={alt} className="h-full w-full object-cover transition duration-500 group-hover:scale-110" />
      ) : (
        <div className={`flex h-full w-full items-center justify-center bg-secondary ${fallbackRounded}`}>
          <Disc3 className="h-10 w-10 text-muted-foreground/30" />
        </div>
      )}

      {showPlayOverlay ? (
        <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition group-hover:opacity-100">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary shadow-lg shadow-primary/40">
            <Play className="h-5 w-5 fill-current text-primary-foreground" />
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default function MediaCard({
  to,
  className,
  artworkClassName,
  image,
  alt,
  title,
  subtitle,
  badge,
  overlay,
  showPlayOverlay = false,
  imageRounded = "rounded-xl",
  showBody = true,
}) {
  return (
    <Link to={to} className={className}>
      <div className={artworkClassName}>
        <MediaArtwork image={image} alt={alt} rounded={imageRounded} showPlayOverlay={showPlayOverlay} />
        {overlay}
      </div>
      {showBody ? (
        <div>
          {badge}
          <p className="truncate text-sm font-semibold transition group-hover:text-primary">{title}</p>
          {subtitle ? <p className="truncate text-xs text-muted-foreground">{subtitle}</p> : null}
        </div>
      ) : null}
    </Link>
  );
}
