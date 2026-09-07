import {
	BellIcon,
	CalendarIcon,
	FlagIcon,
	MailIcon,
	MessageSquareIcon,
	PhoneIcon,
	RefreshCwIcon,
	RocketIcon,
	SendIcon,
	SparklesIcon,
	StarIcon,
	TagIcon,
	UserCheckIcon,
	ZapIcon,
	type LucideIcon,
} from "lucide-react";

export const BUTTON_ICONS: Record<string, LucideIcon> = {
	zap: ZapIcon,
	send: SendIcon,
	mail: MailIcon,
	"message-square": MessageSquareIcon,
	phone: PhoneIcon,
	calendar: CalendarIcon,
	tag: TagIcon,
	sparkles: SparklesIcon,
	rocket: RocketIcon,
	bell: BellIcon,
	flag: FlagIcon,
	"user-check": UserCheckIcon,
	"refresh-cw": RefreshCwIcon,
	star: StarIcon,
};

export function buttonIcon(name: string): LucideIcon {
	return BUTTON_ICONS[name] ?? ZapIcon;
}
