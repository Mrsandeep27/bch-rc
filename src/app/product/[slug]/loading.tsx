import Loader from "@/components/Loader";

export default function ProductLoading() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4">
      <Loader label="Loading your drift…" />
    </div>
  );
}
