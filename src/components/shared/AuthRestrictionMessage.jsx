export default function AuthRestrictionMessage({ message = "Debes iniciar sesión o conectar Spotify para realizar esta acción" }) {
  return <p className="text-xs font-medium text-destructive">{message}</p>;
}
