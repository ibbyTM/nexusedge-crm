import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Eyebrow } from "@/components/crm/primitives";

export default function NotFound() {
	return (
		<main className="mx-auto flex min-h-svh w-full max-w-md flex-col items-center justify-center gap-4 px-4 text-center">
			<Eyebrow>404</Eyebrow>
			<h1 className="font-heading font-medium text-2xl">That page does not exist</h1>
			<p className="text-muted-foreground text-sm">The link may be old, or the record was removed.</p>
			<Button asChild>
				<Link href="/">Back to the dashboard</Link>
			</Button>
		</main>
	);
}
