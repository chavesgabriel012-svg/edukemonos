export function NotReviewer({ email }: { email: string | undefined }) {
  return (
    <div className="max-w-prose space-y-2 rounded-lg border p-4">
      <h1 className="text-xl font-semibold">Necesitas permiso de revisor</h1>
      <p className="text-sm text-muted-foreground">
        Entraste como {email ?? "usuario"}, pero tu cuenta no tiene el rol de revisor. Pídele a la persona
        administradora que te lo asigne.
      </p>
    </div>
  );
}
