import Loader from "@/components/Loader";

export default function RootLoading() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <Loader label="Loading…" />
    </div>
  );
}
