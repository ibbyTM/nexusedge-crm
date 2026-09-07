import type { Metadata } from "next";
import { Suspense } from "react";

import { ContactDetail } from "@/components/crm/contact-detail";

export const metadata: Metadata = { title: "Contact" };

// The static export cannot render /contacts/[id], so the id travels in the
// query string (same pattern as the site's /proposal?slug= page).
export default function ContactViewPage() {
	return (
		<Suspense fallback={null}>
			<ContactDetail />
		</Suspense>
	);
}
