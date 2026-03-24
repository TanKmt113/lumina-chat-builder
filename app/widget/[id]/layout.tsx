import '../../globals.css';

export default function WidgetLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-transparent overflow-hidden">
      {children}
    </div>
  );
}
