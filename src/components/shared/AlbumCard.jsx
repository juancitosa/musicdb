import { getMockArtist } from "../../services/catalog";
import { getImageUrl } from "../../services/spotify";
import MediaCard from "./MediaCard";

export function SpotifyAlbumCard({ album }) {
  const image = getImageUrl(album.images);
  const year = album.release_date?.split("-")[0] ?? "";
  const artistName = album.artists?.[0]?.name ?? "";

  return (
    <MediaCard
      to={`/album/${album.id}`}
      className="card-hover-effect group flex flex-col rounded-2xl border border-border/50 bg-card p-3"
      artworkClassName="mb-3 aspect-square rounded-xl bg-secondary"
      image={image}
      alt={album.name}
      title={album.name}
      subtitle={`${artistName}${year ? ` · ${year}` : ""}`}
      showPlayOverlay
    />
  );
}

export function LocalAlbumCard({ album, compact = false }) {
  const artist = getMockArtist(album.artistId);

  return (
    <MediaCard
      to={`/album/${album.id}`}
      className={compact ? "group block" : "group flex flex-col rounded-2xl border border-border/50 bg-card p-3"}
      artworkClassName={compact ? "mb-3 aspect-square overflow-hidden rounded-xl shadow-md" : "mb-3 aspect-square overflow-hidden rounded-xl bg-secondary"}
      image={album.coverArt}
      alt={album.title}
      title={album.title}
      subtitle={compact ? `${artist?.name ?? ""} · ${album.year}` : String(album.year)}
    />
  );
}
