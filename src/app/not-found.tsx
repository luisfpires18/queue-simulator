import Link from "next/link";

export default function NotFound() {
  return (
    <div className="panel p-16 text-center">
      <div className="text-5xl mb-3">💀</div>
      <h1 className="text-2xl font-black">Wiped.</h1>
      <p className="text-gray-400 mt-1">That page depleted the key. Nothing here.</p>
      <Link href="/board" className="btn-gold mt-5 inline-flex">Back to the board</Link>
    </div>
  );
}
