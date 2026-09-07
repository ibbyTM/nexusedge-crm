import type { Metadata } from "next";

import { ContactsTable } from "@/components/crm/contacts-table";

export const metadata: Metadata = { title: "Contacts" };

export default function ContactsPage() {
	return <ContactsTable />;
}
