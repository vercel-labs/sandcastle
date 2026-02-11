export function NoWorkspacePlaceholder({ message }: { message: string }) {
  return (
    <div className="flex h-full items-center justify-center bg-background-100">
      <p className="text-label-14 text-gray-900">{message}</p>
    </div>
  );
}
