export function SectionHeader({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="mb-4 flex items-start justify-between">
      <div>
        <h2 className="text-copy-13 font-medium text-gray-1000">{title}</h2>
        {description && (
          <p className="mt-0.5 text-copy-13 text-gray-900">{description}</p>
        )}
      </div>
      {children}
    </div>
  );
}
