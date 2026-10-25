import Link from "next/link";
import { messages } from "@/lib/messages/pt-BR";

export default function NotFound() {
  return (
    <section className="py-24 text-center">
      <h1 className="text-3xl font-bold">{messages.errors.notFoundTitle}</h1>
      <p className="text-muted mt-3">{messages.errors.notFoundBody}</p>
      <Link
        href="/"
        className="bg-accent text-accent-foreground mt-6 inline-flex h-11 items-center rounded-md px-5 font-medium"
      >
        {messages.errors.backHome}
      </Link>
    </section>
  );
}
