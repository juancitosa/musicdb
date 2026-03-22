import { mockAlbums, mockArtists, mockTracks } from "../data/mockData";

export function getMockArtist(id) {
  return mockArtists.find((artist) => artist.id === id) ?? null;
}

export function getMockAlbum(id) {
  return mockAlbums.find((album) => album.id === id) ?? null;
}

export function getMockArtistAlbums(artistId) {
  return mockAlbums.filter((album) => album.artistId === artistId);
}

export function getMockAlbumTracks(albumId) {
  return mockTracks.filter((track) => track.albumId === albumId);
}

export function searchLocalCatalog(query) {
  const term = query.trim().toLowerCase();

  return {
    artists: mockArtists
      .filter((artist) => artist.name.toLowerCase().includes(term) || artist.genre.toLowerCase().includes(term))
      .map((artist) => ({ ...artist, _type: "artist" })),
    albums: mockAlbums
      .filter((album) => {
        const artist = getMockArtist(album.artistId);

        return (
          album.title.toLowerCase().includes(term) ||
          album.genre.toLowerCase().includes(term) ||
          artist?.name.toLowerCase().includes(term)
        );
      })
      .map((album) => ({ ...album, _type: "album" })),
  };
}
