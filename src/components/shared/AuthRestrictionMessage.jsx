export default function AuthRestrictionMessage({ message = "Debes iniciar sesion para realizar esta accion" }) {
  return <p className="text-xs font-medium text-destructive">{message}</p>;
}
