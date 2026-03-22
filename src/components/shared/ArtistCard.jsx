import { getImageUrl } from "../../services/spotify";
import MediaCard from "./MediaCard";

export function SpotifyArtistCard({ artist }) {
  const image = getImageUrl(artist.images);

  return (
    <MediaCard
      to={`/artist/${artist.id}`}
      className="card-hover-effect group relative block overflow-hidden rounded-2xl border border-border/50 bg-card"
      artworkClassName="aspect-square overflow-hidden bg-secondary"
      image={image}
      alt={artist.name}
      title={artist.name}
      subtitle={artist.followers?.total ? `${(artist.followers.total / 1e6).toFixed(1)}M seguidores` : ""}
      badge={
        artist.genres?.[0] ? (
          <span className="mb-2 inline-flex rounded-full border border-primary/30 bg-primary/20 px-2.5 py-0.5 text-xs font-semibold capitalize text-white">
            {artist.genres[0]}
          </span>
        ) : null
      }
      overlay={
        <>
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-80" />
          <div className="absolute bottom-0 w-full p-4">
            {artist.genres?.[0] ? (
              <span className="mb-2 inline-flex rounded-full border border-primary/30 bg-primary/20 px-2.5 py-0.5 text-xs font-semibold capitalize text-white">
                {artist.genres[0]}
              </span>
            ) : null}
            <p className="line-clamp-2 text-base font-bold leading-tight text-white transition group-hover:text-primary">{artist.name}</p>
            {artist.followers?.total ? <p className="text-xs text-gray-300">{(artist.followers.total / 1e6).toFixed(1)}M seguidores</p> : null}
          </div>
        </>
      }
      showBody={false}
    />
  );
}

export function LocalArtistCard({ artist }) {
  return (
    <MediaCard
      to={`/artist/${artist.id}`}
      className="group block"
      artworkClassName="relative mb-3 aspect-square overflow-hidden rounded-2xl"
      image={artist.image}
      alt={artist.name}
      title={artist.name}
      subtitle={artist.genre}
      overlay={<div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 transition group-hover:opacity-100" />}
      imageRounded="rounded-2xl"
    />
  );
}
