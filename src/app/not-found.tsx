import Link from "next/link";
import { errors } from "@/lib/copy/en-GB";

export default function NotFound() {
  return (
    <main className="mx-auto max-w-sm px-4 py-24 text-center">
      <p className="font-medium">{errors.notFound}</p>
      <Link href="/" className="mt-6 inline-flex min-h-10 items-center rounded-full bg-surface-2 px-4 text-sm font-medium">
        {errors.home}
      </Link>
    </main>
  );
}
